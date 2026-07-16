import { describe, it, expect } from "vitest";
import { applyChoice } from "./choice";

// evaluateProbe / ProbeState tests moved to
// src/musicdna/engine/experiments/cross-lane-probes.experimental.test.ts
// after cross-lane probes were quarantined out of the live engine.

const DIMS = ["movement", "atmosphere", "immersion", "scale"] as const;

describe("applyChoice", () => {
  it("adds weighted delta and reports topline dim", () => {
    const r = applyChoice({
      prior_vector: { movement: 10 },
      winner: { movement: 80, atmosphere: 30 },
      loser: { movement: 20, atmosphere: 70 },
      tests: ["movement", "atmosphere"],
      diagnostic_weight: 50, // w = 0.5
      fallback_dims: DIMS,
    });
    // movement: 10 + (80-20)*0.5 = 40
    expect(r.vector.movement).toBeCloseTo(40);
    // atmosphere: 0 + (30-70)*0.5 = -20
    expect(r.vector.atmosphere).toBeCloseTo(-20);
    // top |delta| is movement=60 vs atmosphere=40
    expect(r.top_dim).toBe("movement");
    expect(r.top_delta).toBe(60);
    // does not mutate prior
    expect(r.delta_vector.movement).toBe(60);
  });

  it("defaults weight to 50 and falls back to dims when tests empty", () => {
    const r = applyChoice({
      prior_vector: {},
      winner: { movement: 90 },
      loser: { movement: 10 },
      tests: [],
      diagnostic_weight: null,
      fallback_dims: DIMS,
    });
    expect(r.vector.movement).toBeCloseTo(40); // (90-10)*0.5
  });

  it("boundary: diagnostic_weight of 0 zeros out the delta (not defaulted to 50)", () => {
    const r = applyChoice({
      prior_vector: { movement: 10 },
      winner: { movement: 90 },
      loser: { movement: 10 },
      tests: ["movement"],
      diagnostic_weight: 0, // w = 0 → no learning from this pairing
      fallback_dims: DIMS,
    });
    expect(r.vector.movement).toBe(10); // unchanged from prior — no learning
    // delta_vector is the raw (winner-loser) diagnostic, independent of weight.
    expect(r.delta_vector.movement).toBe(80);
  });
});
