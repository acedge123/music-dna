import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export const listCriticExemplars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const db = (context as Ctx).supabase;
    const [saved, recent] = await Promise.all([
      db.from("critic_exemplars").select("id,text,why_it_works,tags,status,source_session_id,created_at").order("created_at", { ascending: false }).limit(300),
      db.from("critic_quality_attempts").select("id,session_id,stage,output_text,created_at").eq("status", "accepted").order("created_at", { ascending: false }).limit(40),
    ]);
    if (saved.error) throw new Error(saved.error.message);
    return { saved: saved.data ?? [], recent: recent.data ?? [] };
  });

export const saveCriticExemplar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    text: z.string().trim().min(8).max(400),
    why: z.string().trim().max(300).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
    sessionId: z.string().uuid().optional(),
    attemptId: z.string().uuid().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context as Ctx).supabase.from("critic_exemplars").insert({
      text: data.text, why_it_works: data.why || null, tags: data.tags,
      source_session_id: data.sessionId ?? null, source_attempt_id: data.attemptId ?? null,
      created_by: (context as Ctx).userId,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true, duplicate: error?.code === "23505" };
  });

export const setCriticExemplarStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["candidate", "approved", "retired"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const approved = data.status === "approved";
    const { error } = await (context as Ctx).supabase.from("critic_exemplars").update({
      status: data.status, approved_by: approved ? (context as Ctx).userId : null, approved_at: approved ? new Date().toISOString() : null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
