// Pure mapper: session state → TerrainFeatures.
//
// Consumes `event_log` history (already-persisted `choice_scored` events),
// session-level lane_confidence, and probe_state skips. Produces the
// terrain input expected by scoreTerrain. No I/O — caller loads rows and
// passes them in.
//
// This module is the boundary the review's refinements landed on:
//   • #4 delta_vector is sourced from event_log.props.raw_delta.
//   • #5 skips feed uncertainty/ruggedness as high-uncertainty observations.
//   • #7 artist bias + snap-decision use the same definitions finalizeSession
//     already applies (>=3 per artist; ms_to_decide < 2000 at >=60%).

export type ChoiceEventRow = {
  round: number;
  raw_delta: Record<string, number> | null | undefined;
  chosen_artist?: string | null;
  ms_to_decide?: number | null;
};

export type TerrainInputs = {
  lane_confidence: number;      // 0..1
  round: number;                // rounds completed (0-based; = choices.length)
  max_rounds: number;           // 6 for web today
  choices: ChoiceEventRow[];    // ordered oldest→newest, only real choices (not skips)
  skipped_rounds_last3: number; // number of skips in the last 3 attempted rounds
};

export type TrinaryLow = "low" | "medium" | "high";
export type TerrainFeatures = {
  // Constants for MusicDNA today (see D2 of the integration plan).
  feedback_latency: "fast";
  reversibility: "medium";               // Refinement #1: corrected from "high".
  adversariality: "none";
  information_cost: "medium";            // Refinement #1: corrected from "low".
  coordination_load: "low";
  environment_stability: "stable";
  time_horizon: "iterative";
  // Derived from session state:
  uncertainty: TrinaryLow;
  ruggedness: TrinaryLow;
  local_minima_risk: TrinaryLow;
  branching_factor: TrinaryLow;
  mode_pressure: "explore" | "prune" | "compound" | "coordinate" | "none";
  // Instrumentation only — not scored.
  derived: {
    lane_confidence: number;
    delta_volatility: number | null; // stddev of |raw_delta| across recent choices; null if <2 samples
    delta_samples: number;
    artist_bias_share: number;       // max share of a single artist among winners; 0..1
    snap_share: number;              // share of ms_to_decide < 2000
    skips_last3: number;
    round_position: number;          // round / max_rounds
  };
};

// Refinement #7: mirror finalizeSession's constants so the router and the
// reveal agree on when to flag bias / snap-decisions.
const SNAP_MS = 2000;
const SNAP_SHARE_HI = 0.6;
const ARTIST_BIAS_N = 3;

// Vector L2 magnitude — captures direction, not just size.
function vecMag(v: Record<string, number> | null | undefined): number | null {
  if (!v) return null;
  let sumSq = 0;
  let count = 0;
  for (const raw of Object.values(v)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    sumSq += n * n;
    count += 1;
  }
  return count === 0 ? null : Math.sqrt(sumSq);
}

// Successive-delta drift: L2 distance between consecutive raw_delta vectors.
// A sequence like +50/-50/+50 (same magnitude, flipped direction) still
// registers as rugged because each step moves ~2×|delta| in axis space.
function stepDistances(deltas: Array<Record<string, number> | null | undefined>): number[] {
  const steps: number[] = [];
  for (let i = 1; i < deltas.length; i++) {
    const a = deltas[i - 1];
    const b = deltas[i];
    if (!a || !b) continue;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let sumSq = 0;
    for (const k of keys) {
      const av = Number(a[k] ?? 0);
      const bv = Number(b[k] ?? 0);
      if (!Number.isFinite(av) || !Number.isFinite(bv)) continue;
      sumSq += (av - bv) ** 2;
    }
    steps.push(Math.sqrt(sumSq));
  }
  return steps;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

export function mapTerrain(input: TerrainInputs): TerrainFeatures {
  const { lane_confidence, round, max_rounds, choices, skipped_rounds_last3 } = input;

  // --- delta volatility (ruggedness input) --------------------------------
  const deltaMags = choices
    .map((c) => magnitude(c.raw_delta))
    .filter((m): m is number => m !== null);
  const deltaSamples = deltaMags.length;
  const deltaVolatility = deltaSamples >= 2 ? stddev(deltaMags) : null;

  // --- artist bias (local_minima_risk input) ------------------------------
  const artistCounts = new Map<string, number>();
  for (const c of choices) {
    const a = (c.chosen_artist ?? "").trim().toLowerCase();
    if (!a) continue;
    artistCounts.set(a, (artistCounts.get(a) ?? 0) + 1);
  }
  const artistTop = Array.from(artistCounts.values()).reduce((m, n) => Math.max(m, n), 0);
  const artistBiasShare = choices.length > 0 ? artistTop / choices.length : 0;
  const artistBiased = artistTop >= ARTIST_BIAS_N;

  // --- snap-decision rate (uncertainty + ruggedness input) ----------------
  const snapCount = choices.filter((c) => (c.ms_to_decide ?? Infinity) < SNAP_MS).length;
  const snapShare = choices.length > 0 ? snapCount / choices.length : 0;
  const snapping = snapShare >= SNAP_SHARE_HI;

  // --- uncertainty ---------------------------------------------------------
  // Low lane confidence, high skip count, or all-snap decisions all raise it.
  // Refinement #5: skips are first-class here — each recent skip counts.
  const skipPenalty = skipped_rounds_last3;
  let uncertainty: TrinaryLow;
  if (lane_confidence < 0.4 || skipPenalty >= 2) uncertainty = "high";
  else if (lane_confidence < 0.65 || skipPenalty >= 1 || snapping) uncertainty = "medium";
  else uncertainty = "low";

  // --- ruggedness ----------------------------------------------------------
  // Refinement #4: null deltaVolatility means "insufficient data", not "smooth".
  // Refinement #5: skips inject artificial roughness.
  let ruggedness: TrinaryLow;
  if (deltaVolatility === null) {
    ruggedness = skipPenalty > 0 ? "medium" : "low";
  } else if (deltaVolatility >= 20 || skipPenalty >= 2) {
    ruggedness = "high";
  } else if (deltaVolatility >= 10 || skipPenalty >= 1 || snapping) {
    ruggedness = "medium";
  } else {
    ruggedness = "low";
  }

  // --- local_minima_risk ---------------------------------------------------
  // Same threshold finalizeSession uses to flag artist bias.
  let localMinima: TrinaryLow;
  if (artistBiased && artistBiasShare >= 0.6) localMinima = "high";
  else if (artistBiased || artistBiasShare >= 0.4) localMinima = "medium";
  else localMinima = "low";

  // --- branching_factor ----------------------------------------------------
  // Early rounds have more meaningful branch choices; late rounds are narrow.
  const roundPosition = max_rounds > 0 ? round / max_rounds : 0;
  let branching: TrinaryLow;
  if (roundPosition < 0.33) branching = "high";
  else if (roundPosition < 0.66) branching = "medium";
  else branching = "low";

  // --- mode_pressure -------------------------------------------------------
  // Combine the strongest active signal. Order matters: bias > uncertainty >
  // stability. Refinement #2 tunes the DOWNSTREAM weight; here we just name
  // the winning pressure.
  let modePressure: TerrainFeatures["mode_pressure"];
  if (localMinima === "high") modePressure = "explore";
  else if (uncertainty === "high") modePressure = "explore";
  else if (uncertainty === "medium" || ruggedness === "high") modePressure = "prune";
  else if (uncertainty === "low" && ruggedness === "low" && lane_confidence >= 0.7) modePressure = "compound";
  else modePressure = "none";

  return {
    feedback_latency: "fast",
    reversibility: "medium",
    adversariality: "none",
    information_cost: "medium",
    coordination_load: "low",
    environment_stability: "stable",
    time_horizon: "iterative",
    uncertainty,
    ruggedness,
    local_minima_risk: localMinima,
    branching_factor: branching,
    mode_pressure: modePressure,
    derived: {
      lane_confidence,
      delta_volatility: deltaVolatility,
      delta_samples: deltaSamples,
      artist_bias_share: Math.round(artistBiasShare * 1000) / 1000,
      snap_share: Math.round(snapShare * 1000) / 1000,
      skips_last3: skipped_rounds_last3,
      round_position: Math.round(roundPosition * 1000) / 1000,
    },
  };
}
