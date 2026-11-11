import { describe, expect, it } from "vitest";
import { interviewMilestone } from "./interview-milestone";
import type { Exchange } from "./session-history";

function history(count: number): Exchange[] {
  return Array.from({ length: count }, (_, i) => [
    {
      type: "choice",
      at: `${i}`,
      pairing_id: `p${i}`,
      pairing: null,
      chosen: { id: `${i}`, title: `Song ${i}`, artist: "Artist", year: null, lane: null },
      rejected: null,
      feedback: null,
    },
    {
      type: "read",
      at: `${i}`,
      answered: i + 1,
      tier: "theory",
      thesis: "Saved read",
      direction: "holding",
      top_dim: "scale",
      revised: false,
      revision: null,
    },
  ]).flat() as Exchange[];
}

describe("REST interview milestones from frozen history", () => {
  it("uses the shared halftime wording and exact three chosen titles", () => {
    const m = interviewMilestone(history(3), false);
    expect(m).toMatchObject({ answered: 3, can_finish: false, continue_label: "Three more" });
    expect(m?.summary).toContain("Song 0, Song 1, Song 2. One thread keeps turning up.");
  });
  it("does not count skips or reactions toward finish eligibility", () => {
    const h = history(3);
    h.push({ type: "skip", at: "4", pairing_id: "skipped", reason: null });
    h.push({ type: "reaction", at: "5", kind: "thats_me" });
    expect(interviewMilestone(h, false)?.can_finish).toBe(false);
  });
  it("offers initial reading after four actual answers", () => {
    expect(interviewMilestone(history(4), false)).toMatchObject({ answered: 4, can_finish: true });
  });
  it("never offers milestones on completed or other answer counts", () => {
    for (const n of [0, 1, 2, 5, 6]) expect(interviewMilestone(history(n), false)).toBeNull();
    expect(interviewMilestone(history(4), true)).toBeNull();
  });
  it("does not invent a title or pattern for unavailable frozen evidence", () => {
    const h = history(3);
    if (h[0].type === "choice") h[0].chosen = null;
    expect(interviewMilestone(h, false)?.summary).toBe("Halfway there. The story stays open.");
  });
  it("retains contradictory evidence in the shared summary", () => {
    const h = history(3);
    if (h[5].type === "read") h[5].direction = "contested";
    expect(interviewMilestone(h, false)?.summary).toContain("pulling in two directions");
  });
});
