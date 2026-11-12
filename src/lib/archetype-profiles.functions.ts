import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DIMS } from "@/musicdna/engine/axes";


async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export const listArchetypeProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("archetype_profiles")
      .select("id, archetype_id, version, core, distinguishers, thematic_note, status, approved_at, archetypes(name, tagline)")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      version: r.version,
      name: (r as unknown as { archetypes: { name: string; tagline: string | null } | null }).archetypes?.name ?? "",
      tagline: (r as unknown as { archetypes: { tagline: string | null } | null }).archetypes?.tagline ?? null,
      core: r.core as Record<string, number>,
      distinguishers: r.distinguishers,
      thematic_note: r.thematic_note,
      status: r.status,
      approved_at: r.approved_at,
    }));
  });

const Weights = z.record(z.enum(DIMS), z.number().min(-1).max(1));

export const reviewArchetypeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "approved", "retired"]),
        core: Weights.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.core) {
      // A changed shape is a new profile version, so saved readings keep naming the version they matched.
      const cur = await context.supabase.from("archetype_profiles").select("version, core").eq("id", data.id).maybeSingle();
      if (cur.error || !cur.data) throw new Error("Profile not found");
      if (JSON.stringify(cur.data.core) !== JSON.stringify(data.core)) patch.version = cur.data.version + 1;
      patch.core = data.core;
    }
    if (data.status === "approved") {
      patch.approved_by = context.userId;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await context.supabase.from("archetype_profiles").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const songExplanationCoverage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [songs, expl] = await Promise.all([
      context.supabase.from("songs").select("id", { count: "exact", head: true }).eq("active", true),
      context.supabase.from("song_trait_explanations").select("song_id, status"),
    ]);
    const rows = (expl.data ?? []) as { song_id: string; status: string }[];
    const by = (s: string) => new Set(rows.filter((r) => r.status === s).map((r) => r.song_id)).size;
    return {
      active_songs: songs.count ?? 0,
      approved_songs: by("approved"),
      pending_songs: by("pending_review"),
    };
  });
