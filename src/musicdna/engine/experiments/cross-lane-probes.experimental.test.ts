// EXPERIMENTAL — tests for the quarantined cross-lane probe flipping.
// The module under test is NOT part of createEngine() and is not called
// from any live server function. See:
//   src/musicdna/engine/experiments/cross-lane-probes.ts
//   docs/musicdna/experiments/cross-lane-probes.md

import { describe, it, expect } from "vitest";
import { evaluateProbe, type ProbeState } from "./cross-lane-probes";

describe("[experimental] cross-lane probe flipping — evaluateProbe", () => {
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
