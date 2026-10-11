// Single evidence ledger (DIA01). The running read, final reasoning, chat
// context and public card all derive claims from this one builder, so they
// can never disagree about what a session's choices show.
//
// Each entry is one answered pairing × one declared tested axis with usable
// values on both songs. Missing values are unknown, not neutral (DIA02).

import { evaluateClaim, CLAIM_POLICY_VERSION, type ClaimStatus } from "./claims";

export const LEDGER_VERSION = "ledger-v2";
/** Contrast below this is too small to count for or against an axis. */
export const MIN_CONTRAST = 10;

export type LedgerSong = Record<string, unknown> & { id?: string; title?: string; artist?: string };
export type LedgerChoice = {
  choice_id?: string;
  provenance?: "pairing" | "legacy_unavailable" | "invalid_snapshot";
  pairing_revision?: string | null;
  catalog_revision?: string;
  ms_to_decide?: number | null;
  pairing_id?: string | null;
  tests?: string[] | null;
  diagnostic_weight?: number | null;
  chosen: LedgerSong | null;
  rejected: LedgerSong | null;
  created_at?: string | null;
};

export type LedgerEntry = {
  choice_id: string | null;
  pairing_revision: string | null;
  catalog_revision: string | null;
  index: number;
  pairing_id: string | null;
  axis: string;
  delta: number;
  weight: number;
  chosen: string;
  chosen_artist: string;
  rejected: string;
  rejected_artist: string;
  created_at: string | null;
};

export type AxisSummary = {
  axis: string;
  direction: "hi" | "lo";
  supporting: number;
  contradicting: number;
  tested: number;
  magnitude: number;
  consistency: number;
  status: ClaimStatus;
  eligible: boolean;
  supporting_examples: LedgerEntry[];
  contradicting_examples: LedgerEntry[];
};

export type Ledger = {
  unavailable: number;
  confounds: {
    kind: "artist" | "song" | "era" | "lane";
    value: string;
    count: number;
    total: number;
  }[];
  version: string;
  policy: string;
  answered: number;
  entries: LedgerEntry[];
  axes: AxisSummary[]; // sorted: eligible first, then consistency × magnitude
};

function val(row: LedgerSong | null, axis: string): number | null {
  const v = row?.[axis];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function buildLedger(choices: LedgerChoice[], allDims: readonly string[]): Ledger {
  const entries: LedgerEntry[] = [];
  const seen = new Set<string>();
  let unavailable = 0;
  const concentrations = new Map<
    string,
    { kind: "artist" | "song" | "era" | "lane"; value: string; count: number }
  >();
  choices.forEach((c, index) => {
    // A distinct pairing counts once.
    const key = c.pairing_id ?? `idx-${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!c.chosen || !c.rejected) {
      unavailable += 1;
      return;
    }
    for (const [kind, raw] of [
      ["artist", c.chosen.artist],
      ["song", c.chosen.id],
      ["era", typeof c.chosen.year === "number" ? `${Math.floor(c.chosen.year / 10) * 10}s` : null],
      ["lane", c.chosen.lane ?? c.chosen.primary_lane],
    ] as const) {
      if (typeof raw !== "string" || !raw) continue;
      const k = `${kind}:${raw}`;
      const prior = concentrations.get(k);
      concentrations.set(k, { kind, value: raw, count: (prior?.count ?? 0) + 1 });
    }
    const tests = [...new Set((c.tests ?? []).filter((d) => allDims.includes(d)))];
    for (const axis of tests) {
      const a = val(c.chosen, axis);
      const b = val(c.rejected, axis);
      if (a === null || b === null) continue;
      entries.push({
        choice_id: c.choice_id ?? null,
        pairing_revision: c.pairing_revision ?? null,
        catalog_revision: c.catalog_revision ?? null,
        index,
        pairing_id: c.pairing_id ?? null,
        axis,
        delta: a - b,
        weight: (c.diagnostic_weight ?? 50) / 100,
        chosen: String(c.chosen.title ?? ""),
        chosen_artist: String(c.chosen.artist ?? ""),
        rejected: String(c.rejected.title ?? ""),
        rejected_artist: String(c.rejected.artist ?? ""),
        created_at: c.created_at ?? null,
      });
    }
  });

  const byAxis = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    if (!byAxis.has(e.axis)) byAxis.set(e.axis, []);
    byAxis.get(e.axis)!.push(e);
  }

  const axes: AxisSummary[] = [];
  for (const [axis, list] of byAxis) {
    const hi = list.filter((e) => e.delta >= MIN_CONTRAST);
    const lo = list.filter((e) => e.delta <= -MIN_CONTRAST);
    const direction: "hi" | "lo" = hi.length >= lo.length ? "hi" : "lo";
    const sup = direction === "hi" ? hi : lo;
    const con = direction === "hi" ? lo : hi;
    const claim = evaluateClaim(sup.length, con.length);
    const magnitude =
      list.reduce((s, e) => s + Math.abs(e.delta) * e.weight, 0) / (list.length || 1);
    axes.push({
      axis,
      direction,
      supporting: sup.length,
      contradicting: con.length,
      tested: list.length,
      magnitude: Number(magnitude.toFixed(2)),
      consistency: Number(claim.consistency.toFixed(3)),
      status: claim.status,
      eligible: claim.eligible,
      supporting_examples: [...sup]
        .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
        .slice(0, 3),
      contradicting_examples: [...con]
        .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
        .slice(0, 3),
    });
  }
  axes.sort((x, y) => {
    if (x.eligible !== y.eligible) return x.eligible ? -1 : 1;
    const sx = x.supporting - x.contradicting,
      sy = y.supporting - y.contradicting;
    if (sx !== sy) return sy - sx;
    return y.consistency * y.magnitude - x.consistency * x.magnitude;
  });

  return {
    unavailable,
    confounds: [...concentrations.values()]
      .filter((c) => c.count >= 3)
      .map((c) => ({ ...c, total: seen.size - unavailable })),
    version: LEDGER_VERSION,
    policy: CLAIM_POLICY_VERSION,
    answered: seen.size,
    entries,
    axes,
  };
}

/**
 * Revision detection (READ02). A revision happens only when the evidence
 * moved: the previously led claim lost its lead (support no longer exceeds
 * contradiction) or a different axis now leads with more support. Returns
 * the contradicting decision so copy can name it.
 */
export type PriorRead = { axis: string; direction: "hi" | "lo"; tier: string } | null;
export function detectRevision(
  prior: PriorRead,
  ledger: Ledger,
): { revised: boolean; previous: PriorRead; changed_by: LedgerEntry | null } {
  if (!prior || prior.tier === "observation")
    return { revised: false, previous: prior, changed_by: null };
  const prev = ledger.axes.find((a) => a.axis === prior.axis);
  const lead = ledger.axes[0];
  const flippedDirection = !!prev && prev.direction !== prior.direction;
  const lostLead = !!prev && prev.supporting <= prev.contradicting;
  const overtaken =
    !!lead &&
    lead.axis !== prior.axis &&
    !!prev &&
    lead.supporting - lead.contradicting > prev.supporting - prev.contradicting;
  const revised = flippedDirection || lostLead || overtaken;
  if (!revised) return { revised: false, previous: prior, changed_by: null };
  // The most recent decision on the prior axis that went against it.
  const against =
    ledger.entries
      .filter(
        (e) =>
          e.axis === prior.axis &&
          (prior.direction === "hi" ? e.delta <= -MIN_CONTRAST : e.delta >= MIN_CONTRAST),
      )
      .sort((a, b) => b.index - a.index)[0] ?? null;
  return { revised: true, previous: prior, changed_by: against };
}
