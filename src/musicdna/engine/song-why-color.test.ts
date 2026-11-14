import { describe, expect, it, vi } from "vitest";
import { selectSongWhyColor } from "./song-why-color";
import { expectedCatalog, snapshotChoice, type EvidenceRow } from "./evidence-snapshot";
import { buildLedger } from "./evidence";
import { DIMS } from "./axes";
import { buildDnaSummary } from "./dna-summary";
import { hypotheticalChoice, readFingerprint, revealFingerprint } from "./prepared-read";
import { authorCritic, criticFacts } from "../adapters/critic-editorial";

const chosen = { id: "a", title: "A", artist: "X", scale: 80 };
const rejected = { id: "b", title: "B", artist: "Y", scale: 20 };
const pairing = { id: "p", tests: ["scale"], diagnostic_weight: 50, updated_at: "r" };
const approved = { id: "why-a", song_id: "a", axis: "scale", score_at_write: 80,
  audible_evidence: "The voice sits close above a spare arrangement.", scoring_version: null, status: "approved" };
const whys = { chosen: selectSongWhyColor([approved], chosen, pairing.tests), rejected: [] };
function frozen(details: unknown = { version: "song-whys-v1", ...whys }): EvidenceRow {
  return { id: "c", pairing_id: "p", session_id: "s", chosen_song_id: "a", rejected_song_id: "b", created_at: "now",
    evidence: { version: "choice-evidence-v1", source: "pairing", choice_id: "c", pairing_id: "p", session_id: "s",
      created_at: "now", mutation_id: null, ms_to_decide: null, catalog_revision: "hash",
      catalog: expectedCatalog(pairing, chosen, rejected), contrasts: { scale: 60 }, song_whys: details } };
}
describe("optional frozen Song Whys", () => {
  it("accepts only approved rows", () => {
    for (const status of ["pending_review", "rejected"]) expect(selectSongWhyColor([{ ...approved, status }], chosen, pairing.tests)).toEqual([]);
    expect(whys.chosen).toHaveLength(1);
  });
  it("excludes stale scores, wrong songs and untested dimensions", () => {
    expect(selectSongWhyColor([{ ...approved, score_at_write: 79 }], chosen, pairing.tests)).toEqual([]);
    expect(selectSongWhyColor([{ ...approved, song_id: "b" }], chosen, pairing.tests)).toEqual([]);
    expect(selectSongWhyColor([approved], chosen, ["texture"])).toEqual([]);
  });
  it("does not alter counts, scores or claim eligibility", () => {
    const plain = buildLedger([hypotheticalChoice(pairing, chosen, rejected)], DIMS);
    const colored = buildLedger([snapshotChoice(frozen())], DIMS);
    expect(colored.answered).toBe(plain.answered);
    expect(colored.axes.map(({ supporting_examples, contradicting_examples, ...a }) => a))
      .toEqual(plain.axes.map(({ supporting_examples, contradicting_examples, ...a }) => a));
    expect(colored.entries[0].delta).toBe(60);
  });
  it("keeps prepared and frozen fingerprints identical, invalidates changed descriptions", () => {
    const pre = buildLedger([hypotheticalChoice(pairing, chosen, rejected, whys)], DIMS);
    const actual = buildLedger([snapshotChoice(frozen())], DIMS);
    expect(readFingerprint(pre, null, null)).toBe(readFingerprint(actual, null, null));
    const changed = buildLedger([hypotheticalChoice(pairing, chosen, rejected, { ...whys,
      chosen: [{ ...whys.chosen[0], audible_evidence: "A changed description of this recording." }] })], DIMS);
    expect(revealFingerprint(changed)).not.toBe(revealFingerprint(actual));
  });
  it("retains frozen receipts independently of later review edits", () => {
    const saved = frozen();
    const catalogNow = { ...approved, audible_evidence: "Different words in the live review queue." };
    expect(catalogNow.audible_evidence).not.toBe(approved.audible_evidence);
    const receipt = buildDnaSummary(buildLedger([snapshotChoice(saved)], DIMS), null).receipts[0];
    expect(receipt.song_whys?.chosen[0].audible_evidence).toBe(approved.audible_evidence);
  });
  it("old and malformed optional annotations preserve valid scoring evidence", () => {
    for (const details of [undefined, { version: "unknown" }]) {
      const row = frozen(details);
      if (details === undefined) delete (row.evidence as Record<string, unknown>).song_whys;
      const choice = snapshotChoice(row);
      expect(choice.provenance).toBe("pairing");
      expect(choice.song_whys).toBeUndefined();
    }
  });
  it("supplies the same recording detail to writer and independent reviewer in two calls", async () => {
    const ledger = buildLedger([snapshotChoice(frozen())], DIMS);
    const generate = vi.fn().mockResolvedValueOnce(JSON.stringify({ headline: "A wins this round.", body: "", choice_ids: ["c"], claims: [] }))
      .mockResolvedValueOnce(JSON.stringify({ grounded: true, ceiling_preserved: true, exceptions_preserved: true,
        self_report_separate: true, no_invented_facts: true, no_future_test_disclosure: true, responsive: true }));
    expect((await authorCritic(ledger, {}, generate, { stage: "read" })).status).toBe("ok");
    expect(generate).toHaveBeenCalledTimes(2);
    for (const call of generate.mock.calls) {
      const facts = JSON.parse(String(call[0]).split("FACTS: ")[1].split("\nCONTEXT:")[0]);
      expect(facts.choices[0].audible_details[0].chosen[0].audible_evidence).toBe(approved.audible_evidence);
    }
    expect(criticFacts(buildLedger([hypotheticalChoice(pairing, chosen, rejected)], DIMS), {}).choices[0]).not.toHaveProperty("audible_details");
  });
});