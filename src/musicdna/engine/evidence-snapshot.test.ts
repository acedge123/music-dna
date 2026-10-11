import { describe, expect, it } from "vitest";
import { expectedCatalog, snapshotChoice, type EvidenceRow } from "./evidence-snapshot";
import { buildLedger } from "./evidence";
import { applyChoice } from "./choice";
import { DIMS } from "./axes";

function row(id = "1", delta = 40): EvidenceRow {
  const catalog = expectedCatalog(
    { updated_at: "revision-1", tests: ["scale", "scale", "fake"], diagnostic_weight: 100 },
    { id: "a", title: "A", artist: "X", year: 1980, lane: "pop", scale: 50 + delta / 2 },
    { id: "b", title: "B", artist: "Y", scale: 50 - delta / 2 },
  );
  return {
    id,
    pairing_id: id,
    session_id: "s",
    chosen_song_id: "a",
    rejected_song_id: "b",
    created_at: "2026-10-10T00:00:00Z",
    evidence: {
      version: "choice-evidence-v1",
      source: "pairing",
      choice_id: id,
      pairing_id: id,
      session_id: "s",
      created_at: "2026-10-10T00:00:00Z",
      ms_to_decide: 100,
      mutation_id: null,
      catalog_revision: "hash-1",
      catalog,
      contrasts: { scale: delta },
    },
  };
}

describe("frozen choice evidence", () => {
  it("replays the snapshot independently of current catalog metadata", () => {
    const original = row();
    const copy = structuredClone(original);
    const catalogNow = { title: "Renamed", scale: 0 };
    expect(catalogNow.title).not.toBe("A");
    const ledger = buildLedger([snapshotChoice(copy)], DIMS);
    expect(ledger.entries[0]).toMatchObject({
      chosen: "A",
      delta: 40,
      weight: 1,
      choice_id: "1",
      pairing_revision: "revision-1",
    });
    expect(copy).toEqual(original);
  });
  it("does not invent evidence for pre-migration votes", () => {
    const legacy = { ...row(), evidence: null };
    expect(snapshotChoice(legacy).provenance).toBe("legacy_unavailable");
    expect(buildLedger([snapshotChoice(legacy)], DIMS)).toMatchObject({
      answered: 1,
      unavailable: 1,
      entries: [],
    });
  });
  it("rejects corrupt snapshots and mismatched vote identity", () => {
    expect(snapshotChoice({ ...row(), evidence: {} }).provenance).toBe("invalid_snapshot");
    expect(snapshotChoice({ ...row(), chosen_song_id: "other" }).chosen).toBeNull();
  });
  it("normalizes declared axes, never falls back to all dimensions", () => {
    const choice = snapshotChoice(row());
    expect(choice.tests).toEqual(["scale"]);
    expect(buildLedger([{ ...choice, tests: [] }], DIMS).entries).toEqual([]);
    expect(
      buildLedger([{ ...choice, tests: ["fake", "scale", "scale"] }], DIMS).entries,
    ).toHaveLength(1);
  });
  it("excludes null and nonfinite values; distinct votes and confounds stay separate", () => {
    const choices = [row("1"), row("2"), row("3"), row("4", -40)].map(snapshotChoice);
    const l = buildLedger([...choices, choices[0]], DIMS);
    expect(l.axes[0]).toMatchObject({ supporting: 3, contradicting: 1, status: "qualified" });
    expect(l.confounds).toContainEqual({ kind: "artist", value: "X", count: 4, total: 4 });
    expect(l.entries).toHaveLength(4);
    expect(buildLedger([{ ...choices[0], chosen: { scale: Infinity } }], DIMS).entries).toEqual([]);
  });
  it("new scoring excludes undeclared, duplicate and missing values without rewriting legacy math", () => {
    const input = {
      prior_vector: { scale: 5 },
      winner: { scale: 90, tension: 90 },
      loser: { scale: 10 },
      tests: ["scale", "scale", "tension", "fake"],
      diagnostic_weight: 50,
      fallback_dims: DIMS,
      strict_axes: true,
    };
    expect(applyChoice(input).vector).toEqual({ scale: 45 });
    expect(applyChoice({ ...input, tests: [] }).vector).toEqual({ scale: 5 });
  });
});
