import { FILLER_REACTION, type Hunch } from "@/musicdna/engine/critic-fillers";
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
  // Avoid a confident prediction followed by a contradictory surprise claim (or vice versa).
  // The used set contains only quips actually displayed earlier in this interview.
  const priorWith = FILLER_REACTION.with.some((line) => used.has(line));
  const priorAgainst = FILLER_REACTION.against.some((line) => used.has(line));
  const reactionHunch: Hunch | null =
    (hunch === "with" && priorAgainst) || (hunch === "against" && priorWith)
      ? "early"
      : hunch;
  // The surprise punchline should not follow a confident "called it" moment.
  const personIndex = wait % PERSON_QUIP_GROUPS.length;
  const person = PERSON_QUIP_GROUPS[
    priorWith && personIndex === 3 ? 4 : personIndex
  ];
  const era = eraQuipGroups(decade);
  const groups: QuipGroup[] = [neutral];
  if (era.length) {
    if (reactionHunch && Number.isFinite(budget)) groups.push(reactionQuipGroup(reactionHunch, wait));
    groups.push(era[wait % era.length]);
  } else if (budget === 3 || !Number.isFinite(budget)) {
    groups.push(person);
  } else {
    if (reactionHunch) groups.push(reactionQuipGroup(reactionHunch, wait));
    groups.push(person);
  }
  if (!Number.isFinite(budget)) {
    // Separate unrelated praise bits with a neutral/era beat, never another conditional claim.
    PERSON_QUIP_GROUPS.forEach((group, index) => {
      groups.push(era[index % Math.max(era.length, 1)] ?? NEUTRAL_QUIP_GROUPS[index]);
      if (!(priorWith && group.id === "person-3")) groups.push(group);
    });
    groups.push(...era, ...NEUTRAL_QUIP_GROUPS);
  }
  return selectQuipGroups(groups, budget, used);
}
