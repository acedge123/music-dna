import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  QualityScores,
  SessionVerdict,
  keptTalkingRate,
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
        "id,session_id,stage,status,rejection_reason,result_version,output_text,output_fingerprint,evidence_context,decision_trace,created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(data.page * 25, data.page * 25 + 24);
    if (result.error) throw new Error("Quality queue unavailable");
    // Never replace the frozen attempt with current prose. Exact result links
    // and local previous/self-report context travel with the attempt itself.
    const ids = (result.data ?? []).map((r) => r.id);
    const reviews = ids.length
      ? await context.supabase
          .from("critic_quality_reviews")
          .select(
            "attempt_id,inference_accuracy,musical_specificity,prose_originality,conversational_relevance,entertainment,reviewer_id",
          )
          .in("attempt_id", ids)
      : { data: [], error: null };
    if (reviews.error) throw new Error("Quality reviews unavailable");
    const sessionIds = [...new Set((result.data ?? []).map((r) => r.session_id))];
    const verdicts = sessionIds.length
      ? await context.supabase
          .from("critic_session_verdicts")
          .select("session_id,keep_talking,reason,reviewer_id")
          .in("session_id", sessionIds)
      : { data: [], error: null };
    if (verdicts.error) throw new Error("Session verdicts unavailable");
    return {
      rows: result.data ?? [],
      reviews: reviews.data ?? [],
      verdicts: verdicts.data ?? [],
      total: result.count ?? 0,
    };
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
      partitions: [
        ...new Set((offers.data ?? []).map((o) => `${o.lane}:${o.catalog_revision}`)),
      ].map((key) => {
        const group = (offers.data ?? []).filter((o) => `${o.lane}:${o.catalog_revision}` === key);
        return {
          key,
          ...exposureReport(
            group.map((o) => ({
              id: o.id,
              pairing_id: o.pairing_id,
              songs: Songs.parse(o.songs),
              shown: o.reported_shown_at !== null,
            })),
            decisions.filter((d) => group.some((o) => o.pairing_id === d.pairing_id)),
          ),
        };
      }),
    };
  });

export const saveCriticSessionVerdict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), verdict: SessionVerdict }).strict().parse(d),
  )
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("Forbidden");
    const { error } = await context.supabase.from("critic_session_verdicts").insert({
      session_id: data.sessionId,
      reviewer_id: context.userId,
      rubric_version: QUALITY_RUBRIC_VERSION,
      keep_talking: data.verdict.keep_talking,
      reason: data.verdict.reason || null,
    });
    if (error?.code === "23505") throw new Error("You already gave this interview a verdict.");
    if (error) throw new Error("Verdict could not be saved");
    return { saved: true };
  });

/** Real listeners only: completed sessions in the last 30 days, owner-QA excluded. */
export const criticKeptTalking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [sessions, qa] = await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("id")
        .not("completed_at", "is", null)
        .gte("completed_at", since)
        .limit(1000),
      supabaseAdmin.from("interview_qa_sessions").select("session_id").limit(5000),
    ]);
    if (sessions.error || qa.error) throw new Error("Kept-talking metric unavailable");
    const qaIds = new Set((qa.data ?? []).map((r) => r.session_id));
    const ids = (sessions.data ?? []).map((s) => s.id).filter((id) => !qaIds.has(id));
    const turns: Record<string, number> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const msgs = await supabaseAdmin
        .from("chat_messages")
        .select("session_id")
        .eq("role", "user")
        .in("session_id", chunk)
        .limit(10000);
      if (msgs.error) throw new Error("Kept-talking metric unavailable");
      for (const m of msgs.data ?? []) turns[m.session_id] = (turns[m.session_id] ?? 0) + 1;
    }
    return {
      window_days: 30,
      ...keptTalkingRate(ids.map((id) => ({ session_id: id, user_turns: turns[id] ?? 0 }))),
    };
  });

/** Admin-only: background-draft timeline for one interview (pick-wait tracing). */
export const draftTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("prepared_reads" as never)
      .select("answered,pairing_id,chosen_song_id,status,started_at,finished_at,requested_at,consumed_at,outcome,wait_ms")
      .eq("session_id", data.sessionId)
      .order("started_at");
    if (error) throw new Error("Draft timeline unavailable");
    return {
      rows: (rows ?? []) as unknown as Array<{
        answered: number; pairing_id: string; chosen_song_id: string; status: string;
        started_at: string; finished_at: string | null; requested_at: string | null;
        consumed_at: string | null; outcome: string | null; wait_ms: number | null;
      }>,
    };
  });
