import { describe, it, expect } from "vitest";
import { selectPairing, shouldStop, assertWithinLane, DEFAULT_PAIRING_KNOBS, type PairingCandidate } from "./pairing";

const DIMS = ["movement", "atmosphere", "immersion", "scale", "community", "perspective", "confidence", "tension", "texture", "transformation"] as const;

const p = (id: string, overrides: Partial<PairingCandidate> = {}): PairingCandidate => ({
  id,
  lane: "alternative",
  tests: ["movement"],
  diagnostic_weight: 80,
  song_a: { artist: "A" },
  song_b: { artist: "B" },
  ...overrides,
});

describe("selectPairing", () => {
  it("returns empty when pool is empty", () => {
    const r = selectPairing({
      pool: [],
      vector: {},
      used_ids: new Set(),
      session_lane: "alternative" as never,
      dims: DIMS,
      rng: { next: () => 0 },
    });
    expect(r.kind).toBe("empty");
  });

  it("drops same-artist pairings", () => {
    const r = selectPairing({
      pool: [p("x", { song_a: { artist: "Bowie" }, song_b: { artist: "Bowie" } })],
      vector: {},
      used_ids: new Set(),
      session_lane: "alternative" as never,
      dims: DIMS,
      rng: { next: () => 0 },
    });
    expect(r.kind).toBe("empty");
  });

  it("skips used pairings", () => {
    const r = selectPairing({
      pool: [p("a"), p("b")],
      vector: {},
      used_ids: new Set(["a"]),
      session_lane: "alternative" as never,
      dims: DIMS,
      rng: { next: () => 0 },
    });
    expect(r.kind).toBe("picked");
    if (r.kind === "picked") expect(r.pairing.id).toBe("b");
  });

  it("prefers fork-testing pairings when leaning axes exist", () => {
    // vector leans hard on movement; only pairing 'good' tests it.
    const r = selectPairing({
      pool: [
        p("bad", { tests: ["scale"] }),
        p("good", { tests: ["movement"] }),
      ],
      vector: { movement: 40 },
      used_ids: new Set(),
      session_lane: "alternative" as never,
      dims: DIMS,
      rng: { next: () => 0.99 },
    });
    expect(r.kind).toBe("picked");
    if (r.kind === "picked") expect(r.pairing.id).toBe("good");
  });
});

describe("shouldStop", () => {
  it("stops at round 12 with enough confident axes", () => {
    const vec: Record<string, number> = {};
    for (const d of DIMS.slice(0, 6)) vec[d] = 40;
    const r = shouldStop({ round: 12, vector: vec, dims: DIMS });
    expect(r.done).toBe(true);
  });
  it("does not stop before minimum rounds", () => {
    expect(shouldStop({ round: 5, vector: {}, dims: DIMS }).done).toBe(false);
  });
});

describe("assertWithinLane", () => {
  it("throws when picked lane differs from a non-general session lane", () => {
    expect(() => assertWithinLane("pop", "alternative" as never)).toThrow(/within-lane/);
  });
  it("permits general lane on either side", () => {
    expect(() => assertWithinLane("general", "alternative" as never)).not.toThrow();
    expect(() => assertWithinLane("pop", "general" as never)).not.toThrow();
    expect(() => assertWithinLane(null, "alternative" as never)).not.toThrow();
  });
});
