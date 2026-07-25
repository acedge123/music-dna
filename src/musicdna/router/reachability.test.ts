// Step 4 gate (integration plan, Part 6): every transition rule must be
// reachable from the terrain the MusicDNA mapper can actually emit. We
// enumerate the mapper's output space by driving `mapTerrain` across a
// realistic Cartesian product of inputs, then assert that every regime the
// scorer can pick appears at least once.
//
// This is the Phase 2 "reachable transitions" deliverable. It does NOT change
// scoring weights — it pins the contract so a later mapper change can't
// silently kill a regime.

import { describe, expect, it } from "vitest";
import { mapTerrain, type ChoiceEventRow, type TerrainFeatures } from "./terrain";
import { recommendRegime, type Regime } from "./scoring";

// Sweep grid — kept small but covers the levers that actually move terrain
// outputs today: lane/vector confidence, round position, skip pressure, delta
// volatility, artist bias, and snap rate.
const LANE_CONF = [0.2, 0.5, 0.8];
const VEC_CONF = [0.1, 0.5, 0.9];
const ROUNDS = [1, 3, 5]; // early / mid / late in a 6-round session
const SKIPS = [0, 1, 2];
const DELTA_PROFILES: Array<{ name: string; deltas: Array<Record<string, number> | null> }> = [
  { name: "empty", deltas: [] },
  { name: "smooth", deltas: [{ x: 5 }, { x: 6 }, { x: 5 }] },
  { name: "volatile", deltas: [{ x: 50 }, { x: -50 }, { x: 50 }] },
  { name: "missing", deltas: [null, null, null] },
];
const ARTIST_PROFILES: Array<{ name: string; artists: string[] }> = [
  { name: "diverse", artists: ["a", "b", "c", "d"] },
  { name: "biased", artists: ["a", "a", "a", "b"] },
];
const SNAP_PROFILES: Array<{ name: string; ms: number[] }> = [
  { name: "deliberate", ms: [5000, 4000, 4500, 5000] },
  { name: "snap", ms: [1000, 800, 1500, 900] },
];

function buildChoices(
  deltaProfile: (typeof DELTA_PROFILES)[number],
  artistProfile: (typeof ARTIST_PROFILES)[number],
  snapProfile: (typeof SNAP_PROFILES)[number],
  round: number,
): ChoiceEventRow[] {
  const n = Math.max(deltaProfile.deltas.length, artistProfile.artists.length, snapProfile.ms.length, round);
  const rows: ChoiceEventRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      round: i,
      raw_delta: deltaProfile.deltas[i % deltaProfile.deltas.length] ?? null,
      chosen_artist: artistProfile.artists[i % artistProfile.artists.length] ?? null,
      ms_to_decide: snapProfile.ms[i % snapProfile.ms.length] ?? null,
    });
  }
  return rows;
}

function enumerate(): TerrainFeatures[] {
  const out: TerrainFeatures[] = [];
  for (const laneConf of LANE_CONF)
    for (const vecConf of VEC_CONF)
      for (const round of ROUNDS)
        for (const skips of SKIPS)
          for (const dp of DELTA_PROFILES)
            for (const ap of ARTIST_PROFILES)
              for (const sp of SNAP_PROFILES) {
                out.push(
                  mapTerrain({
                    lane_confidence: laneConf,
                    vector_confidence: vecConf,
                    round,
                    max_rounds: 6,
                    choices: buildChoices(dp, ap, sp, round),
                    skipped_rounds_last3: skips,
                  }),
                );
              }
  return out;
}

describe("router reachability — Phase 2 gate", () => {
  const terrains = enumerate();
  const winners = new Set<Regime>(terrains.map((t) => recommendRegime(t).regime));

  it("mapper emits every actionable mode_pressure at least once", () => {
    // "none" is the fall-through and is not required to be reachable; the
    // three actionable pressures are the D2 canary.
    const emitted = new Set(terrains.map((t) => t.mode_pressure));
    expect(emitted.has("explore")).toBe(true);
    expect(emitted.has("prune")).toBe(true);
    expect(emitted.has("compound")).toBe(true);
  });

  it("explore is reachable", () => {
    expect(winners.has("explore")).toBe(true);
  });

  it("prune is reachable", () => {
    expect(winners.has("prune")).toBe(true);
  });

  it("compound is reachable", () => {
    // Compound reachability is the D1/D2 canary — if this fails after a mapper
    // or scoring tweak, the fix landed silently killed a regime.
    expect(winners.has("compound")).toBe(true);
  });

  it("skip pressure flips environment_stability and information_cost together", () => {
    const quiet = mapTerrain({
      lane_confidence: 0.7,
      vector_confidence: 0.5,
      round: 3,
      max_rounds: 6,
      choices: buildChoices(DELTA_PROFILES[1], ARTIST_PROFILES[0], SNAP_PROFILES[0], 3),
      skipped_rounds_last3: 0,
    });
    const noisy = mapTerrain({
      lane_confidence: 0.7,
      vector_confidence: 0.5,
      round: 3,
      max_rounds: 6,
      choices: buildChoices(DELTA_PROFILES[1], ARTIST_PROFILES[0], SNAP_PROFILES[0], 3),
      skipped_rounds_last3: 2,
    });
    expect(quiet.environment_stability).toBe("stable");
    expect(quiet.information_cost).toBe("low");
    expect(noisy.environment_stability).toBe("unstable");
    expect(noisy.information_cost).toBe("high");
  });

  it("missing raw_delta never reads as ruggedness=low", () => {
    // Refinement #4 revised: unknown delta must not silently claim smooth terrain.
    const missing = mapTerrain({
      lane_confidence: 0.7,
      vector_confidence: 0.5,
      round: 3,
      max_rounds: 6,
      choices: buildChoices(DELTA_PROFILES[3], ARTIST_PROFILES[0], SNAP_PROFILES[0], 3),
      skipped_rounds_last3: 0,
    });
    expect(missing.ruggedness).not.toBe("low");
  });
});
