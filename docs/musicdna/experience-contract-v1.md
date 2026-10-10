# MusicDNA Experience Contract v1

Shared by web and Flutter. The server decides everything a screen shows; clients render it natively.

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
- Skips never change scores. A repeated skip is a no-op. Three skips in a row end the session (`completion.reason = "skip_bound"`).

### `POST /session/:id/react`: Interview screen, the reaction row (from the 2nd answer on)
Body: `{ kind: "thats_me" | "not_quite" | "harder", pairing_id? }`

```json
{ "contract": 1, "effect": "pacing_only | retest_pairing | harder_pairing | no_alternative",
  "message": "Alright — other side of the same question.",
  "next": <same shape as /next v1> | null }
```
- `retest_pairing` and `harder_pairing` replace the outstanding matchup with `next.pairing`.
- `no_alternative` keeps the current matchup. Show `message`.
- Reactions are never votes and never change scores.

### `POST /session/:id/reveal`: Result screen
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
