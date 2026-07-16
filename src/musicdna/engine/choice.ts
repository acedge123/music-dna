// Pure choice-application math.
//
// Given a pairing, the winner/loser vectors, and the session's running
// vector, produce the delta vector, the updated vector, and the topline
// dimension/delta the reveal builder uses. Also owns the probe-lane
// alignment math (cosine + magnitude → win/flip decision).
//
// No I/O. No LLM. Deterministic. Web server-fns and REST routes both feed
// data in and take the result out; there is one implementation.

import type { Vector, Lane } from "./types";

export type SongVector = Record<string, number>;

export type ApplyChoiceInput = {
  prior_vector: Vector;
  winner: SongVector;
  loser: SongVector;
  tests: string[];
  diagnostic_weight: number | null; // 0..100, defaults to 50
  fallback_dims: readonly string[];
};

export type ApplyChoiceResult = {
  vector: Vector; // prior + weighted delta
  delta_vector: Vector; // per-axis raw delta (winner - loser)
  top_dim: string;
  top_delta: number; // signed
};

export function applyChoice(input: ApplyChoiceInput): ApplyChoiceResult {
  const w = (input.diagnostic_weight ?? 50) / 100;
  const priorVec: Vector = { ...input.prior_vector };
  const vec: Vector = { ...priorVec };
  const tests = input.tests?.length ? input.tests : (input.fallback_dims.slice() as string[]);
  let top_dim = tests[0] ?? "movement";
  let top_delta = 0;
  const delta_vector: Vector = {};
  for (const dim of tests) {
    const a = input.winner?.[dim] ?? 50;
    const b = input.loser?.[dim] ?? 50;
    const delta = a - b;
    delta_vector[dim] = delta;
    vec[dim] = (vec[dim] ?? 0) + delta * w;
    if (Math.abs(delta) > Math.abs(top_delta)) {
      top_delta = delta;
      top_dim = dim;
    }
  }
  return { vector: vec, delta_vector, top_dim, top_delta };
}

// ---- Probe alignment ----
//
// When we've been silently probing a candidate lane, each choice on a probe
// pairing votes for/against flipping to that lane. Cosine alignment between
// the choice delta and the running vector tells us "does this lane reward
// what you already reward?"

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
