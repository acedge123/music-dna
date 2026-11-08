import artifact from "./routing-artifact.json";

/** Bounded server diagnostics, never a client assertion or a rollout switch. */
export function appliedRoutingContext(input: {
  enabled?: string;
  vector: Record<string, number>;
  answered: number;
  routingMode: "legacy" | "shadow" | "live";
  mode: string;
  knobs: Record<string, unknown> | null;
  bootstrap: boolean;
  fallback: boolean;
  steer: "not_quite" | "harder" | null;
  recommendation: { regime: string; pairing_knobs: unknown } | null;
}) {
  if (input.enabled !== "1") return {};
  return {
    applied_routing: {
      schema_version: "applied-routing.v1",
      policy_id: artifact.policy_id,
      policy_version: artifact.version,
      strategy_version: artifact.version,
      prior_vector: input.vector,
      answered_before: input.answered,
      routing_mode: input.routingMode,
      applied_routing_mode: input.bootstrap
        ? "bootstrap"
        : input.routingMode === "live" && input.recommendation
          ? "live"
          : "legacy",
      selected_mode: input.mode,
      effective_knobs: input.knobs,
      bootstrap: input.bootstrap,
      fallback: input.fallback,
      steer: input.steer,
      // A shadow proposal is never labelled applied merely because the picks agree.
      recommendation_applied:
        !input.bootstrap &&
        input.routingMode === "live" &&
        input.recommendation !== null &&
        input.steer === null,
      router_knobs_used:
        !input.bootstrap && input.routingMode === "live" && input.recommendation !== null,
      recommendation_overridden:
        !input.bootstrap &&
        input.routingMode === "live" &&
        input.recommendation !== null &&
        input.steer !== null,
      proposed: input.recommendation
        ? {
            regime: input.recommendation.regime,
            knobs: input.recommendation.pairing_knobs,
          }
        : null,
    },
  };
}
