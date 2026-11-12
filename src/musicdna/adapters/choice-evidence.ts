import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildLedger } from "@/musicdna/engine/evidence";
import { snapshotChoice, type EvidenceRow } from "@/musicdna/engine/evidence-snapshot";
import { DIMS } from "@/musicdna/engine/axes";

export async function loadChoiceEvidence(client: SupabaseClient<Database>, sessionId: string) {
  const { data, error } = await client
    .from("choices")
    .select("id,session_id,pairing_id,chosen_song_id,rejected_song_id,created_at,evidence")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`choice_evidence_unavailable: ${error.message}`);
  const choices = ((data ?? []) as EvidenceRow[]).map(snapshotChoice);
  return { choices, ledger: buildLedger(choices, DIMS) };
}

/**
 * Evidence for a reading. A "Refine My DNA" run is cumulative: its parent's
 * frozen choices come first, then its own. Every other session is itself.
 */
export async function loadReadingEvidence(client: SupabaseClient<Database>, sessionId: string) {
  const { data } = await client
    .from("sessions")
    .select("mode, parent_session_id")
    .eq("id", sessionId)
    .maybeSingle();
  const row = data as { mode?: string; parent_session_id?: string | null } | null;
  if (row?.mode !== "refine" || !row.parent_session_id) return loadChoiceEvidence(client, sessionId);
  const [parent, own] = await Promise.all([
    loadChoiceEvidence(client, row.parent_session_id),
    loadChoiceEvidence(client, sessionId),
  ]);
  const choices = [...parent.choices, ...own.choices];
  return { choices, ledger: buildLedger(choices, DIMS), parentLedger: parent.ledger };
}
