# Flutter handoff: pick → Critic → next matchup (fillers-v1)

Web reference: `src/routes/onboarding.tsx` (`CriticStage`), copy in `src/musicdna/engine/critic-fillers.ts`.
All endpoints need `X-MusicDNA-Experience: 1`.

## 1. Load the lines once per app launch
`GET /api/v1/critic-fillers` (no auth, no user data) →
`{ contract, version, neutral[12], reaction: { against[12], with[8], early[8] }, person[9][1–2 lines], decade: { "1970s": [10 lines], "1980s"–"2020s": [9 lines each] }, skip[8], skip_young, skip_old }`.
Cache it, and keep a bundled copy as an offline fallback. Never edit the lines in Dart.
The final owner-approved list is from **Music_DNA_Quips.docx (12 November 2026)**; blank numbered entries and copied editorial instructions are not quips. Use each pool's actual length, never a hard-coded eight. Refresh the cached list on app launch; the contract and sequencing are unchanged.

## 2. `wait` index
`wait = 0` while the first matchup loads, then `wait = answeredPicks` (1–6) after each pick. Because each wait uses its own index, no line repeats in an interview.

## 3. After a pick
1. Tap → hide the matchup and show the Critic screen: "YOU PICKED · {title}" + `neutral[wait % neutral.length]`.
2. `POST /api/v1/session/:id/choice` with `defer_read: true`. The response now includes
   `hunch`: `"against" | "with" | "early"` (computed inside the save, so no added latency; treat a missing value as `"early"`).
3. Rotate every ~2.5s and hold on the last line:
   `reaction[hunch][wait % reaction[hunch].length]` → each line of `person[wait % person.length]` in order (an entry is a setup → punchline pair or one stand-alone line; never shuffle or split them). If both songs share a decade (`floor(year/10)*10`+"s", e.g. "1970s") also show `decade[key][wait % decade[key].length]` after the reaction; with a reaction, the decade line replaces the person lines. Hold each line ~2.5 s, show each once, last line stays until the read arrives.
4. In parallel: `POST /read` `{ after_pairing_id, answered }` and fetch the next pairing. Keep the pairing hidden.
5. When the read arrives, show it with the next matchup below it **automatically, without a tap**.
   Discard a read whose `answered`/`after_pairing_id` isn't current (a 409 also means discard).
6. If the read hasn't arrived after 20s or fails (503), show "I'll come back to that one." and the next matchup. The pick is already saved.

## 4. After a skip
Show one line per skip (increase `skipCount` each time). If both skipped songs are from before 2000, use `skip_young`. If both are from 2020 or later, use `skip_old`. Otherwise use `skip[skipCount % 8]`. Replace `{artist}` with the artist of `songs[skipCount % 2]`.

## 5. Rules
- Never write new filler lines on the client and never pick a reaction yourself. Use the server's `hunch` only, so "not what I expected" appears only when the pick really went against the listener's strongest earlier lean.
- Halftime (pick 3) doesn't interrupt. Pushback is an optional link on that read (`POST /pushback`).
- The pick-4 early exit and the pick-6 reveal are unchanged.

## Acceptance
- Six picks: no repeated filler lines, and no "Next matchup" button.
- The old matchup is never visible under a new read.
- The first pick always shows an `early` reaction.
