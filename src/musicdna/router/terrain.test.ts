import { describe, expect, it } from "vitest";
import {
  choiceRowsToTerrainInput,
  detectSkipPressure,
  detectVectorVolatility,
  sessionConfidence,
  sessionToTerrain,
  type ChoiceEventRow,
} from "./terrain";

const choice = (over: Partial<ChoiceEventRow> = {}): ChoiceEventRow => ({
  round: 1,
  raw_delta: { movement: 12, atmosphere: -8 },
  chosen_artist: "artist_a",
  ms_to_decide: 4000,
  ...over,
});

describe("sessionToTerrain canonical mapper", () => {
  it("uses Agent Brain D2 constants", () => {
    const terrain = sessionToTerrain(
      choiceRowsToTerrainInput({
        session_id: "quiet",
        lane: "alternative",
        lane_confidence: 0.8,
        vector: { movement: 40, atmosphere: 40, immersion: 40 },
        rounds_shown: 3,
        skipped_pairing_ids: [],
        choices: [choice(), choice(), choice()],
      }),
    );
    expect(terrain).toMatchObject({
      feedback_latency: "fast",
      reversibility: "medium",
      adversariality: "none",
      coordination_load: "low",
      time_horizon: "iterative",
      information_cost: "medium",
      environment_stability: "stable",
    });
  });

  it("treats skip pressure as high information cost and shifting environment", () => {
    const terrain = sessionToTerrain(
      choiceRowsToTerrainInput({
        session_id: "skips",
        lane: "alternative",
        lane_confidence: 0.8,
        vector: { movement: 40, atmosphere: 40, immersion: 40 },
        rounds_shown: 3,
        skipped_pairing_ids: ["a", "b"],
        choices: [choice()],
      }),
    );
    expect(terrain.information_cost).toBe("high");
    expect(terrain.environment_stability).toBe("shifting");
    expect(terrain.mode_pressure).toBe("explore");
  });

  it("keeps missing deltas unknown instead of calm", () => {
    const unknown = detectVectorVolatility(undefined);
    expect(unknown.known).toBe(false);
    expect(unknown.volatile).toBeNull();
    const terrain = sessionToTerrain(
      choiceRowsToTerrainInput({
        session_id: "missing-deltas",
        lane: "alternative",
        lane_confidence: 0.8,
        vector: { movement: 40, atmosphere: 40, immersion: 40 },
        rounds_shown: 3,
        skipped_pairing_ids: [],
        choices: [choice({ raw_delta: null })],
      }),
    );
    expect(terrain.ruggedness).toBe("medium");
  });

  it("detects confidence, artist bias, snap picks, and escape pressure", () => {
    expect(sessionConfidence({ movement: 40, atmosphere: 40 }).confidence).toBe(0.2);
    expect(detectSkipPressure(["a", "b"], 4).recognition_failing).toBe(true);

    const terrain = sessionToTerrain({
      session: {
        session_id: "escape",
        rounds_answered: 5,
        rounds_skipped: 0,
        rounds_shown: 5,
        vector: {},
        lane: "alternative",
        lane_confidence: 0.8,
        skipped_pairing_ids: [],
        artist_frequency: {},
      },
      recentChoices: [],
    });
    expect(terrain.mode_pressure).toBe("escape");
  });
});
