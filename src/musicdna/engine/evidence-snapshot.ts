import { z } from "zod";
import type { LedgerChoice } from "./evidence";
import { DIMS } from "./axes";

export const EVIDENCE_SNAPSHOT_VERSION = "choice-evidence-v1";
const Song = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  year: z.number().nullable(),
  lane: z.string().nullable(),
  primary_lane: z.string().nullable(),
  values: z.record(z.number().finite().nullable()),
});
export const EvidenceSnapshot = z.object({
  version: z.literal(EVIDENCE_SNAPSHOT_VERSION),
  source: z.literal("pairing"),
  choice_id: z.string(),
  pairing_id: z.string(),
  session_id: z.string(),
  created_at: z.string(),
  ms_to_decide: z.number().nullable(),
  mutation_id: z.string().nullable(),
  catalog_revision: z.string(),
  catalog: z.object({
    pairing_revision: z.string().nullable(),
    tests: z.array(z.string()),
    diagnostic_weight: z.number().nullable(),
    chosen: Song,
    rejected: Song,
  }),
  contrasts: z.record(z.number().finite()),
});
export type ChoiceEvidenceSnapshot = z.infer<typeof EvidenceSnapshot>;
export type EvidenceRow = {
  id: string;
  pairing_id: string;
  session_id: string;
  created_at: string;
  chosen_song_id: string;
  rejected_song_id: string | null;
  evidence_snapshot: unknown;
};

export function snapshotChoice(row: EvidenceRow): LedgerChoice {
  const parsed = EvidenceSnapshot.safeParse(row.evidence_snapshot);
  const base = { choice_id: row.id, pairing_id: row.pairing_id, created_at: row.created_at };
  if (
    !parsed.success ||
    parsed.data.choice_id !== row.id ||
    parsed.data.pairing_id !== row.pairing_id ||
    parsed.data.session_id !== row.session_id ||
    parsed.data.catalog.chosen.id !== row.chosen_song_id ||
    parsed.data.catalog.rejected.id !== row.rejected_song_id
  ) {
    return {
      ...base,
      chosen: null,
      rejected: null,
      tests: [],
      provenance: row.evidence_snapshot == null ? "legacy_unavailable" : "invalid_snapshot",
    };
  }
  const s = parsed.data;
  const song = (v: ChoiceEvidenceSnapshot["catalog"]["chosen"]) => ({
    ...v.values,
    id: v.id,
    title: v.title,
    artist: v.artist,
    year: v.year,
    lane: v.lane,
    primary_lane: v.primary_lane,
  });
  return {
    ...base,
    tests: s.catalog.tests,
    diagnostic_weight: s.catalog.diagnostic_weight,
    chosen: song(s.catalog.chosen),
    rejected: song(s.catalog.rejected),
    ms_to_decide: s.ms_to_decide,
    pairing_revision: s.catalog.pairing_revision,
    catalog_revision: s.catalog_revision,
    provenance: "pairing",
  };
}

// Matches the database's whitelist; curator notes and opener/chat scores never enter it.
export function expectedCatalog(
  pairing: {
    updated_at?: string | null;
    tests: string[] | null;
    diagnostic_weight: number | null;
  },
  chosen: Record<string, unknown>,
  rejected: Record<string, unknown>,
) {
  const song = (s: Record<string, unknown>) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    year: typeof s.year === "number" ? s.year : null,
    lane: typeof s.lane === "string" ? s.lane : null,
    primary_lane: typeof s.primary_lane === "string" ? s.primary_lane : null,
    values: Object.fromEntries(
      DIMS.map((d) => [d, typeof s[d] === "number" && Number.isFinite(s[d]) ? s[d] : null]),
    ),
  });
  return {
    pairing_revision: pairing.updated_at ?? null,
    tests: [
      ...new Set((pairing.tests ?? []).filter((d) => (DIMS as readonly string[]).includes(d))),
    ].sort(),
    diagnostic_weight: pairing.diagnostic_weight,
    chosen: song(chosen),
    rejected: song(rejected),
  };
}
