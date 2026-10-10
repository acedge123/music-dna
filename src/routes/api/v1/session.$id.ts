// GET /api/v1/session/:id — resume a session.
//
// Returns the current state so the mobile app can drop the user back where
// they left off (in-progress → keep looping /next+/choice; completed →
// jump to reveal/share). RLS enforces ownership.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { experienceVersion } from "./-experience";

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request, params }) => {
        try {
          const parsed = UUID.safeParse(params.id);
          if (!parsed.success) {
            return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          }
          const { supabase } = await verifyBearer(request);

          const { data: session, error } = await supabase
            .from("sessions")
            .select(
              "id, lane, lane_confidence, vector, started_at, completed_at, is_public, share_token, archetype_id, interpretation",
            )
            .eq("id", parsed.data)
            .maybeSingle();
          if (error) return errorResponse("INTERNAL", error.message, 500);
          if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);

          const { count: roundsCompleted } = await supabase
            .from("choices")
            .select("id", { count: "exact", head: true })
            .eq("session_id", parsed.data);

          const base = {
            session_id: session.id,
            status: session.completed_at ? "completed" : "in_progress",
            lane: session.lane,
            lane_confidence: session.lane_confidence,
            vector: session.vector,
            rounds_completed: roundsCompleted ?? 0,
            started_at: session.started_at,
            completed_at: session.completed_at,
            is_public: session.is_public,
            share_token: session.share_token,
            archetype_id: session.archetype_id,
            interpretation: session.interpretation,
          };
          if (experienceVersion(request) !== 1) return jsonResponse(base);

          // READ03 / NFR01: full chronological history so a resumed client
          // restores the conversation, not just the last line.
          const [choicesRes, eventsRes, openerRes, resultRes] = await Promise.all([
            supabase.from("choices")
              .select("pairing_id, created_at, response, chosen:chosen_song_id(id,title,artist), rejected:rejected_song_id(id,title,artist)")
              .eq("session_id", parsed.data).order("created_at", { ascending: true }),
            supabase.from("event_log")
              .select("event_type, pairing_id, created_at, props")
              .eq("session_id", parsed.data)
              .in("event_type", ["read_shown", "pairing_skipped", "reaction_submitted"])
              .order("created_at", { ascending: true }),
            supabase.from("profiles").select("opening_songs, opening_hypothesis").maybeSingle(),
            supabase.from("session_results").select("version, source, created_at")
              .eq("session_id", parsed.data).order("version", { ascending: true }),
          ]);
          type Song = { id: string; title: string; artist: string } | null;
          const exchanges: Array<Record<string, unknown>> = [];
          for (const c of (choicesRes.data ?? []) as unknown as Array<{ pairing_id: string; created_at: string; response: { verdict?: string; why?: string } | null; chosen: Song; rejected: Song }>) {
            exchanges.push({
              type: "choice", at: c.created_at, pairing_id: c.pairing_id,
              chosen: c.chosen, rejected: c.rejected,
              feedback: c.response ? { verdict: c.response.verdict ?? "", why: c.response.why ?? "" } : null,
            });
          }
          for (const e of (eventsRes.data ?? []) as Array<{ event_type: string; pairing_id: string | null; created_at: string; props: Record<string, unknown> | null }>) {
            const p = e.props ?? {};
            if (e.event_type === "read_shown") {
              exchanges.push({ type: "read", at: e.created_at, tier: p.tier, thesis: p.thesis, revised: p.revised ?? false, revision: p.revision ?? null });
            } else if (e.event_type === "pairing_skipped") {
              exchanges.push({ type: "skip", at: e.created_at, pairing_id: e.pairing_id, reason: p.reason ?? null });
            } else {
              exchanges.push({ type: "reaction", at: e.created_at, kind: p.kind });
            }
          }
          exchanges.sort((a, b) => String(a.at).localeCompare(String(b.at)));
          return jsonResponse({
            ...base,
            contract: 1,
            opener: openerRes.data ? { songs: openerRes.data.opening_songs, hypothesis: openerRes.data.opening_hypothesis } : null,
            exchanges,
            result_versions: resultRes.data ?? [],
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
