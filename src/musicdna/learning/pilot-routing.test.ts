import { describe, it, expect } from "vitest";
import { resolvePilotRouting } from "./pilot-routing";
const version = "sha256:" + "a".repeat(64);
const assignment = {
  data_class: "consented_pilot",
  policy_id: "musicdna-selector",
  policy_version: version,
  strategy_version: version,
  variant: "treatment",
  routing_mode: "live",
};
describe("invite-only routing", () => {
  it("does not query missing migration fields when off", async () => {
    let calls = 0;
    const mode = await resolvePilotRouting({
      defaultMode: "shadow",
      policyVersion: version,
      prepare: async () => {
        calls++;
        return assignment;
      },
      onUnavailable: () => {},
    });
    expect(mode).toBe("shadow");
    expect(calls).toBe(0);
  });
  it("requires both gates and unchanged shadow baseline", async () => {
    for (const input of [
      { instrumentationEnabled: "0", defaultMode: "shadow" as const },
      { instrumentationEnabled: "1", defaultMode: "live" as const },
    ]) {
      let calls = 0;
      expect(
        await resolvePilotRouting({
          ...input,
          enabled: "1",
          policyVersion: version,
          prepare: async () => {
            calls++;
            return assignment;
          },
          onUnavailable: () => {},
        }),
      ).toBe(input.defaultMode);
      expect(calls).toBe(0);
    }
  });
  it("changes routing only for a matching private invitation", async () => {
    const base = {
      enabled: "1",
      instrumentationEnabled: "1",
      defaultMode: "shadow" as const,
      policyVersion: version,
      onUnavailable: () => {},
    };
    expect(await resolvePilotRouting({ ...base, prepare: async () => assignment })).toBe("live");
    for (const a of [
      null,
      { ...assignment, policy_version: "old" },
      { ...assignment, data_class: "synthetic" },
      { ...assignment, variant: "control" },
    ])
      expect(await resolvePilotRouting({ ...base, prepare: async () => a })).toBe("shadow");
    expect(
      await resolvePilotRouting({
        ...base,
        prepare: async () => {
          throw Error("private");
        },
      }),
    ).toBe("shadow");
  });
});
