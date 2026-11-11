import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const Cursor = z
  .object({ started_at: z.string().datetime({ offset: true }), id: z.string().uuid() })
  .strict();
export function parseReadingCursor(value: string | null) {
  if (!value) return null;
  return Cursor.parse(JSON.parse(value));
}

/** Caller-scoped summaries only. Cursor order is stable when timestamps tie. */
export async function loadReadingHistory(
  client: SupabaseClient<Database>,
  userId: string,
  limit: number,
  cursor: ReturnType<typeof parseReadingCursor>,
) {
  let q = client
    .from("sessions")
    .select(
      "id,lane,lane_confidence,started_at,completed_at,is_public,share_token,archetype_id,mode,decade,parent_session_id",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .order("id", { ascending: false });
  if (cursor)
    q = q.or(
      `started_at.lt.${cursor.started_at},and(started_at.eq.${cursor.started_at},id.lt.${cursor.id})`,
    );
  const { data, error } = await q.limit(limit + 1);
  if (error) throw new Error("Reading history unavailable");
  const rows = (data ?? []).slice(0, limit);
  const has_more = (data?.length ?? 0) > limit;
  const last = rows.at(-1);
  return {
    sessions: rows.map((s) => ({
      session_id: s.id,
      lane: s.lane,
      lane_confidence: s.lane_confidence,
      started_at: s.started_at,
      completed_at: s.completed_at,
      status: s.completed_at ? "completed" : "in_progress",
      is_public: s.is_public,
      share_token: s.share_token,
      archetype_id: s.archetype_id,
      mode: s.mode ?? "discover",
      decade: s.decade,
      parent_session_id: s.parent_session_id,
    })),
    has_more,
    next_cursor:
      has_more && last ? JSON.stringify({ started_at: last.started_at, id: last.id }) : null,
  };
}
