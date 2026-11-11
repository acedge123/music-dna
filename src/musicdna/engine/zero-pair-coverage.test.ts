import { describe, expect, it } from "vitest";
import batch from "../../../data/musicdna/zero-pair-pop-2026-11-08.json";
import { DIMS } from "./axes";
import { selectPairing } from "./pairing";

describe("Zero-pairing coverage first", () => {
  const songs = new Map(batch.songs.map((song) => [song.id, song]));
  const pool = batch.pairings.map((pair) => ({
    ...pair,
    song_a: songs.get(pair.song_a_id),
    song_b: songs.get(pair.song_b_id),
  }));
  it("covers every never-paired song in this batch before expanding Alternative", () => {
    const covered = new Set(batch.pairings.flatMap((p) => [p.song_a_id, p.song_b_id]));
    const targets = batch.songs.filter((s) => s.had_no_pairings);
    expect(targets).toHaveLength(13);
    expect(targets.every((s) => covered.has(s.id))).toBe(true);
    expect(batch.pairings.every((p) => p.lane === "pop")).toBe(true);
  });
  it("uses active lane-local songs, different artists, and only declared meaningful tests", () => {
    for (const pair of batch.pairings) {
      const a = songs.get(pair.song_a_id);
      const b = songs.get(pair.song_b_id);
      if (!a || !b) throw new Error("Unresolved song");
      expect(a.active && b.active && pair.active).toBe(true);
      expect(a.primary_lane).toBe(pair.lane);
      expect(b.primary_lane).toBe(pair.lane);
      expect(a.artist).not.toBe(b.artist);
      expect(pair.tests.length).toBeGreaterThan(0);
      for (const test of pair.tests) {
        expect(DIMS.some((axis) => axis === test)).toBe(true);
        const av = (a as Record<string, unknown>)[test];
        const bv = (b as Record<string, unknown>)[test];
        expect(typeof av).toBe("number");
        expect(typeof bv).toBe("number");
        expect(Math.abs(Number(av) - Number(bv))).toBeGreaterThanOrEqual(20);
      }
    }
  });
  it("selects all eight new matchups without replaying a used pair", () => {
    const used = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const selected = selectPairing({
        pool,
        used_ids: used,
        vector: {},
        dims: DIMS,
        session_lane: "pop",
        rng: { next: () => 0.37 },
      });
      expect(selected.kind).toBe("picked");
      if (selected.kind !== "picked") throw new Error("Unselectable matchup");
      expect(used.has(selected.pairing.id)).toBe(false);
      used.add(selected.pairing.id);
    }
    expect(used.size).toBe(8);
  });
});
