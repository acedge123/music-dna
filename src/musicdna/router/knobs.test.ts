import { describe, expect, it } from "vitest";
import {
  legacyKnobsForMode,
  regimeToKnobs,
  regimeToPairingKnobs,
  regimeToSelectionMode,
} from "./knobs";

describe("MusicDNA canonical PairingKnobs", () => {
  it("preserves legacy recognition behavior per selection mode", () => {
    expect(legacyKnobsForMode("diagnostic_first")).toMatchObject({
      mode: "diagnostic_first",
      recog_blend: 0,
      canon_floor: 0,
      challenge_boost: 1.5,
      fork_filter: "hard",
    });
    expect(legacyKnobsForMode("recognition_boost")).toMatchObject({
      mode: "recognition_boost",
      recog_blend: 0.4,
      canon_floor: 45,
    });
    expect(legacyKnobsForMode("recognition_first")).toMatchObject({
      mode: "recognition_first",
      recog_blend: 0.6,
      canon_floor: 55,
    });
  });

  it("maps selection mode exactly like Agent Brain", () => {
    expect(regimeToSelectionMode("compound", "general", 0.9)).toBe("recognition_first");
    expect(regimeToSelectionMode("compound", "alternative", 0.5)).toBe("recognition_boost");
    expect(regimeToSelectionMode("compound", "alternative", 0.8)).toBe("diagnostic_first");
    expect(regimeToSelectionMode("explore", "alternative", 0.8)).toBe("recognition_boost");
  });

  it("uses exact Agent Brain regimeToPairingKnobs values", () => {
    expect(regimeToPairingKnobs("explore", "alternative", 0.8)).toMatchObject({
      mode: "recognition_boost",
      fork_filter: "soft",
      challenge_boost: 1.2,
      axis_need_floor: 0.3,
      axis_need_span: 0.7,
      leaning_axis_count: 2,
    });
    expect(regimeToPairingKnobs("prune", "alternative", 0.8)).toMatchObject({
      mode: "diagnostic_first",
      fork_filter: "hard",
      challenge_boost: 1.8,
      axis_need_floor: 0.4,
      axis_need_span: 0.6,
      leaning_axis_count: 3,
    });
    expect(regimeToPairingKnobs("compound", "alternative", 0.8)).toMatchObject({
      mode: "diagnostic_first",
      fork_filter: "hard",
      challenge_boost: 1.3,
      axis_need_floor: 0.5,
      axis_need_span: 0.5,
      leaning_axis_count: 2,
      leaning_axis_threshold: 20,
    });
  });

  it("adapts canonical knobs to engine field names", () => {
    const k = regimeToKnobs("explore");
    expect(k).toMatchObject({
      mode: "recognition_boost",
      fork_filter: "soft",
      challenge_boost: 1.2,
      axis_need_base: 0.3,
      axis_need_slope: 0.7,
      leaning_top_k: 2,
      canon_floor: 45,
    });
  });
});
