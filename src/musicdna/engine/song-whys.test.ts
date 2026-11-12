import { describe, expect, it } from "vitest";
import { distinctiveTraits, explanationIsCurrent } from "./song-whys";

describe("distinctiveTraits", () => {
  it("picks at most three traits at least 20 points from neutral, strongest first", () => {
    const t = distinctiveTraits({ texture: 92, confidence: 75, scale: 20, tension: 65, movement: 69 });
    expect(t.map((x) => x.axis)).toEqual(["texture", "scale", "confidence"]);
  });
  it("returns nothing for a song with no strong traits", () => {
    expect(distinctiveTraits({ texture: 60, scale: 45 })).toEqual([]);
  });
});

describe("explanationIsCurrent", () => {
  it("goes stale when the song is rescored", () => {
    expect(explanationIsCurrent({ score_at_write: 92 }, 92)).toBe(true);
    expect(explanationIsCurrent({ score_at_write: 92 }, 80)).toBe(false);
  });
});
