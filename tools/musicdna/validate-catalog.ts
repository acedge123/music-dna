import { DIMS } from "../../src/musicdna/engine/axes";

export type CatalogSong = {
  id: string;
  title: string;
  artist: string;
  primary_lane: string;
  active: boolean;
  primary_dimensions: string[];
  rationale: string;
  scoring_provenance: { review: string };
  canon_score: number;
  routing_power: number;
  [key: string]: unknown;
};
export type CatalogPair = {
  id: string;
  song_a_id: string;
  song_b_id: string;
  lane: string;
  active: boolean;
  tests: string[];
  diagnostic_weight: number;
  hypothesis: string;
  user_facing_tradeoff: string;
  expected_split: string;
};
export const DPS_COMPONENTS = {
  polarization: 25,
  tradeoff_richness: 20,
  pairing_density: 15,
  identity_signaling: 15,
  longevity: 10,
  cross_genre_mapping: 15,
} as const;
export function validateCatalog(songs: CatalogSong[], pairings: CatalogPair[]) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const coverage = Object.fromEntries(DIMS.map((axis) => [axis, 0]));
  const byId = new Map(songs.map((song) => [song.id, song]));
  const songIds = new Set<string>();
  const pairs = new Set<string>();
  for (const song of songs) {
    if (songIds.has(song.id)) errors.push(`${song.id}: duplicate song ID`);
    songIds.add(song.id);
    for (const axis of DIMS)
      if (
        typeof song[axis] !== "number" ||
        !Number.isFinite(song[axis]) ||
        Number(song[axis]) < 0 ||
        Number(song[axis]) > 100
      )
        errors.push(`${song.id}: invalid ${axis}`);
    if (DIMS.filter((axis) => Number(song[axis]) < 35 || Number(song[axis]) > 65).length < 3)
      warnings.push(`${song.id}: fewer than three non-neutral axes; activation review required`);
    if (
      !song.primary_dimensions?.length ||
      song.primary_dimensions.length > 3 ||
      new Set(song.primary_dimensions).size !== song.primary_dimensions.length ||
      song.primary_dimensions.some((axis) => !DIMS.some((dim) => dim === axis))
    )
      errors.push(`${song.id}: invalid primary dimensions`);
    let total = 0;
    for (const [key, max] of Object.entries(DPS_COMPONENTS)) {
      const value = song[key];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max)
        errors.push(`${song.id}: invalid ${key}`);
      else total += value;
    }
    if (song.diagnostic_power !== total) errors.push(`${song.id}: DPS sum mismatch`);
    for (const key of ["canon_score", "routing_power"])
      if (
        typeof song[key] !== "number" ||
        !Number.isFinite(song[key]) ||
        Number(song[key]) < 0 ||
        Number(song[key]) > 100
      )
        errors.push(`${song.id}: invalid ${key}`);
    if (!song.rationale || song.scoring_provenance?.review !== "pending" || song.active !== false)
      errors.push(`${song.id}: missing pending inactive review`);
  }
  for (const pair of pairings) {
    const a = byId.get(pair.song_a_id),
      b = byId.get(pair.song_b_id);
    if (!a || !b) {
      errors.push(`${pair.id}: unresolved song ID`);
      continue;
    }
    const key = [a.id, b.id].sort().join(":");
    if (pairs.has(key)) errors.push(`${pair.id}: duplicate unordered pair`);
    pairs.add(key);
    if (a.artist === b.artist || a.id === b.id) errors.push(`${pair.id}: same-artist pairing`);
    if (a.primary_lane !== pair.lane || b.primary_lane !== pair.lane)
      errors.push(`${pair.id}: lane mismatch`);
    if (
      pair.active !== false ||
      !pair.hypothesis ||
      !pair.user_facing_tradeoff ||
      !pair.expected_split ||
      !Number.isInteger(pair.diagnostic_weight) ||
      pair.diagnostic_weight < 40 ||
      pair.diagnostic_weight > 100
    )
      errors.push(`${pair.id}: missing or invalid review metadata`);
    if (
      !pair.tests.length ||
      pair.tests.length > 3 ||
      new Set(pair.tests).size !== pair.tests.length
    )
      errors.push(`${pair.id}: invalid test count`);
    for (const axis of pair.tests) {
      if (!DIMS.some((dim) => dim === axis)) {
        errors.push(`${pair.id}: undeclared axis ${axis}`);
        continue;
      }
      if (
        typeof a[axis] !== "number" ||
        typeof b[axis] !== "number" ||
        Math.abs(Number(a[axis]) - Number(b[axis])) < 20
      )
        errors.push(`${pair.id}: ${axis} contrast below 20`);
      else coverage[axis] += 1;
    }
  }
  for (const axis of DIMS)
    if (coverage[axis] < 5)
      warnings.push(`${axis}: ${coverage[axis]} qualifying tests; full lane target is 5`);
  for (const axis of DIMS)
    if (Math.min(...songs.map((song) => Number(song[axis]))) >= 30)
      warnings.push(`${axis}: no defining low-pole anchor in this batch`);
  return { errors, warnings, coverage };
}
