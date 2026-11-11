import { hasDiagnosticIntegrity } from "./pairing-eligibility";
// Explore-your-DNA decade rules. Pure, shared by server and tests.
// The decade is the setting; the dimensions are the experiment.

export const DECADES = [1970, 1980, 1990, 2000, 2010, 2020] as const;
export type Decade = (typeof DECADES)[number];

export const DECADE_LABEL: Record<Decade, string> = {
  1970: "'70s",
  1980: "'80s",
  1990: "'90s",
  2000: "2000s",
  2010: "2010s",
  2020: "2020s",
};

/** One year of leeway on the early edge: 1979 punk counts as '80s. */
export const DECADE_LEEWAY = 1;

export function isDecade(v: unknown): v is Decade {
  return typeof v === "number" && (DECADES as readonly number[]).includes(v);
}

export function inDecade(year: number | null | undefined, decade: Decade): boolean {
  if (typeof year !== "number" || !Number.isFinite(year)) return false;
  return year >= decade - DECADE_LEEWAY && year <= decade + 9;
}

/** Genre-era rules from the product owner. Unknown lanes are allowed. */
export function eraAllowsLane(lane: string | null | undefined, decade: Decade): boolean {
  const l = (lane ?? "").toLowerCase();
  if ((l === "electronic" || l === "hip_hop" || l === "hiphop") && decade < 1980) return false;
  if (l === "classic_rock" && decade >= 1990) return false;
  if (l === "disco" && decade !== 1970) return false;
  if (l === "punk" && decade > 1990) return false;
  return true;
}

type SongLike = { year?: number | null } | null | undefined;
export type DecadePairing = {
  lane?: string | null;
  is_bootstrap?: boolean | null;
  tests?: string[] | null;
  song_a?: SongLike;
  song_b?: SongLike;
};

export function pairingInDecade(p: DecadePairing, decade: Decade): boolean {
  return (
    eraAllowsLane(p.lane, decade) &&
    inDecade(p.song_a?.year ?? null, decade) &&
    inDecade(p.song_b?.year ?? null, decade)
  );
}

/** Every third pick (3rd, 6th) is an exploration slot that looks away from known traits. */
export function isExplorationSlot(answered: number): boolean {
  return (answered + 1) % 3 === 0;
}

/**
 * Selection prior: the parent's frozen vector at half weight plus this run's
 * own evidence. Used ONLY to choose matchups; never stored or scored.
 */
export function blendPrior(
  parent: Record<string, number>,
  current: Record<string, number>,
  dims: readonly string[],
  weight = 0.5,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of dims) out[d] = (Number(parent[d]) || 0) * weight + (Number(current[d]) || 0);
  return out;
}

/** Strongest traits of a vector, by absolute lean. */
export function topTraits(v: Record<string, number>, dims: readonly string[], k = 3): string[] {
  return dims
    .map((d) => ({ d, m: Math.abs(Number(v[d]) || 0) }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.m - a.m)
    .slice(0, k)
    .map((x) => x.d);
}

/** Exploration slot pool: matchups that test none of the known traits (fallback: full pool). */
export function explorationPool<P extends { tests?: string[] | null }>(pool: P[], known: string[]): P[] {
  const set = new Set(known);
  const away = pool.filter((p) => !(p.tests ?? []).some((t) => set.has(t)));
  return away.length > 0 ? away : pool;
}

// ---------------- Playable pool (shared by coverage and selector) ----------------
const SONG_COLS = "id,title,artist,year,primary_lane,lane,movement,atmosphere,immersion,scale,community,perspective,confidence,tension,texture,transformation";
/** One select + one row cap for every reader, so "ready" means the selector can serve it. */
export const PLAYABLE_PAIRING_SELECT = `id, tests, diagnostic_weight, lane, is_bootstrap, song_a:songs!pairings_song_a_id_fkey(${SONG_COLS}), song_b:songs!pairings_song_b_id_fkey(${SONG_COLS})`;
export const PLAYABLE_PAIRING_LIMIT = 5000;
/** Active-row filtering happens in the query; this applies every remaining selector eligibility rule. */
export function playableDecadePool<P extends DecadePairing>(rows: P[], decade: Decade): P[] {
  return rows.filter(
    (p) => !p.is_bootstrap && pairingInDecade(p, decade) && hasDiagnosticIntegrity(p as never),
  );
}

// ---------------- Coverage (decade × dimension) ----------------
export const READY_MIN_PAIRINGS = 10;
export const READY_MIN_TRAITS = 6;
export const CELL_READY = 3;

export type DecadeCoverage = {
  decade: Decade;
  pairings: number;
  traits_covered: number;
  by_trait: Record<string, number>;
  ready: boolean;
};

export function decadeCoverage(
  pool: DecadePairing[],
  dims: readonly string[],
  opts: { minPairings?: number; minTraits?: number } = {},
): DecadeCoverage[] {
  const minP = opts.minPairings ?? READY_MIN_PAIRINGS;
  const minT = opts.minTraits ?? READY_MIN_TRAITS;
  return DECADES.map((decade) => {
    const inDec = playableDecadePool(pool, decade);
    const by_trait: Record<string, number> = {};
    for (const d of dims) by_trait[d] = 0;
    for (const p of inDec) for (const t of p.tests ?? []) if (t in by_trait) by_trait[t] += 1;
    const traits_covered = dims.filter((d) => by_trait[d] >= 1).length;
    return {
      decade,
      pairings: inDec.length,
      traits_covered,
      by_trait,
      ready: inDec.length >= minP && traits_covered >= minT,
    };
  });
}

export function cellStatus(count: number): "ready" | "thin" | "empty" {
  return count >= CELL_READY ? "ready" : count > 0 ? "thin" : "empty";
}

// ---------------- Comparison with the original reading ----------------
export type AxisLean = { axis: string; direction: "hi" | "lo"; eligible: boolean; magnitude: number };
export type DecadeShift = {
  axis: string;
  kind: "held" | "flipped" | "new" | "quiet";
  original: "hi" | "lo" | null;
  decade: "hi" | "lo" | null;
};

/** Deterministic comparison: only eligible (ledger-supported) leans count as claims. */
export function compareToOriginal(original: AxisLean[], decade: AxisLean[], k = 4): DecadeShift[] {
  const o = new Map(original.filter((a) => a.eligible).map((a) => [a.axis, a]));
  const d = new Map(decade.filter((a) => a.eligible).map((a) => [a.axis, a]));
  const out: DecadeShift[] = [];
  for (const [axis, a] of o) {
    const b = d.get(axis);
    out.push({
      axis,
      original: a.direction,
      decade: b?.direction ?? null,
      kind: !b ? "quiet" : b.direction === a.direction ? "held" : "flipped",
    });
  }
  for (const [axis, b] of d) if (!o.has(axis)) out.push({ axis, original: null, decade: b.direction, kind: "new" });
  const rank = { flipped: 0, new: 1, held: 2, quiet: 3 } as const;
  return out.sort((x, y) => rank[x.kind] - rank[y.kind]).slice(0, k);
}
