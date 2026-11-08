import { z } from "zod";
import type { AxisSummary, Ledger, LedgerEntry } from "./evidence";

export const CLAIM_LANGUAGE_VERSION = "claim-language-v2";
export type LanguageCeiling =
  "observation" | "tentative" | "supported" | "contested" | "mixed" | "insufficient";
export type InsufficiencyReason =
  "sparse_evidence" | "conflicting_evidence" | "invalid_catalog_evidence";
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
    return "Your choices are saved, but I couldn't verify the song information needed to interpret them. You can still tell me what mattered in your picks.";
  if (ledger.answered === 0)
    return "Choose the songs you prefer, or skip any you don't know. Your reading will follow those choices.";
  const examples = [...new Map(ledger.entries.map((e) => [e.pairing_id ?? e.index, e])).values()]
    .filter((e) => e.chosen && e.rejected)
    .slice(0, 1)
    .map(example);
  const picks = examples.length ? ` You chose ${examples.join("; ")}.` : "";
  const uncertainty =
    reason === "conflicting_evidence"
      ? "These choices pull in different directions, so there isn't one clear preference across them."
      : "These matchups don't yet show one consistent preference.";
  return `Your ${ledger.answered} ${ledger.answered === 1 ? "choice is" : "choices are"} saved.${picks} ${uncertainty} Tell me what mattered in your picks.`;
}

/** User-facing limits on the reading, not operator taxonomy or causal claims. */
export function concentrationCaution(c: Ledger["confounds"][number]) {
  const count = `${c.count} of ${c.total}`;
  switch (c.kind) {
    case "artist":
      return {
        claim: "One artist appears often in these choices",
        notes: `${count} choices involved ${c.value}. That artist may be part of what you preferred; more artists would help us tell.`,
      };
    case "song":
      return {
        claim: "One song appeared in several matchups",
        notes: `${count} choices involved the same song. More different songs would help us tell whether the preference carries across them.`,
      };
    case "era":
      return {
        claim: "These choices cover a similar era",
        notes: `${count} choices involved songs from ${/^\d{4}s$/.test(c.value) ? c.value : "a similar era"}. A wider range of eras would help us understand your taste.`,
      };
    case "lane":
      return {
        claim: "These choices cover a similar style",
        notes: `${count} choices involved a similar musical style. A wider range of matchups would help us understand your taste.`,
      };
  }
}

export function deterministicNarration(
  ledger: Ledger,
  labels: AxisLabels,
  axes = ledger.axes.filter((a) => a.eligible).slice(0, 2),
): string {
  if (!axes.length) return insufficientText(ledger);
  const text = axes.map((a) => boundedClaim(a, labels)).join(" ");
  const c = ledger.confounds[0];
  return c ? `${text} ${concentrationCaution(c).notes}` : text;
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
