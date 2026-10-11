// Chronological session history (READ03 / NFR01). One builder for the web
// resume and GET /api/v1/session/:id, so both clients restore the same
// conversation: picks with their committed feedback, the reads that were
// shown (incl. revisions), skips and reactions.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  EvidenceSnapshot,
  snapshotChoice,
  type EvidenceRow,
} from "@/musicdna/engine/evidence-snapshot";

type Client = SupabaseClient<Database>;
export type HistSong = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  lane: string | null;
};
export type HistPairing = {
  id: string;
  tests: string[];
  diagnostic_weight: number;
  song_a: HistSong;
  song_b: HistSong;
};

export type Exchange =
  | {
      type: "choice";
      at: string;
      pairing_id: string;
      pairing: HistPairing | null;
      chosen: HistSong | null;
      rejected: HistSong | null;
      feedback: { verdict: string; why: string } | null;
      evidence_source?: "pairing" | "legacy_unavailable" | "invalid_snapshot";
    }
  | {
      type: "read";
      at: string;
      answered: number | null;
      tier: string | null;
      thesis: string | null;
      direction: string | null;
      revised: boolean;
      revision: Record<string, string | number | boolean | null | Record<string, string>> | null;
    }
  | { type: "skip"; at: string; pairing_id: string | null; reason: string | null }
  | { type: "reaction"; at: string; kind: string | null };

export async function loadSessionHistory(client: Client, sessionId: string): Promise<Exchange[]> {
  const songCols = "id,title,artist,year,lane";
  const [choicesRes, eventsRes] = await Promise.all([
    client
      .from("choices")
      .select(
        `id, session_id, pairing_id, chosen_song_id, rejected_song_id, created_at, evidence, response, chosen:chosen_song_id(${songCols}), rejected:rejected_song_id(${songCols}), pairing:pairing_id(id, tests, diagnostic_weight, song_a:songs!pairings_song_a_id_fkey(${songCols}), song_b:songs!pairings_song_b_id_fkey(${songCols}))`,
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    client
      .from("event_log")
      .select("event_type, pairing_id, created_at, props")
      .eq("session_id", sessionId)
      .in("event_type", ["read_shown", "pairing_skipped", "reaction_submitted"])
      .order("created_at", { ascending: true }),
  ]);
  if (choicesRes.error) throw new Error(choicesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);
  const out: Exchange[] = [];
  type CRow = EvidenceRow & {
    pairing_id: string;
    created_at: string;
    response: { verdict?: string; why?: string } | null;
    chosen: HistSong | null;
    rejected: HistSong | null;
    pairing: HistPairing | null;
  };
  for (const c of (choicesRes.data ?? []) as unknown as CRow[]) {
    const frozen = snapshotChoice(c);
    const parsed = EvidenceSnapshot.safeParse(c.evidence);
    let chosen = c.evidence == null ? c.chosen : null;
    let rejected = c.evidence == null ? c.rejected : null;
    let pairing = c.evidence == null ? c.pairing : null;
    if (frozen.provenance === "pairing" && parsed.success) {
      const s = parsed.data;
      chosen = {
        id: s.catalog.chosen.id,
        title: s.catalog.chosen.title,
        artist: s.catalog.chosen.artist,
        year: s.catalog.chosen.year,
        lane: s.catalog.chosen.lane,
      };
      rejected = {
        id: s.catalog.rejected.id,
        title: s.catalog.rejected.title,
        artist: s.catalog.rejected.artist,
        year: s.catalog.rejected.year,
        lane: s.catalog.rejected.lane,
      };
      pairing = {
        id: c.pairing_id,
        tests: s.catalog.tests,
        diagnostic_weight: s.catalog.diagnostic_weight ?? 50,
        song_a: s.song_a_id === rejected.id ? rejected : chosen,
        song_b: s.song_a_id === rejected.id ? chosen : rejected,
      };
    }
    out.push({
      type: "choice",
      at: c.created_at,
      pairing_id: c.pairing_id,
      pairing,
      chosen,
      rejected,
      evidence_source: frozen.provenance,
      feedback: c.response
        ? { verdict: c.response.verdict ?? "", why: c.response.why ?? "" }
        : null,
    });
  }
  type ERow = {
    event_type: string;
    pairing_id: string | null;
    created_at: string;
    props: Record<string, unknown> | null;
  };
  for (const e of (eventsRes.data ?? []) as ERow[]) {
    const p = e.props ?? {};
    if (e.event_type === "read_shown") {
      out.push({
        type: "read",
        at: e.created_at,
        answered: typeof p.answered === "number" ? p.answered : null,
        tier: (p.tier as string) ?? null,
        thesis: (p.thesis as string) ?? null,
        direction: p.revised ? "revising" : null,
        revised: !!p.revised,
        revision: (p.revision ?? null) as never,
      });
    } else if (e.event_type === "pairing_skipped") {
      out.push({
        type: "skip",
        at: e.created_at,
        pairing_id: e.pairing_id,
        reason: (p.reason as string) ?? null,
      });
    } else {
      out.push({ type: "reaction", at: e.created_at, kind: (p.kind as string) ?? null });
    }
  }
  out.sort((a, b) => a.at.localeCompare(b.at));
  return out;
}
