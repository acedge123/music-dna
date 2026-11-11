import { describe, expect, it } from "vitest";
import { DIMS } from "./axes";
import { hypotheticalChoice } from "./prepared-read";
import { poolEligible, poolEntryStale, poolFingerprint } from "./reaction-pool";

const vals = (n: number) => Object.fromEntries(DIMS.map((d) => [d, n]));
const a = {
  id: "a",
  title: "A",
  artist: "X",
  year: 2010,
  lane: "pop",
  primary_lane: "pop",
  ...vals(80),
};
const b = {
  id: "b",
  title: "B",
  artist: "Y",
  year: 2011,
  lane: "pop",
  primary_lane: "pop",
  ...vals(20),
};
const pairing = {
  id: "p",
  updated_at: "r1",
  tests: ["movement"],
  diagnostic_weight: 60,
  user_facing_tradeoff: "Line.",
};
const ok = { priorChoices: 0, hadPriorRead: false, validation_reason: "accepted", text: "Sharp." };

describe("reaction pool", () => {
  it("never pools a draft written after earlier picks", () => {
    expect(poolEligible(ok)).toBe(true);
    expect(poolEligible({ ...ok, priorChoices: 1 })).toBe(false);
    expect(poolEligible({ ...ok, hadPriorRead: true })).toBe(false);
  });
  it("never pools an unapproved draft", () => {
    expect(poolEligible({ ...ok, validation_reason: "semantic_review_rejected" })).toBe(false);
    expect(poolEligible({ ...ok, validation_reason: "accepted_after_retry" })).toBe(true);
  });
  it("retires an entry when evidence or critic rules change", () => {
    const choice = hypotheticalChoice(pairing, a, b);
    const entry = { evidence_fingerprint: poolFingerprint(choice, "w1", "r1") };
    expect(poolEntryStale(entry, { choice, writer: "w1", reviewer: "r1" })).toBe(false);
    expect(poolEntryStale(entry, { choice, writer: "w2", reviewer: "r1" })).toBe(true);
    const edited = hypotheticalChoice({ ...pairing, user_facing_tradeoff: "New." }, a, b);
    expect(poolEntryStale(entry, { choice: edited, writer: "w1", reviewer: "r1" })).toBe(true);
    const rescored = hypotheticalChoice(pairing, { ...a, movement: 55 }, b);
    expect(poolEntryStale(entry, { choice: rescored, writer: "w1", reviewer: "r1" })).toBe(true);
  });
});
