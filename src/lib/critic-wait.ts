import { FILLER_DECADE, FILLER_NEUTRAL, FILLER_PERSON, fillerLines, type Hunch } from "@/musicdna/engine/critic-fillers";

export const QUIP_INTERVAL_MS = 2500;

/** Budgets are ceilings, never a reason to hold back a ready read. */
export function quipBudget(flow: "per_pick" | "checkpoints", answered: number): number {
  if (flow === "per_pick") return 4;
  if (answered === 2) return 3;
  if (answered === 4) return 4;
  if (answered >= 6) return Infinity;
  return 1;
}

export function waitQuips(wait: number, hunch: Hunch | null, decade: string | null, budget: number, used: ReadonlySet<string>): string[] {
  const neutral = FILLER_NEUTRAL[wait % FILLER_NEUTRAL.length];
  const person = FILLER_PERSON[wait % FILLER_PERSON.length] ?? [];
  const era = decade ? FILLER_DECADE[decade] : undefined;
  // A three-line wait gives the setup/punchline room, without an intervening reaction.
  const primary = budget === 3 && !era && person.length === 2
    ? [neutral, ...person]
    : fillerLines(wait, hunch, decade);
  const groups: readonly (readonly string[])[] = [
    primary,
    ...(Number.isFinite(budget) ? [] : [
      ...FILLER_PERSON,
      ...(era ? era.map((line) => [line]) : []),
      ...FILLER_NEUTRAL.map((line) => [line]),
    ]),
  ];
  const selected: string[] = [];
  const seen = new Set(used);
  for (const group of groups) {
    // Never replay a setup or orphan its punchline after earlier exposure.
    if (group !== primary && group.some((line) => seen.has(line))) continue;
    for (const line of group) {
      if (!line || seen.has(line) || selected.length >= budget) continue;
      selected.push(line);
      seen.add(line);
    }
  }
  return selected;
}