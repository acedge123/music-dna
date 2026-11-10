import { buildLedger, type LedgerChoice } from "./evidence";
import { DIMS } from "./axes";
import { readFingerprint } from "./prepared-read";

export const POOL_STAGE = "picks_1_4" as const;
const ACCEPTED = new Set(["accepted", "accepted_after_retry"]);

/** Identity of a stand-alone reaction: this one choice, no prior read, these critic versions. */
export function poolFingerprint(choice: LedgerChoice, writer: string, reviewer: string) {
  return `${writer}|${reviewer}|${readFingerprint(buildLedger([choice], DIMS), null, null)}`;
}

/**
 * Only a reviewer-approved first-pick draft is stand-alone: later drafts were
 * written with the listener's earlier choices in view and may refer to them.
 */
export function poolEligible(draft: {
  priorChoices: number;
  hadPriorRead: boolean;
  validation_reason: string | null | undefined;
  text: string | null | undefined;
}) {
  return (
    draft.priorChoices === 0 &&
    !draft.hadPriorRead &&
    ACCEPTED.has(draft.validation_reason ?? "") &&
    !!draft.text?.trim()
  );
}

/** A pooled reaction stays servable only while its evidence and critic versions are unchanged. */
export function poolEntryStale(
  entry: { evidence_fingerprint: string },
  current: { choice: LedgerChoice; writer: string; reviewer: string },
) {
  return entry.evidence_fingerprint !== poolFingerprint(current.choice, current.writer, current.reviewer);
}
