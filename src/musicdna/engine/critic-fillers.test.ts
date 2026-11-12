import { describe, expect, it } from "vitest";
import { CRITIC_FILLERS, fillerAt } from "./critic-fillers";

const BANNED = /\b(immediacy|immersion|pressure|release|tension|refinement|rawness|intimacy|vast|dimension|trait|axis|you (always|prefer|favor))\b/i;

describe("critic fillers", () => {
  it("never name traits or claim findings", () => {
    for (const line of CRITIC_FILLERS) expect(line).not.toMatch(BANNED);
  });
  it("rotate without repeating consecutive lines", () => {
    const seen = Array.from({ length: CRITIC_FILLERS.length }, (_, i) => fillerAt("s1", i));
    expect(new Set(seen).size).toBe(CRITIC_FILLERS.length);
  });
});
