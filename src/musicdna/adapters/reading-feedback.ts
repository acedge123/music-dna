import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Accuracy } from "@/lib/reading-feedback";

export async function loadReadingFeedback(
  db: SupabaseClient<Database>,
  userId: string,
  input: { sessionId: string; resultVersion: number },
) {
  const { data: reading, error: readingError } = await db
    .from("session_results")
    .select("id")
    .eq("session_id", input.sessionId)
    .eq("user_id", userId)
    .eq("version", input.resultVersion)
    .maybeSingle();
  if (readingError) throw Error("Couldn't check this reading. Please retry.");
  if (!reading) throw Error("Reading not available for this account.");
  const { data: rows, error } = await db
    .from("result_feedback")
    .select("id,accuracy,result_version,mutation_id")
    .eq("session_id", input.sessionId)
    .eq("user_id", userId)
    .eq("result_version", input.resultVersion)
    .is("target", null)
    .not("accuracy", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw Error("Couldn't load your rating. Please retry.");
  const row = rows?.[0];
  const accuracy =
    row?.accuracy === "partly"
      ? "mixed"
      : row?.accuracy === "wrong"
        ? "not_accurate"
        : row?.accuracy;
  if (row && !["accurate", "mixed", "not_accurate"].includes(accuracy ?? ""))
    throw Error("Couldn't read this rating. Please retry.");
  return {
    sessionId: input.sessionId,
    resultVersion: input.resultVersion,
    feedback: row
      ? {
          id: row.id,
          accuracy: accuracy as Accuracy,
          resultVersion: input.resultVersion,
          mutationId: row.mutation_id,
        }
      : null,
  };
}
