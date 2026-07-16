// Pure choice-application math.
//
// Given a pairing, the winner/loser vectors, and the session's running
// vector, produce the delta vector, the updated vector, and the topline
// dimension/delta the reveal builder uses.
//
// No I/O. No LLM. Deterministic. Web server-fns and REST routes both feed
// data in and take the result out; there is one implementation.
//
// Cross-lane probe flipping used to live here. It is quarantined in
// src/musicdna/engine/experiments/cross-lane-probes.ts — see that file's
// header and docs/musicdna/experiments/cross-lane-probes.md for why.

import type { Vector } from "./types";

export type SongVector = Record<string, number>;

export type ApplyChoiceInput = {
  prior_vector: Vector;
  winner: SongVector;
  loser: SongVector;
  tests: string[];
  diagnostic_weight: number | null; // 0..100, defaults to 50
  fallback_dims: readonly string[];
};

export type ApplyChoiceResult = {
  vector: Vector; // prior + weighted delta
  delta_vector: Vector; // per-axis raw delta (winner - loser)
  top_dim: string;
  top_delta: number; // signed
};

export function applyChoice(input: ApplyChoiceInput): ApplyChoiceResult {
  const w = (input.diagnostic_weight ?? 50) / 100;
  const priorVec: Vector = { ...input.prior_vector };
  const vec: Vector = { ...priorVec };
  const tests = input.tests?.length ? input.tests : (input.fallback_dims.slice() as string[]);
  let top_dim = tests[0] ?? "movement";
  let top_delta = 0;
  const delta_vector: Vector = {};
  for (const dim of tests) {
    const a = input.winner?.[dim] ?? 50;
    const b = input.loser?.[dim] ?? 50;
    const delta = a - b;
    delta_vector[dim] = delta;
    vec[dim] = (vec[dim] ?? 0) + delta * w;
    if (Math.abs(delta) > Math.abs(top_delta)) {
      top_delta = delta;
      top_dim = dim;
    }
  }
  return { vector: vec, delta_vector, top_dim, top_delta };
}
