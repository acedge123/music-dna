import { describe, expect, it } from "vitest";
import { reactionSelectionMode, reactionAcknowledgement } from "./critic-effects";

describe("critic reaction effects", () => {
  it.each(["recognition_first", "recognition_boost", "diagnostic_first"] as const)(
    "harder overrides %s",
    (mode) => {
      expect(reactionSelectionMode(mode, "harder")).toBe("diagnostic_first");
      expect(reactionSelectionMode(mode, "not_quite")).toBe(mode);
      expect(reactionSelectionMode(mode)).toBe(mode);
    },
  );
  it("acknowledges the earlier read without explaining an upcoming test", () => {
    expect(reactionAcknowledgement("not_quite", true, false, "Earlier read.")).toContain(
      "Earlier read.",
    );
    expect(reactionAcknowledgement("harder", false, false)).toContain(
      "not calling that a tougher test",
    );
  });
});
