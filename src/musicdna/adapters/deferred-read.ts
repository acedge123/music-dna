import type { CurrentReadResult } from "../engine/read";
import { ReadSupersededError, type ReadCursor } from "./read-cursor";

/** Private backend-only compare-and-save. Never waits for a model under a lock. */
export async function saveDeferredRead(
  sessionId: string,
  ownerId: string,
  cursor: ReadCursor,
  props: Record<string, unknown>,
): Promise<CurrentReadResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc(
    "save_musicdna_deferred_read" as never,
    {
      p_session_id: sessionId,
      p_owner_id: ownerId,
      p_pairing_id: cursor.pairingId,
      p_answered: cursor.answered,
      p_props: props,
    } as never,
  );
  if (error) throw new Error("read_persistence_unavailable");
  if (!data) throw new ReadSupersededError();
  return data as unknown as CurrentReadResult;
}
