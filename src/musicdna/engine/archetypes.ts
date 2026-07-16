// MusicDNA Engine — archetype assignment.
//
// Pure function: given a user's session vector and the catalog of archetypes,
// return the winning archetype + runners-up + margin + fit tier + any
// residual flag ("nobody in the catalog really explains this listener").
//
// NOTE: `fit_tier` is a bucketed strength-of-fit label (from cosine
// similarity), NOT a calibrated probability of correctness. See
// `scoring.ts#fitTier` for the rationale.
//
// No I/O. The caller loads archetypes from wherever it wants (Supabase in
// prod, fixtures in tests) and feeds them in.

import type { ArchetypeAssignment, Vector } from "./types";
import { scoreArchetype, fitTier } from "./scoring";


export type ArchetypeCatalogEntry = {
  id: string;
  name: string;
  signature_axes: Vector | null;
  // Passed through for the Critic; not used for scoring.
  core_question?: string | null;
  commentary_keywords?: string[] | null;
  confidence_thresholds?: Record<string, string> | null;
};

// Cosine on unit-ish vectors: ~0.7+ is a confident match, <0.5 says the
// current archetype set didn't really fit this listener. Kept in sync with
// docs/musicdna/archetype-bible.md.
export const ARCHETYPE_SCORE_FLOOR = 0.5;
export const ARCHETYPE_MARGIN_FLOOR = 0.05;

export type ArchetypeFlagReason =
  | "no_archetypes"
  | "low_score"
  | "ambiguous"
  | null;

export type ArchetypeAssignmentResult = {
  assignment: ArchetypeAssignment | null;
  winner_row: ArchetypeCatalogEntry | null; // full row so the Critic can read core_question/keywords
  flagged: boolean;
  flag_reason: ArchetypeFlagReason;
};

export function assignArchetype(
  userVector: Vector,
  archetypes: ArchetypeCatalogEntry[],
): ArchetypeAssignmentResult {
  const scored = archetypes
    .map((row) => {
      const axes = row.signature_axes ?? {};
      if (!Object.keys(axes).length) return null;
      return { row, score: scoreArchetype(userVector, axes) };
    })
    .filter((s): s is { row: ArchetypeCatalogEntry; score: number } => s !== null)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      assignment: null,
      winner_row: null,
      flagged: true,
      flag_reason: "no_archetypes",
    };
  }

  const best = scored[0];
  const runnerUp = scored[1]?.score ?? 0;
  const margin = Math.max(0, best.score - runnerUp);

  let flagged = false;
  let flag_reason: ArchetypeFlagReason = null;
  if (best.score < ARCHETYPE_SCORE_FLOOR) {
    flagged = true;
    flag_reason = "low_score";
  } else if (margin < ARCHETYPE_MARGIN_FLOOR) {
    flagged = true;
    flag_reason = "ambiguous";
  }

  const assignment: ArchetypeAssignment = {
    id: best.row.id,
    name: best.row.name,
    score: round3(best.score),
    margin: round3(margin),
    fit_tier: fitTier(best.score),
    runners_up: scored.slice(1, 3).map((s) => ({
      id: s.row.id,
      name: s.row.name,
      score: round3(s.score),
    })),
  };

  return { assignment, winner_row: best.row, flagged, flag_reason };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
