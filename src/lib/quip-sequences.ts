import { FILLER_DECADE, FILLER_NEUTRAL, FILLER_PERSON, FILLER_REACTION, type Hunch } from "@/musicdna/engine/critic-fillers";

export type QuipGroup = {
  id: string;
  tone: "neutral" | "praise" | "dry-authority" | "era" | "reaction";
  /** Ordered lines are an indivisible editorial unit when selecting a queue. */
  lines: readonly string[];
  requiresHunch?: Hunch;
  incompatibleWith: readonly string[];
};

export const PERSON_QUIP_GROUPS: QuipGroup[] = FILLER_PERSON.map((lines, index) => ({
  id: `person-${index}`,
  tone: index === 1 || index === 4 ? "dry-authority" : "praise",
  lines,
  incompatibleWith: ["reaction-with", "reaction-against"],
}));
export const NEUTRAL_QUIP_GROUPS: QuipGroup[] = FILLER_NEUTRAL.map((line, index) => ({
  id: `neutral-${index}`, tone: "neutral", lines: [line], incompatibleWith: [],
}));
export function eraQuipGroups(decade: string | null): QuipGroup[] {
  return (decade ? FILLER_DECADE[decade] ?? [] : []).map((line, index) => ({
    id: `era-${decade}-${index}`, tone: "era", lines: [line], incompatibleWith: [],
  }));
}
export function reactionQuipGroup(hunch: Hunch, wait: number): QuipGroup {
  const pool = FILLER_REACTION[hunch];
  return { id: `reaction-${hunch}`, tone: "reaction", requiresHunch: hunch,
    lines: [pool[wait % pool.length]],
    incompatibleWith: hunch === "early" ? [] : ["reaction-with", "reaction-against", ...PERSON_QUIP_GROUPS.map((g) => g.id)],
  };
}

/** A previously exposed setup must never leave an orphaned punchline. */
export function selectQuipGroups(groups: readonly QuipGroup[], budget: number, used: ReadonlySet<string>): string[] {
  const selected: string[] = [];
  const selectedGroups: QuipGroup[] = [];
  const seen = new Set(used);
  for (const group of groups) {
    if (group.lines.some((line) => seen.has(line)) || selected.length + group.lines.length > budget) continue;
    if (selectedGroups.some((prior) => prior.incompatibleWith.includes(group.id) || group.incompatibleWith.includes(prior.id))) continue;
    // Avoid a run of unrelated praise jokes; neutral/era lines can reset the tone.
    if (group.tone === "praise" && selectedGroups.at(-1)?.tone === "praise") continue;
    selectedGroups.push(group);
    selected.push(...group.lines);
    group.lines.forEach((line) => seen.add(line));
  }
  return selected;
}