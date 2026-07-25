import { describe, expect, it } from "vitest";
import { mapTerrain, type ChoiceEventRow } from "./terrain";

const choice = (over: Partial<ChoiceEventRow> = {}): ChoiceEventRow => ({
  round: 1,
  raw_delta: { movement: 12, atmosphere: -8 },
  chosen_artist: "artist_a",
  ms_to_decide: 4000,
  ...over,
});

describe("mapTerrain — constants (refinement #1)", () => {
  it("hard-codes information_cost=medium and reversibility=medium", () => {
    const f = mapTerrain({
      lane_confidence: 0.7,
      round: 3,
      max_rounds: 6,
      choices: [choice(), choice(), choice()],
      skipped_rounds_last3: 0,
    });
    expect(f.information_cost).toBe("medium");
    expect(f.reversibility).toBe("medium");
    expect(f.feedback_latency).toBe("fast");
    expect(f.adversariality).toBe("none");
  });
});

describe("mapTerrain — skips as first-class signal (refinement #5)", () => {
  it("2+ recent skips force uncertainty=high even with strong lane confidence", () => {
    const f = mapTerrain({
      lane_confidence: 0.9,
      round: 4,
      max_rounds: 6,
      choices: [choice(), choice()],
      skipped_rounds_last3: 2,
    });
    expect(f.uncertainty).toBe("high");
    expect(f.ruggedness).toBe("high");
  });

  it("no skips + strong lane confidence + steady deltas → uncertainty=low", () => {
    const f = mapTerrain({
      lane_confidence: 0.8,
      round: 4,
      max_rounds: 6,
      choices: [
        choice({ raw_delta: { m: 10 } }),
        choice({ raw_delta: { m: 11 } }),
        choice({ raw_delta: { m: 9 } }),
      ],
      skipped_rounds_last3: 0,
    });
    expect(f.uncertainty).toBe("low");
  });
});

describe("mapTerrain — missing raw_delta (refinement #4)", () => {
  it("null raw_delta counts as insufficient data, not smooth", () => {
    const f = mapTerrain({
      lane_confidence: 0.7,
      round: 1,
      max_rounds: 6,
      choices: [choice({ raw_delta: null })],
      skipped_rounds_last3: 0,
    });
    // With <2 delta samples and no skips, ruggedness lands at "low" but the
    // derived summary must expose the sample count so shadow analysis can
    // discount the result.
    expect(f.derived.delta_samples).toBe(0);
    expect(f.derived.delta_volatility).toBeNull();
  });
});

describe("mapTerrain — artist bias mirrors finalizeSession (refinement #7)", () => {
  it("3+ picks from one artist raises local_minima_risk", () => {
    const f = mapTerrain({
      lane_confidence: 0.7,
      round: 4,
      max_rounds: 6,
      choices: [
        choice({ chosen_artist: "same" }),
        choice({ chosen_artist: "same" }),
        choice({ chosen_artist: "same" }),
        choice({ chosen_artist: "same" }),
      ],
      skipped_rounds_last3: 0,
    });
    expect(f.derived.artist_bias_share).toBe(1);
    expect(f.local_minima_risk).toBe("high");
  });

  it("mixed artists keep local_minima_risk low", () => {
    const f = mapTerrain({
      lane_confidence: 0.7,
      round: 4,
      max_rounds: 6,
      choices: [
        choice({ chosen_artist: "a" }),
        choice({ chosen_artist: "b" }),
        choice({ chosen_artist: "c" }),
        choice({ chosen_artist: "d" }),
      ],
      skipped_rounds_last3: 0,
    });
    expect(f.local_minima_risk).toBe("low");
  });
});

describe("mapTerrain — branching follows round position (refinement #8 setup)", () => {
  it("round 1/6 = high branching; round 5/6 = low branching", () => {
    const early = mapTerrain({
      lane_confidence: 0.7,
      round: 1,
      max_rounds: 6,
      choices: [choice()],
      skipped_rounds_last3: 0,
    });
    const late = mapTerrain({
      lane_confidence: 0.7,
      round: 5,
      max_rounds: 6,
      choices: [choice(), choice(), choice(), choice(), choice()],
      skipped_rounds_last3: 0,
    });
    expect(early.branching_factor).toBe("high");
    expect(late.branching_factor).toBe("low");
  });
});
