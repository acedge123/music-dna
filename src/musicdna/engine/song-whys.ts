// "Why this score?" helpers: which traits deserve an explanation, and when an
// explanation is still valid for a song's current score.
import { DIMS } from "./axes";

export const WHY_MIN_DISTANCE = 20;
export const WHY_MAX_TRAITS = 3;

/** The song's 2–3 most distinctive traits: furthest from neutral, at least 20 points out. */
export function distinctiveTraits(song: Record<string, unknown>): { axis: string; score: number }[] {
  return DIMS.map((axis) => ({ axis, score: Number(song[axis]) }))
    .filter((t) => Number.isFinite(t.score) && Math.abs(t.score - 50) >= WHY_MIN_DISTANCE)
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50) || a.axis.localeCompare(b.axis))
    .slice(0, WHY_MAX_TRAITS);
}

/** An explanation only describes the score it was written for. */
export function explanationIsCurrent(e: { score_at_write: number }, currentScore: number) {
  return e.score_at_write === currentScore;
}
