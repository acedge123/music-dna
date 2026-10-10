import { describe, expect, it } from "vitest";
import { buildLedger } from "./evidence";
import { projectRead } from "./read";

const labels = { scale: { hi: "intimacy", lo: "spectacle" } };
const ledger = (ds: number[]) =>
  buildLedger(
    ds.map((scale, i) => ({
      choice_id: String(i),
      pairing_id: String(i),
      tests: ["scale"],
      chosen: { title: `A${i}`, scale },
      rejected: { title: `B${i}`, scale: 0 },
    })),
    ["scale"],
  );

describe("running read projection", () => {
  it("one and two choices remain observation and tentative", () => {
    expect(projectRead(ledger([40]), labels)).toMatchObject({
      tier: "observation",
      language_ceiling: "observation",
    });
    const two = projectRead(ledger([40, 40]), labels);
    expect(two).toMatchObject({ tier: "theory", language_ceiling: "tentative" });
    expect(two.thesis).not.toContain("you favored");
  });
  it("mixed evidence has no directional supported claim", () => {
    const r = projectRead(ledger([40, 40, -40, -40]), labels);
    expect(r).toMatchObject({
      tier: "theory",
      direction: "contested",
      language_ceiling: "mixed",
      insufficiency_reason: "conflicting_evidence",
    });
    expect(r.thesis).toContain("No supported lean");
  });
  it("supported-with-contradiction exposes the actual exception", () => {
    const r = projectRead(ledger([40, 40, 40, -40]), labels);
    expect(r).toMatchObject({
      tier: "read",
      direction: "contested",
      evidence: { supporting: 3, contradicting: 1 },
    });
    expect(r.thesis).toContain("A3 over B3");
    expect(r.thesis).toContain("qualified tendency");
  });
  it("revision names the contradicting choice instead of rotating copy", () => {
    const r = projectRead(ledger([40, -40, -40]), labels, {
      axis: "scale",
      direction: "hi",
      tier: "theory",
      thesis: "Old read",
    });
    expect(r.direction).toBe("revising");
    expect(r.revision).toMatchObject({
      previous_claim: "Old read",
      changed_by: { chosen: "A2", rejected: "B2" },
    });
    expect(r.revision?.new_interpretation).not.toContain("you favored");
  });
  it("unknown historical evidence is not attributed to unfamiliar songs", () => {
    const l = buildLedger([{ pairing_id: "old", chosen: null, rejected: null }], ["scale"]);
    const r = projectRead(l, labels);
    expect(r.insufficiency_reason).toBe("invalid_catalog_evidence");
    expect(r.thesis).not.toMatch(/don't know|weren't your songs/);
  });
});
