import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Ledger } from "../engine/evidence";
import type { CallMeasurement } from "../engine/critic-quality";
import type { AxisLabels } from "../engine/claim-language";
import {
  authorCritic,
  criticFacts,
  CRITIC_EXPRESSION_VERSION,
  CRITIC_REVIEW_VERSION,
  type CriticStage,
} from "./critic-editorial";

export async function measuredCritic(
  client: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  ledger: Ledger,
  labels: AxisLabels,
  generate: (prompt: string, review?: boolean) => Promise<string>,
  options: {
    stage: CriticStage;
    fallback?: string;
    previous?: string;
    selfReport?: string;
    savedText?: string;
  },
  calls: CallMeasurement[],
) {
  const result =
    options.savedText !== undefined
      ? {
          text: options.savedText,
          status: "insufficient" as const,
          validation_reason: "deterministic_choice_no_model_call",
          review_checks: null,
          voice_version: CRITIC_EXPRESSION_VERSION,
          audit_text: options.savedText,
        }
      : await authorCritic(ledger, labels, generate, options);
  // This helper only receives sessions already ownership-checked by callers;
  // revalidate before any privileged diagnostic write, never for auth decisions.
  try {
    const owned = await client
      .from("sessions")
      .select("user_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (owned.error || !owned.data) throw new Error("quality_owner_unavailable");
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(result.text));
    const fingerprint = Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const saved = await client
      .from("session_results")
      .select("version,content")
      .eq("session_id", sessionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const content = saved.data?.content;
    const version =
      content &&
      typeof content === "object" &&
      !Array.isArray(content) &&
      (content.synthesis === result.text ||
        content.narrative === result.text ||
        content.reply === result.text)
        ? (saved.data?.version ?? null)
        : null;
    const decisionTrace = await buildDecisionTrace(supabaseAdmin, sessionId, result, calls);
    const { error } = await supabaseAdmin.from("critic_quality_attempts").insert({
      decision_trace: decisionTrace as never,
      session_id: sessionId,
      user_id: userId,
      attempt_key: crypto.randomUUID(),
      stage: options.stage,
      result_version: version,
      writer_version: CRITIC_EXPRESSION_VERSION,
      reviewer_version: CRITIC_REVIEW_VERSION,
      status: result.status,
      rejection_reason: result.validation_reason,
      review_checks: result.review_checks,
      evidence_context: {
        ...criticFacts(ledger, labels),
        local_review_context: {
          previous: options.previous ?? null,
          self_report: options.selfReport ?? null,
        },
        references: ledger.entries.map((e) => ({
          choice_id: e.choice_id,
          pairing_id: e.pairing_id,
          pairing_revision: e.pairing_revision,
          catalog_revision: e.catalog_revision,
          trait: e.axis,
          delta: e.delta,
        })),
      } as never,
      calls: calls as never,
      output_text: result.text,
      output_fingerprint: fingerprint,
    });
    if (error) throw error;
  } catch {
    // Do not expose context/prose or replace an already committed response.
    console.warn("[critic-quality] measurement_write_unavailable", options.stage);
  }
  return result;
}

/** Classifies a trace into the three Phase-1 causes (or ok/no-model). */
export function classifyTrace(t: {
  status: string;
  rejection_reason: string | null;
  facts_summary?: { entries: number } | null;
  error?: string | null;
}) {
  if (t.status === "ok") return "accepted";
  if (t.rejection_reason === "deterministic_choice_no_model_call") return "no_model_call";
  if (t.status === "narrator_failure" || t.error) return "ai_call_failed";
  if (t.status === "insufficient" || (t.facts_summary && t.facts_summary.entries === 0))
    return "missing_evidence";
  return "rejected";
}

async function buildDecisionTrace(
  admin: SupabaseClient<Database>,
  sessionId: string,
  result: { status: string; validation_reason: string; trace?: unknown },
  calls: CallMeasurement[],
) {
  const qa = await admin
    .from("interview_qa_sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!qa.data) return null; // listener sessions never store raw replies
  const [prior, enrolled] = await Promise.all([
    admin
      .from("critic_quality_attempts")
      .select("id,stage,output_text,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(3),
    admin
      .from("musicdna_learning_enrollments")
      .select("result_id")
      .eq("session_id", sessionId)
      .limit(1),
  ]);
  const t = (result.trace ?? {}) as {
    facts_summary?: { entries: number } | null;
    error?: string | null;
  };
  return {
    trace_version: "decision-trace-v1",
    session_id: sessionId,
    writer_version: CRITIC_EXPRESSION_VERSION,
    reviewer_version: CRITIC_REVIEW_VERSION,
    models: calls.map((c) => ({ phase: c.phase, model: c.model, status: c.status })),
    ...(result.trace as object),
    cause: classifyTrace({
      status: result.status,
      rejection_reason: result.validation_reason,
      ...t,
    }),
    previous_replies: (prior.data ?? []).map((p) => ({
      id: p.id,
      stage: p.stage,
      text: p.output_text,
    })),
    downstream: {
      learning_enrollment: enrolled.error
        ? "unknown"
        : enrolled.data?.length
          ? "enrolled"
          : "not_enrolled",
    },
  };
}

export async function recordServedOffer(
  client: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  pairingId: string,
  boundary: string,
) {
  try {
    const [owned, pairing] = await Promise.all([
      client
        .from("sessions")
        .select("user_id")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle(),
      client
        .from("pairings")
        .select(
          "id,lane,updated_at,song_a:songs!pairings_song_a_id_fkey(id,artist,year,updated_at),song_b:songs!pairings_song_b_id_fkey(id,artist,year,updated_at)",
        )
        .eq("id", pairingId)
        .single(),
    ]);
    if (owned.error || !owned.data || pairing.error || !pairing.data)
      throw new Error("offer_unavailable");
    const p = pairing.data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const offerKey = `${boundary}:${pairingId}`;
    const { error } = await supabaseAdmin.from("pairing_exposures").upsert(
      {
        session_id: sessionId,
        user_id: userId,
        pairing_id: pairingId,
        offer_key: offerKey,
        lane: p.lane,
        catalog_revision: JSON.stringify([
          p.updated_at,
          p.song_a?.updated_at,
          p.song_b?.updated_at,
        ]),
        songs: [p.song_a, p.song_b].map((s) => ({
          id: s?.id,
          artist: s?.artist ?? null,
          year: s?.year ?? null,
        })) as never,
      },
      { onConflict: "session_id,offer_key", ignoreDuplicates: true },
    );
    if (error) throw error;
    const stored = await supabaseAdmin
      .from("pairing_exposures")
      .select("id")
      .eq("session_id", sessionId)
      .eq("offer_key", offerKey)
      .single();
    if (stored.error) throw stored.error;
    return stored.data.id;
  } catch {
    console.warn("[critic-quality] offer_write_unavailable");
    return null;
  }
}
