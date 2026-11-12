import type { AuthedSupabase } from "@/lib/musicdna.functions";

export type ReadCursor = { pairingId: string; answered: number };

export class ReadSupersededError extends Error {
  constructor() {
    super("The interview has moved on from this choice.");
  }
}

/** Caller-scoped metadata only. A delayed writer must not narrate a newer pick
 * as though it were the requested pick, or save an older draft after advancing. */
export async function requireReadCursor(
  supabase: AuthedSupabase,
  sessionId: string,
  cursor: ReadCursor,
): Promise<void> {
  const [latest, total] = await Promise.all([
    supabase
      .from("choices")
      .select("pairing_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("choices")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId),
  ]);
  if (latest.error || total.error) throw new Error("Choice position unavailable");
  if (latest.data?.pairing_id !== cursor.pairingId || total.count !== cursor.answered)
    throw new ReadSupersededError();
}
