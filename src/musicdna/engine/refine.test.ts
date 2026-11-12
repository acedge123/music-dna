import { describe, expect, it } from "vitest";
import { buildLedger, type LedgerChoice } from "./evidence";
import { DIMS } from "./axes";
import { refinePool, refineTargets } from "./refine";

const pick = (i: number, a: number, b: number): LedgerChoice => ({
  pairing_id: `p${i}`,
  tests: ["tension"],
  chosen: { id: `c${i}`, title: "x", artist: "x", tension: a },
  rejected: { id: `r${i}`, title: "y", artist: "y", tension: b },
});

describe("refine", () => {
  it("targets a split trait first", () => {
    const ledger = buildLedger([pick(1, 80, 20), pick(2, 20, 80)], DIMS);
    expect(refineTargets(ledger, DIMS)[0]).toBe("tension");
  });

  it("prefers a new genre that tests an uncertain trait, never repeating parent matchups", () => {
    const pool = [
      { id: "p1", lane: "country", tests: ["tension"] },
      { id: "a", lane: "hip-hop", tests: ["tension"] },
      { id: "b", lane: "country", tests: ["tension"] },
      { id: "c", lane: "metal", tests: ["tension"] },
      { id: "d", lane: "pop", tests: ["tension"] },
      { id: "e", lane: "pop", tests: ["scale"] },
    ];
    const out = refinePool(pool, {
      targets: ["tension"],
      heardLanes: ["Hip-hop"],
      parentPairingIds: new Set(["p1"]),
    });
    expect(out.map((p) => p.id)).toEqual(["b", "c", "d"]);
  });

  it("falls back when the narrow pool is too small", () => {
    const pool = [{ id: "a", lane: "pop", tests: ["scale"] }];
    expect(refinePool(pool, { targets: ["tension"], heardLanes: [], parentPairingIds: new Set() })).toHaveLength(1);
  });
});
