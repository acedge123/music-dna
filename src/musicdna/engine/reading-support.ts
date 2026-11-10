import type { Ledger } from "./evidence";

// A vector match is not a listener claim unless the frozen ledger supports one.
export function hasReadingSupport(ledger: Ledger): boolean {
  return ledger.axes.some((axis) => axis.eligible);
}

export function shouldResumeInterview(input: { fresh?: string; session?: string }): boolean {
  return Boolean(input.session) || !input.fresh;
}