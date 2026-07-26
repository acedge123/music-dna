import { describe, expect, it } from "vitest";
import { recommendRegime, scoreMusicDNATerrain, scoreTerrain } from "./scoring";
import type { TerrainFeatures } from "./types";

const baseFeatures = (overrides: Partial<TerrainFeatures> = {}): TerrainFeatures => ({
  feedback_latency: "fast",
  reversibility: "medium",
  adversariality: "none",
  information_cost: "medium",
  coordination_load: "low",
  environment_stability: "stable",
  time_horizon: "iterative",
  uncertainty: "low",
  ruggedness: "medium",
  local_minima_risk: "medium",
  branching_factor: "medium",
  mode_pressure: "prune",
  ...overrides,
});

describe("MusicDNA scoring parity", () => {
  it("applies Agent Brain scoring with MusicDNA mode_pressure +2 adjustment", () => {
    const scores = scoreTerrain(
      baseFeatures({
        uncertainty: "medium",
        ruggedness: "medium",
        local_minima_risk: "medium",
        branching_factor: "medium",
        mode_pressure: "prune",
      }),
    );
    expect(scores).toEqual({ prune: 13, explore: 9, compound: 7, coordinate: 2 });
  });

  it("returns Agent Brain-style recommendation shape", () => {
    const rec = scoreMusicDNATerrain(baseFeatures({ mode_pressure: "compound", uncertainty: "low" }));
    expect(rec.primary_regime).toBe("compound");
    expect(rec.secondary_regime).toBeTruthy();
    expect(rec.opposing_regime).toBeTruthy();
    expect(rec.confidence).toBeGreaterThanOrEqual(0.4);
    expect(rec.breakdown[0].reasons.length).toBeGreaterThan(0);
  });

  it("keeps compatibility fields for existing callers", () => {
    const rec = recommendRegime(baseFeatures());
    expect(rec.regime).toBe(rec.primary_regime);
    expect(rec.archetype_margin).toBeNull();
    expect(rec.scores.prune).toBeTypeOf("number");
  });
});
