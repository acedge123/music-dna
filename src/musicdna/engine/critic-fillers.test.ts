import { describe, expect, it } from "vitest";
import {
  FILLER_NEUTRAL,
  FILLER_PERSON,
  FILLER_REACTION,
  FILLER_SKIP,
  fillerLines,
  pickHunch,
  skipLine,
} from "./critic-fillers";

const ALL = [
  ...FILLER_NEUTRAL,
  ...FILLER_PERSON,
  ...FILLER_SKIP,
  ...Object.values(FILLER_REACTION).flat(),
];
const BANNED = /\b(immediacy|immersion|pressure|release|tension|refinement|rawness|intimacy|dimension|trait|axis)\b/i;

describe("critic fillers", () => {
  it("never name traits", () => {
    for (const line of ALL) expect(line).not.toMatch(BANNED);
  });
  it("no line repeats across opening + six picks", () => {
    const used = Array.from({ length: 7 }, (_, w) => [
      ...fillerLines(w),
      ...fillerLines(w, "against"),
    ]).flat();
    expect(new Set(used).size).toBe(used.length);
  });
  it("shows only a neutral line until the pick result is known", () => {
    expect(fillerLines(2)).toEqual([FILLER_NEUTRAL[2]]);
  });
  it("skip lines can name the skipped artist", () => {
    expect(skipLine(0, "The Cure")).toBe("What? No The Cure? Alright, youngin', I'll grab a new one.");
  });
});

describe("pickHunch", () => {
  it("first pick is always too early", () => expect(pickHunch({ tension: 80 }, "tension", -10, 1)).toBe("early"));
  it("weak lean is too early", () => expect(pickHunch({ tension: 10 }, "tension", -10, 3)).toBe("early"));
  it("pick against a strong lean", () => expect(pickHunch({ tension: 40 }, "tension", -12, 3)).toBe("against"));
  it("pick with a strong lean", () => expect(pickHunch({ tension: -40 }, "tension", -12, 3)).toBe("with"));
});
