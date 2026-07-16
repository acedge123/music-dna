import { describe, it, expect } from "vitest";
import {
  dot,
  magnitude,
  cosine,
  l1Over,
  scoreArchetype,
  fitTier,
} from "./scoring";

describe("dot / magnitude / cosine", () => {
  it("dot: only overlapping keys contribute", () => {
    expect(dot({ a: 2, b: 3 }, { a: 4, c: 5 })).toBe(8);
  });

  it("magnitude: Euclidean norm", () => {
    expect(magnitude({ a: 3, b: 4 })).toBe(5);
  });

  it("cosine: identical vectors = 1", () => {
    expect(cosine({ a: 1, b: 2 }, { a: 1, b: 2 })).toBeCloseTo(1);
  });

  it("cosine: opposite vectors = -1", () => {
    expect(cosine({ a: 1, b: 2 }, { a: -1, b: -2 })).toBeCloseTo(-1);
  });

  it("cosine: zero vector returns 0 (not NaN)", () => {
    expect(cosine({ a: 0 }, { a: 5 })).toBe(0);
    expect(cosine({}, { a: 5 })).toBe(0);
  });
});

describe("l1Over", () => {
  it("sums absolute values over given dims only", () => {
    expect(l1Over({ a: -3, b: 4, c: 99 }, ["a", "b"])).toBe(7);
  });
  it("treats missing dims as 0", () => {
    expect(l1Over({ a: 5 }, ["a", "b"])).toBe(5);
  });
});

describe("scoreArchetype", () => {
  it("normalizes user vector by /100 before cosine", () => {
    // User vector on -100..100 scale, archetype on -1..1
    const user = { craft: 80, escape: -40 };
    const arch = { craft: 1, escape: -0.5 };
    // Normalized user: { craft: 0.8, escape: -0.4 } — same direction as arch
    expect(scoreArchetype(user, arch)).toBeCloseTo(cosine({ craft: 0.8, escape: -0.4 }, arch));
  });

  it("only scores dimensions present on the archetype", () => {
    const user = { craft: 100, noise: 100 };
    const arch = { craft: 1 };
    // 'noise' ignored — normalized to { craft: 1.0 } vs { craft: 1 } = 1.0
    expect(scoreArchetype(user, arch)).toBeCloseTo(1);
  });

  it("returns 0 when user has no signal on scored dims", () => {
    expect(scoreArchetype({ other: 50 }, { craft: 1 })).toBe(0);
  });
});

describe("fitTier", () => {
  it("maps score to Archetype Bible tiers", () => {
    expect(fitTier(0.9)).toBe(95);
    expect(fitTier(0.75)).toBe(80);
    expect(fitTier(0.6)).toBe(50);
    expect(fitTier(0.2)).toBe(20);
    expect(fitTier(0)).toBe(20);
  });

  it("boundaries snap to the higher tier", () => {
    expect(fitTier(0.85)).toBe(95);
    expect(fitTier(0.7)).toBe(80);
    expect(fitTier(0.5)).toBe(50);
  });
});
