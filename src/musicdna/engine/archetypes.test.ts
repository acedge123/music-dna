import { describe, it, expect } from "vitest";
import {
  assignArchetype,
  ARCHETYPE_SCORE_FLOOR,
  ARCHETYPE_MARGIN_FLOOR,
} from "./archetypes";

const CATALOG = [
  { id: "arch-arch", name: "Architect", signature_axes: { craft: 1, escape: -0.5 } },
  { id: "arch-hed", name: "Hedonist", signature_axes: { escape: 1, craft: -0.5 } },
  { id: "arch-empty", name: "Empty", signature_axes: null },
];

describe("assignArchetype", () => {
  it("picks the archetype with the highest cosine", () => {
    const result = assignArchetype({ craft: 90, escape: -30 }, CATALOG);
    expect(result.assignment?.name).toBe("Architect");
    expect(result.flagged).toBe(false);
    expect(result.assignment?.runners_up[0].name).toBe("Hedonist");
  });

  it("returns runners_up with rounded scores and no self-entry", () => {
    const result = assignArchetype({ craft: 90, escape: -30 }, CATALOG);
    const names = result.assignment?.runners_up.map((r) => r.name) ?? [];
    expect(names).not.toContain("Architect");
    expect(result.assignment?.runners_up.every((r) => Number.isFinite(r.score))).toBe(true);
  });

  it("flags no_archetypes when the catalog is empty", () => {
    const result = assignArchetype({ craft: 10 }, []);
    expect(result.assignment).toBeNull();
    expect(result.flagged).toBe(true);
    expect(result.flag_reason).toBe("no_archetypes");
  });

  it("skips archetypes with null signature_axes", () => {
    const result = assignArchetype({ craft: 90 }, [CATALOG[2]]);
    expect(result.flag_reason).toBe("no_archetypes");
  });

  it("flags low_score with a constructed sub-floor winner (unconditional)", () => {
    // Archetype spans 5 axes (magnitude √5). User only hits one → cos = 1/√5 ≈ 0.447 < 0.5.
    const wide = [
      { id: "w", name: "Wide", signature_axes: { a: 1, b: 1, c: 1, d: 1, e: 1 } },
    ];
    const result = assignArchetype({ a: 100 }, wide);
    expect(result.assignment).not.toBeNull();
    expect(result.assignment!.score).toBeLessThan(ARCHETYPE_SCORE_FLOOR);
    expect(result.flagged).toBe(true);
    expect(result.flag_reason).toBe("low_score");
  });

  it("flags ambiguous when best and runner-up are within margin floor", () => {
    const twins = [
      { id: "a", name: "A", signature_axes: { craft: 1 } },
      { id: "b", name: "B", signature_axes: { craft: 1 } },
    ];
    const result = assignArchetype({ craft: 90 }, twins);
    expect(result.flagged).toBe(true);
    expect(result.flag_reason).toBe("ambiguous");
  });

  it("computes fit_tier from the winning score", () => {
    const result = assignArchetype({ craft: 100 }, [
      { id: "x", name: "X", signature_axes: { craft: 1 } },
    ]);
    expect(result.assignment?.fit_tier).toBe(95);
  });

  // ---------- Boundary cases ----------

  it("boundary: score exactly at the 0.5 floor is NOT flagged low_score", () => {
    // 4-axis archetype (magnitude 2); user hits one axis with value 100
    // → normalized magnitude 1, dot = 1 → cos = 1/2 = 0.5 exact.
    const four = [
      { id: "f", name: "Four", signature_axes: { a: 1, b: 1, c: 1, d: 1 } },
    ];
    const result = assignArchetype({ a: 100 }, four);
    expect(result.assignment!.score).toBeCloseTo(0.5, 10);
    expect(result.flag_reason).not.toBe("low_score");
    // Tier boundary: >= 0.5 → tier 50
    expect(result.assignment!.fit_tier).toBe(50);
  });

  it("boundary: margin just below 0.05 → ambiguous", () => {
    // Winner cos = 1, runner-up cos ≈ 0.96 → margin ≈ 0.04 < 0.05.
    const near = [
      { id: "w", name: "W", signature_axes: { a: 1, b: 0 } },
      { id: "r", name: "R", signature_axes: { a: 1, b: 0.29 } }, // mag ≈ 1.041, cos ≈ 0.961
    ];
    const result = assignArchetype({ a: 100 }, near);
    expect(result.assignment!.name).toBe("W");
    expect(result.assignment!.margin).toBeLessThan(ARCHETYPE_MARGIN_FLOOR);
    expect(result.flag_reason).toBe("ambiguous");
  });

  it("boundary: margin just above 0.05 → not flagged", () => {
    // Winner cos = 1, runner-up cos ≈ 0.928 → margin ≈ 0.072 > 0.05.
    const near = [
      { id: "w", name: "W", signature_axes: { a: 1, b: 0 } },
      { id: "r", name: "R", signature_axes: { a: 1, b: 0.4 } }, // mag ≈ 1.077, cos ≈ 0.928
    ];
    const result = assignArchetype({ a: 100 }, near);
    expect(result.assignment!.name).toBe("W");
    expect(result.assignment!.margin).toBeGreaterThan(ARCHETYPE_MARGIN_FLOOR);
    expect(result.flagged).toBe(false);
  });

  it("boundary: negative-cosine winner still assigns but flags low_score", () => {
    // User points opposite of the sole archetype → cos = -1.
    const only = [{ id: "o", name: "O", signature_axes: { craft: 1 } }];
    const result = assignArchetype({ craft: -100 }, only);
    expect(result.assignment).not.toBeNull();
    expect(result.assignment!.score).toBe(-1);
    expect(result.flagged).toBe(true);
    expect(result.flag_reason).toBe("low_score");
  });

  it("boundary: zero-vector listener scores 0 and flags low_score", () => {
    const result = assignArchetype({}, CATALOG);
    expect(result.assignment).not.toBeNull();
    expect(result.assignment!.score).toBe(0);
    expect(result.flag_reason).toBe("low_score");
  });

  it("boundary: listener with only unrelated dimensions scores 0", () => {
    // Archetype only cares about `craft`; user only supplies `escape` → normalized craft = 0.
    const only = [{ id: "o", name: "O", signature_axes: { craft: 1 } }];
    const result = assignArchetype({ escape: 100 }, only);
    expect(result.assignment!.score).toBe(0);
    expect(result.flag_reason).toBe("low_score");
  });
});
