import type { CardInput } from "@/musicdna/engine/share-card";

/** Builds the card only from the already-published, frozen reading returned by getPublicSession. */
export function cardInputFromPublished(
  loaded: { session: any; definingChoices: { chosen: string; rejected: string }[] },
  url: string,
): CardInput {
  const content = loaded.session?.content as any;
  const synthesis: string = content?.synthesis ?? loaded.session?.interpretation ?? "A reading in progress.";
  const headline = (synthesis.match(/^[^.!?]+[.!?]/)?.[0] ?? synthesis).trim();
  const archetype = content?.archetype_v2?.name ?? loaded.session?.archetype?.name ?? null;
  const traits = (loaded.definingChoices ?? []).slice(0, 3).map((c) => `${c.chosen} over ${c.rejected}`);
  return { headline, archetype, traits, url };
}
