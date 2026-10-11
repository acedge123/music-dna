// End-to-end test: drive the real /api/v1/* REST loop over HTTP.
//
// Not part of the default engine test run. This suite:
//   1. Boots a persona via /api/public/test/opener (harness bypasses auth,
//      seeds a real Supabase user + profile analysis).
//   2. Mints a fresh access token via /api/public/test/bearer.
//   3. Hits the real bearer-protected REST v1 routes end-to-end:
//        POST /api/v1/session
//        GET  /api/v1/session/:id/next
//        POST /api/v1/session/:id/choice   (loop)
//        POST /api/v1/session/:id/reveal
//        GET  /api/v1/share/:token
//
// It runs only when both env vars are present:
//   MUSICDNA_E2E_BASE_URL    e.g. http://localhost:8080 or the preview URL
//   AGENT_TEST_HARNESS_KEY   same secret the harness reads server-side
//
// Otherwise it self-skips so `bun test` / `vitest run` stay green offline.

import { describe, expect, it } from "vitest";

const BASE_URL = process.env.MUSICDNA_E2E_BASE_URL?.replace(/\/+$/, "");
const HARNESS_KEY = process.env.AGENT_TEST_HARNESS_KEY;
const shouldRun = Boolean(BASE_URL && HARNESS_KEY);

// Deterministic persona per suite run so retries can inspect it via /status.
const PERSONA_ID = `e2e_v1_${Date.now().toString(36)}`;
const OPENER_SONGS = [
  "Fake Empire - The National",
  "Dreams - Fleetwood Mac",
  "Space Song - Beach House",
];
const MAX_ROUNDS = 12;

type Json = Record<string, unknown>;

async function harness(action: string, body: Json): Promise<Json> {
  const res = await fetch(`${BASE_URL}/api/public/test/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-harness-secret": HARNESS_KEY!,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`harness ${action} ${res.status}: ${text}`);
  return JSON.parse(text) as Json;
}

async function v1(
  path: string,
  init: RequestInit,
  token?: string,
): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  const text = await res.text();
  let body: Json = {};
  try {
    body = text ? (JSON.parse(text) as Json) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

const d = shouldRun ? describe : describe.skip;

d("REST v1 end-to-end", () => {
  // Long-running: opener + reveal both hit the LLM; each choice is a DB round-trip.
  it("session → next → choice × N → reveal → share", async () => {
    // 1. Bootstrap persona + opening analysis.
    const opener = await harness("opener", {
      persona_id: PERSONA_ID,
      songs: OPENER_SONGS,
      pairing_count: MAX_ROUNDS,
      reset: true,
    });
    expect(opener.ok).toBe(true);

    // 2. Mint a bearer for this persona.
    const bearer = await harness("bearer", { persona_id: PERSONA_ID });
    const token = bearer.access_token as string;
    expect(token).toBeTruthy();

    // 3. Auth boundary: v1 rejects unauthenticated calls.
    const unauth = await v1("/api/v1/session", { method: "POST" });
    expect(unauth.status).toBe(401);
    expect((unauth.body.error as Json)?.code).toBe("UNAUTHORIZED");

    // 4. POST /api/v1/session
    const start = await v1("/api/v1/session", { method: "POST" }, token);
    expect(start.status).toBe(200);
    const sessionId = start.body.session_id as string;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    // 5. Interactive loop: next → choice, until done or MAX_ROUNDS.
    let rounds = 0;
    let lastReveal: Json | null = null;
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const next = await v1(`/api/v1/session/${sessionId}/next`, { method: "GET" }, token);
      expect(next.status).toBe(200);
      if (next.body.done || !next.body.pairing) break;

      const pairing = next.body.pairing as {
        id: string;
        song_a: { id: string };
        song_b: { id: string };
      };
      const chosen = i % 2 === 0 ? pairing.song_a.id : pairing.song_b.id;

      const choice = await v1(
        `/api/v1/session/${sessionId}/choice`,
        {
          method: "POST",
          body: JSON.stringify({
            pairing_id: pairing.id,
            chosen_song_id: chosen,
            ms_to_decide: 1500 + i * 100,
          }),
        },
        token,
      );
      expect(choice.status).toBe(200);
      lastReveal = choice.body;
      rounds++;
    }
    expect(rounds).toBeGreaterThanOrEqual(1);
    expect(lastReveal).not.toBeNull();

    // 6. POST /api/v1/session/:id/reveal — assign archetype + synthesis.
    // D03: reveal never auto-publishes. Sharing is an explicit publish step.
    const reveal = await v1(`/api/v1/session/${sessionId}/reveal`, { method: "POST" }, token);
    expect(reveal.status).toBe(200);
    expect((reveal.body.archetype as Json | null)?.name).toBeTypeOf("string");

    // 6b. POST /api/v1/session/:id/share — explicit publish returns the token.
    const publish = await v1(
      `/api/v1/session/${sessionId}/share`,
      { method: "POST", body: JSON.stringify({ publish: true }) },
      token,
    );
    expect(publish.status).toBe(200);
    const shareToken = publish.body.share_token as string | null;
    expect(shareToken).toBeTruthy();

    // 7. GET /api/v1/share/:token — public, no auth.
    const share = await v1(`/api/v1/share/${shareToken}`, { method: "GET" });
    expect(share.status).toBe(200);
    expect(share.body.session_id).toBe(sessionId);
    expect(share.body.share_token).toBe(shareToken);
    expect(Array.isArray(share.body.defining_choices)).toBe(true);

    // 8. CORS preflight — share route is cross-origin.
    const preflight = await fetch(`${BASE_URL}/api/v1/share/${shareToken}`, { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
  }, 180_000);

  it.runIf(shouldRun)("rejects malformed share tokens with a typed error envelope", async () => {
    const bad = await v1("/api/v1/share/x", { method: "GET" });
    expect(bad.status).toBe(400);
    expect((bad.body.error as Json)?.code).toBe("INVALID_INPUT");
  });

  // Mobile signup path: bootstrap a persona WITHOUT priming opener, then
  // drive onboarding purely through /api/v1/* + a bearer token. Proves a
  // Flutter client that just called supabase_flutter.signUp() can complete
  // onboarding and start a session with zero web-only endpoints.
  it.runIf(shouldRun)(
    "mobile signup flow: bearer → /onboarding/opener → /session",
    async () => {
      const personaId = `e2e_v1_mobile_${Date.now().toString(36)}`;

      // 1. Bootstrap persona (creates auth user + test_runs row, no opener).
      const reset = await harness("reset", { persona_id: personaId });
      expect(reset.ok).toBe(true);

      // 2. Mint bearer for that fresh persona.
      const bearer = await harness("bearer", { persona_id: personaId });
      const token = bearer.access_token as string;
      expect(token).toBeTruthy();

      // 3. POST /api/v1/onboarding/opener — the route Flutter will call.
      const opener = await v1(
        "/api/v1/onboarding/opener",
        { method: "POST", body: JSON.stringify({ songs: OPENER_SONGS }) },
        token,
      );
      expect(opener.status).toBe(200);
      expect(opener.body.ok).toBe(true);
      expect(typeof opener.body.lane).toBe("string");

      // 4. /api/v1/session now succeeds.
      const start = await v1("/api/v1/session", { method: "POST" }, token);
      expect(start.status).toBe(200);
      expect(start.body.session_id).toMatch(/^[0-9a-f-]{36}$/i);

      // 5. Unauthenticated call to opener is rejected.
      const unauth = await v1("/api/v1/onboarding/opener", {
        method: "POST",
        body: JSON.stringify({ songs: OPENER_SONGS }),
      });
      expect(unauth.status).toBe(401);

      // 6. Bad body is rejected with the uniform error envelope.
      const bad = await v1(
        "/api/v1/onboarding/opener",
        { method: "POST", body: JSON.stringify({ songs: [] }) },
        token,
      );
      expect(bad.status).toBe(400);
      expect((bad.body.error as Json)?.code).toBe("INVALID_INPUT");
    },
    180_000,
  );
});

if (!shouldRun) {
  // Tell the developer why nothing ran — quiet skip is worse than a hint.

  console.info(
    "[e2e] Skipped REST v1 end-to-end suite. Set MUSICDNA_E2E_BASE_URL and AGENT_TEST_HARNESS_KEY to run.",
  );
}
