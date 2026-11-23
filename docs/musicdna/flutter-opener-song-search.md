# Flutter handoff — opener song search confirmation

Web ships this now. Flutter should mirror it on the three opening-song fields.

## Endpoint
`GET https://www.musicdna.fm/api/v1/songs/search?q=<text>` — no auth, no experience header, CORS enabled.

Response: `{ "ok": true, "results": [{ "id": "uuid", "title": "Love", "artist": "Lana Del Rey", "year": 2017 }] }`

- Searches **active scored catalog songs plus the separate unscored recognition list**; at most 5 results; `[]` when `q` has fewer than 2 letters/digits. Same endpoint and response shape; no Flutter request change required once Vercel deploys.
- Accepts `Love`, `Lana Del Rey`, `Love — Lana` / `Love - Lana` / `Love by Lana` (artist narrows), and title/artist words in either order.
- Normalizes accents, apostrophes and hyphens **before retrieval**. Bounded spelling fallback applies only when no direct result exists, for queries ≥5 normalized characters and ≥0.8 whole-field similarity; it is not arbitrary typo correction. Candidates require at least one matching two-character word prefix and are capped at 400.
- Ranking: exact title, combined title/artist tokens, title prefix, word prefix, contains; weak multiword substring fragments are excluded. Exact identity duplicates prefer scored rows; obvious Demo/Live/Remaster suffix variants share a suggestion slot, originals preferred, with recognition popularity breaking artist-only ties. No claim that these are independently verified canonical recordings.
- Returns identity only — never scores, lanes or evidence.

## Client behavior (match web)
1. Debounce ~180 ms after typing; cancel the in-flight request on new input. Immediately hide old options and reset keyboard selection; associate every response with its exact query and ignore stale responses even if cancellation races.
2. Show a dropdown "Which one?" listing `Title — Artist` with year on the right (tap targets ≥44 pt).
3. Tapping fills the field with exactly `"{title} — {artist}"` (em dash) and shows `✓ Got it: Title — Artist, Year`. Editing the text clears the confirmation.
4. No match (≥4 chars): show "Not in my crates yet — I'll take it as typed. Add the artist so I get it right." **Only after the current query succeeds with zero results**, never during debounce or loading. Typing freely is always allowed.
5. Track pending/success/empty/error separately. On failure show "Song search is unavailable — I'll take it as typed. Add the artist so I get it right." Never treat a failure as a catalog miss or block Continue.

## Contract unchanged
Submission still sends the three strings to `POST /api/v1/onboarding/opener`. Selecting a suggestion does not send the song `id`, change lane/era classification, scoring, or intake — songs absent from the scored catalog still flow into the existing review queue when submitted. Recognition import itself creates no listener demand and never scores or activates songs.

Recognition IDs are MusicBrainz recording UUIDs, not scored-catalog song IDs. Treat every result ID as opaque and never pass it to pairing or scoring APIs. Duplicate title/artist matches prefer the active scored identity. Recognition-only results return `year: null`: imported album dates and live-version identities are not confirmed original recording dates. Hide the year when null. Lane hints stay in the import metadata and never drive selection.

Acceptance: search `When Doves Cry`, select Prince, submit the three opener strings, then verify normal intake; confirm unknown free text still works and recognition never makes an unscored song eligible for a matchup.

## Guest-search repair acceptance — November 23, 2026

The server uses the narrow identity-only `musicdna_public_song_search` interface; base scored-table access rules are unchanged. Owner-approved migration `20261123155104` applied on November 23; `public-song-search.sql` is its test/reference copy, not a second migration to run. Deploy Vercel before testing Flutter. No client response fields have changed.

- Without signing in, `Dreams` and `Fleetwood Mac` offer **Dreams — Fleetwood Mac**.
- `Bohemain Rhapsody`, `Bohemian Rhapsody Queen`, and `Queen Bohemian Rhapsody` offer Queen.
- `Bjork`, straight apostrophe `Carolyn's Fingers`, and keyboard hyphen `Cherry-Coloured Funk` find accented/Unicode identities.
- Type Queen's title, replace it with `Dreams`, and press Arrow Down/Enter: no old Queen suggestion may be selected.
- Slow the current request: no premature “Not in my crates” message; errors remain distinct from empty results.
- Artist searches leave room for other songs instead of both an original and its obvious demo variant.
- Unknown free text remains accepted. This repair adds no missing songs, scores, demand records or active pairings, and does not change lane/era selection.

### Verification and access review

21 focused tests pass, including isolated database guest denial of direct score reads, active-only identity results, normalization-before-retrieval and no recognition dates. Real guest preview searches passed for all reported P1 examples; desktop and 390px dropdown selection, keyboard confirmation, delayed-query clearing and distinct request-failure feedback passed with no page errors. Catalog-expansion fixtures were not imported.

The database linter flags both guest and signed-in execution of this deliberately public privileged identity projection. Reviewed against Supabase's documented intentional-public-function exception: fixed SQL only, no dynamic statements, no listener-table reads or writes, active scored identities plus public recognition metadata only, 120-character input/400-candidate/3-second bounds and fixed search path. Revoking public execution would break legitimate guest search; using caller access would restore the missing scored-song bug. These intentional warnings remain documented rather than falsely marked fixed. The follow-up security scan reported no new search finding; existing unrelated security findings are not resolved by this work.
