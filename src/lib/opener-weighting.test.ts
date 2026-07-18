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
  it("weights sum to 9 (3+2+2+1+1)", () => {
    expect(Array.from(OPENER_SLOT_WEIGHTS)).toEqual([3, 2, 2, 1, 1]);
    expect(OPENER_WEIGHT_TOTAL).toBe(9);
  });

  it("slot 1 alone is not enough to win (3/9 < 0.5)", () => {
    const share = weightedLaneShare(p(["alternative", "unknown", "unknown", "unknown", "unknown"]));
    expect(share?.lane).toBe("alternative");
    expect(share?.share).toBeCloseTo(3 / 9, 3);
  });

  it("slot 1 + slot 2 clears the 0.5 threshold", () => {
    const share = weightedLaneShare(p(["alternative", "alternative", "pop", "pop", "hip_hop"]));
    expect(share?.lane).toBe("alternative");
    expect(share?.weight).toBe(5); // 3 + 2
    expect(share?.share).toBeCloseTo(5 / 9, 3);
    expect(share?.tied).toBe(false);
  });

  it("dominantPerSongLane returns the weighted top when unambiguous", () => {
    // alt=3+2=5, pop=2, hip_hop=1 → alternative wins.
    expect(dominantPerSongLane(p(["alternative", "alternative", "pop", "hip_hop", "unknown"]))).toBe("alternative");
    // alt=3+1=4, pop=2+2=4 → tied → null.
    expect(dominantPerSongLane(p(["alternative", "pop", "pop", "alternative", "unknown"]))).toBeNull();
  });

  it("returns null when all slots are unknown", () => {
    expect(weightedLaneShare(p(["unknown", "unknown", "unknown", "unknown", "unknown"]))).toBeNull();
    expect(dominantPerSongLane(p(["unknown", "unknown", "unknown", "unknown", "unknown"]))).toBeNull();
  });
});
