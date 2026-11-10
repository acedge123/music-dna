import { describe, expect, it } from "vitest";
import batch from "../../../data/musicdna/pairing-tests-backfill-2026-11-10.json";
import { DIMS } from "./axes";

describe("pairing tests backfill 2026-11-10", () => {
  it("covers all 77 previously untested matchups", () => {
    expect(batch.pairings).toHaveLength(77);
  });

  it("declares 1-3 real traits, each with a score gap of at least 25", () => {
    for (const p of batch.pairings) {
      expect(p.tests.length).toBeGreaterThanOrEqual(1);
      expect(p.tests.length).toBeLessThanOrEqual(3);
      for (const t of p.tests) {
        expect(DIMS as readonly string[]).toContain(t);
        expect(Math.abs((p.gaps as Record<string, number>)[t])).toBeGreaterThanOrEqual(25);
      }
    }
  });
});
