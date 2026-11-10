import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  QualityScores,
  QUALITY_RUBRIC_VERSION,
  exposureReport,
  type ExposureSong,
} from "@/musicdna/engine/critic-quality";
import { snapshotChoice, type EvidenceRow } from "@/musicdna/engine/evidence-snapshot";

export const criticQualityQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ page: z.number().int().min(0).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("Forbidden");
    const result = await context.supabase
      .from("critic_quality_attempts")
      .select(
        "id,session_id,stage,result_version,output_text,output_fingerprint,evidence_context,created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(data.page * 25, data.page * 25 + 24);
    if (result.error) throw new Error("Quality queue unavailable");
    const ids = (result.data ?? []).map((r) => r.id);
    const reviews = ids.length
      ? await context.supabase
          .from("critic_quality_reviews")
          .select(
            "attempt_id,inference_accuracy,musical_specificity,prose_originality,conversational_relevance,reviewer_id",
          )
          .in("attempt_id", ids)
      : { data: [], error: null };
    if (reviews.error) throw new Error("Quality reviews unavailable");
    return { rows: result.data ?? [], reviews: reviews.data ?? [], total: result.count ?? 0 };
  });

export const saveCriticQualityReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ attemptId: z.string().uuid(), scores: QualityScores }).strict().parse(d),
  )
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("Forbidden");
    const { error } = await context.supabase.from("critic_quality_reviews").insert({
      attempt_id: data.attemptId,
      reviewer_id: context.userId,
      rubric_version: QUALITY_RUBRIC_VERSION,
      evaluator_type: "human",
      ...data.scores,
    });
    if (error && error.code !== "23505") throw new Error("Review could not be saved");
    if (error) throw new Error("This attempt already has your immutable review.");
    return { saved: true };
  });

const Songs = z.array(
  z.object({ id: z.string(), artist: z.string().nullable(), year: z.number().nullable() }),
);
export const criticExposureReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("Forbidden");
    // Privileged private evidence read, only after the caller's role is checked.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [offers, choices] = await Promise.all([
      context.supabase
        .from("pairing_exposures")
        .select("id,pairing_id,songs,reported_shown_at,lane,catalog_revision")
        .eq("session_id", data.sessionId)
        .order("id")
        .limit(1000),
      supabaseAdmin
        .from("choices")
        .select("id,session_id,pairing_id,chosen_song_id,rejected_song_id,created_at,evidence")
        .eq("session_id", data.sessionId)
        .order("id")
        .limit(1000),
    ]);
    if (offers.error || choices.error) throw new Error("Exposure report unavailable");
    if ((offers.data?.length ?? 0) === 1000 || (choices.data?.length ?? 0) === 1000)
      throw new Error("Report exceeds its inspection limit");
    const parsed = ((choices.data ?? []) as EvidenceRow[]).map(snapshotChoice);
    const song = (s: Record<string, unknown>): ExposureSong => ({
      id: String(s.id),
      artist: typeof s.artist === "string" ? s.artist : null,
      year: typeof s.year === "number" ? s.year : null,
    });
    const decisions = parsed.flatMap((c) =>
      c.chosen && c.rejected
        ? [
            {
              id: c.choice_id ?? "",
              pairing_id: c.pairing_id ?? "",
              chosen: song(c.chosen),
              rejected: song(c.rejected),
            },
          ]
        : [],
    );
    return {
      ...exposureReport(
        (offers.data ?? []).map((o) => ({
          id: o.id,
          pairing_id: o.pairing_id,
          songs: Songs.parse(o.songs),
          shown: o.reported_shown_at !== null,
        })),
        decisions,
        parsed.length - decisions.length,
      ),
      catalog_partitions: [
        ...new Set((offers.data ?? []).map((o) => `${o.lane}:${o.catalog_revision}`)),
      ],
      choices_without_served_record: decisions.filter(
        (d) => !(offers.data ?? []).some((o) => o.pairing_id === d.pairing_id),
      ).length,
    };
  });
