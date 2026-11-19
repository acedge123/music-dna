import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { rpc, McpError } from "./access";
import { QuipObservation, approvedLines, lineHash, PACING_VERSION } from "./quip-observations";
export async function telemetryAllowed(db: SupabaseClient, sessionId: string) {
  return rpc<boolean>(db, "musicdna_mcp_quip_telemetry_allowed", { p_session: sessionId });
}
export async function recordObservation(db: SupabaseClient, data: z.infer<typeof QuipObservation>) {
  if (!(await telemetryAllowed(db, data.session_id))) throw new McpError("FORBIDDEN");
  if (!approvedLines.has(data.line)) return { recorded: false, replayed: false };
  return rpc<{ recorded: boolean; replayed: boolean }>(db, "musicdna_mcp_record_quip", {
    p_observation: data.id,
    p_session: data.session_id,
    p_wait: data.wait_id,
    p_line_hash: await lineHash(data.line),
    p_pacing_version: PACING_VERSION,
    p_sequence: data.sequence,
    p_answered: data.answered,
    p_phase: data.phase,
    p_shown_at: data.shown_at,
    p_duration_ms: data.duration_ms,
    p_since_wait_ms: data.since_wait_ms,
    p_ended_reason: data.ended_reason,
  });
}
