// Opener era: a soft preference so the opening matchups sound like the
// listener's three songs in time as well as genre. Weighted 3-2-1 by slot.
export const ERA_SLACK_YEARS = 10;
export const ERA_OPENING_ROUNDS = 3;
export const ERA_MIN_POOL = 3;

export type EraWindow = { from: number; to: number };

export function openerEra(years: Array<number | null | undefined>): EraWindow | null {
  const w = [3, 2, 1];
  let sum = 0;
  let wt = 0;
  const known: number[] = [];
  years.slice(0, 3).forEach((y, i) => {
    if (typeof y !== "number" || !Number.isFinite(y)) return;
    sum += y * w[i];
    wt += w[i];
    known.push(y);
  });
  if (!wt) return null;
  const center = Math.round(sum / wt);
  const from = Math.min(center, ...known) - ERA_SLACK_YEARS;
  const to = Math.max(center, ...known) + ERA_SLACK_YEARS;
  return { from, to };
}

type EraSong = object | null | undefined;

export function inEra(p: { song_a?: EraSong; song_b?: EraSong }, era: EraWindow): boolean {
  const ok = (s: EraSong) =>
    { const y = (s as { year?: unknown } | null | undefined)?.year; return typeof y === "number" && y >= era.from && y <= era.to; };
  return ok(p.song_a) && ok(p.song_b);
}

// Prefer in-era matchups early on; never shrink the pool below a playable size.
export function preferEra<T extends { song_a?: EraSong; song_b?: EraSong }>(
  pool: T[],
  era: EraWindow | null,
  answered: number,
): T[] {
  if (!era || answered >= ERA_OPENING_ROUNDS) return pool;
  const near = pool.filter((p) => inEra(p, era));
  return near.length >= ERA_MIN_POOL ? near : pool;
}
