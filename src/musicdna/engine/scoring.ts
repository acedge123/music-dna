// MusicDNA Engine — pure vector math.
//
// No I/O, no Supabase, no LLM. Every function here is deterministic and
// referentially transparent so archetype-scoring changes get regression
// tests, not surprises in production. This is the first migrated concern
// per docs/musicdna/engine-migration.md.

import type { Vector } from "./types";

/** Dot product over the union of keys; missing keys treated as 0. */
export function dot(a: Vector, b: Vector): number {
  let sum = 0;
  for (const k in a) {
    const bv = b[k];
    if (bv !== undefined) sum += a[k] * bv;
  }
  return sum;
}

/** Euclidean magnitude. */
export function magnitude(v: Vector): number {
  let sum = 0;
  for (const k in v) sum += v[k] * v[k];
  return Math.sqrt(sum);
}

/**
 * Cosine similarity in [-1, 1]. Returns 0 when either vector is all zero
 * (undefined mathematically; 0 is the neutral "no signal" answer the engine
 * expects — see musicdna.functions.ts probe alignment).
 */
export function cosine(a: Vector, b: Vector): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

/** L1 magnitude restricted to a set of dimensions (used for probe magnitude). */
export function l1Over(v: Vector, dims: readonly string[]): number {
  let sum = 0;
  for (const d of dims) sum += Math.abs(v[d] ?? 0);
  return sum;
}

/**
 * Score a candidate archetype vector against the user's session vector.
 *
 * Archetype vectors are authored on a -1..1 scale; session vectors accumulate
 * on a roughly -100..100 scale. We normalize the user vector by /100 before
 * cosine so the two live in comparable magnitudes — matching the behavior in
 * musicdna.functions.ts (the /100 there is per-key inside the dot loop).
 */
export function scoreArchetype(
  userVector: Vector,
  archetypeVector: Vector,
): number {
  const normalized: Vector = {};
  for (const k in archetypeVector) {
    normalized[k] = (userVector[k] ?? 0) / 100;
  }
  return cosine(normalized, archetypeVector);
}

export type FitTier = 20 | 50 | 80 | 95;
/** @deprecated Use `FitTier`. Kept as an alias so external callers don't break. */
export type ConfidenceTier = FitTier;

/**
 * Map a cosine similarity to a discrete archetype-fit tier used by the
 * Critic voice to modulate hedging.
 *
 * IMPORTANT — truth-in-labeling:
 *   These tiers describe *strength of fit* between the listener vector and
 *   an archetype's signature axes. They are NOT calibrated probabilities.
 *   A tier of 95 does not mean "95% chance the archetype is correct"; it
 *   means the cosine cleared the top bucket (>= 0.85) in the Archetype
 *   Bible's hedge ladder. A real confidence score would also incorporate
 *   margin over runner-up, number of independent choices, axis coverage,
 *   contradictory evidence, and stability across rounds.
 */
export function fitTier(score: number): FitTier {
  if (score >= 0.85) return 95;
  if (score >= 0.7) return 80;
  if (score >= 0.5) return 50;
  return 20;
}

/** @deprecated Use `fitTier`. */
export const confidenceTier = fitTier;

