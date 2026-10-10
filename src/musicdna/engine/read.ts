import {
  boundedClaim,
  insufficientText,
  insufficiencyReason,
  languageCeiling,
  type AxisLabels,
  type LanguageCeiling,
} from "./claim-language";
import { detectRevision, type Ledger, type PriorRead } from "./evidence";

export type ReadEvidence = {
  supporting: number;
  contradicting: number;
  tested: number;
  examples: { chosen: string; rejected: string }[];
};
export type CurrentReadResult = {
  thesis: string;
  hook: string;
  topDim: string | null;
  strength: number;
  tier: "observation" | "theory" | "read";
  direction: "forming" | "holding" | "contested" | "revising";
  evidence: ReadEvidence;
  question: string;
  revision?: {
    previous_claim: string;
    previous_axis: string;
    changed_by: { chosen: string; rejected: string } | null;
    new_interpretation: string;
  } | null;
  language_ceiling?: LanguageCeiling;
  insufficiency_reason?: ReturnType<typeof insufficiencyReason>;
};

export function projectRead(
  ledger: Ledger,
  labels: AxisLabels,
  prior: (NonNullable<PriorRead> & { thesis?: string }) | null = null,
): CurrentReadResult {
  const lead = ledger.axes[0];
  const empty = { supporting: 0, contradicting: 0, tested: 0, examples: [] };
  if (!lead)
    return {
      thesis: insufficientText(ledger),
      hook: ledger.answered ? "Still listening." : "First one's yours to call.",
      topDim: null,
      strength: 0,
      tier: "observation",
      direction: "forming",
      evidence: empty,
      question: "",
      revision: null,
      language_ceiling: "insufficient",
      insufficiency_reason: insufficiencyReason(ledger),
    };
  const rev = detectRevision(prior, ledger);
  const fmt = (e: Ledger["entries"][number]) => ({
    chosen: e.chosen_artist ? `${e.chosen} (${e.chosen_artist})` : e.chosen,
    rejected: e.rejected_artist ? `${e.rejected} (${e.rejected_artist})` : e.rejected,
  });
  const text = boundedClaim(lead, labels);
  const changed = rev.changed_by ? fmt(rev.changed_by) : null;
  const ceiling = languageCeiling(lead);
  return {
    thesis: rev.revised
      ? `${changed ? `${changed.chosen} over ${changed.rejected} changed the evidence. ` : "The evidence moved. "}${text}`
      : text,
    hook:
      ceiling === "mixed"
        ? "The split matters."
        : lead.status === "qualified"
          ? "The exception matters."
          : lead.eligible
            ? "A tendency in these choices."
            : "Still a working theory.",
    topDim: lead.axis,
    strength: lead.magnitude,
    tier:
      lead.eligible && !rev.revised
        ? "read"
        : ceiling === "observation" || ceiling === "insufficient"
          ? "observation"
          : "theory",
    direction: rev.revised
      ? "revising"
      : lead.contradicting
        ? "contested"
        : lead.eligible
          ? "holding"
          : "forming",
    evidence: {
      supporting: lead.supporting,
      contradicting: lead.contradicting,
      tested: lead.tested,
      examples: lead.supporting_examples.slice(0, 2).map(fmt),
    },
    question: lead.eligible ? "" : "What mattered in that choice?",
    revision:
      rev.revised && prior
        ? {
            previous_claim: prior.thesis ?? "Previous working read",
            previous_axis: prior.axis,
            changed_by: changed,
            new_interpretation: text,
          }
        : null,
    language_ceiling: ceiling,
    insufficiency_reason: insufficiencyReason(ledger),
  };
}
