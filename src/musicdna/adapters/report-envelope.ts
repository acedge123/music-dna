// Read-only saved-report envelope (REPORT01) for GET /api/v1/session/:id/report.
// Never calls Sol/Terra, never finalizes, publishes, starts children or writes.
// Immutable fields replay the saved session_results row verbatim; annotations
// are recomputed deterministically from frozen choice evidence only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildDnaSummary, DNA_SUMMARY_VERSION, type DnaSummary } from "@/musicdna/engine/dna-summary";
import { revealBeats } from "@/musicdna/engine/reveal-beats";
import type { Ledger } from "@/musicdna/engine/evidence";
import { loadReadingEvidence } from "./choice-evidence";

export const REPORT_ENVELOPE_VERSION = "report-envelope-v1";

type Frozen = {
  synthesis?: string;
  signature?: { name: string; hook: string } | null;
  voice_version?: string;
  narration_status?: string;
  reveal?: { answered: number; twist: string | null; challenge: string } | null;
  archetype_v2?: { status: string; name?: string; archetype_id?: string; profile_version?: number; version?: number } | null;
};

export type ReportSession = {
  id: string;
  mode?: string | null;
  decade?: number | null;
  parent_session_id?: string | null;
  completed_at?: string | null;
};

export type ReportResultRow = { version: number; source: string; created_at?: string | null; content: unknown };

export function buildReportEnvelope(
  session: ReportSession,
  row: ReportResultRow,
  ledger: Ledger | null,
) {
  const c = (row.content ?? {}) as Frozen;
  const arch = c.archetype_v2 ?? null;
  const frozenArch =
    arch && arch.status !== "none" && arch.name
      ? { name: arch.name, status: arch.status as "confirmed" | "leaning" }
      : null;
  let dna: DnaSummary | null = null;
  if (ledger) dna = buildDnaSummary(ledger, frozenArch);
  return {
    contract: 1,
    envelope_version: REPORT_ENVELOPE_VERSION,
    status: "ok" as const,
    session: {
      session_id: session.id,
      mode: session.mode ?? "discover",
      decade: session.decade ?? null,
      parent_session_id: session.parent_session_id ?? null,
      completed_at: session.completed_at ?? null,
    },
    // Immutable: replayed from the saved result row, never regenerated.
    frozen: {
      result_version: row.version,
      source: row.source,
      saved_at: row.created_at ?? null,
      text: c.synthesis ?? "",
      voice_version: c.voice_version ?? null,
      narration_status: c.narration_status ?? "ok",
      signature: c.signature ?? null,
      signature_status: c.signature ? ("present" as const) : ("absent" as const),
      reveal: c.reveal ?? null,
      archetype: arch
        ? { saved_at_finalize: true as const, ...arch }
        : { saved_at_finalize: false as const, status: "not_saved" as const },
    },
    // Deterministic: recomputed from frozen choices; may gain wording fixes, never new evidence.
    annotations: ledger
      ? {
          status: "ok" as const,
          dna_summary_version: DNA_SUMMARY_VERSION,
          dna_summary: dna,
          challenge: c.reveal?.challenge ?? revealBeats(ledger).challenge,
          challenge_source: c.reveal ? ("frozen" as const) : ("derived" as const),
        }
      : { status: "unavailable" as const, dna_summary_version: DNA_SUMMARY_VERSION, dna_summary: null, challenge: c.reveal?.challenge ?? null, challenge_source: c.reveal ? ("frozen" as const) : null },
  };
}

export type ReportLookup =
  | { kind: "ok"; body: ReturnType<typeof buildReportEnvelope> }
  | { kind: "not_found" | "no_result" | "version_not_found" | "error"; message: string };

export async function loadReportEnvelope(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  version: number | null,
): Promise<ReportLookup> {
  const s = await supabase
    .from("sessions")
    .select("id, mode, decade, parent_session_id, completed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (s.error) return { kind: "error", message: "Session unavailable" };
  // RLS hides other owners' sessions: cross-owner reads are indistinguishable from missing.
  if (!s.data) return { kind: "not_found", message: "Session not found" };
  let q = supabase
    .from("session_results")
    .select("version, source, created_at, content")
    .eq("session_id", sessionId);
  q = version === null ? q.eq("source", "pairings").order("version", { ascending: true }) : q.eq("version", version);
  const r = await q.limit(1).maybeSingle();
  if (r.error) return { kind: "error", message: "Saved reading unavailable" };
  if (!r.data) {
    return version === null
      ? { kind: "no_result", message: "No saved reading for this session" }
      : { kind: "version_not_found", message: "Result version not found" };
  }
  let ledger: Ledger | null = null;
  try {
    ledger = (await loadReadingEvidence(supabase, sessionId)).ledger;
  } catch {
    ledger = null;
  }
  return { kind: "ok", body: buildReportEnvelope(s.data as ReportSession, r.data as ReportResultRow, ledger) };
}
