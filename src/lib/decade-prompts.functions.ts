import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as publicSupabase } from "@/integrations/supabase/client";

export const DECADES = ["70s", "80s", "90s", "00s", "10s"] as const;
export type Decade = (typeof DECADES)[number];

export type DecadePrompt = {
  id: string;
  decade: Decade;
  position: number;
  text: string;
  is_active: boolean;
};

// Public-readable: anyone (signed in or out) can fetch the active prompt for a
// decade. Backed by the "Anyone can read decade prompts" RLS policy + anon GRANT.
export const getActiveDecadePrompt = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ decade: z.enum(DECADES) }).parse(d))
  .handler(async ({ data }): Promise<{ text: string | null }> => {
    const { data: row, error } = await publicSupabase
      .from("decade_opening_prompts")
      .select("text")
      .eq("decade", data.decade)
      .eq("is_active", true)
      .maybeSingle();
    if (error) return { text: null };
    return { text: row?.text ?? null };
  });

// Public-readable: return all prompts for a decade, ordered by position.
// Used by per-decade onboarding pages (e.g. /1980) to drive the full question
// sequence, not just the opener.
export const listDecadePromptsPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ decade: z.enum(DECADES) }).parse(d))
  .handler(
    async ({
      data,
    }): Promise<{ rows: Array<{ text: string; position: number; is_active: boolean }> }> => {
      const { data: rows, error } = await publicSupabase
        .from("decade_opening_prompts")
        .select("text,position,is_active")
        .eq("decade", data.decade)
        .order("position", { ascending: true });
      if (error) return { rows: [] };
      return {
        rows: (rows ?? []) as Array<{ text: string; position: number; is_active: boolean }>,
      };
    },
  );

// --- Admin operations ---

async function assertAdminAndGetClient(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
  return supabaseAdmin;
}

export const listDecadePrompts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: DecadePrompt[] }> => {
    const admin = await assertAdminAndGetClient(context.userId);
    const { data, error } = await admin
      .from("decade_opening_prompts")
      .select("id,decade,position,text,is_active")
      .order("decade", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as DecadePrompt[] };
  });

export const updateDecadePromptText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        text: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const { error } = await admin
      .from("decade_opening_prompts")
      .update({ text: data.text })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Sets one prompt active for its decade; unsets any other active prompt for
// that same decade first so the partial-unique index is satisfied.
export const setActiveDecadePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const { data: target, error: tErr } = await admin
      .from("decade_opening_prompts")
      .select("id,decade")
      .eq("id", data.id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target) throw new Error("Prompt not found");

    // Unset existing active in this decade
    const { error: unsetErr } = await admin
      .from("decade_opening_prompts")
      .update({ is_active: false })
      .eq("decade", (target as { decade: string }).decade)
      .eq("is_active", true);
    if (unsetErr) throw new Error(unsetErr.message);

    // Set this one active
    const { error: setErr } = await admin
      .from("decade_opening_prompts")
      .update({ is_active: true })
      .eq("id", data.id);
    if (setErr) throw new Error(setErr.message);

    return { ok: true as const };
  });

export const createDecadePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        decade: z.enum(DECADES),
        text: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    // Pick next position for this decade
    const { data: rows, error: rErr } = await admin
      .from("decade_opening_prompts")
      .select("position")
      .eq("decade", data.decade)
      .order("position", { ascending: false })
      .limit(1);
    if (rErr) throw new Error(rErr.message);
    const nextPos = ((rows?.[0] as { position?: number } | undefined)?.position ?? 0) + 1;

    const { data: ins, error } = await admin
      .from("decade_opening_prompts")
      .insert({
        decade: data.decade,
        position: nextPos,
        text: data.text,
        is_active: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id };
  });

export const deleteDecadePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const { error } = await admin.from("decade_opening_prompts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
