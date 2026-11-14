import { describe, expect, it } from "vitest";
import { quipBudget, waitQuips } from "./critic-wait";
import { PERSON_QUIP_GROUPS, reactionQuipGroup, selectQuipGroups } from "./quip-sequences";

describe("checkpoint wait pacing", () => {
  it("uses at most three quips after answer 2", () => expect(quipBudget("checkpoints", 2)).toBe(3));
  it("uses at most four quips after answer 4", () => expect(quipBudget("checkpoints", 4)).toBe(4));
  it("uses only one quip between checkpoints", () => {
    for (const answer of [1, 3, 5]) expect(quipBudget("checkpoints", answer)).toBe(1);
  });
  it("continues beyond four quips at the final reading", () => {
    const lines = waitQuips(6, "early", null, quipBudget("checkpoints", 6), new Set());
    expect(lines.length).toBeGreaterThan(4);
    expect(new Set(lines).size).toBe(lines.length);
  });
  it("never reuses earlier displayed lines at the final wait", () => {
    const used = new Set(waitQuips(2, "early", null, 3, new Set()));
    const lines = waitQuips(6, "early", null, Infinity, used);
    expect(lines.some((line) => used.has(line))).toBe(false);
  });
  it("keeps the opener stable when the saved hunch arrives", () => {
    expect(waitQuips(1, null, null, 1, new Set())).toEqual(
      waitQuips(1, "against", null, 1, new Set()),
    );
  });
  it("keeps setup and punchline adjacent within the three-line budget", () => {
    expect(waitQuips(2, "early", null, 3, new Set()).slice(1)).toEqual([
      "Somebody raised you right.",
      "Or you rebelled perfectly.",
    ]);
  });
  it("never splits a two-part group to fit a one-line budget", () => {
    expect(selectQuipGroups([PERSON_QUIP_GROUPS[0]], 1, new Set())).toEqual([]);
  });
  it("never selects an orphaned punchline when its setup was seen", () => {
    expect(
      selectQuipGroups([PERSON_QUIP_GROUPS[0]], 3, new Set([PERSON_QUIP_GROUPS[0].lines[0]])),
    ).toEqual([]);
  });
  it("keeps incompatible prediction reactions and praise groups out of the same queue", () => {
    expect(
      selectQuipGroups([reactionQuipGroup("against", 2), PERSON_QUIP_GROUPS[0]], 4, new Set())
        .length,
    ).toBe(1);
  });
});
