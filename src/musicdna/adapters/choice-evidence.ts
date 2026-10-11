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
