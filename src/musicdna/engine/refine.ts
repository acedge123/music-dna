// "Refine My DNA": six more picks that build on a finished reading.
// Targets the parent's uncertain traits and spreads across genres the
// listener hasn't been heard through yet. Selection only — never scoring.

import type { Ledger } from "./evidence";

/** Traits the parent reading couldn't settle: split first, then early, then untested. */
export function refineTargets(parent: Ledger, dims: readonly string[]): string[] {
  const rank = (s: string) => (s === "mixed" ? 0 : s === "provisional" ? 1 : 2);
  const tested = new Map(parent.axes.map((a) => [a.axis, a.status]));
  const unsettled = parent.axes
    .filter((a) => a.status === "mixed" || a.status === "provisional" || a.status === "insufficient")
    .sort((a, b) => rank(a.status) - rank(b.status))
    .map((a) => a.axis);
  const untested = dims.filter((d) => !tested.has(d));
  return [...unsettled, ...untested];
}

type Candidate = { id?: string; lane?: string | null; tests?: string[] | null };

/**
 * Narrow the pool in stages, keeping the narrowest stage that still has
 * at least `min` options: (fresh lane AND target trait) → target trait → fresh lane → all.
 * Pairings already answered in the parent reading are always excluded.
 */
export function refinePool<P extends Candidate>(
  pool: P[],
  opts: { targets: string[]; heardLanes: string[]; parentPairingIds: Set<string>; min?: number },
): P[] {
  const min = opts.min ?? 3;
  const base = pool.filter((p) => !p.id || !opts.parentPairingIds.has(p.id));
  const targets = new Set(opts.targets.slice(0, 4));
  const heard = new Set(opts.heardLanes.map((l) => l.toLowerCase()));
  const hitsTarget = (p: P) => (p.tests ?? []).some((t) => targets.has(t));
  const freshLane = (p: P) => !!p.lane && !heard.has(p.lane.toLowerCase());
  for (const stage of [
    base.filter((p) => hitsTarget(p) && freshLane(p)),
    base.filter(hitsTarget),
    base.filter(freshLane),
  ])
    if (stage.length >= min) return stage;
  return base;
}
