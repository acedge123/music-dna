import { describe, expect, it } from "vitest";
import batch from "../../../data/musicdna/zero-pair-families-2026-11-09.json";
import { DIMS } from "./axes";
import { selectPairing } from "./pairing";

describe("Dimension-specific zero-pair coverage", () => {
  const songs = new Map(batch.songs.map((song) => [song.id, song]));
  const pool = batch.pairings.map((pair) => ({
    ...pair,
    song_a: songs.get(pair.song_a_id),
    song_b: songs.get(pair.song_b_id),
  }));

  it("covers 42 previously unpaired active songs in seven existing families", () => {
    expect(batch.songs).toHaveLength(42);
    expect(batch.songs.every((song) => song.active && song.had_no_pairings)).toBe(true);
    const covered = new Set(batch.pairings.flatMap((p) => [p.song_a_id, p.song_b_id]));
    expect(covered.size).toBe(42);
    expect(batch.songs.every((song) => covered.has(song.id))).toBe(true);
    expect(new Set(batch.songs.map((song) => song.lane)).size).toBe(7);
  });

  it("keeps every test inside the same classified lane and musical family", () => {
    for (const pair of pool) {
      const a = pair.song_a;
      const b = pair.song_b;
      if (!a || !b) throw new Error("Missing pinned song");
      expect(a.primary_lane).toBe(pair.lane);
      expect(b.primary_lane).toBe(pair.lane);
      expect(a.lane).toBe(b.lane);
      expect(a.artist).not.toBe(b.artist);
      expect(pair.active && a.active && b.active).toBe(true);
    }
  });

  it("declares one or two valid dimensions with at least 20 points of contrast", () => {
    for (const pair of pool) {
      expect(pair.tests.length).toBeGreaterThanOrEqual(1);
      expect(pair.tests.length).toBeLessThanOrEqual(2);
      expect(new Set(pair.tests).size).toBe(pair.tests.length);
      for (const axis of pair.tests) {
        expect(DIMS.some((dim) => dim === axis)).toBe(true);
        const a = (pair.song_a as Record<string, unknown> | undefined)?.[axis];
        const b = (pair.song_b as Record<string, unknown> | undefined)?.[axis];
        expect(typeof a).toBe("number");
        expect(typeof b).toBe("number");
        expect(Number.isFinite(a)).toBe(true);
        expect(Number.isFinite(b)).toBe(true);
        expect(Math.abs(Number(a) - Number(b))).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("makes every added pairing reachable without replay", () => {
    const used = new Set<string>();
    for (let i = 0; i < 21; i++) {
      const selected = selectPairing({
        pool,
        vector: {},
        used_ids: used,
        session_lane: "alternative",
        dims: DIMS,
        rng: { next: () => 0.37 },
      });
      if (selected.kind !== "picked") throw new Error("Unreachable pairing");
      expect(used.has(selected.pairing.id)).toBe(false);
      used.add(selected.pairing.id);
    }
    expect(used.size).toBe(21);
  });
});
