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

  // Regression: Dreams (Fleetwood Mac, classic_rock) / Teardrop (Massive Attack,
  // electronic) / Bitter Sweet Symphony (The Verve, alternative) — a genuinely
  // mixed opening trio. Must route to "general" with calibration ACTIVE and
  // all three lanes present as candidates, so rounds 1–2 disambiguate rather
  // than dumping the user into a random lane's pairings.
  it("mixed opening trio → general lane with calibration + candidate lanes populated", () => {
    const seed = buildStartSessionSeed({
      profile: {
        opening_lane: "general",
        opening_lane_confidence: 0.35, // uncertain by design
        opening_analysis_json: {
          per_song: [
            { input: "Dreams — Fleetwood Mac", lane: "classic_rock" },
            { input: "Teardrop — Massive Attack", lane: "electronic" },
            { input: "Bitter Sweet Symphony — The Verve", lane: "alternative" },
          ],
          canon_matches: [
            { primary_lane: "classic_rock", year: 1977 },
            { primary_lane: "electronic", year: 1998 },
            { primary_lane: "alternative", year: 1997 },
          ],
        },
      },
      all_lanes: ALL as never,
      rng: fixedRng(0),
    });
    expect(seed.lane).toBe("general");
    expect(seed.calibration.active).toBe(true);
    expect(seed.calibration.candidate_lanes).toEqual(
      expect.arrayContaining(["classic_rock", "electronic", "alternative"]),
    );
    expect(seed.calibration.decade_clusters).toEqual(
      expect.arrayContaining(["1970s", "1990s"]),
    );
    expect(seed.calibration.round_budget).toBe(2);
  });

  it("high-confidence single-lane opener → calibration inactive", () => {
    const seed = buildStartSessionSeed({
      profile: {
        opening_lane: "alternative",
        opening_lane_confidence: 0.9,
        opening_analysis_json: {
          per_song: [
            { input: "A", lane: "alternative" },
            { input: "B", lane: "alternative" },
            { input: "C", lane: "alternative" },
          ],
        },
      },
      all_lanes: ALL as never,
      rng: fixedRng(0),
    });
    expect(seed.lane).toBe("alternative");
    expect(seed.calibration.active).toBe(false);
  });
});
