import {
  MUSICDNA_DIMS,
  type ArtistBias,
  type MapperConfig,
  type MusicDNASessionState,
  type MusicDNATerrainInput,
  type SessionConfidence,
  type SkipPressure,
  type SnapPicks,
  type TerrainFeatures,
  type VectorVolatility,
} from "./types";

export type ChoiceEventRow = {
  round: number;
  raw_delta: Record<string, number> | null | undefined;
  chosen_artist?: string | null;
  ms_to_decide?: number | null;
};

export type TerrainInputs = {
  lane_confidence: number;
  vector_confidence?: number;
  round: number;
  max_rounds: number;
  choices: ChoiceEventRow[];
  skipped_rounds_last3: number;
};

export const DEFAULT_AXIS_CONFIDENCE_THRESHOLD = 30;
export const DEFAULT_ARTIST_BIAS_THRESHOLD = 3;
export const DEFAULT_SNAP_THRESHOLD_MS = 2000;
export const DEFAULT_SNAP_RATE_THRESHOLD = 0.6;
export const DEFAULT_VOLATILITY_THRESHOLD = 15;

export const DEFAULT_MAPPER_CONFIG = {
  round_budget: 6,
  confidence_thresholds: { low: 0.3, high: 0.7 },
  artist_bias_threshold: DEFAULT_ARTIST_BIAS_THRESHOLD,
  axis_confidence_threshold: DEFAULT_AXIS_CONFIDENCE_THRESHOLD,
  volatility_threshold: DEFAULT_VOLATILITY_THRESHOLD,
  snap_threshold_ms: DEFAULT_SNAP_THRESHOLD_MS,
  snap_rate_threshold: DEFAULT_SNAP_RATE_THRESHOLD,
} as const satisfies Required<MapperConfig>;

function resolveConfig(config?: MapperConfig): Required<MapperConfig> {
  return {
    round_budget: config?.round_budget ?? DEFAULT_MAPPER_CONFIG.round_budget,
    confidence_thresholds: {
      low: config?.confidence_thresholds?.low ?? DEFAULT_MAPPER_CONFIG.confidence_thresholds.low,
      high: config?.confidence_thresholds?.high ?? DEFAULT_MAPPER_CONFIG.confidence_thresholds.high,
    },
    artist_bias_threshold: config?.artist_bias_threshold ?? DEFAULT_MAPPER_CONFIG.artist_bias_threshold,
    axis_confidence_threshold:
      config?.axis_confidence_threshold ?? DEFAULT_MAPPER_CONFIG.axis_confidence_threshold,
    volatility_threshold: config?.volatility_threshold ?? DEFAULT_MAPPER_CONFIG.volatility_threshold,
    snap_threshold_ms: config?.snap_threshold_ms ?? DEFAULT_MAPPER_CONFIG.snap_threshold_ms,
    snap_rate_threshold: config?.snap_rate_threshold ?? DEFAULT_MAPPER_CONFIG.snap_rate_threshold,
  };
}

export function sessionConfidence(
  vector: Record<string, number>,
  axisThreshold = DEFAULT_AXIS_CONFIDENCE_THRESHOLD,
): SessionConfidence {
  const confident_axes = MUSICDNA_DIMS.filter((d) => Math.abs(vector[d] ?? 0) >= axisThreshold).length;
  return {
    confidence: confident_axes / MUSICDNA_DIMS.length,
    confident_axes,
    total_axes: MUSICDNA_DIMS.length,
  };
}

export function detectArtistBias(
  freq: Record<string, number>,
  threshold = DEFAULT_ARTIST_BIAS_THRESHOLD,
): ArtistBias {
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (!top || top[1] < threshold) {
    return { biased: false, top_artist: null, count: 0 };
  }
  return { biased: true, top_artist: top[0], count: top[1] };
}

export function detectVectorVolatility(
  deltas: Array<Record<string, number>> | undefined | null,
  threshold = DEFAULT_VOLATILITY_THRESHOLD,
): VectorVolatility {
  if (!deltas || deltas.length < 3) {
    return { known: false, volatile: null, avgMagnitude: 0 };
  }

  const magnitudes = deltas.map((d) => Object.values(d).reduce((sum, v) => sum + Math.abs(v), 0));
  const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  return {
    known: true,
    volatile: avgMagnitude > threshold,
    avgMagnitude,
  };
}

export function detectSnapPicks(
  choices: Array<{ ms_to_decide: number | null }> | undefined | null,
  slowThresholdMs = DEFAULT_SNAP_THRESHOLD_MS,
  rateThreshold = DEFAULT_SNAP_RATE_THRESHOLD,
): SnapPicks {
  const valid = (choices ?? []).filter((c) => c.ms_to_decide != null);
  if (valid.length === 0) {
    return { snap_rate: 0, snapping: false, valid_count: 0 };
  }
  const snap = valid.filter((c) => (c.ms_to_decide as number) < slowThresholdMs).length;
  const snap_rate = snap / valid.length;
  return {
    snap_rate,
    snapping: snap_rate >= rateThreshold,
    valid_count: valid.length,
  };
}

export function detectSkipPressure(skipped: string[], roundsShown: number): SkipPressure {
  const skip_count = skipped.length;
  const skip_rate = roundsShown > 0 ? skip_count / roundsShown : 0;
  return {
    skip_count,
    skip_rate,
    recognition_failing: skip_count >= 2 || skip_rate > 0.25,
  };
}

export function inferModePressure(input: MusicDNATerrainInput): TerrainFeatures["mode_pressure"] {
  const cfg = resolveConfig(input.config);
  const { session, recentDeltas, recentChoices } = input;
  const { confidence } = sessionConfidence(session.vector, cfg.axis_confidence_threshold);
  const bias = detectArtistBias(session.artist_frequency, cfg.artist_bias_threshold);
  const volatility = detectVectorVolatility(recentDeltas, cfg.volatility_threshold);
  const snap = detectSnapPicks(recentChoices, cfg.snap_threshold_ms, cfg.snap_rate_threshold);
  const skips = detectSkipPressure(session.skipped_pairing_ids, session.rounds_shown);
  const { low, high } = cfg.confidence_thresholds;

  const escapeAt = Math.floor(cfg.round_budget * 0.7);
  if (session.rounds_shown >= escapeAt && confidence < low) return "escape";

  if (skips.recognition_failing) return "explore";
  if (bias.biased && bias.count >= 4) return "explore";
  if (volatility.known && volatility.volatile && confidence < high) return "explore";
  if (snap.snapping && confidence < low) return "explore";
  if (confidence < low) return "explore";
  if (confidence >= high && bias.count < 4 && !(volatility.known && volatility.volatile)) {
    return "compound";
  }
  return "prune";
}

export function sessionToTerrain(input: MusicDNATerrainInput): TerrainFeatures {
  const cfg = resolveConfig(input.config);
  const { session, recentDeltas } = input;
  const { confidence } = sessionConfidence(session.vector, cfg.axis_confidence_threshold);
  const bias = detectArtistBias(session.artist_frequency, cfg.artist_bias_threshold);
  const volatility = detectVectorVolatility(recentDeltas, cfg.volatility_threshold);
  const skips = detectSkipPressure(session.skipped_pairing_ids, session.rounds_shown);
  const { low, high } = cfg.confidence_thresholds;

  return {
    feedback_latency: "fast",
    adversariality: "none",
    coordination_load: "low",
    time_horizon: "iterative",
    reversibility: "medium",
    uncertainty: confidence < low ? "high" : confidence < high ? "medium" : "low",
    branching_factor: session.rounds_shown < Math.ceil(cfg.round_budget * 0.85) ? "high" : "medium",
    ruggedness: volatility.known && volatility.volatile ? "high" : "medium",
    local_minima_risk: bias.biased ? "high" : "medium",
    information_cost: skips.recognition_failing ? "high" : "medium",
    environment_stability: skips.recognition_failing ? "shifting" : "stable",
    mode_pressure: inferModePressure(input),
  };
}

export function choiceRowsToTerrainInput(args: {
  session_id: string;
  lane: string;
  lane_confidence: number;
  vector: Record<string, number>;
  rounds_shown: number;
  skipped_pairing_ids: string[];
  choices: ChoiceEventRow[];
  config?: MapperConfig;
}): MusicDNATerrainInput {
  const artist_frequency: Record<string, number> = {};
  for (const choice of args.choices) {
    const artist = (choice.chosen_artist ?? "").trim().toLowerCase();
    if (!artist) continue;
    artist_frequency[artist] = (artist_frequency[artist] ?? 0) + 1;
  }

  const recentDeltas = args.choices
    .map((choice) => choice.raw_delta ?? null)
    .filter((delta): delta is Record<string, number> => delta !== null);
  const recentChoices = args.choices.map((choice) => ({
    ms_to_decide: choice.ms_to_decide ?? null,
  }));

  return {
    session: {
      session_id: args.session_id,
      rounds_answered: args.choices.length,
      rounds_skipped: args.skipped_pairing_ids.length,
      rounds_shown: args.rounds_shown,
      vector: args.vector,
      lane: args.lane,
      lane_confidence: args.lane_confidence,
      skipped_pairing_ids: args.skipped_pairing_ids,
      artist_frequency,
    },
    recentDeltas,
    recentChoices,
    config: args.config,
  };
}

export function mapTerrain(input: TerrainInputs): TerrainFeatures {
  const syntheticVector: Record<string, number> = {};
  const confidentAxes = Math.round((input.vector_confidence ?? input.lane_confidence) * MUSICDNA_DIMS.length);
  for (const dim of MUSICDNA_DIMS.slice(0, confidentAxes)) {
    syntheticVector[dim] = DEFAULT_AXIS_CONFIDENCE_THRESHOLD;
  }
  const skipped_pairing_ids = Array.from({ length: input.skipped_rounds_last3 }, (_, i) => `skip-${i}`);
  return sessionToTerrain(
    choiceRowsToTerrainInput({
      session_id: "legacy-mapTerrain",
      lane: "alternative",
      lane_confidence: input.lane_confidence,
      vector: syntheticVector,
      rounds_shown: input.round,
      skipped_pairing_ids,
      choices: input.choices,
      config: { round_budget: input.max_rounds },
    }),
  );
}

export function enumerateMusicDNATerrains(): TerrainFeatures[] {
  const terrains: TerrainFeatures[] = [];
  const vectors = [
    {},
    { movement: 40, atmosphere: 40, immersion: 40 },
    {
      movement: 40,
      atmosphere: 40,
      immersion: 40,
      scale: 40,
      community: 40,
      perspective: 40,
      confidence: 40,
    },
  ];
  const artistFreqs = [{}, { Radiohead: 2 }, { Radiohead: 3 }, { Radiohead: 5 }];
  const skipSets = [[], ["a"], ["a", "b", "c"]];
  const deltaSets: Array<Array<Record<string, number>> | undefined> = [
    undefined,
    [{ movement: 5 }, { movement: 5 }, { movement: 5 }],
    [{ movement: 40, atmosphere: 40 }, { movement: 40 }, { immersion: 50 }],
  ];
  const choiceSets = [
    [],
    [{ ms_to_decide: 500 }, { ms_to_decide: 600 }, { ms_to_decide: 700 }],
    [{ ms_to_decide: 9000 }, { ms_to_decide: 10000 }],
  ];
  const roundsShown = [0, 2, 4, 5, 6];

  for (const vector of vectors) {
    for (const artist_frequency of artistFreqs) {
      for (const skipped_pairing_ids of skipSets) {
        for (const recentDeltas of deltaSets) {
          for (const recentChoices of choiceSets) {
            for (const rounds_shown of roundsShown) {
              const rounds_skipped = skipped_pairing_ids.length;
              const rounds_answered = Math.max(0, rounds_shown - rounds_skipped);
              const mappedInput: MusicDNATerrainInput = {
                session: {
                  session_id: "enum",
                  rounds_answered,
                  rounds_skipped,
                  rounds_shown,
                  vector,
                  lane: "alternative",
                  lane_confidence: 0.8,
                  skipped_pairing_ids,
                  artist_frequency,
                },
                recentChoices,
              };
              if (recentDeltas !== undefined) {
                mappedInput.recentDeltas = recentDeltas;
              }
              terrains.push(sessionToTerrain(mappedInput));
            }
          }
        }
      }
    }
  }
  return terrains;
}

export type { MusicDNASessionState, MusicDNATerrainInput, TerrainFeatures };
