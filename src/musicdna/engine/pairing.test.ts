import { describe, it, expect } from "vitest";
import {
  selectPairing,
  shouldStop,
  assertWithinLane,
  DEFAULT_PAIRING_KNOBS,
  type PairingCandidate,
  type RecognitionRow,
} from "./pairing";

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

// Deterministic LCG so different tests can share a seeded RNG.
const seededRng = (seed: number) => {
  let s = seed >>> 0;
  return {
    next: () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    },
  };
};

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

// Phase 3.5: fork_filter is a first-class knob. These tests prove it's wired,
// not inert — the same corpus should pick differently under each mode.
describe("selectPairing — fork_filter knob (Phase 3.5)", () => {
  const CORPUS: PairingCandidate[] = [
    // 'fork' pairings test the leaning axis (movement).
    p("fork_lo", { tests: ["movement"], diagnostic_weight: 20 }),
    // 'off' pairings don't touch the leaning axis but have huge weight.
    p("off_hi", { tests: ["scale"], diagnostic_weight: 100 }),
    p("off_hi2", { tests: ["texture"], diagnostic_weight: 100 }),
  ];
  const vec = { movement: 40 };

  it("fork_filter='hard' restricts pool to fork-matching pairings (legacy)", () => {
    const r = selectPairing({
      pool: CORPUS,
      vector: vec,
      used_ids: new Set(),
      session_lane: "alternative" as never,
      dims: DIMS,
      rng: seededRng(42),
      knobs: { fork_filter: "hard" },
    });
    // Under hard filter, only fork_lo survives — must be picked.
    expect(r.kind).toBe("picked");
    if (r.kind === "picked") {
      expect(r.pairing.id).toBe("fork_lo");
      expect(r.selection_reason.pool_size).toBe(1);
    }
  });

  it("fork_filter='off' disables challenge_boost — heavy off-fork pairings can win", () => {
    // With fork disabled, high-weight non-fork pairings dominate. Verify at
    // least one of the off_hi pairings wins across a range of RNG values.
    let sawOffHi = false;
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectPairing({
        pool: CORPUS,
        vector: vec,
        used_ids: new Set(),
        session_lane: "alternative" as never,
        dims: DIMS,
        rng: seededRng(seed),
        knobs: { fork_filter: "off" },
      });
      if (r.kind === "picked" && (r.pairing.id === "off_hi" || r.pairing.id === "off_hi2")) {
        sawOffHi = true;
        expect(r.selection_reason.challenge_boost).toBe(false);
        expect(r.selection_reason.pool_size).toBe(3);
        break;
      }
    }
    expect(sawOffHi).toBe(true);
  });

  it("fork_filter='soft' keeps full pool but boosts fork-matching pairings", () => {
    // Soft mode: pool_size = 3 (no filter), but the challenge_boost tag is
    // set when the winner is fork-matching.
    const seenPoolSizes = new Set<number>();
    for (let seed = 1; seed <= 10; seed++) {
      const r = selectPairing({
        pool: CORPUS,
        vector: vec,
        used_ids: new Set(),
        session_lane: "alternative" as never,
        dims: DIMS,
        rng: seededRng(seed),
        knobs: { fork_filter: "soft" },
      });
      if (r.kind === "picked") seenPoolSizes.add(r.selection_reason.pool_size);
    }
    // Soft mode NEVER filters — every call sees the full pool.
    expect(seenPoolSizes.size).toBe(1);
    expect([...seenPoolSizes][0]).toBe(3);
  });
});

// Phase 3.5: mode + canon_floor are now knobs. Prove that:
//   1) mode passed via knobs takes effect when input.mode is absent.
//   2) input.mode overrides the knob (backward compat).
describe("selectPairing — mode + canon_floor knobs (Phase 3.5)", () => {
  const rec: Map<string, RecognitionRow> = new Map([
    ["obscure", { min_canon: 10, avg_canon: 12, recognition_score: 15 }],
    ["known",   { min_canon: 80, avg_canon: 85, recognition_score: 90 }],
  ]);
  const CORPUS: PairingCandidate[] = [
    p("obscure", { tests: ["scale"], diagnostic_weight: 80 }),
    p("known",   { tests: ["scale"], diagnostic_weight: 80 }),
  ];

  it("mode='recognition_first' via knobs filters obscure pairings out", () => {
    const r = selectPairing({
      pool: CORPUS,
      vector: {},
      used_ids: new Set(),
      session_lane: "general" as never,
      dims: DIMS,
      rng: seededRng(1),
      recognition: rec,
      knobs: { mode: "recognition_first" },
    });
    expect(r.kind).toBe("picked");
    if (r.kind === "picked") {
      expect(r.pairing.id).toBe("known");
      expect(r.selection_reason.mode).toBe("recognition_first");
    }
  });

  it("input.mode wins over knobs.mode (backward-compat precedence)", () => {
    const r = selectPairing({
      pool: CORPUS,
      vector: {},
      used_ids: new Set(),
      session_lane: "general" as never,
      dims: DIMS,
      rng: seededRng(1),
      recognition: rec,
      mode: "diagnostic_first",
      knobs: { mode: "recognition_first" },
    });
    expect(r.kind).toBe("picked");
    if (r.kind === "picked") expect(r.selection_reason.mode).toBe("diagnostic_first");
  });

  it("canon_floor knob overrides RECOGNITION_FLOORS default", () => {
    // Default recognition_first floor is 55 → obscure (10) filtered out.
    // Lower the knob floor to 5 → obscure survives; both should be pickable
    // across seeds.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const r = selectPairing({
        pool: CORPUS,
        vector: {},
        used_ids: new Set(),
        session_lane: "general" as never,
        dims: DIMS,
        rng: seededRng(seed),
        recognition: rec,
        knobs: { mode: "recognition_first", canon_floor: 5 },
      });
      if (r.kind === "picked") seen.add(r.pairing.id);
    }
    expect(seen.has("obscure")).toBe(true);
    expect(seen.has("known")).toBe(true);
  });
});

// Phase 3.5 golden regression: freeze selection_reason across all three modes
// and both recognition regimes. Any future drift in the knobs / scoring math
// breaks these snapshots — replacing the old tautological parity check that
// only compared "omit knobs" vs "pass DEFAULT_PAIRING_KNOBS".
describe("selectPairing — golden regression across all three modes", () => {
  const CORPUS: PairingCandidate[] = [
    p("m1", { tests: ["movement", "atmosphere"], diagnostic_weight: 80 }),
    p("m2", { tests: ["scale"], diagnostic_weight: 60 }),
    p("m3", { tests: ["community", "movement"], diagnostic_weight: 90 }),
    p("m4", { tests: ["tension"], diagnostic_weight: 40 }),
    p("m5", { tests: ["texture", "atmosphere"], diagnostic_weight: 70 }),
    p("m6", { tests: ["confidence"], diagnostic_weight: 55 }),
  ];
  const RECOGNITION: Map<string, RecognitionRow> = new Map([
    ["m1", { min_canon: 90, avg_canon: 92, recognition_score: 95 }],
    ["m2", { min_canon: 20, avg_canon: 25, recognition_score: 30 }],
    ["m3", { min_canon: 70, avg_canon: 72, recognition_score: 75 }],
    ["m4", { min_canon: 40, avg_canon: 45, recognition_score: 50 }],
    ["m5", { min_canon: 60, avg_canon: 65, recognition_score: 68 }],
    ["m6", { min_canon: 55, avg_canon: 58, recognition_score: 60 }],
  ]);

  const scenarios: Array<{ label: string; vector: Record<string, number>; mode: "diagnostic_first" | "recognition_boost" | "recognition_first" }> = [
    { label: "diagnostic_first neutral", vector: {}, mode: "diagnostic_first" },
    { label: "diagnostic_first leaning", vector: { movement: 40, atmosphere: 20 }, mode: "diagnostic_first" },
    { label: "recognition_boost mid",    vector: { scale: -25, community: 30 },  mode: "recognition_boost" },
    { label: "recognition_first cold",   vector: {},                             mode: "recognition_first" },
    { label: "recognition_first leaning",vector: { texture: 50, atmosphere: -40, confidence: 20 }, mode: "recognition_first" },
  ];

  for (const { label, vector, mode } of scenarios) {
    it(`golden: ${label}`, () => {
      const r = selectPairing({
        pool: CORPUS,
        vector,
        used_ids: new Set(),
        session_lane: mode === "recognition_first" ? ("general" as never) : ("alternative" as never),
        dims: DIMS,
        rng: seededRng(1234),
        recognition: RECOGNITION,
        mode,
      });
      // Inline snapshots capture the exact selection_reason on first run and
      // fail loudly if selection math drifts later. First run of the suite
      // populates these; do not hand-edit them without understanding why.
      expect(r.kind === "picked" ? { id: r.pairing.id, reason: r.selection_reason } : { empty: true })
        .toMatchSnapshot();
    });
  }
});

describe("shouldStop", () => {
  it("stops at the default budget (6) with enough confident axes", () => {
    const vec: Record<string, number> = {};
    for (const d of DIMS.slice(0, 6)) vec[d] = 40;
    const r = shouldStop({ round: 6, vector: vec, dims: DIMS });
    expect(r.done).toBe(true);
  });
  it("does not stop before the default minimum (6 rounds)", () => {
    expect(shouldStop({ round: 5, vector: {}, dims: DIMS }).done).toBe(false);
  });
  it("honours an explicit longer min_rounds override", () => {
    const vec: Record<string, number> = {};
    for (const d of DIMS.slice(0, 6)) vec[d] = 40;
    const r = shouldStop({ round: 6, vector: vec, dims: DIMS, min_rounds: 12 });
    expect(r.done).toBe(false);
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

// Phase 3.5 sanity: DEFAULT_PAIRING_KNOBS still preserves the old inline
// literal values. If someone edits the defaults, this test names the exact
// field that drifted so the reviewer can decide intentional vs regression.
describe("DEFAULT_PAIRING_KNOBS — pinned defaults", () => {
  it("matches the pre-refactor literals", () => {
    expect(DEFAULT_PAIRING_KNOBS).toEqual({
      leaning_threshold: 15,
      leaning_top_k: 3,
      challenge_boost: 1.5,
      axis_need_base: 0.4,
      axis_need_slope: 0.6,
      recog_blend_recognition_first: 0.6,
      recog_blend_recognition_boost: 0.4,
      mode: "diagnostic_first",
      fork_filter: "hard",
      canon_floor: null,
    });
  });
});

