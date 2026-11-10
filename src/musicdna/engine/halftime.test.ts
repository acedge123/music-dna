import { describe, expect, it } from "vitest";
import { halftimeSummary } from "./halftime";

const e = (t: string, d: string | null, r = false) => ({ chosenTitle: t, topDim: d, revised: r });

describe("halftimeSummary", () => {
  it("never repeats a reaction and names the three picks", () => {
    const s = halftimeSummary([e("A", "x"), e("B", "x"), e("C", "x")]);
    expect(s).toContain("A, B, C");
    expect(s).toContain("holds or cracks");
  });
  it("flags a revision as tension", () => {
    expect(halftimeSummary([e("A", "x"), e("B", "y", true), e("C", "y")])).toContain("change my mind");
  });
  it("mixed threads stay open", () => {
    expect(halftimeSummary([e("A", "x"), e("B", "y"), e("C", "z")])).toContain("No single thread");
  });
});
