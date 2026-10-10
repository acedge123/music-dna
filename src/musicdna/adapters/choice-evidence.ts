// Frozen per-pick evidence (TGA-303). At pick time we snapshot exactly what
// the pick was judged on — declared tests, weight, and both songs' values —
// onto `choices.evidence`. Every ledger reader prefers that snapshot, so a
// later catalog edit can never change an existing reading's evidence.
import { DIMS } from "@/musicdna/engine/dims";
import type { LedgerChoice, LedgerSong } from "@/musicdna/engine/evidence";

export const EVIDENCE_SNAPSHOT_VERSION = 1;

type SongLike = Record<string, unknown> | null | undefined;

function pickSong(s: SongLike): LedgerSong | null {
  if (!s) return null;
  const out: LedgerSong = {
    id: typeof s.id === "string" ? s.id : undefined,
    title: typeof s.title === "string" ? s.title : undefined,
    artist: typeof s.artist === "string" ? s.artist : undefined,
  };
  for (const d of DIMS as readonly string[]) {
    const v = s[d];
    out[d] = typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  return out;
}

export function snapshotEvidence(args: {
  tests: string[] | null | undefined;
  diagnostic_weight: number | null | undefined;
  chosen: SongLike;
  rejected: SongLike;
}) {
  return {
    v: EVIDENCE_SNAPSHOT_VERSION,
    tests: args.tests ?? [],
    diagnostic_weight: args.diagnostic_weight ?? null,
    chosen: pickSong(args.chosen),
    rejected: pickSong(args.rejected),
  };
}

/** Column list ledger readers must select on `choices`. */
export const CHOICE_EVIDENCE_SELECT = "evidence";

type Snapshot = ReturnType<typeof snapshotEvidence>;

/**
 * Map a choices row to a ledger input. Uses the frozen snapshot when present;
 * falls back to live joins only for rows that predate snapshots.
 */
export function ledgerChoiceFromRow(row: {
  pairing_id?: string | null;
  created_at?: string | null;
  evidence?: unknown;
  pairing?: { tests: string[] | null; diagnostic_weight: number | null } | null;
  chosen?: SongLike;
  rejected?: SongLike;
}): LedgerChoice {
  const snap = row.evidence as Snapshot | null | undefined;
  if (snap && typeof snap === "object" && snap.chosen && snap.rejected) {
    return {
      pairing_id: row.pairing_id ?? null,
      created_at: row.created_at ?? null,
      tests: snap.tests ?? null,
      diagnostic_weight: snap.diagnostic_weight ?? null,
      chosen: snap.chosen,
      rejected: snap.rejected,
    };
  }
  return {
    pairing_id: row.pairing_id ?? null,
    created_at: row.created_at ?? null,
    tests: row.pairing?.tests ?? null,
    diagnostic_weight: row.pairing?.diagnostic_weight ?? null,
    chosen: (row.chosen as LedgerSong) ?? null,
    rejected: (row.rejected as LedgerSong) ?? null,
  };
}
