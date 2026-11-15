import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  canPromoteIntake,
  intakeDraftSchema,
  intakeScoringPrompt,
  INTAKE_JSON_SCHEMA,
  INTAKE_MODEL,
  INTAKE_VERSION,
} from "@/musicdna/adapters/song-intake";

async function assertIntakeAdmin(db: SupabaseClient<Database>, userId: string) {
  const [role, auth] = await Promise.all([
    db.rpc("has_role", { _user_id: userId, _role: "admin" }),
    db.auth.getUser(),
  ]);
  if (role.error || !role.data || auth.error || !auth.data.user || auth.data.user.is_anonymous)
    throw new Error("Forbidden: registered admin only");
}
export const listSongIntake = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum([
          "all",
          "unmatched",
          "matched",
          "scoring",
          "scoring_failed",
          "pending_review",
          "rejected",
          "promoted",
        ]),
        page: z.number().int().min(0),
        search: z.string().trim().max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertIntakeAdmin(context.supabase, context.userId);
    let query = context.supabase
      .from("staged_opener_songs")
      .select(
        "id,cleaned_title,cleaned_artist,status,submission_count,ai_draft,scoring_model,matched_song_id,updated_at",
        { count: "exact" },
      );
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.search)
      query = query.ilike(
        "cleaned_title",
        `%${data.search.replace(/[%_]/g, "").replace(/\\/g, "")}%`,
      );
    const result = await query
      .order("submission_count", { ascending: false })
      .order("id")
      .range(data.page * 50, data.page * 50 + 49);
    if (result.error) throw new Error("Could not load song intake.");
    return {
      count: result.count ?? 0,
      rows: (result.data ?? []).map((row) => {
        const draft = intakeDraftSchema.safeParse(row.ai_draft);
        return { ...row, ai_draft: draft.success ? draft.data : null };
      }),
    };
  });

export const scoreSongIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertIntakeAdmin(context.supabase, context.userId);
    // Claim before inference; no automatic retry on ambiguous provider outcomes.
    const claimed = await context.supabase
      .from("staged_opener_songs")
      .update({
        status: "scoring",
        ai_draft: null,
        scoring_model: INTAKE_MODEL,
        scoring_version: INTAKE_VERSION,
      })
      .eq("id", data.id)
      .in("status", ["unmatched", "scoring_failed", "rejected"])
      .select("id,cleaned_title,cleaned_artist")
      .maybeSingle();
    if (claimed.error || !claimed.data)
      throw new Error("Song is already scoring or has changed. Refresh intake.");
    try {
      const { scoreIntakeRecording } = await import("@/musicdna/adapters/llm-gateway");
      const draft = intakeDraftSchema.parse(
        JSON.parse(
          await scoreIntakeRecording(
            intakeScoringPrompt(claimed.data.cleaned_title, claimed.data.cleaned_artist),
            INTAKE_JSON_SCHEMA,
          ),
        ),
      );
      const saved = await context.supabase
        .from("staged_opener_songs")
        .update({ status: "pending_review", ai_draft: draft })
        .eq("id", data.id)
        .eq("status", "scoring")
        .select("id")
        .maybeSingle();
      if (saved.error || !saved.data) throw new Error("Draft could not be saved.");
      return { ok: true };
    } catch {
      await context.supabase
        .from("staged_opener_songs")
        .update({ status: "scoring_failed" })
        .eq("id", data.id)
        .eq("status", "scoring");
      throw new Error(
        "Scoring failed or could not be saved. Review before starting another attempt.",
      );
    }
  });

export const reviewSongIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["promote", "reject"]),
        draft: intakeDraftSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertIntakeAdmin(context.supabase, context.userId);
    if (data.action === "promote") {
      if (!canPromoteIntake(data.draft))
        throw new Error("Verify the song identity and release year before approval.");
      const result = await context.supabase.rpc("promote_musicdna_opener_song", {
        p_id: data.id,
        p_expected_draft: data.draft,
      });
      if (result.error || !result.data)
        throw new Error("Could not approve this draft. Refresh intake before retrying.");
      return { songId: result.data };
    }
    const result = await context.supabase
      .from("staged_opener_songs")
      .update({
        status: "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending_review")
      .eq("ai_draft", data.draft)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data) throw new Error("Draft changed. Refresh intake.");
    return { songId: null };
  });
