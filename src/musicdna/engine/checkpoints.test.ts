import { describe, expect, it } from "vitest";
import {
  checkpointActions,
  checkpointIndex,
  checkpointsEnabled,
  shouldPrepareForPick,
  writesCriticRead,
} from "./checkpoints";

describe("critic checkpoints", () => {
  it("is off unless the flag is exactly 1", () => {
    expect(checkpointsEnabled(undefined)).toBe(false);
    expect(checkpointsEnabled("true")).toBe(false);
    expect(checkpointsEnabled("1")).toBe(true);
  });
  it("checkpoints land after answered choices 2 and 4 only", () => {
    expect([1, 2, 3, 4, 5, 6].map(checkpointIndex)).toEqual([null, 1, null, 2, null, null]);
  });
  it("writes the Critic only at checkpoints when on, every pick when off", () => {
    expect([1, 2, 3, 4, 5, 6].filter((n) => writesCriticRead("checkpoints", n))).toEqual([2, 4]);
    expect([1, 2, 3].every((n) => writesCriticRead("per_pick", n))).toBe(true);
  });
  it("pre-drafts only for checkpoint picks and the final pick", () => {
    expect([1, 2, 3, 4, 5, 6].filter((n) => shouldPrepareForPick("checkpoints", n))).toEqual([2, 4, 6]);
  });
  it("first checkpoint only continues; second offers reading or the final pair", () => {
    expect(checkpointActions(1, true)).toEqual(["continue"]);
    expect(checkpointActions(2, true)).toEqual(["finish", "continue"]);
    expect(checkpointActions(2, false)).toEqual(["finish"]);
  });
});
