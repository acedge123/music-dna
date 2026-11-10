import { describe, expect, it } from "vitest";
import yacht from "../../../data/musicdna/yacht-rock-expansion-2026-11-10.json";
import disco from "../../../data/musicdna/disco-expansion-2026-11-10.json";
import punk from "../../../data/musicdna/punk-expansion-2026-11-10.json";
import reggae from "../../../data/musicdna/reggae-expansion-2026-11-10.json";
import { DIMS } from "./axes";
import { validTests, sayingProblem } from "./pairing-eligibility";
import { selectPairing } from "./pairing";

describe("approved specialist catalog", () => {
  const batches = [yacht, disco, punk, reggae];
  it("contains the approved 69 songs and 46 pairings", () => {
    expect(batches.reduce((n, b) => n + b.songs.length, 0)).toBe(69);
    expect(batches.reduce((n, b) => n + b.pairings.length, 0)).toBe(46);
  });
  for (const batch of batches) {
    it(`${batch.lane} preserves every declared 20-point test and a unique saying`, () => {
      const score = (key: string) => {
        const song = batch.songs.find((s) => s.key === key);
        expect(song).toBeDefined();
        return Object.fromEntries(DIMS.map((axis, i) => [axis, song?.scores[i]]));
      };
      for (const pair of batch.pairings) {
        expect(validTests(pair.tests, score(pair.a), score(pair.b))).toEqual(pair.tests);
        expect(
          sayingProblem(
            pair.phrase,
            batches
              .flatMap((b) => b.pairings)
              .filter((p) => p !== pair)
              .map((p) => p.phrase),
          ),
        ).toBeNull();
      }
    });
    it(`${batch.lane} can serve six distinct same-lane rounds without exhaustion`, () => {
      const pool = batch.pairings.map((p) => ({
        id: `${p.a}/${p.b}`,
        lane: batch.lane,
        tests: p.tests,
        diagnostic_weight: p.weight,
        song_a: batch.songs.find((s) => s.key === p.a),
        song_b: batch.songs.find((s) => s.key === p.b),
      }));
      const used = new Set<string>();
      for (let round = 0; round < 6; round++) {
        const result = selectPairing({
          pool,
          vector: {},
          used_ids: used,
          session_lane: batch.lane,
          dims: DIMS,
          rng: { next: () => 0.5 },
        });
        expect(result.kind).toBe("picked");
        if (result.kind !== "picked") throw new Error("Unexpected catalog exhaustion");
        expect(result.pairing.lane).toBe(batch.lane);
        expect(used.has(result.pairing.id)).toBe(false);
        used.add(result.pairing.id);
      }
      expect(used.size).toBe(6);
    });
  }
});
