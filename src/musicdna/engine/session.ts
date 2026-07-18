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
    | { secondary_lanes?: string[]; candidate_dimensions?: Record<string, number> }
    | null
    | undefined;
};

export type StartSessionSeed = {
  lane: Lane;
  lane_confidence: number;
  probe_candidate_lanes: Lane[];
  seed_vector: Vector;
};

export type BuildStartSessionInputs = {
  profile: OpeningProfile | null | undefined;
  all_lanes: readonly Lane[];
  rng: Rng;
  default_lane?: Lane;
  probe_max?: number;
};

// Deterministic given (profile, all_lanes, rng, default_lane, probe_max).
export function buildStartSessionSeed(input: BuildStartSessionInputs): StartSessionSeed {
  const defaultLane = input.default_lane ?? ("general" as Lane);
  const probeMax = input.probe_max ?? 3;
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
  return { lane, lane_confidence, probe_candidate_lanes, seed_vector };
}
