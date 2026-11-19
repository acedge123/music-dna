/** A rejected draft is finished but unsaved, not a request still running. */
export function finalReadingError(status: string | undefined): string {
  if (status === "invalid_generation")
    return "That draft didn’t pass the Critic’s evidence check. Your choices are saved — retry for a new draft.";
  if (status === "narrator_failure")
    return "The Critic couldn’t finish this draft. Your choices are saved — retry your reading.";
  return "The reading wasn’t saved. Your choices are safe — retry your reading.";
}

/** The sixth pick gets the final reading, not another interim write first. */
export function needsInterimRead(
  flow: "per_pick" | "checkpoints",
  answered: number,
  checkpoint: number | null,
) {
  return answered < 6 && (flow === "per_pick" || checkpoint !== null);
}
