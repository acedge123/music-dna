// Shadow-mode router entry point.
//
// Loads the last N `choice_scored` events for a session from event_log,
// maps them into TerrainFeatures, and returns a regime recommendation.
// Fire-and-forget by design; failures propagate as `null`. Selector is
// never touched.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mapTerrain, type ChoiceEventRow } from "./terrain";
import { recommendRegime, type Recommendation } from "./scoring";

type AuthedSupabase = SupabaseClient<Database>;

const HISTORY_LIMIT = 6; // matches MAX_ROUNDS in onboarding.tsx
const SKIP_WINDOW = 3;

export type RecommendationSnapshot = Recommendation & {
  features_summary: {
    lane_confidence: number;
    round: number;
    max_rounds: number;
    delta_samples: number;
    delta_volatility: number | null;
    artist_bias_share: number;
    snap_share: number;
    skips_last3: number;
    round_position: number;
    uncertainty: string;
    ruggedness: string;
    local_minima_risk: string;
    branching_factor: string;
    mode_pressure: string;
  };
};

export async function recommendForSession(
  supabase: AuthedSupabase,
  sessionId: string,
  opts: { laneConfidence: number; round: number; maxRounds?: number; archetypeMargin?: number | null } = {
    laneConfidence: 0,
    round: 0,
  },
): Promise<RecommendationSnapshot | null> {
  try {
    const [choiceRes, skipRes] = await Promise.all([
      supabase
        .from("event_log")
        .select("props, created_at")
        .eq("session_id", sessionId)
        .eq("event_type", "choice_scored")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      supabase
        .from("event_log")
        .select("created_at")
        .eq("session_id", sessionId)
        .eq("event_type", "pairing_skipped")
        .order("created_at", { ascending: false })
        .limit(SKIP_WINDOW),
    ]);

    const rawChoices = ((choiceRes.data ?? []) as Array<{ props: Record<string, unknown> | null }>)
      .map((row) => row.props ?? {})
      .reverse(); // oldest → newest

    const choices: ChoiceEventRow[] = rawChoices.map((p) => ({
      round: Number((p as { round?: unknown }).round ?? 0),
      raw_delta: (p as { raw_delta?: Record<string, number> | null }).raw_delta ?? null,
      chosen_artist: (p as { chosen_artist?: string | null }).chosen_artist ?? null,
      ms_to_decide: (p as { ms_to_decide?: number | null }).ms_to_decide ?? null,
    }));

    const skips = (skipRes.data ?? []).length;

    const features = mapTerrain({
      lane_confidence: opts.laneConfidence,
      round: opts.round,
      max_rounds: opts.maxRounds ?? 6,
      choices,
      skipped_rounds_last3: Math.min(SKIP_WINDOW, skips),
    });

    const rec = recommendRegime(features);
    if (opts.archetypeMargin !== undefined) rec.archetype_margin = opts.archetypeMargin;

    return {
      ...rec,
      features_summary: {
        lane_confidence: features.derived.lane_confidence,
        round: opts.round,
        max_rounds: opts.maxRounds ?? 6,
        delta_samples: features.derived.delta_samples,
        delta_volatility: features.derived.delta_volatility,
        artist_bias_share: features.derived.artist_bias_share,
        snap_share: features.derived.snap_share,
        skips_last3: features.derived.skips_last3,
        round_position: features.derived.round_position,
        uncertainty: features.uncertainty,
        ruggedness: features.ruggedness,
        local_minima_risk: features.local_minima_risk,
        branching_factor: features.branching_factor,
        mode_pressure: features.mode_pressure,
      },
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[musicdna.router] recommendForSession failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export { mapTerrain } from "./terrain";
export { recommendRegime, scoreTerrain } from "./scoring";
export type { TerrainFeatures } from "./terrain";
export type { Regime, Recommendation, Scores } from "./scoring";
