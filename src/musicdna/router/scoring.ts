import {
  SEARCH_REGIMES,
  type ModePressure,
  type Recommendation,
  type Regime,
  type TerrainFeatures,
} from "./types";

type DimensionWeightTable = Partial<
  Record<keyof TerrainFeatures, Partial<Record<string, Partial<Record<Regime, number>>>>>
>;

export type Scores = Record<Regime, number>;

const DIMENSION_WEIGHTS: DimensionWeightTable = {
  feedback_latency: {
    fast: { explore: 2, prune: 1 },
    medium: { explore: 1, prune: 1, compound: 1 },
    slow: { coordinate: 1, compound: -1, explore: -1 },
  },
  reversibility: {
    high: { explore: 2, prune: 1 },
    medium: { prune: 1, compound: 1 },
    low: { compound: -2, coordinate: 1, prune: 1 },
  },
  uncertainty: {
    low: { compound: 2, prune: 1, explore: -1 },
    medium: { prune: 2, explore: 1, coordinate: 1 },
    high: { explore: 3, coordinate: 1, compound: -2 },
  },
  branching_factor: {
    low: { compound: 2, coordinate: 1 },
    medium: { explore: 1, prune: 1, compound: 1 },
    high: { prune: 3, explore: 2, compound: -1 },
  },
  adversariality: {
    none: { compound: 1, prune: 1 },
    some: { coordinate: 2, prune: 1 },
    high: { coordinate: 4, compound: -1 },
  },
  ruggedness: {
    low: { compound: 2, prune: 1 },
    medium: { explore: 1, prune: 1, coordinate: 1 },
    high: { explore: 2, coordinate: 1, compound: -1 },
  },
  local_minima_risk: {
    low: { compound: 1, prune: 1 },
    medium: { explore: 1, prune: 1 },
    high: { explore: 2, compound: -1 },
  },
  information_cost: {
    low: { explore: 2, prune: 1 },
    medium: { explore: 1, prune: 1 },
    high: { compound: 1, coordinate: 1, explore: -2 },
  },
  coordination_load: {
    low: { compound: 1, prune: 1 },
    medium: { coordinate: 2, prune: 1 },
    high: { coordinate: 3, compound: -1 },
  },
  environment_stability: {
    stable: { compound: 2, prune: 1 },
    shifting: { explore: 1, coordinate: 1, compound: -1 },
  },
  time_horizon: {
    one_shot: { prune: 1, coordinate: 1, explore: -1 },
    iterative: { explore: 2, compound: 1 },
  },
  mode_pressure: {
    // Singleton-regime pressures contribute +2 to their matching regime.
    // (Historically encoded as +4 with a post-hoc -2 adjustment; inlined here
    // so the weight table is the single source of truth.)
    explore: { explore: 2 },
    prune: { prune: 2 },
    compound: { compound: 2 },
    escape: { explore: 2, prune: 1, compound: -1 },
    coordinate: { coordinate: 2 },
    create: { explore: 2, prune: -1, compound: -1 },
  },
};


const OPPOSING: Record<Regime, Regime> = {
  prune: "explore",
  explore: "compound",
  compound: "explore",
  coordinate: "explore",
};

function createEmptyScoreMap(): Scores {
  return {
    prune: 0,
    explore: 0,
    compound: 0,
    coordinate: 0,
  };
}

function isRegime(value: string): value is Regime {
  return (SEARCH_REGIMES as readonly string[]).includes(value);
}

export function scoreTerrain(features: TerrainFeatures): Scores {
  return scoreMusicDNATerrain(features).breakdown.reduce<Scores>(
    (scores, row) => {
      scores[row.regime] = row.score;
      return scores;
    },
    createEmptyScoreMap(),
  );
}

export function scoreMusicDNATerrain(features: TerrainFeatures): Recommendation {
  const scores = createEmptyScoreMap();
  const reasons: Record<Regime, string[]> = {
    prune: [],
    explore: [],
    compound: [],
    coordinate: [],
  };

  for (const field of Object.keys(DIMENSION_WEIGHTS) as (keyof TerrainFeatures)[]) {
    const fieldWeights = DIMENSION_WEIGHTS[field];
    const fieldValue = features[field];
    const appliedWeights = fieldWeights?.[String(fieldValue)];
    if (!appliedWeights) continue;

    for (const regime of SEARCH_REGIMES) {
      const weight = appliedWeights[regime];
      if (!weight) continue;
      scores[regime] += weight;
      reasons[regime].push(`${field}=${String(fieldValue)} (${weight > 0 ? "+" : ""}${weight})`);
    }
  }




  const breakdown = SEARCH_REGIMES.map((regime) => ({
    regime,
    score: scores[regime],
    reasons: reasons[regime],
  })).sort((left, right) => right.score - left.score);

  const primary = breakdown[0]?.regime ?? "explore";
  const secondary = breakdown[1]?.regime ?? null;
  const topScore = breakdown[0]?.score ?? 0;
  const secondScore = breakdown[1]?.score ?? 0;
  const margin = topScore - secondScore;
  const confidence = Math.max(0, Math.min(1, 0.4 + Math.max(0, margin) * 0.08));

  return {
    primary_regime: primary,
    secondary_regime: secondary,
    opposing_regime: OPPOSING[primary],
    confidence,
    breakdown,
    transition_candidate: transitionCandidateFor(features, primary),
  };
}

function transitionCandidateFor(
  profile: TerrainFeatures,
  topRegime: Regime,
): Regime | null {
  if (
    topRegime === "explore" &&
    profile.uncertainty !== "high" &&
    profile.branching_factor === "high"
  ) {
    return "prune";
  }
  if (
    topRegime === "prune" &&
    profile.uncertainty === "low" &&
    profile.environment_stability === "stable"
  ) {
    return "compound";
  }
  if (
    topRegime === "compound" &&
    (profile.environment_stability === "shifting" || profile.local_minima_risk === "high")
  ) {
    return "explore";
  }
  if (
    topRegime !== "coordinate" &&
    (profile.adversariality === "high" || profile.coordination_load === "high")
  ) {
    return "coordinate";
  }
  return null;
}

export function recommendRegime(features: TerrainFeatures): Recommendation & {
  regime: Regime;
  margin: number;
  scores: Scores;
  archetype_margin: null;
} {
  const rec = scoreMusicDNATerrain(features);
  const scores = rec.breakdown.reduce<Scores>(
    (acc, row) => {
      acc[row.regime] = row.score;
      return acc;
    },
    createEmptyScoreMap(),
  );
  const margin = (rec.breakdown[0]?.score ?? 0) - (rec.breakdown[1]?.score ?? 0);
  return {
    ...rec,
    regime: rec.primary_regime,
    margin,
    scores,
    archetype_margin: null,
  };
}

export function scoringAgrees(modePressureIn: ModePressure, regimeOut: Regime): boolean {
  return modePressureIn === regimeOut;
}

export type { Recommendation, Regime };
