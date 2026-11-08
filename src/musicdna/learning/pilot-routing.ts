export type PilotMode = "legacy" | "shadow" | "live";

/** An operator invitation is required. This never calls Agent Brain or a model. */
export async function resolvePilotRouting(input: {
  enabled?: string;
  instrumentationEnabled?: string;
  defaultMode: PilotMode;
  policyVersion: string;
  prepare: () => Promise<unknown>;
  onUnavailable: () => void;
}): Promise<PilotMode> {
  if (input.enabled !== "1") return input.defaultMode;
  if (input.instrumentationEnabled !== "1" || input.defaultMode !== "shadow") {
    input.onUnavailable();
    return input.defaultMode;
  }
  try {
    const a = await input.prepare();
    if (a === null) return input.defaultMode; // not invited, withdrawn, or another reading
    if (!a || typeof a !== "object" || Array.isArray(a)) throw Error("invalid_pilot");
    const d = a as Record<string, unknown>;
    if (
      d.data_class !== "consented_pilot" ||
      d.policy_id !== "musicdna-selector" ||
      d.policy_version !== input.policyVersion ||
      d.strategy_version !== input.policyVersion ||
      !["control", "treatment"].includes(String(d.variant)) ||
      d.routing_mode !== (d.variant === "treatment" ? "live" : "shadow")
    )
      throw Error("invalid_pilot");
    return d.routing_mode as PilotMode;
  } catch {
    input.onUnavailable();
    return input.defaultMode;
  }
}
