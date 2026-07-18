// Pure pairing-selection logic.
//
// nextPairingImpl fetches candidate pairings from Supabase and filters them
// down to the one we'll ask the user next. This module owns the "which
// pairing do we pick given the current session state?" question — the same
// question the web server-fn and the /api/v1 route both need answered
// identically. No I/O; the caller loads the pool and passes it in.

import type { Rng } from "./ports";
import type { Vector, Lane } from "./types";

export type PairingCandidate = {
  id: string;
  lane?: string | null;
  tests: string[] | null;
  diagnostic_weight: number | null;
  song_a?: { artist?: string | null; canon_score?: number | null; year?: number | null } | null;
  song_b?: { artist?: string | null; canon_score?: number | null; year?: number | null } | null;
};

export type SelectPairingInput<P extends PairingCandidate = PairingCandidate> = {
  pool: P[];
  vector: Vector;
  used_ids: Set<string>;
  session_lane: Lane;
  dims: readonly string[];
  rng: Rng;
};

// Instrumentation: capture WHY this pairing beat its neighbours so the
// `pairing_shown` / `choice_scored` events can later answer "did we test
// the axis we most needed to test?" without re-running the selector.
export type SelectionReason = {
  leaning_axes: string[];          // axes the running vector already leans hard on
  fork_matched: boolean;           // did we pick from the fork-pool (leaning-axis filter)?
  tests: string[];                 // dims this pairing actually tests
  axes_needed: string[];           // subset of `tests` where the running vector is weak
  axis_need_score: number;         // 0..1, mean of 1/(1+|v|) across tests
  challenge_boost: boolean;        // was the 1.5x boost applied?
  diagnostic_weight: number;       // 0..100 (defaulted to 50 when null)
  pool_size: number;               // eligible pool size after filters
  weight: number;                  // final scoring weight for the winner
};

export type SelectPairingResult<P extends PairingCandidate = PairingCandidate> =
  | { kind: "picked"; pairing: P; selection_reason: SelectionReason }
  | { kind: "empty" };

export function shouldStop(input: {
  round: number;
  vector: Vector;
  dims: readonly string[];
  min_rounds?: number;
  confidence_threshold?: number;
  axis_confidence_threshold?: number;
}): { done: boolean; confidence: number; confident_axes: number } {
  const minRounds = input.min_rounds ?? 12;
  const confThresh = input.confidence_threshold ?? 0.6;
  const axisConf = input.axis_confidence_threshold ?? 30;
  const confident_axes = input.dims.filter(
    (d) => Math.abs(input.vector[d] ?? 0) >= axisConf,
  ).length;
  const confidence = confident_axes / input.dims.length;
  return { done: input.round >= minRounds && confidence >= confThresh, confidence, confident_axes };
}

// Same-artist matchups aren't lane decisions — they're micro-comparisons
// inside one artist's catalog. Drop them from the general selection pool.
function differentArtist<P extends PairingCandidate>(p: P): boolean {
  const a = (p.song_a?.artist ?? "").trim().toLowerCase();
  const b = (p.song_b?.artist ?? "").trim().toLowerCase();
  return a !== "" && b !== "" && a !== b;
}

// Filter/score pipeline for the next pairing. Deterministic given rng.
// Returns { kind: "empty" } when nothing in the pool is eligible.
export function selectPairing<P extends PairingCandidate>(
  input: SelectPairingInput<P>,
): SelectPairingResult<P> {
  const { vector, used_ids, dims, rng } = input;
  let pool = input.pool.filter((p) => !used_ids.has(p.id)).filter(differentArtist);
  if (!pool.length) return { kind: "empty" };

  // Hypothesis-challenging filter: prefer pairings that test the axes the
  // running vector already leans hardest on. If filtering would empty the
  // pool, fall back to a scoring boost.
  const leaningAxes = new Set(
    dims
      .map((d) => ({ d, v: Math.abs(vector[d] ?? 0) }))
      .filter((x) => x.v >= 15)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => x.d),
  );
  const testsFork = (p: P) => {
    const tests = (p.tests ?? []) as string[];
    return tests.some((t) => leaningAxes.has(t));
  };
  if (leaningAxes.size > 0) {
    const forkPool = pool.filter(testsFork);
    if (forkPool.length > 0) pool = forkPool;
  }

  const need = (dim: string) => 1 / (1 + Math.abs(vector[dim] ?? 0));
  const scored = pool.map((p) => {
    const tests = (p.tests?.length ? p.tests : dims.slice()) as string[];
    const axisNeed = tests.reduce((s, d) => s + need(d), 0) / Math.max(1, tests.length);
    const challengesHypothesis = leaningAxes.size > 0 && tests.some((t) => leaningAxes.has(t));
    const challengeBoost = challengesHypothesis ? 1.5 : 1;
    const w = ((p.diagnostic_weight ?? 50) / 100) * (0.4 + 0.6 * axisNeed) * challengeBoost;
    return { p, w, tests, axisNeed, challengesHypothesis };
  });
  const total = scored.reduce((s, x) => s + x.w, 0);
  let r = rng.next() * total;
  const pick = scored.find((x) => (r -= x.w) <= 0) ?? scored[0];
  const pickedTests = pick.tests;
  const axesNeeded = pickedTests.filter((d) => Math.abs(vector[d] ?? 0) < 15);
  const selection_reason: SelectionReason = {
    leaning_axes: Array.from(leaningAxes),
    fork_matched: leaningAxes.size > 0 && pickedTests.some((t) => leaningAxes.has(t)),
    tests: pickedTests,
    axes_needed: axesNeeded,
    axis_need_score: Math.round(pick.axisNeed * 1000) / 1000,
    challenge_boost: pick.challengesHypothesis,
    diagnostic_weight: pick.p.diagnostic_weight ?? 50,
    pool_size: pool.length,
    weight: Math.round(pick.w * 1000) / 1000,
  };
  return { kind: "picked", pairing: pick.p, selection_reason };
}

// Guard used by the route/server-fn to fail loud if we ever pick a pairing
// outside the session's lane. Never mutate; throw at the caller.
export function assertWithinLane(pickedLane: string | null | undefined, sessionLane: Lane): void {
  if (
    sessionLane !== "general" &&
    pickedLane &&
    pickedLane !== sessionLane &&
    pickedLane !== "general"
  ) {
    throw new Error(
      `within-lane invariant violated: picked lane="${pickedLane}" for session lane="${sessionLane}". ` +
        `See mem://product/within-lane-only.md.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Calibration pairing selection.
//
// Rounds 1–2 aren't scoring aesthetic dimensions — they're deciding which lane
// to lock into. We pick pairings that are:
//   1. within the candidate lanes derived from the user's opening 3 songs
//   2. as recognizable as possible (sum of both songs' canon_score)
//   3. near the user's opening decade clusters (soft bonus)
// This uses ONLY existing columns (canon_score, year) — no schema/data adds.
export type CalibrationSelectInput<P extends PairingCandidate = PairingCandidate> = {
  pool: P[];
  used_ids: Set<string>;
  candidate_lanes: string[];
  decade_clusters: string[]; // ["1980s", ...]
  rng: Rng;
};
export type CalibrationSelectResult<P extends PairingCandidate = PairingCandidate> =
  | { kind: "picked"; pairing: P; reason: { candidate_lanes: string[]; recognizability: number; decade_bonus: number } }
  | { kind: "empty" };

function decadeOf(year: number | null | undefined): string | null {
  if (!year || !Number.isFinite(year) || year < 1900) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

export function selectCalibrationPairing<P extends PairingCandidate>(
  input: CalibrationSelectInput<P>,
): CalibrationSelectResult<P> {
  const laneSet = new Set(input.candidate_lanes);
  const decadeSet = new Set(input.decade_clusters);
  const pool = input.pool
    .filter((p) => !input.used_ids.has(p.id))
    .filter((p) => (p.lane ? laneSet.has(p.lane) : false))
    .filter(differentArtist);
  if (!pool.length) return { kind: "empty" };

  const scored = pool.map((p) => {
    const canonA = Number(p.song_a?.canon_score ?? 50);
    const canonB = Number(p.song_b?.canon_score ?? 50);
    const recognizability = (canonA + canonB) / 200; // 0..1
    const decA = decadeOf(p.song_a?.year ?? null);
    const decB = decadeOf(p.song_b?.year ?? null);
    const decade_bonus =
      (decA && decadeSet.has(decA) ? 0.15 : 0) + (decB && decadeSet.has(decB) ? 0.15 : 0);
    // Weight: recognizability drives it; decade nudges. Small jitter so ties
    // don't always resolve the same way.
    const w = recognizability + decade_bonus + input.rng.next() * 0.05;
    return { p, w, recognizability, decade_bonus };
  });
  scored.sort((a, b) => b.w - a.w);
  const pick = scored[0];
  return {
    kind: "picked",
    pairing: pick.p,
    reason: {
      candidate_lanes: input.candidate_lanes,
      recognizability: Math.round(pick.recognizability * 1000) / 1000,
      decade_bonus: Math.round(pick.decade_bonus * 1000) / 1000,
    },
  };
}
