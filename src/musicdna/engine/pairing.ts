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

// Recognition data joined from the pairing_recognition view. Optional —
// the selector still works without it (falls back to diagnostic-weight
// scoring). Passed as a lookup keyed by pairing id so callers can hydrate
// the pool from a separate query.
export type RecognitionRow = {
  min_canon: number;
  avg_canon: number;
  recognition_score: number;
};

// Selection mode. Controls how recognition interacts with diagnostic weight:
// - "diagnostic_first": current behaviour, ignore recognition (lane-confident).
// - "recognition_boost": blend recognition and diagnostic weight (uncertain lane).
// - "recognition_first": hard-filter to recognizable pairings, then blend
//   (general lane after bootstrap).
export type SelectionMode =
  | "diagnostic_first"
  | "recognition_boost"
  | "recognition_first";

export type SelectPairingInput<P extends PairingCandidate = PairingCandidate> = {
  pool: P[];
  vector: Vector;
  used_ids: Set<string>;
  session_lane: Lane;
  dims: readonly string[];
  rng: Rng;
  mode?: SelectionMode;
  recognition?: Map<string, RecognitionRow>;
  // Optional override; falls back to RECOGNITION_FLOORS[mode].
  min_canon_floor?: number;
};

// Instrumentation.
export type SelectionReason = {
  leaning_axes: string[];
  fork_matched: boolean;
  tests: string[];
  axes_needed: string[];
  axis_need_score: number;
  challenge_boost: boolean;
  diagnostic_weight: number;
  pool_size: number;
  weight: number;
  mode: SelectionMode;
  recognition_score?: number;
};

// Default recognition floors per mode. Tunable in one place.
export const RECOGNITION_FLOORS: Record<SelectionMode, number> = {
  diagnostic_first: 0,
  recognition_boost: 45,
  recognition_first: 55,
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
  const mode: SelectionMode = input.mode ?? "diagnostic_first";
  const recognition = input.recognition;
  const canonFloor = input.min_canon_floor ?? RECOGNITION_FLOORS[mode];

  let pool = input.pool.filter((p) => !used_ids.has(p.id)).filter(differentArtist);
  if (!pool.length) return { kind: "empty" };

  // Recognition floor: filter out pairings the user probably won't know when
  // we're not lane-confident. If the floor empties the pool, drop it so we
  // still return something rather than nothing.
  if (mode !== "diagnostic_first" && recognition && canonFloor > 0) {
    const recognisable = pool.filter((p) => {
      const r = recognition.get(p.id);
      return r ? r.min_canon >= canonFloor : true; // no data = don't exclude
    });
    if (recognisable.length > 0) pool = recognisable;
  }

  // Hypothesis-challenging filter: prefer pairings that test the axes the
  // running vector already leans hardest on.
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
  // Blend factor for recognition vs diagnostic weight.
  // recognition_first: recognition dominates (0.6 / 0.4).
  // recognition_boost: balanced-ish (0.4 / 0.6).
  const recogBlend = mode === "recognition_first" ? 0.6 : mode === "recognition_boost" ? 0.4 : 0;
  const scored = pool.map((p) => {
    const tests = (p.tests?.length ? p.tests : dims.slice()) as string[];
    const axisNeed = tests.reduce((s, d) => s + need(d), 0) / Math.max(1, tests.length);
    const challengesHypothesis = leaningAxes.size > 0 && tests.some((t) => leaningAxes.has(t));
    const challengeBoost = challengesHypothesis ? 1.5 : 1;
    const dw = (p.diagnostic_weight ?? 50) / 100;
    const rec = recognition?.get(p.id);
    const recNorm = rec ? Math.max(0, Math.min(100, rec.recognition_score)) / 100 : 0.5;
    const base = recogBlend > 0
      ? (recogBlend * recNorm + (1 - recogBlend) * dw)
      : dw;
    const w = base * (0.4 + 0.6 * axisNeed) * challengeBoost;
    return { p, w, tests, axisNeed, challengesHypothesis, rec };
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
    mode,
    recognition_score: pick.rec?.recognition_score,
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
