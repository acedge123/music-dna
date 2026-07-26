export const MUSICDNA_DIMS = [
  "movement",
  "atmosphere",
  "immersion",
  "scale",
  "community",
  "perspective",
  "confidence",
  "tension",
  "texture",
  "transformation",
] as const;

export type MusicDNADim = (typeof MUSICDNA_DIMS)[number];

export type SelectionMode =
  | "diagnostic_first"
  | "recognition_boost"
  | "recognition_first";

export const RECOGNITION_FLOORS: Record<SelectionMode, number> = {
  diagnostic_first: 0,
  recognition_boost: 45,
  recognition_first: 55,
};

export const SEARCH_REGIMES = ["prune", "explore", "compound", "coordinate"] as const;

export type Regime = (typeof SEARCH_REGIMES)[number];

export type ModePressure =
  | "explore"
  | "prune"
  | "compound"
  | "escape"
  | "coordinate"
  | "create";

export type TrinaryLow = "low" | "medium" | "high";

export type TerrainFeatures = {
  feedback_latency: "fast" | "medium" | "slow";
  reversibility: TrinaryLow;
  uncertainty: TrinaryLow;
  branching_factor: TrinaryLow;
  adversariality: "none" | "some" | "high";
  ruggedness: TrinaryLow;
  local_minima_risk: TrinaryLow;
  information_cost: TrinaryLow;
  coordination_load: TrinaryLow;
  environment_stability: "stable" | "shifting";
  time_horizon: "one_shot" | "iterative";
  mode_pressure: ModePressure;
};

export type MusicDNASessionState = {
  session_id: string;
  rounds_answered: number;
  rounds_skipped: number;
  rounds_shown: number;
  vector: Record<string, number>;
  lane: string;
  lane_confidence: number;
  skipped_pairing_ids: string[];
  artist_frequency: Record<string, number>;
};

export type MapperConfig = {
  round_budget?: number;
  confidence_thresholds?: {
    low: number;
    high: number;
  };
  artist_bias_threshold?: number;
  axis_confidence_threshold?: number;
  volatility_threshold?: number;
  snap_threshold_ms?: number;
  snap_rate_threshold?: number;
};

export type MusicDNATerrainInput = {
  session: MusicDNASessionState;
  recentDeltas?: Array<Record<string, number>>;
  recentChoices?: Array<{ ms_to_decide: number | null }>;
  config?: MapperConfig;
};

export type PairingKnobs = {
  mode: SelectionMode;
  recog_blend: number;
  canon_floor: number;
  challenge_boost: number;
  leaning_axis_threshold: number;
  leaning_axis_count: number;
  axis_need_floor: number;
  axis_need_span: number;
  fork_filter: "hard" | "soft" | "off";
};

export type ScoreBreakdown = {
  regime: Regime;
  score: number;
  reasons: string[];
};

export type Recommendation = {
  primary_regime: Regime;
  secondary_regime: Regime | null;
  opposing_regime: Regime;
  confidence: number;
  breakdown: ScoreBreakdown[];
  transition_candidate: Regime | null;
};

export type MusicDNARegimeRecommendation = {
  regime: Regime;
  confidence: number;
  terrain: TerrainFeatures;
  mode_pressure_in: ModePressure;
  scoring_agrees: boolean;
  rationale: string[];
  transition_candidate: Regime | null;
  selection_mode: SelectionMode;
  pairing_knobs: PairingKnobs;
  scoring: Recommendation;
  archetype_margin: number | null;
};

export type SessionConfidence = {
  confidence: number;
  confident_axes: number;
  total_axes: number;
};

export type ArtistBias = {
  biased: boolean;
  top_artist: string | null;
  count: number;
};

export type VectorVolatility = {
  known: boolean;
  volatile: boolean | null;
  avgMagnitude: number;
};

export type SnapPicks = {
  snap_rate: number;
  snapping: boolean;
  valid_count: number;
};

export type SkipPressure = {
  skip_count: number;
  skip_rate: number;
  recognition_failing: boolean;
};
