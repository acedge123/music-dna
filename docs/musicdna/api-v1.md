# MusicDNA API v1

Versioned client API. Every current and future client — web, Flutter,
desktop, admin tooling — calls the same endpoints, and every endpoint calls
the same engine (`src/musicdna/engine/*`). There is one implementation of
scoring, archetype assignment, and reveal shaping. Ever.

Base URL: `https://<your-app>.lovable.app/api/v1`

## Auth

- Public endpoints (currently `GET /share/:token`) require nothing.
- All other endpoints require a Supabase bearer token:
  `Authorization: Bearer <supabase_access_token>`

CORS: every response includes `Access-Control-Allow-*` headers; all routes
respond to `OPTIONS` preflight. Safe to call from any origin.

## Error envelope

```json
{ "error": { "code": "NOT_FOUND", "message": "Session not found" } }
```

Codes: `NOT_FOUND` (404), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`INVALID_INPUT` (400), `UPSTREAM` (502), `INTERNAL` (500).

## Endpoints

### `POST /api/v1/onboarding/react`

Per-song conversational reaction. Call this after each of the first two
opening songs to get the critic's running reaction plus a personalized
label/prompt for the next slot. This is what makes the mobile opening
feel one-question-at-a-time instead of a bulk form. Optional — you can
skip straight to `/opener` for the legacy three-at-once flow.

Body:

```json
{
  "song": "Fake Empire - The National",
  "index": 0,
  "priorSongs": []
}
```

- `song`: the song just named (1–200 chars).
- `index`: 0-based index of this song in the opening sequence (0, 1).
- `priorSongs`: songs already named earlier in this opening (max 20).

Response:

```json
{
  "ok": true,
  "reaction": "The National as your #1 — okay, we're doing feelings.",
  "next_label": "who's on deck after the sadboys?"
}
```

`next_label` is nullable; render your default slot label when it's empty.

### `POST /api/v1/onboarding/opener`

Post-signup opening analysis. Call this once, immediately after the user
signs up (and after the optional per-song `/react` calls), with the 3
songs they picked. Runs the LLM analysis (lane guess, seed vector,
secondary lanes) and persists it to the caller's `profiles` row.
`POST /api/v1/session` requires this to have completed at least once.

Body:

```json
{ "songs": ["Fake Empire - The National", "Dreams - Fleetwood Mac", "Space Song - Beach House"] }
```

- `songs`: exactly 3 free-text strings, each 1–200 chars. Format
  `"Title - Artist"` is preferred but not required; catalog resolution is
  server-side.

Response:

```json
{
  "ok": true,
  "lane": "alternative",
  "lane_confidence": 0.62,
  "hypothesis": "Three songs in — already a shape, not a portrait…",
  "secondary_lanes": ["indie", "folk"]
}
```


### `POST /api/v1/session`

Start a new MusicDNA session for the authenticated user. Uses the user's
opening 3 songs (stored on `profiles`) to seed the session vector, pick the
primary lane, and choose probe candidate lanes.

Response:

```json
{ "session_id": "…", "lane": "alternative", "lane_confidence": 0.87 }
```

### `GET /api/v1/session/:id/next`

Return the next pairing (or `null` when the session is out of pairings).
Also returns progress + probe state so the client can render round X of Y.
Session ownership is enforced by RLS on the caller's token.

### `POST /api/v1/session/:id/choice`

Body:

```json
{ "pairing_id": "…", "chosen_song_id": "…", "ms_to_decide": 4230 }
```

Records the choice, updates the session vector, and returns whatever
`recordChoiceImpl` returns (updated progress, lane flip signals, etc.).

### `POST /api/v1/session/:id/reveal`

Finalize the session. Runs the pure engine `assignArchetype` over the
current vector, generates the Analyst reasoning artifacts, calls the Critic
LLM under the evidence-threshold constraints, and persists the reveal.

Response:

```json
{
  "archetypeId": "…",
  "archetypeName": "Architect",
  "interpretation": "Across 7 of 12 matchups…",
  "vector": { "movement": 42, "…": 0 },
  "allowed_claims": [ … ],
  "counterarguments": [ … ]
}
```

Note: reveal never auto-publishes a reading (D03). To share, the client
must explicitly publish:

### `POST /api/v1/session/:id/share`

Body: `{ "publish": true }` to publish, `{ "publish": false }` to revoke.
Revocation rotates the token, so previously copied links stop working.
Publishing a reading that has not completed returns 400.

```json
{ "contract": 1, "is_public": true, "share_token": "…", "share_url": "https://www.musicdna.fm/s/…", "result_version": 1 }
```

`share_url` is the canonical public URL (`null` after revoke);
`result_version` is the latest saved result version being published. The
returned token is then used with `GET /api/v1/share/:token`. A token
alone never grants access: public lookups require `is_public = true`.

### `POST /api/v1/session/:id/chat`

Body: `{ "message": "…", "mutation_id": "…" }`. Submits one chat turn and
returns the critic's reply. A retry with the same `mutation_id` replays the
exact committed reply (`replayed: true`) — the reply row is stored under
`<mutation_id>:reply`, never guessed by timestamp. If the user turn committed
but the reply did not, the server returns `409 CHAT_TURN_PENDING`; retry the
same `mutation_id`.

```json
{ "contract": 1, "reply": "…", "session_id": "…", "replayed": false,
  "user_message_id": "…", "assistant_message_id": "…" }
```

### `GET /api/v1/session/:id/chat`

Returns the latest 200 messages in chronological order (each with `id`,
`role`, `content`, `created_at`, `mutation_id`) plus `result_versions` with
full `content` and `self_report` per version, so a client can restore the
conversation and every revision exactly as saved.

### `POST /api/v1/session/:id/feedback`

Body: `{ accuracy?, rating?, comment?, target?, most_accurate_sentence?,
least_accurate_sentence?, result_version?, mutation_id? }`. Records result
feedback bound to the exact `result_version` the listener saw (RES06). One
row per (user, session, target): resubmitting updates it. A retry with the
same `mutation_id` replays the saved row (`replayed: true`).

```json
{ "contract": 1, "id": "…", "updated": false, "replayed": false }
```

### `GET /api/v1/session/:id/feedback`

Returns the caller's feedback rows for the session.

### `GET /api/v1/share/:token`

Public read of a completed, shared session. Accepts either the opaque
`share_token` or — for back-compat — a session UUID that has `is_public =
true`.

Response:

```json
{
  "session_id": "…",
  "share_token": "…",
  "completed_at": "2026-06-30T18:22:11Z",
  "lane": "Alternative",
  "interpretation": "You're an Architect…",
  "archetype": {
    "id": "…",
    "name": "Architect",
    "tagline": "Craftsmanship first.",
    "description": null
  },
  "defining_choices": [
    { "chosen": "…", "chosenArtist": "…", "rejected": "…", "rejectedArtist": "…" }
  ]
}
```

### `GET /api/v1/sessions`

List the caller's sessions (history), most-recent-first. RLS scopes the
result to the caller. Query: `?limit=<1..100>` (default `20`).

```json
{
  "sessions": [
    {
      "session_id": "…",
      "lane": "alternative",
      "lane_confidence": 0.87,
      "started_at": "2026-06-30T18:22:11Z",
      "completed_at": "2026-06-30T18:34:02Z",
      "status": "completed",
      "is_public": true,
      "share_token": "…",
      "archetype_id": "…"
    }
  ]
}
```

`status` is `"in_progress"` when `completed_at` is null, else `"completed"`.

### `GET /api/v1/session/:id`

Resume a session. Returns the current state so the client can drop the
user back where they left off (`in_progress` → keep looping
`/next` + `/choice` then `/reveal`; `completed` → jump to reveal/share).

```json
{
  "session_id": "…",
  "status": "in_progress",
  "lane": "alternative",
  "lane_confidence": 0.72,
  "vector": { "movement": 42 },
  "rounds_completed": 4,
  "started_at": "…",
  "completed_at": null,
  "is_public": false,
  "share_token": null,
  "archetype_id": null,
  "interpretation": null
}
```

### `DELETE /api/v1/account`

Delete the caller's account and all their data. Required by Apple App
Store guideline 5.1.1(v) for any app with account sign-up. All
user-scoped tables are FK'd to `auth.users` with `ON DELETE CASCADE`, so
a single `auth.admin.deleteUser` server-side wipes the user's footprint.

```json
{ "ok": true, "deleted_user_id": "…" }
```

After a successful delete the caller's bearer is invalid and every
subsequent `/api/v1/*` call returns `UNAUTHORIZED`.

## Mobile auth redirects (Supabase)

Supabase Auth email links (email confirm, magic link, password reset)
default to the web origin. For a native app to handle them, add a custom
scheme to the Supabase project's **Auth → URL Configuration → Redirect
URLs** allowlist and pass it as `emailRedirectTo` / `redirectTo` from
`supabase_flutter`:

- `musicdna://auth/callback` (native)
- `https://www.musicdna.fm/auth/callback` (web fallback)

The Flutter client registers the `musicdna` URL scheme in
`ios/Runner/Info.plist` (`CFBundleURLSchemes`) and
`android/app/src/main/AndroidManifest.xml` (`<intent-filter>` with
`android:scheme="musicdna"`), then handles the callback via
`supabase_flutter`'s `onAuthStateChange`.

## Universal / App Links (share deep-linking)

Share URLs like `https://www.musicdna.fm/s/<token>` open in the native
app when installed via:

- iOS: `/.well-known/apple-app-site-association`
  (`appIDs: ["<TEAM_ID>.com.thegigagency.musicDna"]`, path `/s/*`)
- Android: `/.well-known/assetlinks.json`
  (`package_name: "com.thegigagency.music_dna"`, SHA-256 fingerprints
  for both release and debug keystores)

Both files ship under `public/.well-known/` and are served as-is at the
root by Vercel. The Apple team ID and Android SHA-256 fingerprints must
be filled in before the App Store / Play Store builds ship.

## Mobile / Flutter signup flow

Authentication itself is not part of `/api/v1/*`. Clients talk to Supabase
Auth directly with the appropriate SDK (`supabase_flutter` on mobile,
`@supabase/supabase-js` on web) for signup, sign-in, password reset, and
OAuth. Once the SDK returns a session, the client passes its `access_token`
as `Authorization: Bearer …` to every `/api/v1/*` call.

End-to-end mobile onboarding is three REST calls:

1. `supabase_flutter.signUp(email, password)` — returns a session.
2. `POST /api/v1/onboarding/opener` with the 3 opening songs — persists the
   opening analysis to `profiles`.
3. `POST /api/v1/session` — seeds a session from the profile and returns a
   `session_id`; the client then loops `next → choice → reveal` and finally
   reads `GET /api/v1/share/:token` for the public reveal.

`POST /api/v1/session` will error with `INVALID_INPUT` if step 2 has not
completed for the current user. Rerun the opener with 3 songs and retry.

## Versioning policy

- `/v1` is stable. Breaking changes ship as `/v2`.
- Additive fields are allowed on `/v1` responses at any time. Clients MUST
  ignore unknown fields.
- Removing fields, renaming fields, or changing types is a break — bump the
  version.

## End-to-end tests

`src/routes/api/v1/e2e.test.ts` drives the full REST loop
(`session → next → choice × N → reveal → share`) through the real routes
over HTTP. It self-skips unless both env vars are set:

```bash
MUSICDNA_E2E_BASE_URL=http://localhost:8080 \
AGENT_TEST_HARNESS_KEY=<same value as the server secret> \
bunx vitest run src/routes/api/v1/e2e.test.ts
```

How it works:
1. `POST /api/public/test/opener` — bootstraps a synthetic Supabase user +
   opening analysis (auth-bypassing harness gated by
   `AGENT_TEST_HARNESS_KEY`).
2. `POST /api/public/test/bearer` — resets that user's password and returns a
   fresh access token so the test can hit the real bearer-protected routes.
3. The test then walks `/api/v1/session`, `/next`, `/choice`, `/reveal`, and
   the public `/share/:token` end-to-end and asserts the auth boundary,
   CORS preflight, and the typed error envelope.

Point `MUSICDNA_E2E_BASE_URL` at `http://localhost:8080` for a local dev
server or at the preview URL to smoke-test a deployed build.
