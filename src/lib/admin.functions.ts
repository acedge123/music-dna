import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_TABLES = ["songs", "pairings", "archetypes"] as const;
type AdminTable = (typeof ADMIN_TABLES)[number];

// JSON value tree that TanStack's serializer accepts.
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type JsonRow = { [k: string]: Json };

async function assertAdminAndGetClient(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
  return supabaseAdmin;
}

export const adminCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; userId: string; reason?: string }> => {
    // Use the authed client — RLS lets users read their own user_roles rows.
    // Avoids requiring SUPABASE_SERVICE_ROLE_KEY just to render the nav.
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) return { isAdmin: false, userId: context.userId, reason: `db: ${error.message}` };
    if (!data) return { isAdmin: false, userId: context.userId };
    return { isAdmin: true, userId: context.userId };
  });


export const adminList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table: z.enum(ADMIN_TABLES),
      search: z.string().max(120).optional(),
      lane: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const table = data.table as AdminTable;

    // Build query dynamically; cast through any because table is a runtime union.
    // Pairings read from the pairings_with_songs view so titles/artists are
    // joined in — the base pairings table only stores UUIDs. Writes still hit
    // the base table via adminUpsert/adminDelete/adminSetDiagnosticWeight.
    const readSource = table === "pairings" ? "pairings_with_songs" : table;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (admin as any).from(readSource).select("*").limit(500);
    if (table === "songs") {
      q = q.order("artist", { ascending: true }).order("title", { ascending: true });
      if (data.search) {
        // Strip LIKE wildcards and PostgREST .or() syntax characters so user
        // input can't escape into another filter expression.
        const s = data.search.replace(/[%_,()."*\\]/g, "").trim();
        if (s) q = q.or(`title.ilike.%${s}%,artist.ilike.%${s}%`);
      }
      if (data.lane) q = q.eq("primary_lane", data.lane);
    } else if (table === "pairings") {
      q = q.order("diagnostic_weight", { ascending: false });
      if (data.lane) q = q.eq("lane", data.lane);
    } else {
      q = q.order("name", { ascending: true });
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let out = (rows ?? []) as JsonRow[];

    // For pairings, join in recognition metrics from the pairing_recognition
    // view so curators can see min_canon / avg_canon / era_bucket /
    // recognition_score alongside the diagnostic fields.
    if (table === "pairings" && out.length > 0) {
      const ids = out.map((r) => String((r as { id?: unknown }).id)).filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recRes = await (admin as any)
        .from("pairing_recognition")
        .select("pairing_id, min_canon, avg_canon, recognition_score, era_bucket, era_span_years, cross_subculture, shared_subcultures")
        .in("pairing_id", ids);
      const byId = new Map<string, Record<string, unknown>>();
      for (const r of (recRes.data ?? []) as Array<Record<string, unknown>>) {
        byId.set(String(r.pairing_id), r);
      }
      out = out.map((row) => {
        const extra = byId.get(String((row as { id?: unknown }).id)) ?? {};
        return { ...row, ...extra } as JsonRow;
      });
    }

    return { rows: out };
  });

// Per-table input shape — accept arbitrary JSON, validate critical fields server-side.
const RowSchema = z.record(z.string(), z.unknown());

export const adminUpsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table: z.enum(ADMIN_TABLES),
      id: z.string().uuid().nullable().optional(),
      row: RowSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const row = { ...data.row };

    // Strip system columns the caller shouldn't overwrite.
    delete row.id;
    delete row.created_at;
    delete row.updated_at;

    if (data.id) {
      const { error } = await admin
        .from(data.table)
        .update(row as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, created: false as const };
    }
    const { data: ins, error } = await admin
      .from(data.table)
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id, created: true as const };
  });

export const adminDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table: z.enum(ADMIN_TABLES),
      id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const { error } = await admin.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Inline editor for pairings: diagnostic_weight, active, and is_bootstrap.
// is_bootstrap marks a pairing as usable in the first 2 rounds of a
// general-lane session so we can promote the session to a real lane.
export const adminSetDiagnosticWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      diagnostic_weight: z.number().int().min(0).max(100),
      active: z.boolean().optional(),
      is_bootstrap: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const patch: { diagnostic_weight: number; active?: boolean; is_bootstrap?: boolean } = {
      diagnostic_weight: data.diagnostic_weight,
    };
    if (data.active !== undefined) patch.active = data.active;
    if (data.is_bootstrap !== undefined) patch.is_bootstrap = data.is_bootstrap;
    const { error } = await admin.from("pairings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// --------- Residual review queue ---------
// Sessions where the archetype match didn't clear the confidence bar.
// This is the "did any listener escape all current archetypes?" queue:
// - low_score: best cosine < floor (no archetype really fit)
// - ambiguous: top 2 within margin (the ontology can't distinguish them)
// - no_archetypes: catalog was empty
// Also returns a stats summary so the admin can watch the residual rate
// trend over time — new archetypes should be born from this, not vibes.
export const adminResidualQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      limit: z.number().int().min(1).max(200).default(50),
      reason: z.enum(["low_score", "ambiguous", "no_archetypes", "any"]).default("any"),
      lane: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);

    // Totals for the residual rate — completed sessions vs flagged ones.
    const totalP = admin.from("sessions").select("id", { count: "exact", head: true })
      .not("completed_at", "is", null);
    const flaggedP = admin.from("sessions").select("id", { count: "exact", head: true })
      .eq("archetype_flagged", true);
    const [totalRes, flaggedRes] = await Promise.all([totalP, flaggedP]);
    if (totalRes.error) throw new Error(totalRes.error.message);
    if (flaggedRes.error) throw new Error(flaggedRes.error.message);

    // Per-reason counts.
    const reasons: Record<string, number> = { low_score: 0, ambiguous: 0, no_archetypes: 0 };
    for (const r of Object.keys(reasons)) {
      const { count, error } = await admin.from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("archetype_flagged", true)
        .eq("archetype_flag_reason", r);
      if (error) throw new Error(error.message);
      reasons[r] = count ?? 0;
    }

    let q = admin.from("sessions")
      .select("id, user_id, lane, lane_confidence, completed_at, archetype_top3, archetype_score, archetype_margin, archetype_flag_reason, share_token")
      .eq("archetype_flagged", true)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.reason !== "any") q = q.eq("archetype_flag_reason", data.reason);
    if (data.lane) q = q.eq("lane", data.lane);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return {
      total: totalRes.count ?? 0,
      flagged: flaggedRes.count ?? 0,
      reasons,
      rows: (rows ?? []) as JsonRow[],
    };
  });

// --------- Ontology dashboard: the "am I learning?" view ---------
// Not for users. For us. Aggregates coverage (catalog shape), heatmap
// (where listeners actually land), and pairing/song health (which
// matchups + songs are earning their keep). All read-only.
export const adminOntology = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdminAndGetClient(context.userId);

    // ---- catalog ----
    const songsRes = await admin.from("songs")
      .select("id, title, artist, primary_lane, archetype_signals, active")
      .limit(5000);
    if (songsRes.error) throw new Error(songsRes.error.message);
    const songs = songsRes.data ?? [];

    const pairingsRes = await admin.from("pairings")
      .select("id, song_a_id, song_b_id, lane, diagnostic_weight, active, expected_split, user_facing_tradeoff, hypothesis, difficulty")
      .limit(5000);
    if (pairingsRes.error) throw new Error(pairingsRes.error.message);
    const pairings = pairingsRes.data ?? [];

    const archRes = await admin.from("archetypes").select("id, name").limit(500);
    if (archRes.error) throw new Error(archRes.error.message);
    const archetypes = archRes.data ?? [];

    // ---- session-scale data (bounded — most recent 5k choices, 2k sessions) ----
    const sessionsRes = await admin.from("sessions")
      .select("id, lane, archetype_id, archetype_score, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(2000);
    if (sessionsRes.error) throw new Error(sessionsRes.error.message);
    const sessions = sessionsRes.data ?? [];

    const choicesRes = await admin.from("choices")
      .select("pairing_id, chosen_song_id, rejected_song_id, ms_to_decide")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (choicesRes.error) throw new Error(choicesRes.error.message);
    const choices = choicesRes.data ?? [];

    // ---- coverage: lane × archetype-signal from the catalog ----
    // songs.archetype_signals is a free-form array; we count each signal
    // that matches a known archetype name (case-insensitive slug match).
    const archNames = archetypes.map((a) => ({ id: a.id, name: a.name, key: a.name.toLowerCase() }));
    const laneList = new Set<string>();
    const coverage: Record<string, Record<string, number>> = {};
    const laneSongCount: Record<string, number> = {};
    for (const s of songs) {
      const lane = (s.primary_lane as string | null) || "general";
      laneList.add(lane);
      laneSongCount[lane] = (laneSongCount[lane] ?? 0) + 1;
      coverage[lane] ??= {};
      const sigs = (s.archetype_signals as string[] | null) ?? [];
      for (const sig of sigs) {
        const k = String(sig).toLowerCase();
        const match = archNames.find((a) => k.includes(a.key) || a.key.includes(k));
        const label = match?.name ?? sig;
        coverage[lane][label] = (coverage[lane][label] ?? 0) + 1;
      }
    }

    // ---- heatmap: lane × winning archetype from real sessions ----
    const archById = new Map(archetypes.map((a) => [a.id, a.name]));
    const heatmap: Record<string, Record<string, number>> = {};
    const laneSessionCount: Record<string, number> = {};
    let unassigned = 0;
    for (const sess of sessions) {
      const lane = (sess.lane as string | null) || "general";
      laneList.add(lane);
      laneSessionCount[lane] = (laneSessionCount[lane] ?? 0) + 1;
      const archName = archById.get(sess.archetype_id as string) ?? null;
      if (!archName) { unassigned++; continue; }
      heatmap[lane] ??= {};
      heatmap[lane][archName] = (heatmap[lane][archName] ?? 0) + 1;
    }

    // ---- pairing health ----
    const songById = new Map(songs.map((s) => [s.id as string, s]));
    const pairingStats = new Map<string, { picks_a: number; picks_b: number; total: number; ms_sum: number; ms_n: number }>();
    for (const c of choices) {
      const pid = c.pairing_id as string;
      if (!pid) continue;
      const p = pairings.find((pr) => pr.id === pid);
      if (!p) continue;
      const st = pairingStats.get(pid) ?? { picks_a: 0, picks_b: 0, total: 0, ms_sum: 0, ms_n: 0 };
      if (c.chosen_song_id === p.song_a_id) st.picks_a++;
      else if (c.chosen_song_id === p.song_b_id) st.picks_b++;
      st.total++;
      const ms = c.ms_to_decide as number | null;
      if (typeof ms === "number" && ms > 0 && ms < 60_000) { st.ms_sum += ms; st.ms_n++; }
      pairingStats.set(pid, st);
    }

    const pairingHealth = pairings
      .map((p) => {
        const st = pairingStats.get(p.id as string);
        const total = st?.total ?? 0;
        const splitA = total ? (st!.picks_a / total) : null;
        // Info gain proxy: balanced splits (~50/50) are more diagnostic.
        // Score 0..100; 50/50 → 100, 100/0 → 0. Only meaningful once we
        // have a real sample; keep null under 5 choices.
        const infoGain = splitA != null && total >= 5
          ? Math.round((1 - Math.abs(splitA - 0.5) * 2) * 100)
          : null;
        const avgMs = st && st.ms_n ? Math.round(st.ms_sum / st.ms_n) : null;
        const a = songById.get(p.song_a_id as string);
        const b = songById.get(p.song_b_id as string);
        return {
          id: p.id as string,
          lane: (p.lane as string | null) || "general",
          diagnostic_weight: p.diagnostic_weight as number | null,
          active: p.active as boolean,
          expected_split: p.expected_split as string | null,
          user_facing_tradeoff: (p.user_facing_tradeoff as string | null) ?? null,
          hypothesis: (p.hypothesis as string | null) ?? null,
          difficulty: (p.difficulty as string | null) ?? null,
          a_title: a ? `${a.title} — ${a.artist}` : "?",
          b_title: b ? `${b.title} — ${b.artist}` : "?",
          a_song: a ? { title: a.title, artist: a.artist } : null,
          b_song: b ? { title: b.title, artist: b.artist } : null,
          picks_a: st?.picks_a ?? 0,
          picks_b: st?.picks_b ?? 0,
          total,
          split_a_pct: splitA != null ? Math.round(splitA * 100) : null,
          avg_ms: avgMs,
          info_gain: infoGain,
        };
      })
      .sort((x, y) => (y.total - x.total));

    // ---- song health ----
    const songStats = new Map<string, { appearances: number; chosen: number; ms_sum: number; ms_n: number; info_sum: number; info_n: number }>();
    for (const c of choices) {
      const pid = c.pairing_id as string;
      const p = pairings.find((pr) => pr.id === pid);
      if (!p) continue;
      const stAll = pairingStats.get(pid);
      const infoGain = stAll && stAll.total >= 5
        ? (1 - Math.abs(stAll.picks_a / stAll.total - 0.5) * 2) * 100
        : null;
      for (const sid of [p.song_a_id, p.song_b_id]) {
        if (!sid) continue;
        const st = songStats.get(sid as string) ?? { appearances: 0, chosen: 0, ms_sum: 0, ms_n: 0, info_sum: 0, info_n: 0 };
        st.appearances++;
        if (c.chosen_song_id === sid) st.chosen++;
        const ms = c.ms_to_decide as number | null;
        if (typeof ms === "number" && ms > 0 && ms < 60_000) { st.ms_sum += ms; st.ms_n++; }
        if (infoGain != null) { st.info_sum += infoGain; st.info_n++; }
        songStats.set(sid as string, st);
      }
    }
    const songHealth = Array.from(songStats.entries())
      .map(([sid, st]) => {
        const s = songById.get(sid);
        return {
          id: sid,
          title: s?.title ?? "?",
          artist: s?.artist ?? "?",
          lane: (s?.primary_lane as string | null) ?? "general",
          appearances: st.appearances,
          chosen_pct: st.appearances ? Math.round((st.chosen / st.appearances) * 100) : 0,
          avg_ms: st.ms_n ? Math.round(st.ms_sum / st.ms_n) : null,
          info_contribution: st.info_n ? Math.round(st.info_sum / st.info_n) : null,
        };
      })
      .sort((x, y) => y.appearances - x.appearances);

    return {
      lanes: Array.from(laneList).sort(),
      archetype_names: archetypes.map((a) => a.name).sort(),
      lane_song_count: laneSongCount,
      lane_session_count: laneSessionCount,
      unassigned_sessions: unassigned,
      totals: {
        songs: songs.length,
        active_songs: songs.filter((s) => s.active).length,
        pairings: pairings.length,
        active_pairings: pairings.filter((p) => p.active).length,
        archetypes: archetypes.length,
        sessions_sampled: sessions.length,
        choices_sampled: choices.length,
      },
      coverage,
      heatmap,
      pairing_health: pairingHealth,
      song_health: songHealth,
    };
  });


// ============ Diagnostics ============
// Reads the read-only views defined in the instrumentation migration.
// Requires admin; uses the service-role client so the security_invoker views
// return cross-session rows regardless of the caller's RLS.
// See docs/musicdna/instrumentation.md for the field contract.
export const adminDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    // The views aren't in the generated Database type until the migration runs,
    // and even after they will only ever be read here — cast to any at the
    // boundary rather than pollute the typed client surface.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;

    const [stability, independence, contradiction, residual, agreement] = await Promise.all([
      db.from("v_session_stability").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("v_axis_independence").select("*").limit(500),
      db.from("v_contradiction_load").select("*").limit(500),
      db.from("v_residual_rate").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("v_human_agreement").select("*").limit(500),
    ]);

    // Any of these can 404 pre-migration; surface a shape the UI can render
    // instead of throwing so the rest of the admin still works.
    type Res = { data: unknown[] | null; error: { message?: string } | null };
    const rows = (res: Res) =>
      res.error ? { rows: [] as JsonRow[], error: res.error.message ?? "unknown" }
                : { rows: (res.data ?? []) as JsonRow[], error: null };

    // Derived headline numbers — pre-aggregated so the UI stays simple.
    const residualRows = rows(residual).rows as Array<{ residual?: boolean | null }>;
    const finalCount = residualRows.length;
    const residualCount = residualRows.filter((r) => r.residual === true).length;

    const agreementRows = rows(agreement).rows as Array<{ accuracy?: string | null }>;
    const withFeedback = agreementRows.filter((r) => r.accuracy != null);
    const accurate = withFeedback.filter((r) => r.accuracy === "accurate").length;

    return {
      headline: {
        sessions_final: finalCount,
        residual_rate: finalCount > 0 ? Math.round((residualCount / finalCount) * 1000) / 1000 : null,
        feedback_captured: withFeedback.length,
        accuracy_rate: withFeedback.length > 0 ? Math.round((accurate / withFeedback.length) * 1000) / 1000 : null,
      },
      session_stability: rows(stability),
      axis_independence: rows(independence),
      contradiction_load: rows(contradiction),
      residual_rate: rows(residual),
      human_agreement: rows(agreement),
    };
  });


// ============ Shadow router telemetry (Step 1 of Agent Brain integration) ============
// Reads the `regime_recommended` events written fire-and-forget by
// nextPairingImpl, plus supporting `choice_scored` events, and returns the
// baseline distributions the plan calls for: regime mix, feature mix,
// per-round drift, and empirical compound-reachability. Read-only; the
// selector remains untouched. See docs/musicdna/agent-brain-integration-plan.md
// Step 1 for the acceptance criteria this powers.
const CONFIDENT_AXIS_THRESHOLD = 20; // |vector - 50| >= 20 → axis is "confident"

export const adminShadowRouter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      days: z.number().int().min(1).max(90).default(30),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;

    const [regimeRes, choiceRes, skipRes, sessionRes] = await Promise.all([
      db.from("event_log")
        .select("session_id, pairing_id, created_at, props")
        .eq("event_type", "regime_recommended")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      db.from("event_log")
        .select("session_id, created_at, props")
        .eq("event_type", "choice_scored")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      db.from("event_log")
        .select("session_id, created_at")
        .eq("event_type", "pairing_skipped")
        .gte("created_at", since)
        .limit(5000),
      db.from("sessions")
        .select("id, lane, lane_confidence, completed_at, archetype_margin, vector, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    type Row = { session_id: string | null; pairing_id?: string | null; created_at: string; props: Record<string, unknown> | null };
    const regimeRows = (regimeRes.data ?? []) as Row[];
    const choiceRows = (choiceRes.data ?? []) as Row[];
    const skipRows = (skipRes.data ?? []) as Row[];
    const sessions = (sessionRes.data ?? []) as Array<{
      id: string;
      lane: string | null;
      lane_confidence: number | null;
      completed_at: string | null;
      archetype_margin: number | null;
      vector: Record<string, number> | null;
      created_at: string;
    }>;

    // ---- Regime distribution + confidence ----
    const regimeCounts: Record<string, number> = { explore: 0, prune: 0, compound: 0, coordinate: 0 };
    const featureCounts: Record<string, Record<string, number>> = {
      uncertainty: {}, ruggedness: {}, local_minima_risk: {}, branching_factor: {}, mode_pressure: {},
    };
    const perRound: Record<number, Record<string, number>> = {};
    let confidenceSum = 0;
    let confidenceN = 0;
    const uniqSessions = new Set<string>();

    for (const r of regimeRows) {
      const p = r.props ?? {};
      const regime = String((p as { regime?: unknown }).regime ?? "");
      if (regime && regime in regimeCounts) regimeCounts[regime]++;
      const conf = Number((p as { confidence?: unknown }).confidence);
      if (Number.isFinite(conf)) { confidenceSum += conf; confidenceN++; }
      if (r.session_id) uniqSessions.add(r.session_id);

      const fs = ((p as { features_summary?: Record<string, unknown> }).features_summary ?? {}) as Record<string, unknown>;
      for (const k of Object.keys(featureCounts)) {
        const v = String(fs[k] ?? "");
        if (v) featureCounts[k][v] = (featureCounts[k][v] ?? 0) + 1;
      }
      const round = Number((fs as { round?: unknown }).round ?? -1);
      if (round >= 0 && regime) {
        perRound[round] ??= { explore: 0, prune: 0, compound: 0, coordinate: 0 };
        perRound[round][regime] = (perRound[round][regime] ?? 0) + 1;
      }
    }

    // ---- Compound reachability (D1): per-session peak count of |vec-50| ≥ THRESHOLD ----
    // We use the final session.vector as the "peak" — sessions still in flight
    // are included but under-represented, which biases the estimate low
    // (conservative for reachability claims).
    const peakBuckets: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0, "4+": 0 };
    let sessionsWithVector = 0;
    let completedSessions = 0;
    for (const s of sessions) {
      if (s.completed_at) completedSessions++;
      const v = s.vector;
      if (!v || typeof v !== "object") continue;
      sessionsWithVector++;
      let confident = 0;
      for (const val of Object.values(v)) {
        if (typeof val === "number" && Math.abs(val - 50) >= CONFIDENT_AXIS_THRESHOLD) confident++;
      }
      const key = confident >= 4 ? "4+" : String(confident);
      peakBuckets[key] = (peakBuckets[key] ?? 0) + 1;
    }

    // ---- Axis coverage: how often each axis appears in axes_tested ----
    const axisCounts: Record<string, number> = {};
    let choiceCount = 0;
    for (const c of choiceRows) {
      const axes = ((c.props as { axes_tested?: unknown })?.axes_tested ?? []) as unknown[];
      if (!Array.isArray(axes)) continue;
      choiceCount++;
      for (const a of axes) {
        const k = String(a);
        axisCounts[k] = (axisCounts[k] ?? 0) + 1;
      }
    }

    // ---- Empty-reveal proxy: completed sessions whose vector never left 50 on ANY axis ----
    let flatSessions = 0;
    for (const s of sessions) {
      if (!s.completed_at || !s.vector) continue;
      const anyMoved = Object.values(s.vector).some(
        (v) => typeof v === "number" && Math.abs(v - 50) >= 5,
      );
      if (!anyMoved) flatSessions++;
    }

    return {
      window_days: data.days,
      totals: {
        regime_events: regimeRows.length,
        unique_sessions: uniqSessions.size,
        choice_events: choiceCount,
        skip_events: skipRows.length,
        sessions_in_window: sessions.length,
        sessions_completed: completedSessions,
      },
      regime_distribution: regimeCounts,
      avg_confidence: confidenceN > 0 ? Math.round((confidenceSum / confidenceN) * 1000) / 1000 : null,
      feature_distribution: featureCounts,
      per_round: perRound,
      compound_reachability: {
        threshold: CONFIDENT_AXIS_THRESHOLD,
        sessions_measured: sessionsWithVector,
        buckets: peakBuckets,
      },
      axis_coverage: axisCounts,
      empty_reveal: {
        completed: completedSessions,
        flat: flatSessions,
        rate: completedSessions > 0 ? Math.round((flatSessions / completedSessions) * 1000) / 1000 : null,
      },
    };
  });
