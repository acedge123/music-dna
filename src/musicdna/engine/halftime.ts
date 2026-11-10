// Halftime copy after three picks. Built only from what the listener actually
// chose (titles, running-read stability, revisions) — never a new claim, and it
// never repeats the third pick's reaction.
export type HalftimeEntry = {
  chosenTitle: string;
  topDim: string | null;
  revised: boolean;
};

export function halftimeSummary(entries: HalftimeEntry[]): string {
  const picks = entries.slice(0, 3);
  if (picks.length < 3) return "Halfway there. The story stays open.";
  const titles = picks.map((p) => p.chosenTitle);
  const list = `${titles[0]}, ${titles[1]}, ${titles[2]}`;
  const dims = picks.map((p) => p.topDim).filter(Boolean);
  const steady = dims.length === 3 && new Set(dims).size === 1;
  const revisedAny = picks.some((p) => p.revised);
  const tension = revisedAny
    ? "You've already made me change my mind once."
    : steady
      ? "One thread keeps turning up."
      : "No single thread has won yet.";
  const hook = steady && !revisedAny ? "the pattern holds or cracks" : "which story wins";
  return `${list}. ${tension} Three more—let's see if ${hook}.`;
}
