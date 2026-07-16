import { describe, it, expect } from "vitest";
import { applyChoice, evaluateProbe, type ProbeState } from "./choice";

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

describe("evaluateProbe", () => {
  const emptyState: ProbeState = { probes_shown: [], pending: {}, lane_alignment: {}, flips: [] };

  it("is a no-op when the pairing isn't a probe", () => {
    const r = evaluateProbe({
      pairing_id: "p1",
      probe_state: emptyState,
      session_lane: "alternative" as never,
      delta_vector: {},
      prior_vector: {},
      tests: [],
    });
    expect(r.probe_lane).toBeNull();
    expect(r.flipped).toBe(false);
    expect(r.next_lane).toBe("alternative");
  });

  it("counts a win when cosine crosses the threshold and never mutates input", () => {
    const state: ProbeState = {
      probes_shown: [],
      pending: { p1: "pop" as never },
      lane_alignment: {},
      flips: [],
    };
    const r = evaluateProbe({
      pairing_id: "p1",
      probe_state: state,
      session_lane: "alternative" as never,
      // delta and prior perfectly aligned → cosine = 1
      delta_vector: { movement: 30 },
      prior_vector: { movement: 20 },
      tests: ["movement"],
    });
    expect(r.probe_lane).toBe("pop");
    expect(r.win).toBe(1);
    expect(r.probe_state.lane_alignment.pop.wins).toBe(1);
    expect(r.probe_state.pending.p1).toBeUndefined();
    // Input state untouched
    expect(state.pending.p1).toBe("pop");
    expect(state.lane_alignment.pop).toBeUndefined();
  });

  it("flips lane after two aligned wins", () => {
    let state: ProbeState = {
      probes_shown: [],
      pending: { p1: "pop" as never },
      lane_alignment: {},
      flips: [],
    };
    const r1 = evaluateProbe({
      pairing_id: "p1",
      probe_state: state,
      session_lane: "alternative" as never,
      delta_vector: { movement: 30 },
      prior_vector: { movement: 20 },
      tests: ["movement"],
    });
    expect(r1.flipped).toBe(false);
    state = { ...r1.probe_state, pending: { p2: "pop" as never } };
    const r2 = evaluateProbe({
      pairing_id: "p2",
      probe_state: state,
      session_lane: "alternative" as never,
      delta_vector: { movement: 40 },
      prior_vector: { movement: 25 },
      tests: ["movement"],
    });
    expect(r2.flipped).toBe(true);
    expect(r2.next_lane).toBe("pop");
    expect(r2.probe_state.flips[0].to).toBe("pop");
  });
});
