import { describe, expect, it } from "vitest";
import batch from "../../../data/musicdna/hip-hop-expansion-2026-11-10.json";
import { DIMS } from "./axes";
import { sayingProblem, validTests } from "./pairing-eligibility";

const songs = new Map(batch.songs.map((s) => [s.id, s]));

describe("Hip-hop expansion review batch", () => {
  it("adds 20 scored songs and 24 matchups, inactive pending approval", () => {
    expect(batch.songs).toHaveLength(20);
    expect(batch.pairings).toHaveLength(24);
    expect(batch.activation_approved).toBe(false);
    expect(batch.songs.every((s) => !s.active)).toBe(true);
    expect(batch.pairings.every((p) => !p.active)).toBe(true);
    expect(batch.baseline.active_pairings + batch.pairings.length).toBe(44);
  });
  it("keeps every pairing within Hip-hop with at least 25-point declared contrasts", () => {
    for (const p of batch.pairings) {
      const a = songs.get(p.song_a_id),
        b = songs.get(p.song_b_id);
      if (!a || !b) throw new Error("Missing paired song");
      expect(a.lane).toBe("hip_hop");
      expect(b.lane).toBe("hip_hop");
      expect(a.artist).not.toBe(b.artist);
      expect(validTests(p.tests, a, b)).toEqual(p.tests);
      for (const t of p.tests) {
        const x = a[t as keyof typeof a],
          y = b[t as keyof typeof b];
        if (typeof x !== "number" || typeof y !== "number") throw new Error("Invalid trait");
        expect(Math.abs(x - y)).toBeGreaterThanOrEqual(25);
      }
    }
  });
  it("covers all ten dimensions and every new song", () => {
    expect([...new Set(batch.pairings.flatMap((p) => p.tests))].sort()).toEqual([...DIMS].sort());
    expect(new Set(batch.pairings.flatMap((p) => [p.song_a_id, p.song_b_id])).size).toBe(20);
  });
  it("retains bounded diagnostic components and their actual sum", () => {
    for (const s of batch.songs) {
      expect(s.longevity).toBeLessThanOrEqual(10);
      expect(s.diagnostic_power).toBe(
        s.polarization +
          s.tradeoff_richness +
          s.pairing_density +
          s.identity_signaling +
          s.longevity +
          s.cross_genre_mapping,
      );
      expect(s.scoring_provenance.predictive_validation).toBe(false);
    }
  });
  it("has unique non-generic sayings and no duplicate song pair", () => {
    const sayings: string[] = [];
    const keys = new Set<string>();
    for (const p of batch.pairings) {
      expect(sayingProblem(p.user_facing_tradeoff, sayings)).toBeNull();
      sayings.push(p.user_facing_tradeoff);
      const key = [p.song_a_id, p.song_b_id].sort().join(":");
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });
});
