// Archetype matching v2: approved profiles on the current 10 traits with
// signed weights, scored only from frozen ledger evidence. Selection of an
// archetype must be earned: enough relevant comparisons, a clear gap to the
// runner-up, more than one genre, and no unmeasured thematic requirement.

import type { Ledger } from "./evidence";

export const ARCHETYPE_V2_VERSION = "archetype-v2";
export const V2_SCORE_FLOOR = 0.5;
export const V2_MARGIN_FLOOR = 0.1;
export const V2_MIN_RELEVANT = 4;
/** Core traits with evidence needed before an archetype can be confirmed. */
export const V2_MIN_DIMENSIONS = 2;
/** Runner-ups this similar are the same shape, not a real competitor. */
export const V2_TWIN_SIMILARITY = 0.95;

export type ArchetypeProfileV2 = {
  archetype_id: string;
  name: string;
  version?: number;
  core: Record<string, number>;
  thematic_note?: string | null;
};

export function profileSimilarity(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const x = a[k] ?? 0, y = b[k] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export type ArchetypeMatchV2 = {
  name: string;
  archetype_id: string;
  profile_version: number;
  version: typeof ARCHETYPE_V2_VERSION;
  score: number;
  status: "confirmed" | "leaning" | "none";
  reasons: string[];
  runner_up: { name: string; score: number } | null;
};

/** Per-axis signed lean in [-1,1] from the ledger: (support - contradiction) / relevant. */
export function ledgerLean(ledger: Ledger): Record<string, { lean: number; relevant: number }> {
  const out: Record<string, { lean: number; relevant: number }> = {};
  for (const a of ledger.axes) {
    const relevant = a.supporting + a.contradicting;
    if (!relevant) continue;
    const sign = a.direction === "hi" ? 1 : -1;
    out[a.axis] = { lean: (sign * (a.supporting - a.contradicting)) / relevant, relevant };
  }
  return out;
}

export function scoreProfile(profile: ArchetypeProfileV2, lean: ReturnType<typeof ledgerLean>) {
  let num = 0;
  let den = 0;
  let relevant = 0;
  let dimensions = 0;
  for (const [axis, w] of Object.entries(profile.core)) {
    den += Math.abs(w);
    const l = lean[axis];
    if (!l) continue;
    num += w * l.lean;
    relevant += l.relevant;
    dimensions += 1;
  }
  return { score: den ? num / den : 0, relevant, dimensions };
}

export function matchArchetypeV2(
  ledger: Ledger,
  profiles: ArchetypeProfileV2[],
): ArchetypeMatchV2 | null {
  if (!profiles.length) return null;
  const lean = ledgerLean(ledger);
  const ranked = profiles
    .map((p) => ({ p, ...scoreProfile(p, lean) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  // A near-twin profile (e.g. Seeker vs Transformer) never blocks a match by
  // competing as the runner-up; the margin is measured against a distinct shape.
  const second =
    ranked.slice(1).find((r) => profileSimilarity(r.p.core, best.p.core) < V2_TWIN_SIMILARITY) ?? null;
  const lanes = ledger.confounds.filter((c) => c.kind === "lane");
  const singleLane = lanes.some((c) => c.total > 0 && c.count === c.total);
  const reasons: string[] = [];
  if (best.score < V2_SCORE_FLOOR) reasons.push("weak_fit");
  if (second && best.score - second.score < V2_MARGIN_FLOOR) reasons.push("close_runner_up");
  if (best.relevant < V2_MIN_RELEVANT) reasons.push("few_relevant_comparisons");
  if (best.dimensions < V2_MIN_DIMENSIONS) reasons.push("single_dimension");
  if (singleLane) reasons.push("single_genre");
  if (best.p.thematic_note) reasons.push("needs_thematic_evidence");
  const status =
    best.score <= 0 ? "none" : reasons.length === 0 ? "confirmed" : best.score >= 0.3 ? "leaning" : "none";
  return {
    name: best.p.name,
    archetype_id: best.p.archetype_id,
    profile_version: best.p.version ?? 1,
    version: ARCHETYPE_V2_VERSION,
    score: Math.round(best.score * 1000) / 1000,
    status,
    reasons,
    runner_up: second ? { name: second.p.name, score: Math.round(second.score * 1000) / 1000 } : null,
  };
}
