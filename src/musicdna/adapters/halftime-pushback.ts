// Halftime pushback (Q3) — one implementation for web and REST.
// The listener's words are self-report: stored as a trusted `halftime_pushback`
// event with at_pick, never a vote, score, ledger entry or routing input.
// Idempotency: the event id is derived from (session, mutation_id), so a retry
// collides on the primary key and replays the saved row instead of duplicating.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { halftimePushbackReply } from "@/musicdna/engine/halftime";

export class PushbackError extends Error {
  constructor(
    public code: "NOT_FOUND" | "MUTATION_CONFLICT" | "PERSISTENCE_FAILED",
    message: string,
  ) {
    super(message);
  }
}

export async function pushbackEventId(sessionId: string, mutationId: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`halftime_pushback:${sessionId}:${mutationId}`)),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Admin = Pick<SupabaseClient<Database>, "from">;

export type PushbackResult = {
  mutation_id: string;
  text: string;
  at_pick: number;
  reply: string;
  provenance: "self_report";
  counts_as_vote: false;
  replayed: boolean;
  created_at: string | null;
};

export async function recordHalftimePushbackImpl(
  supabase: Pick<SupabaseClient<Database>, "from">,
  admin: Admin,
  userId: string,
  input: { sessionId: string; text: string; mutationId: string },
): Promise<PushbackResult> {
  const text = input.text.trim();
  const s = await supabase.from("sessions").select("user_id").eq("id", input.sessionId).maybeSingle();
  if (s.error || !s.data || s.data.user_id !== userId) throw new PushbackError("NOT_FOUND", "Session not found");
  const id = await pushbackEventId(input.sessionId, input.mutationId);
  const replay = async (): Promise<PushbackResult | null> => {
    const { data } = await admin
      .from("event_log")
      .select("props, created_at, user_id, session_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const p = (data.props ?? {}) as Record<string, unknown>;
    if (data.user_id !== userId || data.session_id !== input.sessionId || p.text !== text)
      throw new PushbackError("MUTATION_CONFLICT", "This mutation_id was already used for a different reply");
    return {
      mutation_id: input.mutationId,
      text,
      at_pick: Number(p.at_pick ?? 0),
      reply: String(p.reply ?? halftimePushbackReply(text)),
      provenance: "self_report",
      counts_as_vote: false,
      replayed: true,
      created_at: data.created_at,
    };
  };
  const prior = await replay();
  if (prior) return prior;
  const { count } = await supabase
    .from("choices")
    .select("id", { count: "exact", head: true })
    .eq("session_id", input.sessionId);
  const reply = halftimePushbackReply(text);
  const at_pick = count ?? 0;
  const { error } = await admin.from("event_log").insert({
    id,
    user_id: userId,
    session_id: input.sessionId,
    event_type: "halftime_pushback",
    props: { text, at_pick, reply, mutation_id: input.mutationId, counts_as_vote: false, provenance: "self_report" } as never,
    client: "server",
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const won = await replay();
      if (won) return won;
    }
    throw new PushbackError("PERSISTENCE_FAILED", "Could not save your reply.");
  }
  return { mutation_id: input.mutationId, text, at_pick, reply, provenance: "self_report", counts_as_vote: false, replayed: false, created_at: null };
}
