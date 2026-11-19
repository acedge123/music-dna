import { describe, expect, it } from "vitest";
import { needsInterimRead } from "./final-reading-state";

describe("final reading delivery state", () => {
  it("pick six never waits for an interim read before the final report in either flow", () => {
    expect(needsInterimRead("per_pick", 6, null)).toBe(false);
    expect(needsInterimRead("checkpoints", 6, null)).toBe(false);
    expect(needsInterimRead("per_pick", 5, null)).toBe(true);
    expect(needsInterimRead("checkpoints", 4, 2)).toBe(true);
    expect(needsInterimRead("checkpoints", 5, null)).toBe(false);
  });
});
