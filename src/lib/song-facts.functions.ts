import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin-only via RLS (has_role admin): non-admins get empty lists / failed writes.
const STATUSES = ["draft", "needs_human", "approved", "rejected"] as const;

export const listSongFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(STATUSES).or(z.literal("all")), page: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("song_facts")
      .select("id,song_id,kind,text,source_url,source_title,confidence,status,check_note,reviewed_at,songs(title,artist)", { count: "exact" })
      .order("song_id")
      .order("kind")
      .range(data.page * 100, data.page * 100 + 99);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const { data: all } = await context.supabase.from("song_facts").select("status,song_id").limit(20000);
    const totals: Record<string, number> = {};
    for (const r of all ?? []) totals[r.status] = (totals[r.status] ?? 0) + 1;
    return {
      rows: (rows ?? []).map((r) => {
        const s = r.songs as unknown as { title: string; artist: string } | null;
        return { ...r, songs: undefined, song: s ? `${s.title} — ${s.artist}` : r.song_id };
      }),
      count: count ?? 0,
      totals,
      songs: new Set((all ?? []).filter((r) => r.status === "approved").map((r) => r.song_id)).size,
    };
  });

export const reviewSongFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        text: z.string().trim().min(8).max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("song_facts")
      .update({
        status: data.status,
        ...(data.text ? { text: data.text } : {}),
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id,status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found or not allowed");
    return row;
  });
