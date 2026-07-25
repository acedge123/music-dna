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
  it("quiet session: information_cost=low, environment_stability=stable (Cursor #4)", () => {
    const f = mapTerrain({
      lane_confidence: 0.7,
      round: 3,
      max_rounds: 6,
      choices: [choice(), choice(), choice()],
      skipped_rounds_last3: 0,
    });
    expect(f.information_cost).toBe("low");
    expect(f.environment_stability).toBe("stable");
    expect(f.reversibility).toBe("medium");
    expect(f.feedback_latency).toBe("fast");
    expect(f.adversariality).toBe("none");
  });

  it("skip pressure drives information_cost=high and environment_stability=unstable (Cursor #4)", () => {
    const f = mapTerrain({
      lane_confidence: 0.7,
      round: 3,
      max_rounds: 6,
      choices: [choice(), choice(), choice()],
      skipped_rounds_last3: 2,
    });
    expect(f.information_cost).toBe("high");
    expect(f.environment_stability).toBe("unstable");
  });

  it("vector_confidence=0 with strong lane_confidence still raises uncertainty (Cursor #3)", () => {
    const f = mapTerrain({
      lane_confidence: 0.9,
      vector_confidence: 0.1,
      round: 3,
      max_rounds: 6,
      choices: [choice(), choice(), choice()],
      skipped_rounds_last3: 0,
    });
    // Weak vector (0.1) dominates; combined confidence < 0.4 → high uncertainty.
    expect(f.uncertainty).toBe("high");
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

describe("mapTerrain — missing raw_delta (refinement #4 revised)", () => {
  it("null raw_delta with pending choice → unknown, mapped to medium not low", () => {
    const f = mapTerrain({
      lane_confidence: 0.8,
      round: 1,
      max_rounds: 6,
      choices: [choice({ raw_delta: null })],
      skipped_rounds_last3: 0,
    });
    expect(f.derived.delta_samples).toBe(0);
    expect(f.derived.delta_volatility).toBeNull();
    // "Unknown delta" must never look smooth — the old branch mapped this
    // to ruggedness=low, which biased the router toward compound.
    expect(f.ruggedness).toBe("medium");
    expect(f.uncertainty).toBe("medium");
  });
});

describe("mapTerrain — volatility captures direction, not just magnitude", () => {
  it("direction-flipping deltas (+50 / -50 / +50) register as rugged", () => {
    const f = mapTerrain({
      lane_confidence: 0.8,
      round: 3,
      max_rounds: 6,
      choices: [
        choice({ raw_delta: { m: 50 } }),
        choice({ raw_delta: { m: -50 } }),
        choice({ raw_delta: { m: 50 } }),
      ],
      skipped_rounds_last3: 0,
    });
    // L2 step distance between (+50) and (-50) is 100; old mean-|delta|
    // metric would have called this perfectly smooth.
    expect(f.derived.delta_volatility).not.toBeNull();
    expect(f.ruggedness).toBe("high");
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
