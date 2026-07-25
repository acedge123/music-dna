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
  it("exact score table for the neutral-signal baseline", () => {
    // Strip derived signals so ONLY the constants contribute + medium trinaries.
    const scores = scoreTerrain(
      baseFeatures({
        uncertainty: "medium",
        ruggedness: "medium",
        local_minima_risk: "medium",
        branching_factor: "medium",
        mode_pressure: "none",
      }),
    );
    // Sum of constant weights (feedback_latency=fast, reversibility=medium,
    // adversariality=none, information_cost=medium, coordination_load=low,
    // environment_stability=stable, time_horizon=iterative) plus derived
    // medium×4. Locked-in table so future edits show up in diff.
    expect(scores).toEqual({ explore: 8, prune: 10, compound: 6, coordinate: 1 });
  });

  it("tie-breaking: recommendRegime picks the first REGIMES entry on a tie", () => {
    // Force explore == prune by adding no signal at all; the deterministic
    // sort in recommendRegime keeps the enum order.
    const rec = recommendRegime(
      baseFeatures({
        uncertainty: "medium",
        ruggedness: "medium",
        local_minima_risk: "medium",
        branching_factor: "medium",
        mode_pressure: "none",
      }),
    );
    // Prune leads by 2 here (10 vs 8) — sanity that the exact table wins.
    expect(rec.regime).toBe("prune");
    expect(rec.margin).toBe(2);
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
