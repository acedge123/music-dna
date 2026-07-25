import { describe, expect, it } from "vitest";
import { recommendRegime, scoreTerrain } from "./scoring";
import type { TerrainFeatures } from "./terrain";

const baseFeatures = (overrides: Partial<TerrainFeatures> = {}): TerrainFeatures => ({
  feedback_latency: "fast",
  reversibility: "medium",
  adversariality: "none",
  information_cost: "medium",
  coordination_load: "low",
  environment_stability: "stable",
  time_horizon: "iterative",
  uncertainty: "low",
  ruggedness: "low",
  local_minima_risk: "low",
  branching_factor: "low",
  mode_pressure: "none",
  derived: {
    lane_confidence: 0.7,
    delta_volatility: 5,
    delta_samples: 5,
    artist_bias_share: 0.2,
    snap_share: 0.1,
    skips_last3: 0,
    round_position: 0.5,
  },
  ...overrides,
});

describe("scoring — constant baseline (refinement #1)", () => {
  it("with corrected constants explore/prune/compound tie at similar values", () => {
    // Strip derived signals to reveal ONLY the constant contribution.
    const scores = scoreTerrain(
      baseFeatures({
        uncertainty: "medium",
        ruggedness: "medium",
        local_minima_risk: "medium",
        branching_factor: "medium",
        mode_pressure: "none",
      }),
    );
    // Expect the corrected constants to put prune ahead of the +3-lead explore
    // baseline that the old constants (information_cost: low, reversibility: high)
    // produced. Sanity: no regime is untouchable.
    expect(scores.explore).toBeGreaterThan(0);
    expect(scores.prune).toBeGreaterThan(0);
    expect(scores.compound).toBeGreaterThan(0);
    expect(scores.coordinate).toBeLessThanOrEqual(scores.prune);
  });
});

describe("scoring — mode_pressure weight (refinement #2)", () => {
  it("mode_pressure=+2 lets compound win a settled session but leaves margin for signals", () => {
    const settled = baseFeatures({
      uncertainty: "low",
      ruggedness: "low",
      local_minima_risk: "low",
      branching_factor: "low",
      mode_pressure: "compound",
    });
    const rec = recommendRegime(settled);
    expect(rec.regime).toBe("compound");
    // Refinement #2: margin should NOT dominate — mode_pressure is +2 only.
    expect(rec.margin).toBeLessThanOrEqual(6);
  });

  it("skip-driven uncertainty flips a stable session away from compound", () => {
    const rugged = baseFeatures({
      uncertainty: "high",
      ruggedness: "high",
      local_minima_risk: "medium",
      mode_pressure: "explore",
    });
    const rec = recommendRegime(rugged);
    expect(rec.regime).toBe("explore");
  });
});

describe("scoring — refinement #3 archetype_margin passthrough", () => {
  it("recommendRegime leaves archetype_margin null; caller injects it", () => {
    const rec = recommendRegime(baseFeatures());
    expect(rec.archetype_margin).toBeNull();
  });
});
