// Music DNA payoff — deterministic summary of a finished reading.
// Every number, confidence word and receipt here comes from the frozen
// evidence ledger (buildLedger/evaluateClaim). The Critic's prose sits on
// top of this; it never supplies counts.

import { DIM_LABEL } from "./axes";
import type { ClaimStatus } from "./claims";
import type { Ledger, LedgerEntry } from "./evidence";
import type { SongWhyColor } from "./song-why-color";

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
  song_whys?: { chosen: SongWhyColor[]; rejected: SongWhyColor[] };
};

export type DnaArchetype =
  | { status: "confirmed" | "leaning"; name: string }
  | { status: "emerging"; name: null };

export type DnaSummary = {
  version: string;
  answered: number;
  dimensions: DnaDimension[];
  undecided: { axis: string; label: string }[];
  receipts: DnaReceipt[];
  archetype: DnaArchetype;
  /** Every answered matchup, in order: what was picked over what. */
  matchups: { chosen: string; chosen_artist: string; rejected: string; rejected_artist: string }[];
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
  archetype: { name: string; status?: "confirmed" | "leaning" } | null,
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
      ...(e.song_whys ? { song_whys: e.song_whys } : {}),
    });
    return true;
  };
  const byAxis = new Map(ledger.axes.map((a) => [a.axis, a]));
  // Spread the pattern receipts across dimensions first, then fill from the top one.
  for (const pass of [0, 1]) {
    for (const d of dimensions) {
      if (receipts.length >= 2) break;
      const examples = byAxis.get(d.axis)?.supporting_examples ?? [];
      for (const e of pass === 0 ? examples.slice(0, 1) : examples) {
        if (receipts.length >= 2) break;
        if (push("pattern", e, `A vote for ${d.preferred}.`) && pass === 0) break;
      }
    }
  }
  let exception = false;
  outer: for (const d of dimensions) {
    for (const e of byAxis.get(d.axis)?.contradicting_examples ?? []) {
      if (push("contradiction", e, `The exception: ${d.over} won this one.`)) {
        exception = true;
        break outer;
      }
    }
  }
  // No exception inside the leads: a split trait is the honest complication.
  if (!exception) {
    outer2: for (const u of ledger.axes.filter((a) => a.status === "mixed")) {
      const l = DIM_LABEL[u.axis] ?? { hi: u.axis, lo: u.axis };
      for (const e of [...u.contradicting_examples, ...u.supporting_examples]) {
        const side = e.delta > 0 ? l.hi : l.lo;
        if (
          push(
            "contradiction",
            e,
            `The complication: ${side} won here, and ${l.hi} vs ${l.lo} is still split.`,
          )
        )
          break outer2;
      }
    }
  }
  const seenMatchups = new Set<string>();
  const matchups = ledger.entries
    .filter((e) => {
      const k = key(e);
      if (seenMatchups.has(k)) return false;
      seenMatchups.add(k);
      return true;
    })
    .map((e) => ({
      chosen: e.chosen,
      chosen_artist: e.chosen_artist,
      rejected: e.rejected,
      rejected_artist: e.rejected_artist,
    }));

  const lanes = ledger.confounds.filter((c) => c.kind === "lane");
  const single = lanes.find((c) => c.total > 0 && c.count === c.total);

  return {
    version: DNA_SUMMARY_VERSION,
    answered: ledger.answered,
    dimensions,
    undecided,
    receipts,
    matchups,
    // The archetype only appears when finalize stored one (it already passed
    // the score/margin floors and ledger support). Otherwise: emerging.
    archetype: archetype?.name
      ? { status: archetype.status ?? "confirmed", name: archetype.name }
      : { status: "emerging", name: null },
    single_lane: single?.value ?? null,
  };
}
