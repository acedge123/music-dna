import { describe, expect, it } from "vitest";
import { FILLER_REACTION } from "@/musicdna/engine/critic-fillers";
import { quipBudget, waitQuips } from "./critic-wait";
import {
  NEUTRAL_QUIP_GROUPS,
  OVERTIME_QUIP_GROUPS,
  PERSON_QUIP_GROUPS,
  reactionQuipGroup,
  selectQuipGroups,
} from "./quip-sequences";

const category = (line: string) => {
  if (NEUTRAL_QUIP_GROUPS.some((g) => g.lines.includes(line))) return "neutral";
  if (PERSON_QUIP_GROUPS.some((g) => g.lines.includes(line))) return "person";
  if (OVERTIME_QUIP_GROUPS.some((g) => g.lines.includes(line))) return "overtime";
  return "reaction";
};

describe("six-pick wait pacing", () => {
  for (const flow of ["per_pick", "checkpoints"] as const) {
    it(`${flow}: pick one is neutral only`, () => {
      expect(waitQuips(1, "against", null, quipBudget(flow, 1), new Set()).map(category)).toEqual([
        "neutral",
      ]);
    });
    it(`${flow}: pick two is reaction then complete person pair`, () => {
      expect(waitQuips(2, "with", null, quipBudget(flow, 2), new Set()).map(category)).toEqual([
        "reaction",
        "person",
        "person",
      ]);
    });
    it(`${flow}: pick three is reaction only`, () => {
      expect(waitQuips(3, "against", null, quipBudget(flow, 3), new Set()).map(category)).toEqual([
        "reaction",
      ]);
    });
    it(`${flow}: pick four is neutral reaction person`, () => {
      expect(waitQuips(4, "with", null, quipBudget(flow, 4), new Set()).map(category)).toEqual([
        "neutral",
        "reaction",
        "person",
      ]);
    });
    it(`${flow}: pick five is neutral only`, () => {
      expect(waitQuips(5, "against", null, quipBudget(flow, 5), new Set()).map(category)).toEqual([
        "neutral",
      ]);
    });
    it(`${flow}: pick six starts neutral reaction person`, () => {
      expect(waitQuips(6, "with", null, quipBudget(flow, 6), new Set()).map(category)).toEqual([
        "neutral",
        "reaction",
        "person",
      ]);
    });
  }
  it("only pick-six final writing gets twelve Overtime beats after its primary pattern", () => {
    expect(waitQuips(6, "early", null, Infinity, new Set(), true).map(category)).toEqual([
      "neutral",
      "reaction",
      "person",
      ...Array(12).fill("overtime"),
    ]);
    for (const pick of [0, 1, 2, 3, 4, 5])
      expect(waitQuips(pick, "early", null, Infinity, new Set(), true).map(category)).not.toContain(
        "overtime",
      );
    expect(waitQuips(6, "early", null, Infinity, new Set(), false).map(category)).not.toContain(
      "overtime",
    );
  });
  it("reaction-first waits do not invent a reaction before the saved hunch", () => {
    expect(waitQuips(2, null, null, 3, new Set())).toEqual([]);
    expect(waitQuips(3, null, null, 1, new Set())).toEqual([]);
  });
  it("never reuses any earlier displayed line in a six-pick interview", () => {
    const used = new Set<string>();
    for (let pick = 1; pick <= 6; pick++) {
      const lines = waitQuips(
        pick,
        "early",
        "1980s",
        quipBudget("per_pick", pick),
        used,
        pick === 6,
      );
      expect(lines.some((line) => used.has(line))).toBe(false);
      expect(new Set(lines).size).toBe(lines.length);
      lines.forEach((line) => used.add(line));
    }
    const lines = waitQuips(6, "early", null, Infinity, used, true);
    expect(lines.some((line) => used.has(line))).toBe(false);
  });
  it("keeps the opener stable when the saved hunch arrives", () => {
    expect(waitQuips(1, null, null, 1, new Set())).toEqual(
      waitQuips(1, "against", null, 1, new Set()),
    );
  });
  it("era decoration never replaces the requested person slot", () => {
    expect(waitQuips(2, "early", "1980s", 3, new Set()).map(category)).toEqual([
      "reaction",
      "person",
      "person",
    ]);
  });
  it("does not follow a confident prediction with a surprise claim", () => {
    const used = new Set<string>([FILLER_REACTION.with[0]]);
    const lines = waitQuips(2, "against", null, 3, used);
    expect(lines.some((line) => FILLER_REACTION.against.includes(line as never))).toBe(false);
  });
  it("does not follow a surprise claim with a confident prediction", () => {
    const used = new Set<string>([FILLER_REACTION.against[0]]);
    const lines = waitQuips(4, "with", null, 4, used);
    expect(lines.some((line) => FILLER_REACTION.with.includes(line as never))).toBe(false);
  });
  it("avoids a surprise punchline after an earlier confident prediction", () => {
    const used = new Set<string>([FILLER_REACTION.with[0]]);
    expect(waitQuips(3, "early", null, 3, used)).not.toContain("I'm as surprised as you are.");
    expect(waitQuips(6, "early", null, Infinity, used)).not.toContain(
      "I'm as surprised as you are.",
    );
  });
  it("never splits a two-part group to fit a one-line budget", () => {
    expect(selectQuipGroups([PERSON_QUIP_GROUPS[0]], 1, new Set())).toEqual([]);
  });
  it("never selects an orphaned punchline when its setup was seen", () => {
    expect(
      selectQuipGroups([PERSON_QUIP_GROUPS[0]], 3, new Set([PERSON_QUIP_GROUPS[0].lines[0]])),
    ).toEqual([]);
  });
  it("allows a conditional reaction followed by a compatible person pair", () => {
    expect(
      selectQuipGroups([reactionQuipGroup("against", 2), PERSON_QUIP_GROUPS[0]], 4, new Set())
        .length,
    ).toBe(3);
  });
  it("still excludes the surprise person pair after a confident reaction", () => {
    expect(
      selectQuipGroups([reactionQuipGroup("with", 2), PERSON_QUIP_GROUPS[3]], 4, new Set()).map(
        category,
      ),
    ).toEqual(["reaction"]);
  });
});
