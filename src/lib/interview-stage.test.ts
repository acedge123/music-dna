import { describe, expect, it } from "vitest";
import { interviewStage } from "./interview-stage";

const playing = { phase: "playing", busy: false, pairing: true, pendingPick: false, pendingSkip: false, checkpoint: false, finalWriting: false };
describe("exclusive checkpoint stages", () => {
  it("holds checkpoint 2 or 4 separately from a fetched next pairing", () => {
    expect(interviewStage({ ...playing, checkpoint: true })).toBe("checkpoint");
  });
  it("releases only the pairing after Continue clears the checkpoint", () => {
    expect(interviewStage(playing)).toBe("pairing");
  });
  it("keeps final writing separate even when a checkpoint or old pairing remains", () => {
    expect(interviewStage({ ...playing, checkpoint: true, finalWriting: true })).toBe("wait");
  });
  it("replaces the final retry screen while retrying, then returns to the final screen", () => {
    expect(interviewStage({ ...playing, phase: "done", finalWriting: true })).toBe("wait");
    expect(interviewStage({ ...playing, phase: "done" })).toBe("final");
  });
  it("shows a skip wait without treating the skipped pairing as active", () => {
    expect(interviewStage({ ...playing, busy: true, pendingSkip: true })).toBe("wait");
  });
});