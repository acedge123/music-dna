import { describe, expect, it, vi } from "vitest";
import { buildLedger } from "../engine/evidence";
import { narrateEvidence } from "./evidence-narrator";

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

describe("evidence narrator boundary", () => {
  it("does not spend a model call on insufficient evidence", async () => {
    const generate = vi.fn();
    expect((await narrateEvidence(ledger([40, -40, 40, -40]), labels, generate)).status).toBe(
      "insufficient",
    );
    expect(generate).not.toHaveBeenCalled();
  });
  it("validates model-selected IDs and retains the exception", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue('{"claims":[{"axis":"scale","direction":"hi","choice_ids":["0"]}]}');
    const r = await narrateEvidence(ledger([40, 40, 40, -40]), labels, generate);
    expect(r.status).toBe("ok");
    expect(r.text).toContain("A3 over B3");
  });
  it.each(["free prose", '{"claims":[{"axis":"fake","direction":"hi","choice_ids":["0"]}]}'])(
    "falls back on invalid generation %s",
    async (raw) => {
      const r = await narrateEvidence(ledger([40, 40, 40, -40]), labels, async () => raw);
      expect(r.status).toBe("invalid_generation");
      expect(r.text).toContain("qualified tendency");
      expect(r.text).not.toContain("fake");
    },
  );
  it("narrator failure is not insufficient evidence", async () => {
    const r = await narrateEvidence(ledger([40, 40, 40]), labels, async () => {
      throw Error("timeout");
    });
    expect(r.status).toBe("narrator_failure");
    expect(r.text).toContain("3 supporting choices");
    expect(r.text).not.toContain("not enough");
  });
});
