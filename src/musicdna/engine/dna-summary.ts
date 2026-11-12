// Music DNA payoff — deterministic summary of a finished reading.
// Every number, confidence word and receipt here comes from the frozen
// evidence ledger (buildLedger/evaluateClaim). The Critic's prose sits on
// top of this; it never supplies counts.

import { DIM_LABEL } from "./axes";
import type { ClaimStatus } from "./claims";
import type { Ledger, LedgerEntry } from "./evidence";

export const DNA_SUMMARY_VERSION = "dna-summary-v1";

export type DnaConfidence = "Clear" | "Leaning" | "Early";

export type DnaDimension = {
  axis: string;
  /** "refinement over rawness" */
  label: string;
  preferred: string;
  over: string;
  supporting: number;
  /** Relevant comparisons: pairings that actually tested this trait directionally. */
  relevant: number;
  confidence: DnaConfidence;
  status: ClaimStatus;
};

export type DnaReceipt = {
  kind: "pattern" | "contradiction";
  axis: string;
  chosen: string;
  chosen_artist: string;
  rejected: string;
  rejected_artist: string;
  note: string;
};

export type DnaArchetype =
  | { status: "confirmed"; name: string }
  | { status: "emerging"; name: null };

export type DnaSummary = {
  version: string;
  answered: number;
  dimensions: DnaDimension[];
  undecided: { axis: string; label: string }[];
  receipts: DnaReceipt[];
  archetype: DnaArchetype;
  /** Set when every answered choice came from one lane. */
  single_lane: string | null;
};

const CONFIDENCE: Partial<Record<ClaimStatus, DnaConfidence>> = {
  supported: "Clear",
  qualified: "Leaning",
  provisional: "Early",
};

function poles(axis: string, direction: "hi" | "lo") {
  const l = DIM_LABEL[axis] ?? { hi: axis, lo: axis };
  return direction === "hi" ? { preferred: l.hi, over: l.lo } : { preferred: l.lo, over: l.hi };
}

export function relevantComparisonsLabel(d: Pick<DnaDimension, "supporting" | "relevant">) {
  return `${d.supporting} of ${d.relevant} relevant comparison${d.relevant === 1 ? "" : "s"}`;
}

export function buildDnaSummary(
  ledger: Ledger,
  archetype: { name: string } | null,
): DnaSummary {
  const dimensions: DnaDimension[] = ledger.axes
    .filter((a) => CONFIDENCE[a.status] && a.supporting > 0)
    .slice(0, 3)
    .map((a) => {
      const p = poles(a.axis, a.direction);
      return {
        axis: a.axis,
        label: `${p.preferred} over ${p.over}`,
        ...p,
        supporting: a.supporting,
        relevant: a.supporting + a.contradicting,
        confidence: CONFIDENCE[a.status]!,
        status: a.status,
      };
    });

  const undecided = ledger.axes
    .filter((a) => a.status === "mixed")
    .map((a) => {
      const l = DIM_LABEL[a.axis] ?? { hi: a.axis, lo: a.axis };
      return { axis: a.axis, label: `${l.hi} or ${l.lo}` };
    });

  const receipts: DnaReceipt[] = [];
  const usedPairs = new Set<string>();
  const key = (e: LedgerEntry) => e.pairing_id ?? `${e.chosen}|${e.rejected}`;
  const push = (kind: DnaReceipt["kind"], e: LedgerEntry, note: string) => {
    if (usedPairs.has(key(e))) return false;
    usedPairs.add(key(e));
    receipts.push({
      kind,
      axis: e.axis,
      chosen: e.chosen,
      chosen_artist: e.chosen_artist,
      rejected: e.rejected,
      rejected_artist: e.rejected_artist,
      note,
    });
    return true;
  };
  const byAxis = new Map(ledger.axes.map((a) => [a.axis, a]));
  for (const d of dimensions) {
    for (const e of byAxis.get(d.axis)?.supporting_examples ?? []) {
      if (receipts.length >= 2) break;
      push("pattern", e, `A vote for ${d.preferred}.`);
    }
    if (receipts.length >= 2) break;
  }
  outer: for (const d of dimensions) {
    for (const e of byAxis.get(d.axis)?.contradicting_examples ?? []) {
      if (push("contradiction", e, `The exception: ${d.over} won this one.`)) break outer;
    }
  }

  const lanes = ledger.confounds.filter((c) => c.kind === "lane");
  const single = lanes.find((c) => c.total > 0 && c.count === c.total);

  return {
    version: DNA_SUMMARY_VERSION,
    answered: ledger.answered,
    dimensions,
    undecided,
    receipts,
    // The archetype only appears when finalize stored one (it already passed
    // the score/margin floors and ledger support). Otherwise: emerging.
    archetype: archetype?.name
      ? { status: "confirmed", name: archetype.name }
      : { status: "emerging", name: null },
    single_lane: single?.value ?? null,
  };
}
