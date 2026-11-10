import { describe, expect, it } from "vitest";
import { halftimeSummary } from "./halftime";

const e = (t: string, d: string | null, r = false, direction?: "forming" | "holding" | "contested" | "revising") =>
  ({ chosenTitle: t, topDim: d, revised: r, direction });

describe("halftimeSummary", () => {
  it("names the three picks", () => {
    expect(halftimeSummary([e("A", "x"), e("B", "x"), e("C", "x")])).toContain("A, B, C");
  });
  it("reports a thread when the ledger read after pick three has one, even if early reads were empty", () => {
    const s = halftimeSummary([e("A", null), e("B", null), e("C", "x", false, "holding")]);
    expect(s).toContain("One thread keeps turning up");
    expect(s).not.toContain("No single thread");
  });
  it("flags a revision as tension", () => {
    expect(halftimeSummary([e("A", "x"), e("B", "y", true), e("C", "y")])).toContain("change my mind");
  });
  it("contested evidence is a split, not a pattern", () => {
    expect(halftimeSummary([e("A", "x"), e("B", "y"), e("C", "z", false, "contested")])).toContain("two directions");
  });
  it("no ledger lead means no pattern claim", () => {
    expect(halftimeSummary([e("A", "x"), e("B", "y"), e("C", null)])).toContain("No single thread");
  });
});
