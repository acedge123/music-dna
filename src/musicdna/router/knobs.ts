import type { PairingKnobs as EnginePairingKnobs } from "@/musicdna/engine/pairing";
import {
  RECOGNITION_FLOORS,
  type PairingKnobs,
  type Regime,
  type SelectionMode,
} from "./types";

export type RegimeKnobs = Partial<EnginePairingKnobs>;

export function legacyKnobsForMode(mode: SelectionMode): PairingKnobs {
  return {
    mode,
    recog_blend: mode === "recognition_first" ? 0.6 : mode === "recognition_boost" ? 0.4 : 0,
    canon_floor: RECOGNITION_FLOORS[mode],
    challenge_boost: 1.5,
    leaning_axis_threshold: 15,
    leaning_axis_count: 3,
    axis_need_floor: 0.4,
    axis_need_span: 0.6,
    fork_filter: "hard",
  };
}

export function regimeToSelectionMode(
  regime: Regime,
  sessionLane: string,
  laneConfidence: number,
): SelectionMode {
  if (sessionLane === "general") return "recognition_first";
  if (laneConfidence < 0.6) return "recognition_boost";
  return regime === "explore" ? "recognition_boost" : "diagnostic_first";
}

export function regimeToPairingKnobs(
  regime: Regime,
  sessionLane: string,
  laneConfidence: number,
): PairingKnobs {
  const effective: Regime = regime === "coordinate" ? "explore" : regime;
  const mode = regimeToSelectionMode(effective, sessionLane, laneConfidence);
  const base = legacyKnobsForMode(mode);

  switch (effective) {
    case "explore":
      return {
        ...base,
        fork_filter: "soft",
        challenge_boost: 1.2,
        axis_need_floor: 0.3,
        axis_need_span: 0.7,
        leaning_axis_count: 2,
      };
    case "prune":
      return {
        ...base,
        fork_filter: "hard",
        challenge_boost: 1.8,
        axis_need_floor: 0.4,
        axis_need_span: 0.6,
        leaning_axis_count: 3,
      };
    case "compound":
      return {
        ...base,
        fork_filter: "hard",
        challenge_boost: 1.3,
        axis_need_floor: 0.5,
        axis_need_span: 0.5,
        leaning_axis_count: 2,
        leaning_axis_threshold: 20,
      };
  }
}

export function toEnginePairingKnobs(knobs: PairingKnobs): EnginePairingKnobs {
  return {
    leaning_threshold: knobs.leaning_axis_threshold,
    leaning_top_k: knobs.leaning_axis_count,
    challenge_boost: knobs.challenge_boost,
    axis_need_base: knobs.axis_need_floor,
    axis_need_slope: knobs.axis_need_span,
    recog_blend_recognition_first: knobs.mode === "recognition_first" ? knobs.recog_blend : 0.6,
    recog_blend_recognition_boost: knobs.mode === "recognition_boost" ? knobs.recog_blend : 0.4,
    mode: knobs.mode,
    fork_filter: knobs.fork_filter,
    canon_floor: knobs.canon_floor,
  };
}

export function regimeToKnobs(
  regime: Regime,
  sessionLane = "alternative",
  laneConfidence = 0.8,
): RegimeKnobs {
  return toEnginePairingKnobs(regimeToPairingKnobs(regime, sessionLane, laneConfidence));
}
