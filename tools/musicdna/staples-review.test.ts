import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { scoringReady, validateStaplesShortlist, type StapleCandidate } from "./staples-review";

const rows = JSON.parse(readFileSync(new URL("../../docs/musicdna/staples-pack-2026-11-15/candidates.json", import.meta.url), "utf8")) as StapleCandidate[];

describe("staples pack review gates", () => {
  it("holds exactly 10/25/25/25/25/50 unique sourced candidates", () => {
    expect(validateStaplesShortlist(rows)).toEqual([]);
  });
  it("rejects a duplicated recording", () => {
    const first = rows[0];
    if (!first) throw new Error("missing fixture");
    expect(validateStaplesShortlist([...rows, { ...first, id: "another-id" }])).toContain("another-id: duplicate recording");
  });
  it("never calls a 2026 chart completed", () => {
    const first = rows[0];
    if (!first) throw new Error("missing fixture");
    expect(validateStaplesShortlist([{ ...first, chart_year: 2026, chart_status: "completed" }])).toContain(`${first.id}: 2026 must be provisional`);
  });
  it("blocks scoring until original recording identity and year are verified", () => {
    const first = rows[0];
    if (!first) throw new Error("missing fixture");
    expect(scoringReady({ ...first, release_year: null, identity_review: "pending" })).toBe(false);
    expect(scoringReady({ ...first, release_year: 1977, identity_review: "verified" })).toBe(true);
  });
  it("does not equate chart year with release decade", () => {
    const first = rows[0];
    if (!first) throw new Error("missing fixture");
    expect(validateStaplesShortlist([{ ...first, release_year: 1969, target_decade: 1970 }])).toContain(`${first.id}: recording belongs to another release decade`);
  });
});