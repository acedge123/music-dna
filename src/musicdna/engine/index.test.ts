// Golden-fixture test: drive the full engine loop with in-memory gateways.
//
// This is the regression net for the domain logic. If cosine, archetype
// scoring, probe alignment, or pairing selection tweaks change behavior,
// this test surfaces it before web/Flutter hit it in production.

import { describe, expect, it } from "vitest";
import {
  createEngine,
  seededRng,
  fixedClock,
} from "./index";
import {
  createInMemorySupabaseGateway,
  createScriptedLLMGateway,
  emptyStore,
} from "./testing";
import type { ArchetypeCatalogEntry } from "./archetypes";
import type { PairingCandidate } from "./pairing";

const DIMS = [
  "movement", "atmosphere", "immersion", "scale", "community",
  "perspective", "confidence", "tension", "texture", "transformation",
] as const;

const ARCHETYPES: ArchetypeCatalogEntry[] = [
  {
    id: "arch-atmos",
    name: "The Atmospherist",
    signature_axes: { atmosphere: 80, immersion: 70, texture: 40 },
  },
  {
    id: "arch-kinetic",
    name: "The Kineticist",
    signature_axes: { movement: 80, tension: 60, confidence: 40 },
  },
];

function pairing(id: string, tests: string[], weight = 60): PairingCandidate {
  return {
    id,
    lane: "alternative",
    tests,
    diagnostic_weight: weight,
    song_a: { artist: `A${id}` },
    song_b: { artist: `B${id}` },
  };
}

describe("engine factory — golden loop", () => {
  const engine = createEngine({
    db: createInMemorySupabaseGateway(emptyStore()),
    llm: createScriptedLLMGateway([]),
    clock: fixedClock("2026-01-01T00:00:00Z"),
    rng: seededRng(42),
  });

  it("seeds a session from an opening profile deterministically", () => {
    const seed = engine.buildStartSessionSeed({
      profile: {
        opening_lane: "alternative",
        opening_lane_confidence: 0.8,
        opening_analysis_json: {
          secondary_lanes: ["pop"],
          candidate_dimensions: { atmosphere: 60, movement: -20 },
        },
      },
      all_lanes: ["alternative", "pop", "electronic", "metal"],
    });
    expect(seed.lane).toBe("alternative");
    expect(seed.lane_confidence).toBe(0.8);
    expect(seed.probe_candidate_lanes).toContain("pop");
    expect(seed.seed_vector.atmosphere).toBeGreaterThan(0);
    expect(seed.seed_vector.movement).toBeLessThan(0);
  });

  it("picks a pairing, applies choice, and converges on an archetype", () => {
    let vector = engine.seedVectorFromPriors({ atmosphere: 40 });
    const used = new Set<string>();
    const pool: PairingCandidate[] = [
      pairing("p1", ["atmosphere", "immersion"], 80),
      pairing("p2", ["movement", "tension"], 60),
      pairing("p3", ["atmosphere", "texture"], 70),
      pairing("p4", ["immersion", "scale"], 50),
    ];

    for (let round = 1; round <= pool.length; round++) {
      const pick = engine.selectPairing({
        pool,
        vector,
        used_ids: used,
        session_lane: "alternative",
        dims: DIMS,
      });
      expect(pick.kind).toBe("picked");
      if (pick.kind !== "picked") break;
      engine.assertWithinLane(pick.pairing.lane, "alternative");
      used.add(pick.pairing.id);

      // Reward the "atmospherist" pole so we drift toward that archetype.
      const winner = { atmosphere: 90, immersion: 80, texture: 60, movement: 20, tension: 20 };
      const loser = { atmosphere: 10, immersion: 20, texture: 30, movement: 80, tension: 70 };
      const applied = engine.applyChoice({
        prior_vector: vector,
        winner,
        loser,
        tests: pick.pairing.tests ?? [],
        diagnostic_weight: pick.pairing.diagnostic_weight,
        fallback_dims: DIMS,
      });
      vector = applied.vector;
    }

    const result = engine.assignArchetype(vector, ARCHETYPES);
    expect(result.assignment?.name).toBe("The Atmospherist");
    expect(result.flagged).toBe(false);
  });

  // evaluateProbe (cross-lane probe flipping) is quarantined out of the live
  // engine — its regression coverage lives in
  // src/musicdna/engine/experiments/cross-lane-probes.experimental.test.ts



  it("in-memory gateway serves the same shape the real adapter does", async () => {
    const store = emptyStore();
    store.sessions["s1"] = {
      id: "s1",
      user_id: "u1",
      lane: "alternative",
      vector: { atmosphere: 50 },
      completed_at: null,
      archetype_id: null,
    };
    store.songs["song-a"] = { id: "song-a", title: "A", artist: "AA" };
    store.pairings["p1"] = {
      id: "p1",
      song_a: { id: "song-a", title: "A", artist: "AA" },
      song_b: { id: "song-b", title: "B", artist: "BB" },
    };
    const gw = createInMemorySupabaseGateway(store);
    expect(await gw.getSession("s1")).toMatchObject({ id: "s1", lane: "alternative" });
    expect(await gw.getPairing("p1")).toMatchObject({ id: "p1" });
    expect(await gw.getSongs(["song-a"])).toHaveLength(1);
  });
});
