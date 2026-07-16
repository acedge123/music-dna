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
  song_a?: { artist?: string | null } | null;
  song_b?: { artist?: string | null } | null;
};

export type SelectPairingInput<P extends PairingCandidate = PairingCandidate> = {
  pool: P[];
  vector: Vector;
  used_ids: Set<string>;
  session_lane: Lane;
  dims: readonly string[];
  rng: Rng;
};

export type SelectPairingResult<P extends PairingCandidate = PairingCandidate> =
  | { kind: "picked"; pairing: P }
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
    return { p, w };
  });
  const total = scored.reduce((s, x) => s + x.w, 0);
  let r = rng.next() * total;
  const pick = scored.find((x) => (r -= x.w) <= 0) ?? scored[0];
  return { kind: "picked", pairing: pick.p };
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
