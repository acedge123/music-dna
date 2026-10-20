import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { persistenceRpc } from "./persistence";
export async function setSharePublication(
  client: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  publish: boolean,
  resultVersion?: number,
) {
  const { data: owned, error } = await client
    .from("sessions")
    .select("user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !owned || owned.user_id !== userId) throw new Error("Session not found");
  return persistenceRpc<{
    is_public: boolean;
    share_token: string | null;
    result_version: number | null;
  }>(client, "publish_saved_read", {
    p_session_id: sessionId,
    p_publish: publish,
    p_version: resultVersion ?? null,
  });
}
