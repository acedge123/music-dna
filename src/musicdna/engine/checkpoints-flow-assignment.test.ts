import { describe, expect, it } from "vitest";
import { assignInterviewFlow, savedFlowFromProps } from "./checkpoints";

describe("assignInterviewFlow", () => {
  it("flag off: everyone stays per_pick, even capable mobile", () => {
    expect(assignInterviewFlow({ flag: "0", client: "web" })).toBe("per_pick");
    expect(assignInterviewFlow({ flag: undefined, client: "mobile", capability: "checkpoints-v1" })).toBe("per_pick");
  });
  it("flag on: web gets checkpoints", () => {
    expect(assignInterviewFlow({ flag: "1", client: "web" })).toBe("checkpoints");
  });
  it("flag on: older mobile without the capability stays per_pick", () => {
    expect(assignInterviewFlow({ flag: "1", client: "mobile" })).toBe("per_pick");
    expect(assignInterviewFlow({ flag: "1", client: "mobile", capability: "something-else" })).toBe("per_pick");
  });
  it("flag on: mobile advertising checkpoints-v1 gets checkpoints", () => {
    expect(assignInterviewFlow({ flag: "1", client: "mobile", capability: "checkpoints-v1" })).toBe("checkpoints");
    expect(assignInterviewFlow({ flag: "1", client: "mobile", capability: "foo, Checkpoints-V1" })).toBe("checkpoints");
  });
});

describe("savedFlowFromProps", () => {
  it("returns the saved flow; interviews with no saved flow ran per_pick", () => {
    expect(savedFlowFromProps({ flow: "checkpoints" })).toBe("checkpoints");
    expect(savedFlowFromProps({ flow: "per_pick" })).toBe("per_pick");
    expect(savedFlowFromProps(null)).toBe("per_pick");
  });
});
