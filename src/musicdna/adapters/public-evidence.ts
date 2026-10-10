import { ledgerChoiceFromRow } from "./choice-evidence";
// Public share-card evidence (SHR02 / DIA01). The share page and
// /api/v1/share/:token both pick their "defining choices" here, from the same
// ledger + claim policy as the private reading — never by fastest picks.
// Only picks that support an eligible claim are shown; a weak session shows none.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildLedger, type LedgerSong } from "@/musicdna/engine/evidence";

const DIMS = [
  "movement",
  "atmosphere",
  "immersion",
  "scale",
  "community",
  "perspective",
  "confidence",
  "tension",
  "texture",
  "transformation",
] as const;

export type PublicDefiningChoice = {
  chosen_title: string;
  chosen_artist: string;
  rejected_title: string;
  rejected_artist: string;
};

export async function loadPublicDefiningChoices(
  client: SupabaseClient<Database>,
  sessionId: string,
  limit = 3,
): Promise<PublicDefiningChoice[]> {
  const cols = `title,artist,${DIMS.join(",")}`;
  const { data, error } = await client
    .from("choices")
    .select(
      `pairing_id, created_at, evidence, pairing:pairing_id(tests, diagnostic_weight), chosen:chosen_song_id(${cols}), rejected:rejected_song_id(${cols})`,
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  type Row = {
    pairing_id: string | null;
    evidence: unknown;
    pairing: { tests: string[] | null; diagnostic_weight: number | null } | null;
    chosen: LedgerSong | null;
    rejected: LedgerSong | null;
  };
  const ledger = buildLedger(((data ?? []) as unknown as Row[]).map(ledgerChoiceFromRow), DIMS);
  const out: PublicDefiningChoice[] = [];
  const seen = new Set<string>();
  for (const axis of ledger.axes.filter((a) => a.eligible)) {
    for (const e of axis.supporting_examples) {
      const key = `${e.chosen}|${e.rejected}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        chosen_title: e.chosen,
        chosen_artist: e.chosen_artist,
        rejected_title: e.rejected,
        rejected_artist: e.rejected_artist,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
