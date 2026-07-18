// Pure session-start helpers.
//
// startSessionImpl reads a profile row from Supabase and inserts a new
// sessions row. Everything BETWEEN those two I/O calls — how the opening
// analysis becomes a lane, a confidence, a seed vector, and a probe
// candidate list — is deterministic and lives here so it can be unit-tested
// without a database, and so Flutter / future admin tools reuse it.
//
// Rule: no Supabase, no LLM, no time, no globals. Randomness enters via
// the injected `rng`.

import type { Rng } from "./ports";
import type { Vector, Lane } from "./types";
import { seedVectorFromPriors } from "./priors";

export type OpeningProfile = {
  opening_lane: Lane | null | undefined;
  opening_lane_confidence: number | null | undefined;
  opening_analysis_json:
    | {
        secondary_lanes?: string[];
        candidate_dimensions?: Record<string, number>;
        per_song?: Array<{ input?: string; lane?: string; canon_id?: string }>;
        canon_matches?: Array<{ song_id?: string; primary_lane?: string; year?: number | null }>;
      }
    | null
    | undefined;
};

export type CalibrationState = {
  active: boolean;
  candidate_lanes: Lane[];
  decade_clusters: string[]; // e.g. ["1980s", "1990s"]
  round_budget: number;      // how many calibration rounds to spend
  lane_wins: Record<string, number>;
};

export type StartSessionSeed = {
  lane: Lane;
  lane_confidence: number;
  probe_candidate_lanes: Lane[];
  seed_vector: Vector;
  calibration: CalibrationState;
};

export type BuildStartSessionInputs = {
  profile: OpeningProfile | null | undefined;
  all_lanes: readonly Lane[];
  rng: Rng;
  default_lane?: Lane;
  probe_max?: number;
  // Below this confidence the session enters lane-calibration mode for
  // rounds 1–2 regardless of the LLM's guessed lane.
  calibration_confidence_threshold?: number;
};

// Deterministic given (profile, all_lanes, rng, default_lane, probe_max).
export function buildStartSessionSeed(input: BuildStartSessionInputs): StartSessionSeed {
  const defaultLane = input.default_lane ?? ("general" as Lane);
  const probeMax = input.probe_max ?? 3;
  const calThresh = input.calibration_confidence_threshold ?? 0.6;
  const lane = (input.profile?.opening_lane ?? defaultLane) as Lane;
  const lane_confidence = Number(input.profile?.opening_lane_confidence ?? 0);

  const analysis = input.profile?.opening_analysis_json ?? {};
  const secondaries = (analysis.secondary_lanes ?? []).filter((l): l is Lane =>
    (input.all_lanes as readonly string[]).includes(l) && l !== lane,
  );
  const wildcardPool = input.all_lanes.filter((l) => l !== lane && !secondaries.includes(l));
  const wildcard =
    wildcardPool.length > 0
      ? wildcardPool[Math.floor(input.rng.next() * wildcardPool.length)]
      : undefined;
  const probe_candidate_lanes = Array.from(
    new Set([...secondaries, ...(wildcard ? [wildcard] : [])] as Lane[]),
  ).slice(0, probeMax);

  const seed_vector = seedVectorFromPriors(analysis.candidate_dimensions);

  // Candidate lanes for calibration: derived from ALL opening songs, not just
  // the LLM's top pick. Includes primary + secondaries + any per_song lane +
  // any canon-match primary_lane. Dedup, drop "general"/"unknown".
  const candidateSet = new Set<string>();
  if (lane && lane !== "general") candidateSet.add(lane);
  for (const s of secondaries) candidateSet.add(s);
  for (const ps of analysis.per_song ?? []) {
    if (typeof ps?.lane === "string" && ps.lane !== "unknown" && ps.lane !== "general") {
      if ((input.all_lanes as readonly string[]).includes(ps.lane)) candidateSet.add(ps.lane);
    }
  }
  for (const cm of analysis.canon_matches ?? []) {
    if (typeof cm?.primary_lane === "string" && (input.all_lanes as readonly string[]).includes(cm.primary_lane)) {
      candidateSet.add(cm.primary_lane);
    }
  }
  const candidate_lanes = Array.from(candidateSet) as Lane[];

  // Decade clusters from canon-matched years. Cheap, catalog-only — no
  // fabricated recognition scores or new metadata.
  const decadeSet = new Set<string>();
  for (const cm of analysis.canon_matches ?? []) {
    const y = Number(cm?.year ?? 0);
    if (Number.isFinite(y) && y > 1900) decadeSet.add(`${Math.floor(y / 10) * 10}s`);
  }
  const decade_clusters = Array.from(decadeSet);

  // Enter calibration mode when the read isn't confident enough to trust the
  // lane, OR when we have 2+ candidate lanes to disambiguate between.
  const calibrationActive = lane_confidence < calThresh || candidate_lanes.length >= 2;

  return {
    lane,
    lane_confidence,
    probe_candidate_lanes,
    seed_vector,
    calibration: {
      active: calibrationActive,
      candidate_lanes,
      decade_clusters,
      round_budget: 2,
      lane_wins: {},
    },
  };
}

