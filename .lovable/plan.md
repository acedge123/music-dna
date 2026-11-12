# Pick -> Critic -> next matchup sequencing

## Verdict on Codex's AB-73
Keep the backend change. Your sequencing is the better screen flow. The two don't conflict.
AB-73 saves the pick first and fetches the Critic's read separately. That makes the pick crash-safe and avoids phone timeouts. It doesn't force the app to show the next matchup early. The app decides what appears and when. The bug you saw, where the new read covers the old matchup, comes from screen ordering, not from the backend.

## Proposed experience (web and iPhone)
1. Listener taps a song. The matchup animates away, and the chosen song stays as a small "You picked X" card.
2. Critic stage, full screen and Critic only. If the read was pre-drafted it appears immediately (most picks). Otherwise rotating filler lines appear every ~2.5s, e.g. "Hm. Interesting.", "Hold on, let me listen to that again.", "That's not the one I expected.", "Filing that away..."
3. The read lands and replaces the filler.
4. A "Next matchup" button reveals the new pairing. It's loaded in the background, so it appears instantly. It never appears before the read lands or fails.
5. Slow or failed read: after ~20s, show "I'll come back to that one" plus Next. The pick is already saved, so nothing is lost.

## Filler line rules
- Short, in the Rolling Stone critic voice, and rotated without repeats in a session.
- Never claim a finding or name a trait or song. They're stalling lines, not evidence. This keeps the ledger rule intact.
- Never hint at what the next matchup tests (keep matchups mysterious).
- Halftime (pick 3) and pick 6 keep their own existing moments.

## Scope
- Web: change the interview screen to this sequence using the deferred-read path. No changes to scoring, selection, prompts or models.
- Shared filler list in one place so web and Flutter use identical lines (exposed to Flutter in the v1 contract docs).
- Flutter: handoff note for Codex (mobile PR #30) with the same sequence.
- Apply Codex's migration only after you approve it separately (production rule).

## Technical details
- Use AB-73 `defer_read`: vote returns -> show Critic stage -> call `/read` for that choice position -> render. Prefetch the next pairing from the vote response but keep it hidden until the read finishes.
- Stale-read guard: drop any read whose choice position isn't the current one. This prevents the overlap bug.
- Fillers live in an engine constants module plus `docs/musicdna/experience-contract-v1.md`. A test checks they contain no song, axis or trait names.
