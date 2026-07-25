// Port of Agent Brain's scoreTerrain, tuned per D2 of the integration plan:
//   • Refinement #1: information_cost=medium, reversibility=medium constants.
//   • Refinement #2: mode_pressure weight reduced from +4 to +2.
//   • Refinement #6: this scorer never influences shouldStop.
//
// Returns a regime recommendation plus the raw score table so shadow
// analysis can second-guess the pick without re-running the mapper.

import type { TerrainFeatures } from "./terrain";

export type Regime = "explore" | "prune" | "compound" | "coordinate";

export type Scores = Record<Regime, number>;

export type Recommendation = {
  regime: Regime;
  confidence: number;      // 0..1, from margin over max possible
  margin: number;          // raw score gap #1 - #2
  scores: Scores;
  archetype_margin: number | null; // Refinement #9 — filled in by index.ts if the caller has archetype rankings
};

// Weight table. Constant fields contribute a fixed baseline per regime.
// Derived fields contribute the DERIVED value on the mapped regime.
const CONSTANT_WEIGHTS = {
  feedback_latency: { fast: { explore: 2, prune: 1, compound: 0, coordinate: 0 } },
  reversibility:    { medium: { explore: 1, prune: 1, compound: 0, coordinate: 0 } },
  adversariality:   { none:   { explore: 0, prune: 1, compound: 1, coordinate: 0 } },
  information_cost: { medium: { explore: 1, prune: 1, compound: 1, coordinate: 0 } },
  coordination_load:{ low:    { explore: 0, prune: 1, compound: 1, coordinate: 0 } },
  environment_stability: { stable: { explore: 0, prune: 1, compound: 2, coordinate: 0 } },
  time_horizon:     { iterative: { explore: 2, prune: 0, compound: 1, coordinate: 0 } },
} as const;

// Derived-field contributions. Small — mapper already narrowed to trinaries.
const DERIVED_WEIGHTS = {
  uncertainty:       { high: { explore: 3, prune: 0, compound: 0, coordinate: 1 },
                        medium: { explore: 1, prune: 2, compound: 0, coordinate: 0 },
                        low: { explore: 0, prune: 1, compound: 2, coordinate: 0 } },
  ruggedness:        { high: { explore: 2, prune: 1, compound: 0, coordinate: 0 },
                        medium: { explore: 1, prune: 2, compound: 0, coordinate: 0 },
                        low: { explore: 0, prune: 1, compound: 2, coordinate: 0 } },
  local_minima_risk: { high: { explore: 3, prune: 0, compound: 0, coordinate: 0 },
                        medium: { explore: 1, prune: 1, compound: 0, coordinate: 0 },
                        low: { explore: 0, prune: 1, compound: 1, coordinate: 0 } },
  branching_factor:  { high: { explore: 2, prune: 0, compound: 0, coordinate: 0 },
                        medium: { explore: 1, prune: 1, compound: 0, coordinate: 0 },
                        low: { explore: 0, prune: 1, compound: 1, coordinate: 0 } },
} as const;

// Refinement #2: mode_pressure weight halved from +4 to +2.
const MODE_PRESSURE_WEIGHT = 2;

const REGIMES: Regime[] = ["explore", "prune", "compound", "coordinate"];

function addRow(scores: Scores, row: Partial<Record<Regime, number>>): void {
  for (const r of REGIMES) scores[r] += row[r] ?? 0;
}

export function scoreTerrain(features: TerrainFeatures): Scores {
  const scores: Scores = { explore: 0, prune: 0, compound: 0, coordinate: 0 };

  addRow(scores, CONSTANT_WEIGHTS.feedback_latency[features.feedback_latency]);
  addRow(scores, CONSTANT_WEIGHTS.reversibility[features.reversibility]);
  addRow(scores, CONSTANT_WEIGHTS.adversariality[features.adversariality]);
  addRow(scores, CONSTANT_WEIGHTS.information_cost[features.information_cost]);
  addRow(scores, CONSTANT_WEIGHTS.coordination_load[features.coordination_load]);
  addRow(scores, CONSTANT_WEIGHTS.environment_stability[features.environment_stability]);
  addRow(scores, CONSTANT_WEIGHTS.time_horizon[features.time_horizon]);

  addRow(scores, DERIVED_WEIGHTS.uncertainty[features.uncertainty]);
  addRow(scores, DERIVED_WEIGHTS.ruggedness[features.ruggedness]);
  addRow(scores, DERIVED_WEIGHTS.local_minima_risk[features.local_minima_risk]);
  addRow(scores, DERIVED_WEIGHTS.branching_factor[features.branching_factor]);

  if (features.mode_pressure !== "none") {
    scores[features.mode_pressure as Regime] += MODE_PRESSURE_WEIGHT;
  }

  return scores;
}

export function recommendRegime(features: TerrainFeatures): Recommendation {
  const scores = scoreTerrain(features);
  const sorted = REGIMES.map((r) => ({ r, s: scores[r] })).sort((a, b) => b.s - a.s);
  const winner = sorted[0];
  const runnerUp = sorted[1];
  const margin = winner.s - runnerUp.s;
  // Confidence: margin as a fraction of the theoretical spread (roughly 15
  // points end-to-end at the current weight table).
  const confidence = Math.max(0, Math.min(1, margin / 6));
  return {
    regime: winner.r,
    confidence: Math.round(confidence * 1000) / 1000,
    margin,
    scores,
    archetype_margin: null,
  };
}
