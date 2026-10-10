// Test harness for end-to-end agent runs against MusicDNA.
//
// Public, secret-gated HTTP endpoints that drive the same code paths the UI
// uses (commitOpeningThree → startSession → nextPairing × N → recordChoice ×
// N → finalizeSession → finalSynthesis → getMyResult) without requiring a
// real Supabase auth user. Each persona_id is a stable synthetic identity
// stored in public.test_runs with its own generated user_id.
//
// Auth: header `x-test-harness-secret: <AGENT_TEST_HARNESS_KEY>`. No bearer.
// All DB writes use the service-role admin client; RLS is bypassed.
//
// See /docs/test-harness.md for the full agent-facing API.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  commitOpeningThreeImpl,
  startSessionImpl,
  nextPairingImpl,
  recordChoiceImpl,
  finalizeSessionImpl,
  finalSynthesisImpl,
  getMyResultImpl,
} from "@/lib/musicdna.functions";

type Action = "opener" | "next" | "choice" | "report" | "reset" | "status" | "bearer";

const PERSONA_RE = /^[a-zA-Z0-9_.\-:]{1,80}$/;

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });

const err = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  json({ ok: false, error: message, ...extra }, { status });

function authorized(req: Request): boolean {
  const secret = process.env.AGENT_TEST_HARNESS_KEY;
  if (!secret) return false;
  const got = req.headers.get("x-test-harness-secret") ?? "";
  if (got.length !== secret.length) return false;
  // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getOrCreateRun(personaId: string, pairingCount?: number, reset = false) {
  const admin = await getAdmin();
  if (reset) {
    // Wipe everything for this persona: delete sessions/choices via cascade,
    // then clear the test_runs row's session pointers and counters.
    const existing = await admin
      .from("test_runs")
      .select("user_id, session_id")
      .eq("persona_id", personaId)
      .maybeSingle();
    if (existing.data?.user_id) {
      // Delete the user's sessions (choices cascade if FK is set; otherwise delete explicitly).
      const userId = existing.data.user_id;
      await admin
        .from("choices")
        .delete()
        .in(
          "session_id",
          (await admin.from("sessions").select("id").eq("user_id", userId)).data?.map(
            (s) => s.id,
          ) ?? [],
        );
      await admin.from("sessions").delete().eq("user_id", userId);
      await admin.from("session_reasoning").delete().eq("user_id", userId);
      await admin.from("event_log").delete().eq("user_id", userId);
      await admin.from("llm_calls").delete().eq("user_id", userId);
      await admin
        .from("profiles")
        .update({
          opening_songs: null,
          opening_hypothesis: null,
          opening_lane: null,
          opening_lane_confidence: null,
          opening_analysis_json: null,
        })
        .eq("user_id", userId);
      await admin
        .from("test_runs")
        .update({
          session_id: null,
          opener_songs: null,
          opener_payload: null,
          current_pairing_id: null,
          current_pairing_payload: null,
          choices_log: [],
          pairings_used: 0,
          ...(pairingCount ? { pairing_count: pairingCount } : {}),
          report: null,
        })
        .eq("persona_id", personaId);
    }
  }

  const existing = await admin
    .from("test_runs")
    .select("*")
    .eq("persona_id", personaId)
    .maybeSingle();
  if (existing.data) {
    if (pairingCount && pairingCount !== existing.data.pairing_count) {
      await admin
        .from("test_runs")
        .update({ pairing_count: pairingCount })
        .eq("persona_id", personaId);
      existing.data.pairing_count = pairingCount;
    }
    return existing.data;
  }

  // First contact for this persona: mint a real Supabase auth user so the
  // sessions.user_id FK to auth.users is satisfied. handle_new_user trigger
  // auto-creates the matching profile + user_role rows.
  const email = `persona-${personaId.toLowerCase().replace(/[^a-z0-9._-]/g, "_")}@test.musicdna.local`;
  let userId: string | null = null;

  const created = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + "-Aa1!",
    email_confirm: true,
    user_metadata: { persona_id: personaId, harness: true, display_name: `persona:${personaId}` },
  });
  if (created.data?.user?.id) {
    userId = created.data.user.id;
  } else {
    // Likely "User already registered" — look it up via listUsers.
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list.data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!found)
      throw new Error(`auth.admin.createUser failed: ${created.error?.message ?? "unknown"}`);
    userId = found.id;
  }

  const inserted = await admin
    .from("test_runs")
    .insert({ persona_id: personaId, pairing_count: pairingCount ?? 6, user_id: userId })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) {
    throw new Error(`test_runs insert failed: ${inserted.error?.message ?? "unknown"}`);
  }
  // Ensure profile/user_roles exist (trigger should have done it; belt-and-suspenders).
  await admin
    .from("profiles")
    .upsert({ user_id: userId, display_name: `persona:${personaId}` }, { onConflict: "user_id" });
  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "user" }, { onConflict: "user_id,role" });
  return inserted.data;
}

const OpenerBody = z.object({
  persona_id: z.string().regex(PERSONA_RE),
  songs: z.array(z.string().trim().min(1).max(200)).length(3),
  pairing_count: z.number().int().min(1).max(40).optional(),
  reset: z.boolean().optional(),
});

const PersonaOnly = z.object({ persona_id: z.string().regex(PERSONA_RE) });

const ChoiceBody = z.object({
  persona_id: z.string().regex(PERSONA_RE),
  pairing_id: z.string().uuid(),
  chosen_song_id: z.string().uuid(),
  ms_to_decide: z.number().int().nonnegative().max(600000).optional(),
});

async function handleOpener(req: Request) {
  const body = OpenerBody.parse(await req.json());
  const run = await getOrCreateRun(body.persona_id, body.pairing_count, body.reset ?? false);
  const admin = await getAdmin();
  const opener = await commitOpeningThreeImpl(admin, run.user_id, { songs: body.songs });
  await admin
    .from("test_runs")
    .update({
      opener_songs: body.songs,
      opener_payload: opener as never,
    })
    .eq("persona_id", body.persona_id);
  return json({
    ok: true,
    persona_id: body.persona_id,
    user_id: run.user_id,
    pairing_count: run.pairing_count,
    opener,
  });
}

async function handleNext(req: Request) {
  const body = PersonaOnly.parse(await req.json());
  const admin = await getAdmin();
  const run = await admin
    .from("test_runs")
    .select("*")
    .eq("persona_id", body.persona_id)
    .maybeSingle();
  if (!run.data) return err(404, "unknown persona_id — call /opener first");

  let sessionId = run.data.session_id;
  if (!sessionId) {
    const s = await startSessionImpl(admin, run.data.user_id);
    sessionId = s.sessionId;
    await admin
      .from("test_runs")
      .update({ session_id: sessionId })
      .eq("persona_id", body.persona_id);
  }

  // Honor the agent-chosen pairing_count: stop early if we've already hit it.
  if (run.data.pairings_used >= run.data.pairing_count) {
    return json({
      ok: true,
      persona_id: body.persona_id,
      session_id: sessionId,
      pairing: null,
      round: run.data.pairings_used,
      done: true,
      reason: "pairing_count reached",
    });
  }

  const np = await nextPairingImpl(admin, { sessionId });
  if (np.pairing) {
    await admin
      .from("test_runs")
      .update({
        current_pairing_id: np.pairing.id,
        current_pairing_payload: np.pairing as never,
      })
      .eq("persona_id", body.persona_id);
  }
  return json({
    ok: true,
    persona_id: body.persona_id,
    session_id: sessionId,
    round: np.round,
    confidence: np.confidence,
    done: np.done,
    pairing: np.pairing
      ? {
          pairing_id: np.pairing.id,
          tests: np.pairing.tests,
          song_a: np.pairing.song_a,
          song_b: np.pairing.song_b,
        }
      : null,
    pairings_used: run.data.pairings_used,
    pairing_count: run.data.pairing_count,
  });
}

async function handleChoice(req: Request) {
  const body = ChoiceBody.parse(await req.json());
  const admin = await getAdmin();
  const run = await admin
    .from("test_runs")
    .select("*")
    .eq("persona_id", body.persona_id)
    .maybeSingle();
  if (!run.data) return err(404, "unknown persona_id");
  if (!run.data.session_id) return err(400, "no active session — call /next first");

  const reveal = await recordChoiceImpl(admin, run.data.user_id, {
    sessionId: run.data.session_id,
    pairingId: body.pairing_id,
    chosenSongId: body.chosen_song_id,
    msToDecide: body.ms_to_decide,
  });

  const log = Array.isArray(run.data.choices_log) ? (run.data.choices_log as unknown[]) : [];
  log.push({
    pairing_id: body.pairing_id,
    chosen_song_id: body.chosen_song_id,
    ms_to_decide: body.ms_to_decide ?? null,
    reveal,
    at: new Date().toISOString(),
  });
  await admin
    .from("test_runs")
    .update({
      pairings_used: (run.data.pairings_used ?? 0) + 1,
      choices_log: log as never,
      current_pairing_id: null,
      current_pairing_payload: null,
    })
    .eq("persona_id", body.persona_id);

  return json({
    ok: true,
    persona_id: body.persona_id,
    pairings_used: (run.data.pairings_used ?? 0) + 1,
    pairing_count: run.data.pairing_count,
    reveal,
  });
}

async function handleReport(req: Request) {
  const body = PersonaOnly.parse(await req.json());
  const admin = await getAdmin();
  const run = await admin
    .from("test_runs")
    .select("*")
    .eq("persona_id", body.persona_id)
    .maybeSingle();
  if (!run.data) return err(404, "unknown persona_id");
  if (!run.data.session_id) return err(400, "no session to finalize");

  const finalize = await finalizeSessionImpl(admin, run.data.user_id, {
    sessionId: run.data.session_id,
  });
  const synth = await finalSynthesisImpl(admin, run.data.user_id, {
    sessionId: run.data.session_id,
  });
  const result = await getMyResultImpl(admin, run.data.user_id);

  const report = { finalize, synth, result };
  await admin
    .from("test_runs")
    .update({ report: report as never })
    .eq("persona_id", body.persona_id);
  return json({
    ok: true,
    persona_id: body.persona_id,
    session_id: run.data.session_id,
    ...report,
  });
}

async function handleReset(req: Request) {
  const body = PersonaOnly.parse(await req.json());
  await getOrCreateRun(body.persona_id, undefined, true);
  return json({ ok: true, persona_id: body.persona_id, reset: true });
}

async function handleStatus(req: Request) {
  const url = new URL(req.url);
  const personaId = url.searchParams.get("persona_id") ?? "";
  if (!PERSONA_RE.test(personaId)) return err(400, "persona_id required as query param");
  const admin = await getAdmin();
  const run = await admin.from("test_runs").select("*").eq("persona_id", personaId).maybeSingle();
  if (!run.data) return err(404, "unknown persona_id");
  return json({ ok: true, run: run.data });
}

// Mint a fresh Supabase access token for a persona, so agent e2e tests can
// hit the real bearer-protected /api/v1/* routes end-to-end. Resets the
// user's password to a known value then signs in — service-role only, gated
// by AGENT_TEST_HARNESS_KEY.
async function handleBearer(req: Request) {
  const body = PersonaOnly.parse(await req.json());
  const admin = await getAdmin();
  const run = await admin
    .from("test_runs")
    .select("user_id")
    .eq("persona_id", body.persona_id)
    .maybeSingle();
  if (!run.data?.user_id) {
    return err(404, "unknown persona_id — call /opener first");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const email = `persona-${body.persona_id.toLowerCase().replace(/[^a-z0-9._-]/g, "_")}@test.musicdna.local`;
  const password = `${body.persona_id}-Harness-${run.data.user_id.slice(0, 8)}!Aa1`;
  const updated = await admin.auth.admin.updateUserById(run.data.user_id, { password });
  if (updated.error) return err(500, `password reset failed: ${updated.error.message}`);

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return err(500, "SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing");
  const client = createClient(url, anon, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    return err(500, `signInWithPassword failed: ${signIn.error?.message ?? "no session"}`);
  }
  return json({
    ok: true,
    persona_id: body.persona_id,
    user_id: run.data.user_id,
    access_token: signIn.data.session.access_token,
    expires_at: signIn.data.session.expires_at ?? null,
  });
}

async function dispatch(req: Request, action: string) {
  if (!authorized(req)) return err(401, "invalid or missing x-test-harness-secret");
  try {
    switch (action as Action) {
      case "opener":
        return await handleOpener(req);
      case "next":
        return await handleNext(req);
      case "choice":
        return await handleChoice(req);
      case "report":
        return await handleReport(req);
      case "reset":
        return await handleReset(req);
      case "status":
        return await handleStatus(req);
      case "bearer":
        return await handleBearer(req);
      default:
        return err(404, `unknown action: ${action}`);
    }
  } catch (e) {
    if (e instanceof z.ZodError) return err(400, "validation failed", { issues: e.issues });
    const message = e instanceof Error ? e.message : String(e);
    return err(500, message);
  }
}

export const Route = createFileRoute("/api/public/test/$action")({
  server: {
    handlers: {
      GET: async ({ request, params }) => dispatch(request, params.action),
      POST: async ({ request, params }) => dispatch(request, params.action),
    },
  },
});
