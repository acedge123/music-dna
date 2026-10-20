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
  if (process.env.MUSICDNA_BACKEND_PERSISTENCE_V2 !== "1") {
    const { data: latest } = await client
      .from("session_results")
      .select("version")
      .eq("session_id", sessionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      ...(await legacySetSharePublication(client, userId, sessionId, publish)),
      result_version: latest?.version ?? null,
    };
  }
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

function newToken(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function legacySetSharePublication(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  publish: boolean,
): Promise<{ is_public: boolean; share_token: string | null }> {
  const { data: s, error } = await supabase
    .from("sessions")
    .select("user_id, completed_at, share_token")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s || s.user_id !== userId) throw new Error("Session not found");
  if (publish && !s.completed_at) throw new Error("Finish the reading before sharing it.");

  const patch = publish
    ? { is_public: true, share_token: s.share_token ?? newToken() }
    : { is_public: false, share_token: newToken() };
  const { error: upErr } = await supabase
    .from("sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (upErr) throw new Error(upErr.message);
  return { is_public: patch.is_public, share_token: publish ? patch.share_token : null };
}
