import type { Ledger } from "@/musicdna/engine/evidence";
import {
  deterministicNarration,
  narrationOptions,
  validatedNarration,
  type AxisLabels,
} from "@/musicdna/engine/claim-language";

export const NARRATOR_PROMPT = `Select up to two distinct eligible claims from the supplied ledger.
Return only JSON: {"claims":[{"axis":"<supplied axis>","direction":"hi|lo","choice_ids":["<supplied supporting choice id>"]}]}.
Never invent IDs, songs, claims or prose. Qualified claims retain every exception in the renderer.`;

export async function narrateEvidence(
  ledger: Ledger,
  labels: AxisLabels,
  generate: (prompt: string) => Promise<string>,
) {
  const fallback = deterministicNarration(ledger, labels);
  const options = narrationOptions(ledger);
  if (!options.length) return { text: fallback, status: "insufficient" as const };
  let raw: string;
  try {
    raw = await generate(`${NARRATOR_PROMPT}\nOPTIONS: ${JSON.stringify(options)}`);
  } catch {
    return { text: fallback, status: "narrator_failure" as const };
  }
  try {
    const validated = validatedNarration(JSON.parse(raw), ledger, labels);
    return validated
      ? { text: validated, status: "ok" as const }
      : { text: fallback, status: "invalid_generation" as const };
  } catch {
    return { text: fallback, status: "invalid_generation" as const };
  }
}
