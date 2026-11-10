import { z } from "zod";

export const QUALITY_RUBRIC_VERSION = "critic-quality-rubric-v2";
export const QUALITY_AXES = [
  "inference_accuracy",
  "musical_specificity",
  "prose_originality",
  "conversational_relevance",
  "entertainment",
] as const;
export const QUALITY_LABELS: Record<(typeof QUALITY_AXES)[number], string> = {
  inference_accuracy: "Grounded in evidence",
  musical_specificity: "Musical specificity",
  prose_originality: "Originality",
  conversational_relevance: "Conversational relevance",
  entertainment: "Entertainment / want to continue",
};
const score = z.number().int().min(1).max(5).nullable();
export const QualityScores = z
  .object({
    inference_accuracy: score,
    musical_specificity: score,
    prose_originality: score,
    conversational_relevance: score,
    entertainment: score,
  })
  .strict();
export const QUALITY_ANCHORS = {
  inference_accuracy: [
    "Contradicts frozen evidence",
    "Unsupported inference",
    "Bounded but incomplete",
    "Grounded with qualifications",
    "Precisely grounded, exceptions intact",
  ],
  musical_specificity: [
    "Invented musical detail",
    "Generic musical language",
    "One relevant supplied detail",
    "Specific supplied contrasts",
    "Precise song-specific contrasts, no invention",
  ],
  prose_originality: [
    "Stock template",
    "Mostly recycled wording",
    "Some fresh phrasing",
    "Distinctive sustained voice",
    "Fresh, memorable, not ornamental",
  ],
  conversational_relevance: [
    "Ignores the current turn",
    "Mostly disconnected",
    "Addresses the turn",
    "Responds and advances it",
    "Directly engages the correction/context without inventing motive",
  ],
  entertainment: [
    "Would stop here",
    "Polite but flat",
    "Mildly interesting",
    "Want to reply",
    "Can't wait to argue back",
  ],
} as const;

export type CallMeasurement = {
  phase: "writer" | "reviewer";
  status: "ok" | "failed";
  latency_ms: number;
  model: string | null;
  provider: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: null;
  cost_status: "unavailable";
};

export type ExposureSong = { id: string; artist: string | null; year: number | null };
export type ExposureOffer = {
  id: string;
  pairing_id: string;
  songs: ExposureSong[];
  shown: boolean;
};
export type FrozenDecision = {
  id: string;
  pairing_id: string;
  chosen: ExposureSong;
  rejected: ExposureSong;
};
export function exposureReport(
  offers: ExposureOffer[],
  decisions: FrozenDecision[],
  unavailableChoices = 0,
) {
  const uniqueOffers = [...new Map(offers.map((o) => [o.id, o])).values()];
  const uniqueDecisions = [...new Map(decisions.map((d) => [d.id, d])).values()];
  const distribution = (songs: ExposureSong[]) => {
    const artists: Record<string, number> = {};
    const eras: Record<string, number> = {};
    let unknownArtist = 0,
      unknownEra = 0;
    for (const song of songs) {
      if (song.artist) artists[song.artist] = (artists[song.artist] ?? 0) + 1;
      else unknownArtist++;
      if (song.year !== null) {
        const era = String(Math.floor(song.year / 10) * 10);
        eras[era] = (eras[era] ?? 0) + 1;
      } else unknownEra++;
    }
    return {
      total: songs.length,
      artists,
      eras,
      unknown_artist: unknownArtist,
      unknown_era: unknownEra,
    };
  };
  const opponentCounts: Record<string, number> = {};
  for (const d of uniqueDecisions)
    opponentCounts[d.rejected.id] = (opponentCounts[d.rejected.id] ?? 0) + 1;
  const offeredCounts: Record<string, number> = {};
  for (const o of uniqueOffers)
    for (const s of o.songs) offeredCounts[s.id] = (offeredCounts[s.id] ?? 0) + 1;
  return {
    served: uniqueOffers.length,
    client_reported_shown: uniqueOffers.filter((o) => o.shown).length,
    missing_display_reports: uniqueOffers.filter((o) => !o.shown).length,
    answered: uniqueDecisions.length,
    unavailable_choices: unavailableChoices,
    served_songs: distribution(uniqueOffers.flatMap((o) => o.songs)),
    reported_shown_songs: distribution(uniqueOffers.filter((o) => o.shown).flatMap((o) => o.songs)),
    answered_offered_songs: distribution(uniqueDecisions.flatMap((d) => [d.chosen, d.rejected])),
    chosen_songs: distribution(uniqueDecisions.map((d) => d.chosen)),
    repeated_opponents: Object.entries(opponentCounts)
      .filter(([, count]) => count > 1)
      .map(([song_id, count]) => ({ song_id, count })),
    repeated_offered_songs: Object.entries(offeredCounts)
      .filter(([, count]) => count > 1)
      .map(([song_id, count]) => ({ song_id, count })),
    independent_retests: null,
    independent_retest_status: "not_established" as const,
    historical_exposure_status: "prospective_only" as const,
  };
}

export const KEEP_TALKING = ["yes", "maybe", "no"] as const;
export const SessionVerdict = z
  .object({
    keep_talking: z.enum(KEEP_TALKING),
    reason: z.string().trim().max(500).nullable(),
  })
  .strict();

/** Share of completed listener sessions that chatted after the reveal. */
export function keptTalkingRate(sessions: { session_id: string; user_turns: number }[]) {
  const total = sessions.length;
  const talked = sessions.filter((s) => s.user_turns > 0);
  const turns = talked.reduce((n, s) => n + s.user_turns, 0);
  return {
    completed_sessions: total,
    kept_talking: talked.length,
    rate: total ? talked.length / total : null,
    avg_turns_when_talking: talked.length ? turns / talked.length : null,
  };
}
