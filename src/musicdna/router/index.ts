// Shadow-mode router entry point.
//
// Loads the last N `choice_scored` events for a session from event_log,
// maps them into TerrainFeatures, and returns a regime recommendation.
// Failures propagate as `null`. Selector is never touched.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  choiceRowsToTerrainInput,
  sessionConfidence,
  sessionToTerrain,
  type ChoiceEventRow,
} from "./terrain";
import { regimeToPairingKnobs, regimeToSelectionMode } from "./knobs";
import { recommendRegime, scoringAgrees, type Recommendation } from "./scoring";
import type {
  MusicDNARegimeRecommendation,
  MusicDNATerrainInput,
  Regime,
} from "./types";

type AuthedSupabase = SupabaseClient<Database>;

const HISTORY_LIMIT = 6; // matches MAX_ROUNDS in onboarding.tsx
const ATTEMPT_WINDOW = 3;

export type RecommendationSnapshot = MusicDNARegimeRecommendation & {
  features_summary: {
    lane_confidence: number;
    vector_confidence: number;
    round: number;
    max_rounds: number;
    uncertainty: string;
    ruggedness: string;
    local_minima_risk: string;
    branching_factor: string;
    mode_pressure: string;
    environment_stability: string;
    information_cost: string;
  };
};

export async function recommendForSession(
  supabase: AuthedSupabase,
  sessionId: string,
  opts: {
    laneConfidence: number;
    vector?: Record<string, number>;
    lane?: string;
    skippedPairingIds?: string[];
    round: number;
    maxRounds?: number;
    archetypeMargin?: number | null;
  } = { laneConfidence: 0, round: 0 },
): Promise<RecommendationSnapshot | null> {
  try {
    const [choiceRes, attemptsRes] = await Promise.all([
      supabase
        .from("event_log")
        .select("props, created_at")
        .eq("session_id", sessionId)
        .eq("event_type", "choice_scored")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      supabase
        .from("event_log")
        .select("event_type, created_at")
        .eq("session_id", sessionId)
        .in("event_type", ["choice_scored", "pairing_skipped"])
        .order("created_at", { ascending: false })
        .limit(ATTEMPT_WINDOW),
    ]);

    const rawChoices = ((choiceRes.data ?? []) as Array<{ props: Record<string, unknown> | null }>)
      .map((row) => row.props ?? {})
      .reverse();

    const choices: ChoiceEventRow[] = rawChoices.map((p) => ({
      round: Number((p as { round?: unknown }).round ?? 0),
      raw_delta: (p as { raw_delta?: Record<string, number> | null }).raw_delta ?? null,
      chosen_artist: (p as { chosen_artist?: string | null }).chosen_artist ?? null,
      ms_to_decide: (p as { ms_to_decide?: number | null }).ms_to_decide ?? null,
    }));

    const attempts = (attemptsRes.data ?? []) as Array<{ event_type: string }>;
    const recentSkipCount = attempts.filter((r) => r.event_type === "pairing_skipped").length;
    const skippedPairingIds =
      opts.skippedPairingIds ?? Array.from({ length: recentSkipCount }, (_, i) => `recent-skip-${i}`);

    let archetypeMargin: number | null = opts.archetypeMargin ?? null;
    if (archetypeMargin === null && choiceRes.data && choiceRes.data.length > 0) {
      const latest = (choiceRes.data[0] as { props: Record<string, unknown> | null }).props ?? {};
      const m = (latest as { margin?: unknown }).margin;
      if (typeof m === "number" && Number.isFinite(m)) archetypeMargin = m;
    }

    const input = choiceRowsToTerrainInput({
      session_id: sessionId,
      lane: opts.lane ?? "alternative",
      lane_confidence: opts.laneConfidence,
      vector: opts.vector ?? {},
      rounds_shown: opts.round,
      skipped_pairing_ids: skippedPairingIds,
      choices,
      config: { round_budget: opts.maxRounds ?? 6 },
    });

    const rec = recommendMusicDNARegime(input);
    rec.archetype_margin = archetypeMargin;
    const vectorConfidence = sessionConfidence(input.session.vector).confidence;

    return {
      ...rec,
      features_summary: {
        lane_confidence: input.session.lane_confidence,
        vector_confidence: vectorConfidence,
        round: opts.round,
        max_rounds: opts.maxRounds ?? 6,
        uncertainty: rec.terrain.uncertainty,
        ruggedness: rec.terrain.ruggedness,
        local_minima_risk: rec.terrain.local_minima_risk,
        branching_factor: rec.terrain.branching_factor,
        mode_pressure: rec.terrain.mode_pressure,
        environment_stability: rec.terrain.environment_stability,
        information_cost: rec.terrain.information_cost,
      },
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[musicdna.router] recommendForSession failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function recommendMusicDNARegime(input: MusicDNATerrainInput): MusicDNARegimeRecommendation {
  const terrain = sessionToTerrain(input);
  const scoring = recommendRegime(terrain);
  const { session } = input;
  const { confidence, confident_axes, total_axes } = sessionConfidence(session.vector);
  const mode_pressure_in = terrain.mode_pressure;
  const regime = scoring.primary_regime;
  const selection_mode = regimeToSelectionMode(regime, session.lane, session.lane_confidence);
  const pairing_knobs = regimeToPairingKnobs(regime, session.lane, session.lane_confidence);

  const rationale: string[] = [
    `Round ${session.rounds_shown} (${session.rounds_answered} answered / ${session.rounds_skipped} skipped), ` +
      `confidence ${(confidence * 100).toFixed(0)}% (${confident_axes}/${total_axes} axes)`,
  ];

  if (terrain.uncertainty === "high") {
    rationale.push("Uncertainty is high - favoring exploration");
  } else if (terrain.uncertainty === "low") {
    rationale.push("Uncertainty is low - ready to compound");
  }
  if (terrain.local_minima_risk === "high") {
    rationale.push("Artist bias detected - local-minima risk elevated");
  }
  if (terrain.ruggedness === "high") {
    rationale.push("Vector volatility - taste landscape is rugged");
  }
  if (terrain.environment_stability === "shifting") {
    rationale.push("Skip pressure - environment treated as shifting");
  }
  if (mode_pressure_in === "escape") {
    rationale.push("Escape pressure - stuck at low confidence late in the budget");
  }
  rationale.push(...(scoring.breakdown[0]?.reasons.slice(0, 3) ?? []));

  return {
    regime,
    confidence: scoring.confidence,
    terrain,
    mode_pressure_in,
    scoring_agrees: scoringAgrees(mode_pressure_in, regime),
    rationale,
    transition_candidate: scoring.transition_candidate,
    selection_mode,
    pairing_knobs,
    scoring,
    archetype_margin: null,
  };
}

export { mapTerrain, sessionToTerrain } from "./terrain";
export { recommendRegime, scoreTerrain, scoreMusicDNATerrain } from "./scoring";
export type { MusicDNATerrainInput, TerrainFeatures } from "./types";
export type { Regime, Recommendation, Scores } from "./scoring";
