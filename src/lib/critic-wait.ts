import { FILLER_REACTION, type Hunch } from "@/musicdna/engine/critic-fillers";
import {
  PERSON_QUIP_GROUPS,
  NEUTRAL_QUIP_GROUPS,
  OVERTIME_QUIP_GROUPS,
  reactionQuipGroup,
  selectQuipGroups,
  type QuipGroup,
} from "./quip-sequences";

export const QUIP_INTERVAL_MS = 2500;

export const PICK_QUIP_PATTERN = {
  1: ["neutral"],
  2: ["reaction", "person"],
  3: ["reaction"],
  4: ["neutral", "reaction", "person"],
  5: ["neutral"],
  6: ["neutral", "reaction", "person"],
} as const;

/** Budgets are ceilings, never a reason to hold back a ready read. */
export function quipBudget(_flow: "per_pick" | "checkpoints", answered: number): number {
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
  finalReading = false,
): string[] {
  const unused = (group: QuipGroup) => group.lines.every((line) => !used.has(line));
  const neutral =
    [...NEUTRAL_QUIP_GROUPS.slice(wait % NEUTRAL_QUIP_GROUPS.length), ...NEUTRAL_QUIP_GROUPS].find(
      unused,
    ) ?? NEUTRAL_QUIP_GROUPS[wait % NEUTRAL_QUIP_GROUPS.length];
  // Avoid a confident prediction followed by a contradictory surprise claim (or vice versa).
  // The used set contains only quips actually displayed earlier in this interview.
  const priorWith = FILLER_REACTION.with.some((line) => used.has(line));
  const priorAgainst = FILLER_REACTION.against.some((line) => used.has(line));
  const reactionHunch: Hunch | null =
    (hunch === "with" && priorAgainst) || (hunch === "against" && priorWith) ? "early" : hunch;
  // The surprise punchline should not follow a confident "called it" moment.
  const personIndex = wait % PERSON_QUIP_GROUPS.length;
  const preferredPerson =
    PERSON_QUIP_GROUPS[
      (priorWith || reactionHunch === "with") && personIndex === 3 ? 4 : personIndex
    ];
  // Pick six always gets setup + punchline: four primary beats, never a standalone.
  const person =
    [preferredPerson, ...PERSON_QUIP_GROUPS].find(
      (group) =>
        unused(group) &&
        (wait !== 6 || group.lines.length === 2) &&
        !((priorWith || reactionHunch === "with") && group.id === "person-3"),
    ) ?? preferredPerson;
  const reaction = reactionQuipGroup(reactionHunch ?? "early", wait);
  const pool = FILLER_REACTION[reactionHunch ?? "early"];
  const reactionLine = [...pool.slice(wait % pool.length), ...pool].find((line) => !used.has(line));
  // Era copy remains available for legacy clients; it no longer replaces the agreed person slot.
  void decade;
  const pattern = PICK_QUIP_PATTERN[wait as keyof typeof PICK_QUIP_PATTERN] ?? ["neutral"];
  const readyPattern =
    hunch === null ? pattern.filter((category) => category === "neutral") : pattern;
  const groups: QuipGroup[] = readyPattern.map((category) =>
    category === "neutral"
      ? neutral
      : category === "person"
        ? person
        : { ...reaction, lines: reactionLine ? [reactionLine] : [] },
  );
  // A slow vote must hold Neutral, not bypass the as-yet-unknown reaction/person slots.
  if (wait === 6 && finalReading && hunch !== null) groups.push(...OVERTIME_QUIP_GROUPS);
  return selectQuipGroups(groups, budget, used);
}
