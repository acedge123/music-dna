// Halftime copy after three picks. Built only from what the listener actually
// chose (titles) plus the ledger-derived running read after pick three — the
// same evidence the critic narrates — so halftime can't contradict the critic.
// It never repeats the third pick's reaction.
export type HalftimeEntry = {
  chosenTitle: string;
  topDim: string | null;
  revised: boolean;
  direction?: "forming" | "holding" | "contested" | "revising";
};

export function halftimeSummary(entries: HalftimeEntry[]): string {
  const picks = entries.slice(0, 3);
  if (picks.length < 3) return "Halfway there. The story stays open.";
  const list = `${picks[0].chosenTitle}, ${picks[1].chosenTitle}, ${picks[2].chosenTitle}`;
  // The latest read summarizes the whole ledger; earlier per-pick reads may
  // predate enough evidence and must not veto a pattern the ledger now shows.
  const latest = picks[2];
  const revisedAny = picks.some((p) => p.revised);
  const contested = latest.direction === "contested";
  const thread = !!latest.topDim && !contested;
  const tension = revisedAny
    ? "You've already made me change my mind once."
    : contested
      ? "Your picks are pulling in two directions."
      : thread
        ? "One thread keeps turning up."
        : "No single thread has won yet.";
  const hook = thread && !revisedAny ? "the pattern holds or cracks" : "which story wins";
  return `${list}. ${tension} Three more—let's see if ${hook}.`;
}
