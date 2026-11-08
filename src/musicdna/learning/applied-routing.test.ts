import { describe, expect, it } from "vitest";
import { appliedRoutingContext } from "./applied-routing";
import artifact from "./routing-artifact.json";

const input = {
  enabled: "1",
  vector: { movement: 12 },
  answered: 2,
  routingMode: "shadow" as const,
  mode: "recognition_first",
  knobs: null,
  bootstrap: false,
  fallback: false,
  steer: null,
  recommendation: { regime: "escape", pairing_knobs: { challenge_boost: 2 } },
};
describe("applied routing diagnostics", () => {
  it("defaults off and accepts only the explicit flag", () => {
    for (const enabled of [undefined, "", "true", "0"])
      expect(appliedRoutingContext({ ...input, enabled })).toEqual({});
  });
  it("keeps a shadow suggestion separate from actual selection", () => {
    const { applied_routing: d } = appliedRoutingContext(input);
    expect(d).toMatchObject({
      policy_id: artifact.policy_id,
      policy_version: artifact.version,
      proposed: { regime: "escape" },
      recommendation_applied: false,
      effective_knobs: null,
    });
    expect(d).not.toHaveProperty("variant");
  });
  it("records effective overrides and fallback even when live was requested", () => {
    const { applied_routing: d } = appliedRoutingContext({
      ...input,
      routingMode: "live",
      fallback: true,
      steer: "harder",
      knobs: { mode: "diagnostic_first", canon_floor: 0 },
    });
    expect(d).toMatchObject({
      recommendation_applied: false,
      router_knobs_used: true,
      recommendation_overridden: true,
      fallback: true,
      steer: "harder",
      effective_knobs: { mode: "diagnostic_first", canon_floor: 0 },
    });
  });
  it("does not attribute bootstrap or a missing recommendation to the router", () => {
    expect(
      appliedRoutingContext({ ...input, routingMode: "live", bootstrap: true }).applied_routing
        ?.recommendation_applied,
    ).toBe(false);
    expect(
      appliedRoutingContext({ ...input, routingMode: "live", recommendation: null })
        .applied_routing,
    ).toMatchObject({ proposed: null, recommendation_applied: false });
  });
});
