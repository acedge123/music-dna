import { describe, it, expect } from "vitest";
import { regimeToKnobs } from "./knobs";

describe("regimeToKnobs", () => {
  it("explore softens the fork filter and boosts leaning axes", () => {
    const k = regimeToKnobs("explore");
    expect(k.fork_filter).toBe("soft");
    expect(k.challenge_boost ?? 0).toBeGreaterThan(1.5);
    expect(k.axis_need_slope ?? 0).toBeGreaterThan(0.6);
  });

  it("prune matches today's defaults (hard filter, 1.5 boost)", () => {
    const k = regimeToKnobs("prune");
    expect(k.fork_filter).toBe("hard");
    expect(k.challenge_boost).toBe(1.5);
  });

  it("compound exploits: hard filter, lower axis-need slope", () => {
    const k = regimeToKnobs("compound");
    expect(k.fork_filter).toBe("hard");
    expect(k.axis_need_slope ?? 1).toBeLessThan(0.6);
  });

  it("coordinate falls back to prune-shaped knobs (no-op safety)", () => {
    const k = regimeToKnobs("coordinate");
    expect(k.fork_filter).toBe("hard");
  });

  it("never touches mode or canon_floor — recognition stays lane-driven", () => {
    for (const r of ["explore", "prune", "compound", "coordinate"] as const) {
      const k = regimeToKnobs(r);
      expect(k.mode).toBeUndefined();
      expect(k.canon_floor).toBeUndefined();
    }
  });
});
