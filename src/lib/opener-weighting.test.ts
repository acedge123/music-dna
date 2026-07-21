import { describe, it, expect } from "vitest";
import {
  OPENER_SLOT_WEIGHTS,
  OPENER_WEIGHT_TOTAL,
  weightedLaneShare,
  dominantPerSongLane,
} from "./musicdna.functions";

const p = (lanes: Array<string>) =>
  lanes.map((lane) => ({ lane: lane as never }));

describe("opener slot weighting", () => {
  it("weights sum to 6 (3+2+1)", () => {
    expect(Array.from(OPENER_SLOT_WEIGHTS)).toEqual([3, 2, 1]);
    expect(OPENER_WEIGHT_TOTAL).toBe(6);
  });

  it("slot 1 alone clears the 0.5 threshold", () => {
    const share = weightedLaneShare(p(["alternative", "unknown", "unknown"]));
    expect(share?.lane).toBe("alternative");
    expect(share?.weight).toBe(3);
    expect(share?.share).toBeCloseTo(3 / 6, 3);
    expect(share?.tied).toBe(false);
  });

  it("slot 1 + slot 2 clears the 0.5 threshold", () => {
    const share = weightedLaneShare(p(["alternative", "alternative", "pop"]));
    expect(share?.lane).toBe("alternative");
    expect(share?.weight).toBe(5); // 3 + 2
    expect(share?.share).toBeCloseTo(5 / 6, 3);
    expect(share?.tied).toBe(false);
  });

  it("dominantPerSongLane returns the weighted top when unambiguous", () => {
    // alt=3+2=5, pop=1 -> alternative wins.
    expect(dominantPerSongLane(p(["alternative", "alternative", "pop"]))).toBe("alternative");
    // alt=3, pop=2+1=3 -> tied -> null.
    expect(dominantPerSongLane(p(["alternative", "pop", "pop"]))).toBeNull();
  });

  it("returns null when all slots are unknown", () => {
    expect(weightedLaneShare(p(["unknown", "unknown", "unknown"]))).toBeNull();
    expect(dominantPerSongLane(p(["unknown", "unknown", "unknown"]))).toBeNull();
  });
});
