import { describe, expect, it } from "vitest";
import { buildLedger, type LedgerChoice } from "./evidence";
import { DIMS } from "./axes";
import { buildDnaSummary, relevantComparisonsLabel } from "./dna-summary";

function pick(i: number, chosenTexture: number, rejectedTexture: number, lane = "Hip-hop"): LedgerChoice {
  return {
    pairing_id: `p${i}`,
    tests: ["texture"],
    chosen: { id: `c${i}`, title: `Chosen ${i}`, artist: `A${i}`, texture: chosenTexture, lane },
    rejected: { id: `r${i}`, title: `Rejected ${i}`, artist: `B${i}`, texture: rejectedTexture, lane },
  };
}

describe("buildDnaSummary", () => {
  const ledger = buildLedger([pick(1, 80, 30), pick(2, 75, 20), pick(3, 70, 25), pick(4, 20, 80)], DIMS);

  it("reports 3 of 4 relevant comparisons for refinement over rawness, as Leaning", () => {
    const s = buildDnaSummary(ledger, null);
    expect(s.dimensions[0]).toMatchObject({ label: "refinement over rawness", supporting: 3, relevant: 4, confidence: "Leaning" });
    expect(relevantComparisonsLabel(s.dimensions[0])).toBe("3 of 4 relevant comparisons");
  });

  it("gives two pattern receipts and one contradiction", () => {
    const s = buildDnaSummary(ledger, null);
    expect(s.receipts.map((r) => r.kind)).toEqual(["pattern", "pattern", "contradiction"]);
    expect(s.receipts[2].chosen).toBe("Chosen 4");
  });

  it("never names an archetype unless one was confirmed at finalize", () => {
    expect(buildDnaSummary(ledger, null).archetype).toEqual({ status: "emerging", name: null });
    expect(buildDnaSummary(ledger, { name: "The Atmospherist" }).archetype).toEqual({ status: "confirmed", name: "The Atmospherist" });
  });

  it("flags a single-lane run", () => {
    expect(buildDnaSummary(ledger, null).single_lane).toBe("Hip-hop");
  });

  it("lists a 1-1 split as undecided, not as a dimension", () => {
    const split = buildLedger([pick(1, 80, 20), pick(2, 20, 80)], DIMS);
    const s = buildDnaSummary(split, null);
    expect(s.dimensions).toHaveLength(0);
    expect(s.undecided.map((u) => u.axis)).toEqual(["texture"]);
  });
});
