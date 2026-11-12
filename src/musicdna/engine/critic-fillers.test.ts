import { describe, expect, it } from "vitest";
import {
  FILLER_NEUTRAL,
  FILLER_PERSON,
  FILLER_REACTION,
  FILLER_SKIP,
  SKIP_OLD,
  SKIP_YOUNG,
  fillerLines,
  pickHunch,
  skipLine,
} from "./critic-fillers";

const ALL = [
  ...FILLER_NEUTRAL,
  ...FILLER_PERSON.flat(),
  ...FILLER_SKIP,
  SKIP_YOUNG,
  SKIP_OLD,
  ...Object.values(FILLER_REACTION).flat(),
];
const BANNED = /\b(immediacy|immersion|pressure|release|tension|refinement|rawness|intimacy|dimension|trait|axis)\b/i;

describe("critic fillers", () => {
  it("never name traits", () => {
    for (const line of ALL) expect(line).not.toMatch(BANNED);
  });
  it("no line repeats across opening + six picks", () => {
    const used = Array.from({ length: 7 }, (_, w) => [
      ...fillerLines(w, "against"),
    ]).flat();
    expect(new Set(used).size).toBe(used.length);
  });
  it("shows only a neutral line until the pick result is known", () => {
    expect(fillerLines(2)).toEqual([FILLER_NEUTRAL[2]]);
  });
  it("youngin' only when both skipped songs are pre-2000", () => {
    const old = [{ artist: "The Cure", year: 1989 }, { artist: "Joy Division", year: 1980 }];
    expect(skipLine(0, old)).toContain("youngin'");
    expect(skipLine(0, [{ artist: "The Cure", year: 1989 }, { artist: "Mitski", year: 2023 }])).not.toContain("youngin'");
  });
  it("OK boomer when both skipped songs are 2020+", () => {
    const fresh = [{ artist: "Mitski", year: 2023 }, { artist: "Fontaines D.C.", year: 2024 }];
    expect(skipLine(0, fresh)).toContain("OK boomer");
    expect(skipLine(0, fresh)).not.toContain("youngin'");
  });
});

describe("pickHunch", () => {
  it("first pick is always too early", () => expect(pickHunch({ tension: 80 }, "tension", -10, 1)).toBe("early"));
  it("weak lean is too early", () => expect(pickHunch({ tension: 10 }, "tension", -10, 3)).toBe("early"));
  it("pick against a strong lean", () => expect(pickHunch({ tension: 40 }, "tension", -12, 3)).toBe("against"));
  it("pick with a strong lean", () => expect(pickHunch({ tension: -40 }, "tension", -12, 3)).toBe("with"));
});
