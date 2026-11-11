import { describe, expect, it } from "vitest";
import { buildLedger } from "./evidence";
import { DIMS } from "./axes";
import { expectedCatalog, snapshotChoice } from "./evidence-snapshot";
import {
  hypotheticalChoice,
  readFingerprint,
  revealDraftKey,
  revealFingerprint,
} from "./prepared-read";

const vals = (n: number) => Object.fromEntries(DIMS.map((d) => [d, n]));
const a = {
  id: "a",
  title: "Firework",
  artist: "Katy Perry",
  year: 2010,
  lane: "pop",
  primary_lane: "pop",
  ...vals(80),
};
const b = {
  id: "b",
  title: "Liability",
  artist: "Lorde",
  year: 2017,
  lane: "pop",
  primary_lane: "pop",
  ...vals(20),
};
const pairing = {
  id: "p1",
  updated_at: "2026-01-01",
  tests: ["movement", "tension"],
  diagnostic_weight: 70,
  user_facing_tradeoff: "Rush or ache.",
};

function frozen(chosen: typeof a, rejected: typeof b, tradeoff = pairing.user_facing_tradeoff) {
  return snapshotChoice({
    id: "c1",
    pairing_id: "p1",
    session_id: "s1",
    created_at: "2026-01-02",
    chosen_song_id: chosen.id,
    rejected_song_id: rejected.id,
    evidence: {
      version: "choice-evidence-v1",
      source: "pairing",
      choice_id: "c1",
      pairing_id: "p1",
      session_id: "s1",
      created_at: "2026-01-02",
      ms_to_decide: 900,
      mutation_id: null,
      catalog_revision: "rev",
      catalog: expectedCatalog(pairing, chosen, rejected),
      editorial: {
        version: "pairing-saying-v1",
        pairing_revision: "2026-01-01",
        user_facing_tradeoff: tradeoff,
      },
      contrasts: {},
    },
  });
}

describe("prepared reads", () => {
  it("a reaction drafted before the pick matches the frozen vote for the same song", () => {
    const pre = readFingerprint(buildLedger([hypotheticalChoice(pairing, a, b)], DIMS), "prior", 0);
    const real = readFingerprint(buildLedger([frozen(a, b)], DIMS), "prior", 0);
    expect(pre).toBe(real);
  });
  it("the draft for the other song is never used", () => {
    const pre = readFingerprint(buildLedger([hypotheticalChoice(pairing, b, a)], DIMS), "prior", 0);
    expect(pre).not.toBe(readFingerprint(buildLedger([frozen(a, b)], DIMS), "prior", 0));
  });
  it("a changed matchup saying or prior read invalidates the draft", () => {
    const pre = readFingerprint(buildLedger([hypotheticalChoice(pairing, a, b)], DIMS), "prior", 0);
    expect(pre).not.toBe(readFingerprint(buildLedger([frozen(a, b, "Edited.")], DIMS), "prior", 0));
    expect(pre).not.toBe(readFingerprint(buildLedger([frozen(a, b)], DIMS), "other prior", 0));
  });
  it("a reveal drafted during the final pick matches only the song actually chosen", () => {
    const real = revealFingerprint(buildLedger([frozen(a, b)], DIMS));
    expect(revealFingerprint(buildLedger([hypotheticalChoice(pairing, a, b)], DIMS))).toBe(real);
    expect(revealFingerprint(buildLedger([hypotheticalChoice(pairing, b, a)], DIMS))).not.toBe(
      real,
    );
  });
  it("reveal drafts never share a slot with the post-pick reaction for pick 6", () => {
    expect(revealDraftKey(6)).not.toBe(6);
    expect(revealFingerprint(buildLedger([frozen(a, b)], DIMS))).not.toBe(
      readFingerprint(buildLedger([frozen(a, b)], DIMS), null, null),
    );
  });
});
