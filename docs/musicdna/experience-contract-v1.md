# MusicDNA Experience Contract v1

Shared by web and Flutter. The server decides everything a screen shows; clients render it natively.

## November 10 mobile parity additions (AB-56)

- `GET /api/v1/session/:id` adds optional `milestone`: null, or
  `{answered, title, summary, continue_label, can_finish}`. Only three/four saved
  answers qualify; skips/reactions do not count. Completed sessions return null.
  Summary uses the existing web halftime formatter and frozen history, including
  the saved `top_dim`; unavailable historical titles produce a neutral message.
  This is presentation guidance, not permission to bypass server finalization.
- `POST /api/v1/session/:id/reveal` already accepts `{finish_early:true}` after
  four answered choices. A retry must preserve that intent and replay the saved
  result. Its optional `reveal` object contains `answered`, `twist`, `challenge`.
- `POST /api/v1/session/:id/prepare` takes exactly
  `{pairing_id, exposure_id}`. Normal bearer auth, session ownership and a matching
  server-offered exposure are required before calling the same `prepareReadsImpl`
  used by web. It acknowledges that the pairing was rendered and returns only
  `{contract:1, prepared:<count>}`. Existing unique draft claims prevent duplicate
  generation; failures are optional speed failures, never a failed song choice.
  Call once after display, not while a milestone hides the pairing. Old servers
  may return 404; the ordinary on-choice writing path remains available.

No new schema, provider key, model override, learning gate or pilot enrollment is
needed. Existing saved prose stays immutable. The generated routing source stamp
was refreshed to reflect already-merged engine/function changes; original AB-52
invitation/source pins remain untouched and must not be rebucketed.

## Opting in

Send `X-MusicDNA-Experience: 1` on every `/api/v1/*` request. Without the header, each route returns its original v0 shape, so the shipped Flutter build keeps working. All v1 bodies carry `"contract": 1`.

Errors: `{ "error": { "code", "message" } }`. Codes: `NOT_FOUND`, `CONFLICT` (409), `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_INPUT`, `UPSTREAM`, `INTERNAL`.

## Endpoints

### `GET /session/:id/next`: Interview screen, the active matchup
```json
{
  "contract": 1,
  "pairing": { "id": "uuid", "tests": ["scale"], "diagnostic_weight": 60, "lane": "alternative",
               "song_a": { "id", "title", "artist", "year" }, "song_b": { … } },
  "prompt": "This one's about how big a song should feel.",
  "progress": { "answered": 2, "max_answered": 6 },
  "completion": { "done": false, "reason": null }
}
```
- `prompt` is generated from **this** pairing. Show it above the cards. It never names the expected answer.
- Progress label: `answered / max_answered`. Never count skips. Never show "Round 8 of 6".
- `completion.done = true` means `pairing` is null. Go straight to `/reveal` without a "generate" step. `reason` is one of `budget`, `confident`, `skip_bound`, or `catalog_exhausted`. Use it for the result's framing line, e.g. skip_bound gets "These weren't your songs, so here's what we can honestly say."
- Curator fields (`why_good`, `hypothesis`) are never sent.

### `POST /session/:id/choice`: Interview screen, feedback after a tap
Body: `{ pairing_id, chosen_song_id, ms_to_decide?, mutation_id? }`

```json
{
  "contract": 1,
  "replayed": false,
  "feedback": { "verdict": "Wake Up over Skinny Love.", "why": "…" },
  "read": {
    "tier": "observation | theory | read",
    "direction": "forming | holding | contested | revising",
    "thesis": "…", "hook": "…", "question": "…",
    "evidence": { "supporting": 3, "contradicting": 1, "tested": 4,
                  "examples": [{ "chosen": "Wake Up (Arcade Fire)", "rejected": "Skinny Love (Bon Iver)" }] },
    "revision": null | { "previous_claim", "previous_axis", "changed_by": { "chosen", "rejected" }, "new_interpretation" }
  }
}
```
- Mark the winner and dim the loser **before** the request returns. Render `feedback` and then `read` when it arrives.
- **Retries are safe.** If the same pairing comes back with the same song, the server returns the committed response with `replayed: true`. If it comes back with a different song, the server returns 409 `CONFLICT`. Generate one `mutation_id` per tap and reuse it on retry.
- `direction` maps to chips: forming → "Theory forming", holding → "The thread holds", contested → "One choice challenges this", revising → "Rethinking".
- When `revision` is present, show the previous claim struck through and name the `changed_by` pick.

### `POST /session/:id/skip`: Interview screen, "Don't know these"
Body: `{ pairing_id, ms_to_decide?, reason?: "unknown_one" | "unknown_both" | "cant_choose" }` → `{ ok, replayed }`
- Skips never change scores. A repeated skip is a no-op. Answers reset the consecutive-skip streak. Six answered choices remains the normal target. The separate early low-recognition rule (three total skips with at most two answers) remains unchanged. Five skips in a row end the session (`completion.reason = "skip_bound"`).

### `POST /session/:id/react`: Interview screen, the reaction row (from the 2nd answer on)
Body: `{ kind: "thats_me" | "not_quite" | "harder", pairing_id? }`

```json
{ "contract": 1, "effect": "pacing_only | retest_pairing | harder_pairing | no_alternative",
  "message": "Alright, let's check that. This one's about how big a song should feel.",
  "next": <same shape as /next v1> | null }
```
- `retest_pairing` and `harder_pairing` replace the outstanding matchup with `next.pairing`.
- `no_alternative` keeps the current matchup. Show `message`.
- Reactions are never votes and never change scores.

### `POST /session/:id/reveal`: Result screen
Optional body: `{ "finish_early": true }` explicitly ends at four or five answered pairings (400 before four). Default interview depth is six; vector confidence alone no longer auto-ends at four. Skip bounds and catalog exhaustion still allow honest shorter endings. Completed readings replay unchanged. `/next` for a completed session returns no further pairing.

New results add `reveal: { answered, twist, challenge }`. `answered` counts actual choices; `twist` is an actual contrary choice to an eligible claim, otherwise null. Never invent a twist from concentration diagnostics. Legacy results omit these fields; never reconstruct them from today's catalog. Flutter can stage the complete saved `headline`, then optional twist, then challenge, and keep supporting choices/audit under Receipts. Existing v0 response shape is unchanged; no V1 enablement is implied.

Web pauses after choice three using the saved running read and offers the exit after four. Selection stays on the existing lane-local selector with shadow routing; this presentation does not activate a new hypothesis-routing policy or promise a specific next test.
```json
{
  "contract": 1,
  "result_version": 1,
  "outcome": "supported | insufficient_evidence",
  "headline": "…",
  "supporting_choices": [{ "tradeoff", "examples": ["A over B"], "supporting", "tested" }],
  "tension": { "claim", "notes" } | null,
  "share_token": "…",
  "full": { …v0 reveal payload, shown behind "Full reading"… }
}
```
- The first pairing-based result is saved as version 1 and replayed verbatim after that. Reopening it shows the same reading.
- Show up to two `supporting_choices`. If fewer qualify, show fewer and say so.
- Primary actions: Push back, Share this read, Full reading.

### `GET /session/:id`: Resume
v1 adds:
```json
{ "contract": 1,
  "opener": { "songs": [...], "hypothesis": "…" },
  "exchanges": [ { "type": "choice", "at", "pairing_id", "chosen", "rejected", "feedback" },
                 { "type": "read", "at", "tier", "thesis", "revised", "revision" },
                 { "type": "skip", "at", "pairing_id", "reason" },
                 { "type": "reaction", "at", "kind" } ],
  "result_versions": [ { "version": 1, "source": "pairings" }, { "version": 2, "source": "chat_self_report" } ] }
```
- Render `exchanges` in order. Keep the latest exchange prominent and collapse the older ones. Then call `/next` to continue.

## Evidence and versions
- Every claim comes from one ledger (`ledger-v1`) and one claim policy (`d01-v1`): at least 3 distinct supporting pairings, at least 0.65 consistency, and more support than contradiction. A 3–1 split earns a qualified claim. A 2–2 split never earns one.
- Chat is self-report. It never changes the session's scores or version 1. Each refinement is saved as a new `chat_self_report` version with `base_version` pointing at the original.

## Fixtures
`fixtures/musicdna/experience-v1/*.json`: stable, qualified_3_1, mixed_2_2, sparse, zero_answer_skip_bound, artist_confounded. Each holds the input choices plus the expected ledger outcome and completion. `src/musicdna/engine/experience-fixtures.test.ts` keeps them in sync with the engine.

## Pending persistence rollout / parity release gate

The behavior below for feedback operations, recoverable chat, revised content and publication snapshots requires the reviewed persistence SQL plus `MUSICDNA_BACKEND_PERSISTENCE_V2=1`. SQL remains review-only and must not be applied to production without separate approval.

`MUSICDNA_EXPERIENCE_V1` defaults disabled at the server entry. V1 requests receive 503 `EXPERIENCE_DISABLED` until acceptance passes. Approved private verification uses `MUSICDNA_BACKEND_ACCEPTANCE=1` plus `X-MusicDNA-Acceptance-Key` matching the private harness key; bearer authentication and ownership checks still apply. Never embed this key in Flutter or distribute it to listeners. V0 and web behavior remain available.

## Sharing (D03)

`POST /api/v1/session/:id/share` with `{ "publish": true | false, "result_version": 1 }` → `{ contract: 1, is_public, share_token, share_url, result_version }`.
- `share_url` is the canonical public URL (`/s/:token`); `null` after revoke. `result_version` is the exact saved result version pinned by the publication transaction (latest if omitted). Public lookup returns that version, its frozen `content`, and ledger-derived choices; later chat cannot change this snapshot. Republishing explicitly replaces the snapshot.
Public lookups (`/api/v1/share/:token`, `/s/:token`) return 404 unless the reading is published. Revoking rotates the token.

## Reactions

`POST /api/v1/session/:id/react` accepts an optional `mutation_id`; retries with the same id are recorded once. A failed write returns an error. The server never acknowledges a reaction it hasn't saved. Web uses the same server logic.

## Chat (CHAT01/02, D04)

`POST /api/v1/session/:id/chat` with `{ "message": "…", "mutation_id": "…" }` → `{ contract: 1, reply, session_id, replayed, user_message_id, assistant_message_id }`.
- `mutation_id` is optional but recommended: a retried submit with the same id replays the saved reply (`replayed: true`) instead of double-posting — the same retry contract as choices. The reply row is stored under `<mutation_id>:reply`, so replay returns the exact committed reply, never a timestamp guess.
- If the user turn committed but the reply never did (crash between writes), the server returns `409 CHAT_TURN_PENDING` only while a generation lease is active (60 seconds); retry the same `mutation_id` after expiry to recover. A write failure releases the lease. Old interrupted user turns are adopted. Reply and revision save atomically; conflicting message reuse returns 409 `MUTATION_CONFLICT`.
- Chat is self-report. It never changes the session's scores or the frozen version-1 result. Each explicit self-report refinement produces changed, qualified synthesis in a new `chat_self_report` result version, with `base_version` pointing at the original. Provenance includes originating mutation ID, user message ID/text, applied/cumulative deltas, previous version and renderer version. This is not additional pairing support.

`GET /api/v1/session/:id/chat?limit=200&cursor=<opaque>` → `{ contract: 1, session_id, next_cursor, has_more, messages: [ { id, role, content, created_at, mutation_id } ], result_versions: [ { version, source, base_version, created_at, content, self_report } ] }`.
- Returns a latest-first page (1–200 messages) displayed chronologically, plus result versions WITH their content. Use `next_cursor` to load preceding pages, prepend them, and deduplicate by stable message ID. Continue until `has_more` is false; equal timestamps are ordered by ID so there is no 200-message total cap. Invalid cursors return 400.

Both endpoints are owner-only (403 for another user's session, 404 when it doesn't exist). Web and REST share one server implementation (`chatTurnImpl`), so turns, self-report versioning and retry semantics are identical across clients.

## Result feedback (RES06)

`POST /api/v1/session/:id/feedback` with `{ accuracy?, rating?, comment?, target?, most_accurate_sentence?, least_accurate_sentence?, result_version, mutation_id }` → `{ contract: 1, id, updated, replayed }`.
- `result_version` binds the feedback to the exact result version the listener saw.
- One immutable operation per owner/session/mutation, bound to the exact saved result version. A new mutation adds a row without overwriting earlier-version feedback. Identical retries return the same ID (`replayed: true`); changed payload/version/target under a reused key returns 409 `MUTATION_CONFLICT`. Version and mutation ID are required on REST writes.
- `accuracy` accepts `accurate | partly | not_accurate` (aliases `mixed`, `wrong` are normalized server-side). `rating` is -1, 0 or 1.

`GET /api/v1/session/:id/feedback` → `{ contract: 1, session_id, feedback: [ … ] }` returns the caller's feedback rows for the session, including `mutation_id`, `result_version`, and row `id`, for lost-response recovery.

Both are owner-only and share the web implementation (`submitFeedbackImpl`).


## Explore your DNA (decade runs)

Available after a discover reading is completed. A decade run is an ordinary session (`mode: "explore"`); after it starts, use the usual `/next`, `/choice`, `/skip` and `/reveal` calls. Its matchups stay inside the decade.

- `GET /api/v1/session/:id/explore` takes either a reading id or a decade-run id and returns `{ root_session_id, decades: [{ decade, ready, pairings }], runs: [{ session_id, decade, completed, started_at }] }`.
- `POST /api/v1/session/:id/explore` with body `{ "decade": 1980, "operation_id": "<uuid>" }` returns `{ session_id, mode: "explore", decade, replayed }`. Send a new `operation_id` for each deliberate start and reuse the same one when retrying; a repeat returns the same run with `replayed: true`. It returns 400 when the decade is unknown or not ready, or when the reading isn't finished.
- Decade runs do not pre-draft reads: `prepare` returns `{ prepared: 0, skipped: "explore_mode" }`. Coverage readiness and matchup selection use the same eligibility rules. Deleting an original reading also deletes its decade runs.
- `GET /api/v1/session/:id/comparison` for a decade run returns `{ decade, root_session_id, shifts: [{ axis, kind: "held"|"flipped"|"new"|"quiet", original, decade }] }`. Both sides come from frozen ledgers. It returns 404 when the session is not a decade run.
- `GET /api/v1/session/:id` now also returns `mode`, `decade` and `parent_session_id`.

Decades: 1970, 1980, 1990, 2000, 2010, 2020. The run must be started by the same account that owns the reading.


## Reading-library summaries (build8)

`GET /api/v1/sessions?limit=30&cursor=...` remains caller-scoped and backward compatible. Summaries additionally include `mode` (`discover` or `explore`), nullable `decade` and `parent_session_id`. `has_more` and opaque `next_cursor` support older readings; URL-encode the returned cursor as one query parameter. The cursor uses stable descending `started_at,id` order and is validated before querying. Existing clients may ignore the new fields. Authentication and row ownership remain mandatory. This endpoint never publishes a reading or starts generation.

For read-only saved-result recovery, the existing owner-only `GET /api/v1/session/:id/chat?limit=1` includes `result_versions`; use the earliest `source=pairings` saved version and its frozen content. Absence of a saved version is pending, never an invented version1. Reopening or a lost-response check must read the saved version before requesting generation.

## `dna_summary` on reveal (dna-summary-v1)
`POST /api/v1/session/:id/reveal` (v1) adds `dna_summary`, recomputed from frozen choice evidence on every read (never saved prose):
- `archetype`: `{status:"confirmed", name}` only when finalize stored an archetype that passed score/margin floors and ledger support; otherwise `{status:"emerging", name:null}`. Never display an archetype name for `emerging`.
- `dimensions[]` (max 3): `label`, `preferred`, `over`, `supporting`, `relevant`, `confidence` (`Clear`|`Leaning`|`Early`). Render counts as "`supporting` of `relevant` relevant comparisons".
- `undecided[]`: split traits (`label` like "danger or release").
- `receipts[]` (max 3): two `pattern`, at most one `contradiction`, each with chosen/rejected titles and artists plus a short `note`.
- `single_lane`: lane name when every answered pick came from one lane, else null.

## Refine My DNA (`mode=refine`)
`POST /api/v1/session/:id/refine` `{ "operation_id"?: string }` → `{ session_id, mode:"refine", replayed }`. Retry with the same `operation_id` returns the same run. The child points at the root discover reading; drive it with the normal next/choice/skip/reveal. Matchups exclude the parent's answered pairings, target its split/early/untested traits and prefer genres not yet heard. The reveal's ledger, `dna_summary` and archetype fit are cumulative (parent + refine picks); the parent's saved reading never changes. Clients should prompt guests to create an account first.
- `signature` (top-level, nullable): `{ name, hook }` written by Sol and passed by Terra, saved with the reading. Show it as the headline only when `dna_summary.archetype.status === "emerging"`, labelled as an early signature; older readings have none.
