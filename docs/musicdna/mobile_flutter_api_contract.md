# MusicDNA Flutter API Contract

This document defines the Flutter-facing contract for MusicDNA using the
existing shared REST API. Flutter does not get a separate wrapper layer.
Web, Flutter, desktop, and tooling all call the same `/api/v1/*` endpoints.

The architecture boundary is:

- Flutter owns auth UI, session UI, reveal UI, loading states, retries, and
  recovery UX.
- The backend owns session creation, pairing selection, scoring, reveal
  generation, and public share shaping.
- The engine remains the single source of truth for MusicDNA logic.

## Principles

- Flutter must not reimplement MusicDNA engine logic client-side.
- Flutter should call the existing `/api/v1/*` routes directly over HTTP.
- Supabase auth is still handled client-side, but authenticated MusicDNA
  requests use the Supabase bearer token.
- Response shapes should be treated as stable DTOs for Flutter repository and
  BLoC layers.
- Clients must tolerate additive fields on `/v1` and ignore unknown keys.

## Auth Boundary

Mobile auth is split:

- Supabase auth:
  - sign in
  - sign up
  - sign out
  - session restore
- MusicDNA REST:
  - commit opening three songs
  - start session
  - fetch next pairing
  - submit choice
  - finalize reveal
  - fetch public share

Authenticated requests send:

```http
Authorization: Bearer <supabase_access_token>
```

The current public route is:

- `GET /api/v1/share/:token`

## CORS

The current `/api/v1/*` routes are already CORS-enabled and answer
`OPTIONS` preflight requests. Flutter can call them directly over HTTPS.

## Error Envelope

Handled failures use this shape:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Session id must be a UUID"
  }
}
```

Current codes:

- `NOT_FOUND`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `INVALID_INPUT`
- `UPSTREAM`
- `INTERNAL`

## Endpoint Set

### 1a. Per-Song Reaction (conversational opening)

`POST /api/v1/onboarding/react`

Purpose:

- Mirror the web opening's one-song-at-a-time cadence
- Return a short critic reaction the UI shows after each of the first two songs
- Return a personalized `next_label` the UI uses as the placeholder/prompt for the next slot

Request:

```json
{
  "song": "A Forest — The Cure",
  "index": 0,
  "priorSongs": []
}
```

- `index` is the 0-based position of the song just named. Call this at `index: 0` after song 1, `index: 1` after song 2. Song 3 goes straight to `/onboarding/opener`.
- `priorSongs` is the list of songs already named earlier in this opening (empty for song 1, one entry for song 2).

Response:

```json
{
  "ok": true,
  "reaction": "The Cure at the top — okay, we're doing goth kids grown up.",
  "next_label": "who's on deck after Robert Smith?"
}
```

`next_label` may be `null`; render your default slot label when it is.

Optional. A client that wants the legacy three-at-once flow can skip this and call `/onboarding/opener` directly with all three songs.

### 1b. Commit Opening Three

`POST /api/v1/onboarding/opener`

Purpose:

- Persist the user's opening three songs after signup
- Generate the onboarding hypothesis/analysis payload
- Seed the later session start flow with saved profile priors


Request:

```json
{
  "songs": ["A Forest — The Cure", "Ceremony — New Order", "Blue Monday — New Order"]
}
```

Response example:

```json
{
  "lane": "alternative",
  "confidence": 0.65,
  "secondary_lanes": ["electronic"],
  "reasoning": ["You keep rewarding propulsion over polish."],
  "hypothesis": "Three songs in. Already a shape, not a portrait — let's keep going.",
  "candidate_dimensions": {
    "movement": 62,
    "atmosphere": 48
  },
  "per_song": [
    {
      "input": "A Forest — The Cure",
      "lane": "alternative",
      "source": "catalog",
      "canon_id": "uuid"
    }
  ],
  "canon_matches": [
    {
      "input": "A Forest — The Cure",
      "song_id": "uuid",
      "title": "A Forest",
      "artist": "The Cure",
      "primary_lane": "post_punk_new_wave"
    }
  ],
  "reaction": "Three songs in. Already a shape, not a portrait — let's keep going.",
  "observation": "Three songs in. Already a shape, not a portrait — let's keep going.",
  "fork": "",
  "stakes": ""
}
```

### 2. Start Session

`POST /api/v1/session`

Purpose:

- Start a new MusicDNA session for the authenticated user
- Seed the session from the user's saved opening songs/profile priors
- Return the session identity and initial lane

Request:

```json
{}
```

Response:

```json
{
  "session_id": "uuid",
  "lane": "alternative",
  "lane_confidence": 0.87
}
```

### 3. Get Next Pairing

`GET /api/v1/session/{sessionId}/next`

Purpose:

- Return the next pairing for the session
- Tell Flutter whether the session is complete
- Return current round/progress confidence

In-progress response example:

```json
{
  "done": false,
  "round": 4,
  "confidence": 0.64,
  "pairing": {
    "id": "uuid",
    "tests": ["movement", "immersion"],
    "hypothesis": "Slow-burn propulsion vs instant payoff",
    "why_good": "Helps resolve movement against immersion",
    "diagnostic_weight": 73,
    "lane": "alternative",
    "song_a": {
      "id": "uuid",
      "title": "A Forest",
      "artist": "The Cure",
      "year": 1980,
      "primary_lane": "alternative",
      "lane": "goth_darkwave"
    },
    "song_b": {
      "id": "uuid",
      "title": "The Killing Moon",
      "artist": "Echo & the Bunnymen",
      "year": 1984,
      "primary_lane": "alternative",
      "lane": "post_punk_new_wave"
    }
  }
}
```

Completed response example:

```json
{
  "done": true,
  "round": 12,
  "confidence": 0.81,
  "pairing": null
}
```

### 4. Submit Choice

`POST /api/v1/session/{sessionId}/choice`

Purpose:

- Record a user choice for the current pairing
- Update the session vector
- Return deterministic round feedback used by Flutter mid-session UI

Request:

```json
{
  "pairing_id": "uuid",
  "chosen_song_id": "uuid",
  "ms_to_decide": 4230
}
```

Response example:

```json
{
  "vector": {
    "movement": 42,
    "atmosphere": 18
  },
  "verdict": "You went with the song that keeps moving.",
  "why": "You reward build and pressure over instant release.",
  "hesitation": "Fast call.",
  "dim": "movement",
  "delta": 12.4
}
```

### 5. Finalize Reveal

`POST /api/v1/session/{sessionId}/reveal`

Purpose:

- Finalize the session
- Assign the archetype
- Generate the persisted reveal payload
- Return the share token and result data needed by Flutter results UI

Response example:

```json
{
  "archetypeId": "uuid",
  "archetypeName": "Architect",
  "interpretation": "Across 7 of 12 matchups, you repeatedly favored songs that build pressure before release.",
  "vector": {
    "movement": 42,
    "atmosphere": 18
  },
  "allowed_claims": [],
  "counterarguments": []
}
```

### 5b. Explicit Publish / Revoke (D03)

Reveal never auto-publishes. To share, call:

`POST /api/v1/session/{sessionId}/share`

Request: `{ "publish": true }` to publish, `{ "publish": false }` to revoke
(revocation rotates the token, killing copied links).

Response:

```json
{ "contract": 1, "is_public": true, "share_token": "public-share-token",
  "share_url": "https://www.musicdna.fm/s/public-share-token", "result_version": 1 }
```

`share_url` is the canonical public URL (`null` after revoke);
`result_version` is the latest saved result version being published. Then
read the public reveal via `GET /api/v1/share/{token}`. A token alone
never grants access — public lookups require `is_public = true`.

### 5c. Chat (CHAT01/02, D04)

`POST /api/v1/session/{sessionId}/chat` with `{ "message", "mutation_id" }`
returns `{ contract, reply, session_id, replayed, user_message_id,
assistant_message_id }`. A retry with the same `mutation_id` replays the exact
committed reply (stored under `<mutation_id>:reply`). If the user turn
committed but the reply did not, the server returns `409 CHAT_TURN_PENDING` —
retry the same `mutation_id`.

`GET /api/v1/session/{sessionId}/chat` returns the latest 200 messages in
chronological order (with stable `id` and `mutation_id`) plus
`result_versions` including full `content` and `self_report` per version.

### 5d. Result feedback (RES06)

`POST /api/v1/session/{sessionId}/feedback` with `{ accuracy?, rating?,
comment?, target?, most_accurate_sentence?, least_accurate_sentence?,
result_version?, mutation_id? }` → `{ contract, id, updated, replayed }`.
`result_version` binds feedback to the exact result version shown. One row per
(user, session, target); resubmitting updates it, and a repeated `mutation_id`
replays the saved row. `GET` on the same path returns the caller's rows.

### 6. Public Share

`GET /api/v1/share/{token}`

Purpose:

- Read a completed shared reveal without auth
- Support both explicit share tokens and public session UUID back-compat

Response example:

```json
{
  "session_id": "uuid",
  "share_token": "public-share-token",
  "completed_at": "2026-06-30T18:22:11Z",
  "lane": "Alternative",
  "interpretation": "You're an Architect…",
  "archetype": {
    "id": "uuid",
    "name": "Architect",
    "tagline": "Craftsmanship first.",
    "description": null
  },
  "defining_choices": [
    {
      "chosen": "A Forest",
      "chosenArtist": "The Cure",
      "rejected": "The Killing Moon",
      "rejectedArtist": "Echo & the Bunnymen"
    }
  ]
}
```

## Session History, Resume & Reactions

Session history and resume ARE exposed as REST:

- `GET /api/v1/sessions` — list the caller's sessions (most-recent-first).
- `GET /api/v1/session/:id` — resume state for one session
  (`in_progress` → keep looping `next` + `choice` then `reveal`;
  `completed` → jump to reveal/share).
- `POST /api/v1/session/:id/react` — record a reaction on the running read.
- `POST /api/v1/session/:id/skip` — skip the current pairing.

## Flutter Integration Notes

Recommended mobile layering:

- data source:
  - raw HTTP requests to `/api/v1/onboarding/opener`, `/api/v1/session*`,
    and `/api/v1/share/*`
- repository:
  - maps response DTOs to domain entities
  - maps the shared error envelope to typed failures
- use cases:
  - commit opening three songs
  - start session
  - fetch next pairing
  - submit choice
  - finalize reveal
  - fetch public share
- bloc/state:
  - session start/loading
  - live diagnostic session
  - reveal/results
  - retry/recovery states

## Current Ticket Focus

`TGA-274` should align Flutter contract/types to the already-shipped REST API,
not introduce a second mobile-specific wrapper. If new endpoints are needed
later, they should extend the same `/api/v1` surface used by every client.
