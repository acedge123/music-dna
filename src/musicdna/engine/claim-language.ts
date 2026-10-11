import { z } from "zod";
import type { AxisSummary, Ledger, LedgerEntry } from "./evidence";

export const CLAIM_LANGUAGE_VERSION = "claim-language-v1";
export type LanguageCeiling =
  | "observation"
  | "tentative"
  | "supported"
  | "contested"
  | "mixed"
  | "insufficient";
export type InsufficiencyReason =
  | "sparse_evidence"
  | "conflicting_evidence"
  | "invalid_catalog_evidence";
export type AxisLabels = Record<string, { hi: string; lo: string }>;

export function languageCeiling(a: AxisSummary): LanguageCeiling {
  if (a.eligible) return "supported";
  if (a.status === "mixed") return "mixed";
  if (!a.supporting && !a.contradicting) return "insufficient";
  if (a.contradicting) return "contested";
  return a.supporting < 2 ? "observation" : "tentative";
}

export function insufficiencyReason(ledger: Ledger): InsufficiencyReason | null {
  if (ledger.axes.some((a) => a.eligible)) return null;
  if (!ledger.entries.length && ledger.answered) return "invalid_catalog_evidence";
  if (ledger.axes.some((a) => a.status === "mixed" && a.supporting + a.contradicting >= 3))
    return "conflicting_evidence";
  return "sparse_evidence";
}

const example = (e: LedgerEntry) => `${e.chosen} over ${e.rejected}`;
export function boundedClaim(a: AxisSummary, labels: AxisLabels): string {
  const pole = labels[a.axis];
  const preferred = a.direction === "hi" ? pole?.hi : pole?.lo;
  const opposed = a.direction === "hi" ? pole?.lo : pole?.hi;
  if (!preferred || !opposed) return "This tradeoff has no validated wording yet.";
  const ceiling = languageCeiling(a);
  if (ceiling === "mixed")
    return `Split evidence: ${a.supporting} choices one way, ${a.contradicting} the other. No supported lean on this tradeoff.`;
  if (ceiling === "insufficient") return "These choices don't establish a directional pattern.";
  const names = a.supporting_examples.slice(0, 2).map(example).join("; ");
  if (ceiling === "observation")
    return `${names}. One choice for ${preferred} over ${opposed}, not a pattern.`;
  if (ceiling === "tentative")
    return `${names}. A tentative lean toward ${preferred} over ${opposed}; not enough independent choices yet.`;
  if (ceiling === "contested")
    return `${names}. The evidence for ${preferred} over ${opposed} is contested (${a.supporting} supporting, ${a.contradicting} against); no supported claim yet.`;
  const exception = a.contradicting_examples[0];
  return `Across these matchups, you favored ${preferred} over ${opposed} (${a.supporting} supporting choices, ${a.contradicting} against). ${names}.${exception ? ` An exception: ${example(exception)}. This is a qualified tendency, not a rule.` : " A tendency in these choices, not an identity."}`;
}

export function insufficientText(ledger: Ledger): string {
  const reason = insufficiencyReason(ledger);
  if (reason === "invalid_catalog_evidence")
    return "Your choices are saved, but their diagnostic evidence is unavailable or invalid. I can't turn that into a taste claim.";
  if (reason === "conflicting_evidence")
    return "These choices pull in different directions. There isn't enough consistent evidence for a supported reading yet.";
  return ledger.answered === 0
    ? "No pairing evidence yet. There isn't a reading to make."
    : `${ledger.answered} answered ${ledger.answered === 1 ? "matchup isn't" : "matchups aren't"} enough consistent evidence for a supported reading yet. Choices noted, not decoded.`;
}

export function deterministicNarration(
  ledger: Ledger,
  labels: AxisLabels,
  axes = ledger.axes.filter((a) => a.eligible).slice(0, 2),
): string {
  if (!axes.length) return insufficientText(ledger);
  const text = axes.map((a) => boundedClaim(a, labels)).join(" ");
  const c = ledger.confounds[0];
  return c
    ? `${text} ${c.count} of ${c.total} chosen songs share ${c.kind} ${c.value}; that concentration could be doing some of the work.`
    : text;
}

const Selection = z
  .object({
    claims: z
      .array(
        z
          .object({
            axis: z.string(),
            direction: z.enum(["hi", "lo"]),
            choice_ids: z.array(z.string()).min(1).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(2),
  })
  .strict();

export function evidenceId(e: LedgerEntry) {
  return e.choice_id ?? e.pairing_id;
}

// The model selects evidence; it cannot invent displayed prose. Every rendered
// sentence is bounded by the ledger policy, including unavoidable exceptions.
export function validatedNarration(
  raw: unknown,
  ledger: Ledger,
  labels: AxisLabels,
): string | null {
  const parsed = Selection.safeParse(raw);
  if (!parsed.success) return null;
  const selected: AxisSummary[] = [];
  for (const c of parsed.data.claims) {
    const a = ledger.axes.find(
      (a) => a.axis === c.axis && a.direction === c.direction && a.eligible,
    );
    if (!a || selected.includes(a) || new Set(c.choice_ids).size !== c.choice_ids.length)
      return null;
    if (!c.choice_ids.every((id) => a.supporting_examples.some((e) => evidenceId(e) === id)))
      return null;
    selected.push(a);
  }
  return deterministicNarration(ledger, labels, selected);
}

export function narrationOptions(ledger: Ledger) {
  return ledger.axes
    .filter((a) => a.eligible)
    .map((a) => ({
      axis: a.axis,
      direction: a.direction,
      status: a.status,
      supporting: a.supporting,
      contradicting: a.contradicting,
      examples: a.supporting_examples.map((e) => ({
        choice_id: evidenceId(e),
        chosen: e.chosen,
        rejected: e.rejected,
      })),
      exceptions: a.contradicting_examples.map((e) => ({ chosen: e.chosen, rejected: e.rejected })),
    }));
}

const QUESTIONS = {
  preference: "Which part of the music mattered most to you?",
  familiarity: "Was that about the song itself, or how familiar it felt?",
  context: "When would you choose the other side?",
  exception: "What made the exception matter to you?",
  correction: "What would you change about that reading?",
} as const;
const ChatSelection = z
  .object({
    claims: Selection.shape.claims.min(0),
    question_id: z.enum(["preference", "familiarity", "context", "exception", "correction"]),
    acknowledge_self_report: z.boolean(),
  })
  .strict();

export function validatedChat(
  raw: unknown,
  ledger: Ledger,
  labels: AxisLabels,
  selfReport: string,
  previousReply = "",
): string | null {
  const parsed = ChatSelection.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  if (r.question_id === "exception" && !ledger.axes.some((a) => a.contradicting > 0)) return null;
  const claimText = r.claims.length ? validatedNarration({ claims: r.claims }, ledger, labels) : "";
  if (claimText === null) return null;
  const ownWords = selfReport.trim().slice(0, 200);
  const acknowledgement =
    r.acknowledge_self_report && ownWords
      ? `You said: "${ownWords}". I'll keep that separate from what the matchups show.`
      : "";
  const freshClaim = claimText && !previousReply.includes(claimText) ? claimText : "";
  return [acknowledgement, freshClaim, QUESTIONS[r.question_id]].filter(Boolean).join(" ");
}

export function fallbackChat(ledger: Ledger): string {
  return ledger.answered
    ? "I couldn't ground that reply in your choices. Which part of the music mattered most to you?"
    : "We don't have pairing evidence yet. Which part of the music matters most to you?";
}
