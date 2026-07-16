// EXPERIMENTAL — cross-lane probe flipping.
//
// STATUS: quarantined. NOT wired into createEngine() or any live server
// function. Do not import from `src/lib/musicdna.functions.ts`, `src/routes/`,
// or `src/musicdna/engine/index.ts`. See:
//   docs/musicdna/experiments/cross-lane-probes.md   ← why and re-activation criteria
//   mem://product/within-lane-only.md                ← the product invariant this violates
//
// What it does
// ------------
// When probe pairings from a candidate lane (not the user's current lane) are
// pending, this scores per-choice alignment (cosine of delta vs. running
// vector, plus signal magnitude) and, after enough aligned wins, silently
// flips the session lane. That contradicts the current product thesis:
// dimensions are scoped WITHIN the user's lane; cross-lane equivalence is
// not claimed. See mem://product/within-lane-only.md.
//
// Why it stays in the repo
// ------------------------
// The math is sound and worth keeping for the day cross-lane resonance is
// actually part of the product. Deleting it would waste the calibration
// work; leaving it in the live engine would let it silently reactivate.
// This module is the safe middle: importable from experiments and admin
// spikes, invisible to the shipped engine surface.
//
// Reactivation criteria (do not enable without ALL of these):
//   1. Product decision to reintroduce cross-lane suggestions.
//   2. Calibration data proving flip thresholds (win_cosine_threshold,
//      flip_min_total, flip_min_win_rate, flip_min_avg_cosine) don't
//      whiplash users on noise.
//   3. UX for the flip event (silent flip is currently unacceptable — the
//      user should at minimum see the reframe).
//   4. The invariant guard in `nextPairingImpl` (`probe_state.pending`
//      must be empty) is intentionally lifted, with tests covering the
//      lifted path.

import type { Vector, Lane } from "../types";

export type ProbeLaneTally = {
  wins: number;
  total: number;
  magnitude: number;
  cosine_sum: number;
};

export type ProbeState = {
  probes_shown: Array<{ round: number; pairing_id: string; lane: Lane }>;
  pending: Record<string, Lane>;
  lane_alignment: Record<string, ProbeLaneTally>;
  flips: Array<{ round: number; from: Lane; to: Lane; reason: string }>;
};

export type EvaluateProbeInput = {
  pairing_id: string;
  probe_state: ProbeState;
  session_lane: Lane;
  delta_vector: Vector;
  prior_vector: Vector;
  tests: string[];
  // Thresholds for flipping (tunable in one place).
  win_cosine_threshold?: number;
  flip_min_total?: number;
  flip_min_win_rate?: number;
  flip_min_avg_cosine?: number;
};

export type EvaluateProbeResult = {
  probe_state: ProbeState;
  next_lane: Lane;
  probe_lane: Lane | null;
  cosine: number;
  magnitude: number;
  win: 0 | 1;
  flipped: boolean;
  flip_reason?: string;
  flip_summary?: { win_rate: number; avg_cosine: number };
};

function cloneProbeState(s: ProbeState | null | undefined): ProbeState {
  return {
    probes_shown: s?.probes_shown ?? [],
    pending: { ...(s?.pending ?? {}) },
    lane_alignment: { ...(s?.lane_alignment ?? {}) },
    flips: [...(s?.flips ?? [])],
  };
}

export function evaluateProbe(input: EvaluateProbeInput): EvaluateProbeResult {
  const probe_state = cloneProbeState(input.probe_state);
  const probe_lane = probe_state.pending[input.pairing_id] ?? null;
  if (!probe_lane) {
    return {
      probe_state,
      next_lane: input.session_lane,
      probe_lane: null,
      cosine: 0,
      magnitude: 0,
      win: 0,
      flipped: false,
    };
  }

  const keys = Object.keys(input.delta_vector);
  let dot = 0;
  let magD = 0;
  let magV = 0;
  for (const k of keys) {
    const d = input.delta_vector[k] ?? 0;
    const v = input.prior_vector[k] ?? 0;
    dot += d * v;
    magD += d * d;
    magV += v * v;
  }
  const cosine = magD > 0 && magV > 0 ? dot / (Math.sqrt(magD) * Math.sqrt(magV)) : 0;
  const magnitude = input.tests.reduce((s, dim) => s + Math.abs(input.delta_vector[dim] ?? 0), 0);
  const winThresh = input.win_cosine_threshold ?? 0.2;
  const win: 0 | 1 = cosine >= winThresh ? 1 : 0;

  const prev = probe_state.lane_alignment[probe_lane] ?? {
    wins: 0,
    total: 0,
    magnitude: 0,
    cosine_sum: 0,
  };
  probe_state.lane_alignment[probe_lane] = {
    wins: prev.wins + win,
    total: prev.total + 1,
    magnitude: prev.magnitude + magnitude,
    cosine_sum: prev.cosine_sum + cosine,
  };
  probe_state.probes_shown.push({
    round: probe_state.probes_shown.length + 1,
    pairing_id: input.pairing_id,
    lane: probe_lane,
  });
  delete probe_state.pending[input.pairing_id];

  const tally = probe_state.lane_alignment[probe_lane];
  const win_rate = tally.total ? tally.wins / tally.total : 0;
  const avg_cosine = tally.total ? tally.cosine_sum / tally.total : 0;
  const flipMinTotal = input.flip_min_total ?? 2;
  const flipMinWin = input.flip_min_win_rate ?? 0.75;
  const flipMinCos = input.flip_min_avg_cosine ?? 0.3;
  const alreadyFlipped = probe_state.flips.some((f) => f.to === probe_lane);
  if (tally.total >= flipMinTotal && win_rate >= flipMinWin && avg_cosine >= flipMinCos && !alreadyFlipped) {
    const reason = `probe lane ${probe_lane}: ${tally.wins}/${tally.total} wins, avg cosine ${avg_cosine.toFixed(2)}`;
    probe_state.flips.push({
      round: probe_state.probes_shown.length,
      from: input.session_lane,
      to: probe_lane,
      reason,
    });
    return {
      probe_state,
      next_lane: probe_lane,
      probe_lane,
      cosine,
      magnitude,
      win,
      flipped: true,
      flip_reason: reason,
      flip_summary: { win_rate, avg_cosine },
    };
  }
  return {
    probe_state,
    next_lane: input.session_lane,
    probe_lane,
    cosine,
    magnitude,
    win,
    flipped: false,
  };
}
