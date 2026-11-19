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

/** Never regenerate a saved reading or automatically duplicate an unknown in-flight write. */
export async function recoverFinalReading<
  T extends { result_version?: number | null; narration_status?: string },
>(
  readSaved: () => Promise<T | null>,
  generate: () => Promise<T>,
  isCurrent: () => boolean = () => true,
): Promise<T> {
  const saved = await readSaved();
  if (saved) return saved;
  let last: T | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!isCurrent()) throw new Error("Reading request superseded");
    try {
      last = await generate();
    } catch (error) {
      const recovered = await readSaved();
      if (recovered) return recovered;
      throw error; // Timeout/provider failure may still be running; do not duplicate it.
    }
    if (last.result_version != null) return last;
    const recovered = await readSaved();
    if (recovered) return recovered;
    if (last.narration_status !== "invalid_generation") return last;
  }
  if (last) return last;
  throw new Error("Reading unavailable");
}
