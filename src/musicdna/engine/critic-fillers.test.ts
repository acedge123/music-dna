import { describe, expect, it } from "vitest";
import { FILLER_NEUTRAL, FILLER_TENSION, FILLER_THINKING, fillerFor } from "./critic-fillers";

const ALL = [...FILLER_THINKING, ...FILLER_TENSION, ...FILLER_NEUTRAL];
const BANNED = /\b(immediacy|immersion|pressure|release|tension|refinement|rawness|intimacy|dimension|trait|axis)\b/i;

describe("critic fillers", () => {
  it("never name traits", () => {
    for (const line of ALL) expect(line).not.toMatch(BANNED);
  });
  it("opening plus six picks use 21 different lines, none repeated", () => {
    const used = Array.from({ length: 7 }, (_, w) => [0, 1, 2].map((t) => fillerFor(w, t))).flat();
    expect(used).toHaveLength(21);
    expect(new Set(used).size).toBe(21);
  });
});
