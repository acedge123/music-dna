# Flutter handoff — opener song search confirmation

Web ships this now. Flutter should mirror it on the three opening-song fields.

## Endpoint
`GET https://www.musicdna.fm/api/v1/songs/search?q=<text>` — no auth, no experience header, CORS enabled.

Response: `{ "ok": true, "results": [{ "id": "uuid", "title": "Love", "artist": "Lana Del Rey", "year": 2017 }] }`

- Searches **active** catalog songs only; at most 5 results; `[]` when `q` has fewer than 2 letters/digits.
- Accepts `Love`, `Lana Del Rey`, `Love — Lana` / `Love - Lana` / `Love by Lana` (artist narrows).
- Ranking: exact title, then title prefix, word prefix, contains; duplicates (same title+artist) collapsed.
- Returns identity only — never scores, lanes or evidence.

## Client behavior (match web)
1. Debounce ~180 ms after typing; cancel the in-flight request on new input.
2. Show a dropdown "Which one?" listing `Title — Artist` with year on the right (tap targets ≥44 pt).
3. Tapping fills the field with exactly `"{title} — {artist}"` (em dash) and shows `✓ Got it: Title — Artist, Year`. Editing the text clears the confirmation.
4. No match (≥4 chars): show "Not in my crates yet — I'll take it as typed. Add the artist so I get it right." Typing freely is always allowed.
5. Search failure is silent; never block Continue.

## Contract unchanged
Submission still sends the three strings to `POST /api/v1/onboarding/opener`. Selecting a suggestion does not send the song `id`, change lane/era classification, scoring, or intake — unmatched songs still flow into the review queue. Broadening match rate = adding songs to the catalog.
