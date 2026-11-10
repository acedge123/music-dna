import type { Ledger } from "./evidence";

/** Only an actual exception to an eligible tendency can be the reveal's twist. */
export function revealBeats(ledger: Ledger) {
  const axis = ledger.axes.find((a) => a.eligible && a.contradicting_examples.length > 0);
  const exception = axis?.contradicting_examples[0];
  return {
    answered: ledger.answered,
    twist: exception ? `${exception.chosen} over ${exception.rejected}` : null,
    challenge: exception
      ? `What pulled you toward ${exception.chosen} in that choice?`
      : "What did I miss about what pulls you into a song?",
  };
}
