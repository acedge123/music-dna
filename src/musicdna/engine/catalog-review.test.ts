import { describe, expect, it } from "vitest";
import review from "../../../data/musicdna/cat06-review-2.json";
import { DIMS } from "./axes";
import { buildLedger, type LedgerChoice } from "./evidence";
import { selectPairing, sessionCompletion } from "./pairing";
import {
  validateCatalog,
  type CatalogPair,
  type CatalogSong,
} from "../../../tools/musicdna/validate-catalog";
const songs = review.songs as CatalogSong[];
const pairs = review.pairings as CatalogPair[];
const byId = new Map(songs.map((s) => [s.id, s]));
const pool = pairs.map((p) => ({
  ...p,
  song_a: byId.get(p.song_a_id),
  song_b: byId.get(p.song_b_id),
}));
const select = (used_ids = new Set<string>()) =>
  selectPairing({
    pool,
    used_ids,
    vector: {},
    session_lane: "alternative",
    dims: DIMS,
    rng: { next: () => 0.37 },
  });
describe("Inactive modern catalog recalibration", () => {
  it("keeps all 37 songs inactive and pending approval", () => {
    expect(songs).toHaveLength(37);
    expect(songs.every((s) => !s.active && s.scoring_provenance.review === "pending")).toBe(true);
    expect(review.activation_approved).toBe(false);
  });
  it("passes ten-axis, component bounds, metadata and every declared 20-point contrast", () => {
    expect(validateCatalog(songs, pairs).errors).toEqual([]);
    expect(pairs).toHaveLength(30);
  });
  it("rejects an unsupported test rather than silently counting it", () => {
    const mutated = pairs.map((p, i) => (i === 0 ? { ...p, tests: ["movement"] } : p));
    expect(
      validateCatalog(songs, mutated).errors.some((e) => e.includes("contrast below 20")),
    ).toBe(true);
  });
  it("rejects legacy axes and inconsistent DPS totals", () => {
    expect(
      validateCatalog(songs, [{ ...pairs[0], tests: ["groove"] }]).errors.some((e) =>
        e.includes("undeclared axis"),
      ),
    ).toBe(true);
    const first = songs[0];
    expect(
      validateCatalog(
        [{ ...first, diagnostic_power: Number(first.diagnostic_power) + 1 }, ...songs.slice(1)],
        pairs,
      ).errors.some((e) => e.includes("DPS sum mismatch")),
    ).toBe(true);
  });
  it("reports coverage deficits without lowering the five-pair target", () => {
    expect(validateCatalog(songs, pairs).coverage.movement).toBe(4);
    expect(validateCatalog(songs, pairs).coverage.scale).toBe(3);
    expect(validateCatalog(songs, pairs).warnings.some((w) => w.startsWith("scale: 3"))).toBe(true);
  });
  it("selects six distinct usable modern matchups and avoids used/skipped IDs", () => {
    const used = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const result = select(used);
      expect(result.kind).toBe("picked");
      if (result.kind !== "picked") return;
      expect(used.has(result.pairing.id)).toBe(false);
      expect(result.pairing.song_a?.year).toBeGreaterThanOrEqual(2000);
      used.add(result.pairing.id);
    }
    expect(used.size).toBe(6);
    expect(select(new Set(pairs.map((p) => p.id))).kind).toBe("empty");
  });
  it("drops a same-artist candidate even when its weight is high", () => {
    const result = selectPairing({
      pool: [
        {
          id: "concentrated",
          tests: ["movement"],
          diagnostic_weight: 100,
          lane: "alternative",
          song_a: { artist: "The Strokes" },
          song_b: { artist: "The Strokes" },
        },
      ],
      used_ids: new Set(),
      vector: {},
      session_lane: "alternative",
      dims: DIMS,
      rng: { next: () => 0 },
    });
    expect(result.kind).toBe("empty");
  });
  it("ends after three consecutive skips without inventing evidence", () => {
    expect(
      sessionCompletion({ answered: 0, skipped: 3, consecutive_skips: 3, vector: {}, dims: DIMS })
        .reason,
    ).toBe("skip_bound");
    expect(buildLedger([], DIMS).axes).toEqual([]);
  });
  const confidencePairs = pairs.filter((p) => p.tests.includes("confidence")).slice(0, 4);
  function choices(supporting: number): LedgerChoice[] {
    return confidencePairs.map((p, i) => {
      const a = byId.get(p.song_a_id),
        b = byId.get(p.song_b_id);
      if (!a || !b) throw new Error("Missing reviewed song");
      const hi = Number(a.confidence) > Number(b.confidence) ? a : b;
      const lo = hi === a ? b : a;
      return {
        pairing_id: p.id,
        tests: p.tests,
        diagnostic_weight: p.diagnostic_weight,
        chosen: i < supporting ? hi : lo,
        rejected: i < supporting ? lo : hi,
      };
    });
  }
  it("supports qualified 3–1 claims on actual reviewed pairings, never 2–2", () => {
    const qualified = buildLedger(choices(3), DIMS).axes.find((a) => a.axis === "confidence");
    expect(qualified?.supporting).toBe(3);
    expect(qualified?.contradicting).toBe(1);
    expect(qualified?.status).toBe("qualified");
    expect(qualified?.eligible).toBe(true);
    const mixed = buildLedger(choices(2), DIMS).axes.find((a) => a.axis === "confidence");
    expect(mixed?.status).toBe("mixed");
    expect(mixed?.eligible).toBe(false);
  });
  it("retains declared evidence in mixed-era fixtures and surfaces artist concentration", () => {
    const original = choices(3);
    const mixed = original.map((c, i) =>
      i === 0 ? { ...c, chosen: { ...c.chosen, year: 1981 } } : c,
    );
    expect(buildLedger(mixed, DIMS).entries.length).toBe(
      buildLedger(original, DIMS).entries.length,
    );
    const concentrated = original.map((c) => ({
      ...c,
      chosen: { ...c.chosen, artist: "Same opener artist" },
    }));
    expect(
      buildLedger(concentrated, DIMS).confounds.some((c) => c.kind === "artist" && c.count === 4),
    ).toBe(true);
  });
});
