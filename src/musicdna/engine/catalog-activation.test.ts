import { expect, it } from "vitest";
import review from "../../../data/musicdna/cat06-review-2.json";

// Alan's explicit 31-song approval excludes these six unresolved candidates.
const held = new Set([
  "Beautiful Things", "Ordinary", "Messy", "Kyoto", "Solar Power", "The Adults Are Talking",
]);
const approved = review.songs.filter(song => !held.has(song.title));
const ids = new Set(approved.map(song => song.id));

it("selects exactly the 31 approved songs and excludes all six held candidates", () => {
  expect(approved).toHaveLength(31);
  expect(review.songs.filter(song => held.has(song.title))).toHaveLength(6);
  expect(approved.some(song => held.has(song.title))).toBe(false);
});

it("selects only the 23 reviewed matchups whose two songs are approved", () => {
  const pairs = review.pairings.filter(pair => ids.has(pair.song_a_id) && ids.has(pair.song_b_id));
  expect(pairs).toHaveLength(23);
  for (const pair of pairs) {
    expect(ids.has(pair.song_a_id)).toBe(true);
    expect(ids.has(pair.song_b_id)).toBe(true);
  }
});