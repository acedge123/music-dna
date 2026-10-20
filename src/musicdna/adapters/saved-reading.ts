import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseReadingContent } from "@/lib/reading-content";

export async function loadSavedReading(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: { sessionId: string; resultVersion?: number },
) {
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id,user_id,completed_at")
    .eq("id", data.sessionId)
    .maybeSingle();
  if (error) throw new Error("Couldn't load the reading. Please retry.");
  if (!session || session.user_id !== userId)
    throw new Error("Reading not available for this account.");
  const { data: rows, error: resultError } = await supabase
    .from("session_results")
    .select("version,source,base_version,content,self_report,created_at")
    .eq("session_id", data.sessionId)
    .eq("user_id", userId)
    .order("version", { ascending: true });
  if (resultError) throw new Error("Couldn't load the saved reading. Please retry.");
  const versions = (rows ?? []).map((row) => {
    const content = parseReadingContent(row.content);
    if (!content) throw new Error("This saved reading couldn't be opened. Please retry.");
    return {
      version: row.version,
      source: row.source,
      baseVersion: row.base_version,
      content: { ...content, result_version: row.version },
      createdAt: row.created_at,
    };
  });
  const selected = data.resultVersion
    ? versions.find((row) => row.version === data.resultVersion)
    : versions.find((row) => row.source === "pairings");
  if (!selected) throw new Error("Finish the song choices before continuing this reading.");
  return { sessionId: session.id, selected, versions };
}
