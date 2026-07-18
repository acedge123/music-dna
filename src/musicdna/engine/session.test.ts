import { describe, it, expect } from "vitest";
import { buildStartSessionSeed } from "./session";

const ALL: readonly string[] = ["alternative", "pop", "hip_hop", "electronic", "classic_rock", "metal", "country", "r_and_b"];

const fixedRng = (v: number) => ({ next: () => v });

describe("buildStartSessionSeed", () => {
  it("uses profile lane and confidence", () => {
    const seed = buildStartSessionSeed({
      profile: {
        opening_lane: "alternative",
        opening_lane_confidence: 0.82,
        opening_analysis_json: { secondary_lanes: ["pop"], candidate_dimensions: { movement: 40 } },
      },
      all_lanes: ALL as never,
      rng: fixedRng(0),
    });
    expect(seed.lane).toBe("alternative");
    expect(seed.lane_confidence).toBeCloseTo(0.82);
    expect(seed.probe_candidate_lanes[0]).toBe("pop");
    // seedVectorFromPriors scales by PRIOR_SEED_WEIGHT=0.35, so 40 → 14.
    expect(seed.seed_vector.movement).toBeCloseTo(14);
  });

  it("falls back to general when profile is missing", () => {
    const seed = buildStartSessionSeed({
      profile: null,
      all_lanes: ALL as never,
      rng: fixedRng(0),
    });
    expect(seed.lane).toBe("general");
    expect(seed.lane_confidence).toBe(0);
    expect(seed.seed_vector).toEqual({});
  });

  it("excludes the primary lane from probe candidates and appends a wildcard", () => {
    const seed = buildStartSessionSeed({
      profile: {
        opening_lane: "pop",
        opening_lane_confidence: 0.5,
        opening_analysis_json: { secondary_lanes: ["pop", "alternative"] },
      },
      all_lanes: ALL as never,
      rng: fixedRng(0),
    });
    expect(seed.probe_candidate_lanes).not.toContain("pop");
    expect(seed.probe_candidate_lanes[0]).toBe("alternative");
    expect(seed.probe_candidate_lanes.length).toBeGreaterThanOrEqual(2);
    // wildcard is the first non-secondary, non-primary lane at rng=0.
    expect(seed.probe_candidate_lanes[seed.probe_candidate_lanes.length - 1]).not.toBe("pop");
  });
});
