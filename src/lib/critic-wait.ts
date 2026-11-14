import { type Hunch } from "@/musicdna/engine/critic-fillers";
import {
  PERSON_QUIP_GROUPS,
  NEUTRAL_QUIP_GROUPS,
  eraQuipGroups,
  reactionQuipGroup,
  selectQuipGroups,
  type QuipGroup,
} from "./quip-sequences";

export const QUIP_INTERVAL_MS = 2500;

/** Budgets are ceilings, never a reason to hold back a ready read. */
export function quipBudget(flow: "per_pick" | "checkpoints", answered: number): number {
  if (flow === "per_pick") return 4;
  if (answered === 2) return 3;
  if (answered === 4) return 4;
  if (answered >= 6) return Infinity;
  return 1;
}

export function waitQuips(
  wait: number,
  hunch: Hunch | null,
  decade: string | null,
  budget: number,
  used: ReadonlySet<string>,
): string[] {
  const neutral = NEUTRAL_QUIP_GROUPS[wait % NEUTRAL_QUIP_GROUPS.length];
  const person = PERSON_QUIP_GROUPS[wait % PERSON_QUIP_GROUPS.length];
  const era = eraQuipGroups(decade);
  const groups: QuipGroup[] = [neutral];
  if (era.length) {
    if (hunch && Number.isFinite(budget)) groups.push(reactionQuipGroup(hunch, wait));
    groups.push(era[wait % era.length]);
  } else if (budget === 3 || !Number.isFinite(budget)) {
    groups.push(person);
  } else {
    if (hunch) groups.push(reactionQuipGroup(hunch, wait));
    groups.push(person);
  }
  if (!Number.isFinite(budget)) {
    // Separate unrelated praise bits with a neutral/era beat, never another conditional claim.
    PERSON_QUIP_GROUPS.forEach((group, index) => {
      groups.push(era[index % Math.max(era.length, 1)] ?? NEUTRAL_QUIP_GROUPS[index], group);
    });
    groups.push(...era, ...NEUTRAL_QUIP_GROUPS);
  }
  return selectQuipGroups(groups, budget, used);
}
