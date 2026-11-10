# Make "fun" a measured goal, not a hope

## Where we are
The current fixes target reliability: the Critic's answers stop getting thrown out, stay grounded, and engage challenges. That is necessary but does not make the Critic fun. The admin review today scores four things (accuracy, musical specificity, originality, relevance). Nothing measures entertainment or "do I want to keep talking."

## What to add

1. Fifth review score: "Entertainment / want to continue" (1-5), alongside the existing four in Admin -> Critic QA. Rename "inference accuracy" to "Grounded in evidence" in the UI so the five match your list.
2. Session-level verdict. After a QA run, the reviewer answers one question for the whole interview: "After six choices, did you want to keep talking?" (Yes / Maybe / No + one-line why). Single replies can be good while the session is dull, so this is scored separately.
3. Real-listener signal (no extra questions asked): did they send a chat message after the reveal, how many turns, and did they come back. Shown in admin as "kept talking" rate. QA sessions stay excluded.
4. Acceptance bar for the 20-run evaluation:
   - at least 90% of replies accepted and grounded (reliability gate, unchanged)
   - average Entertainment at least 4 of 5
   - at least 70% of sessions answer "Yes" to the keep-talking question
   Grounding stays a hard gate: a funny reply that makes things up still fails.

## Fun improvements to run after the reliability gate passes
Measure first, then tune using the scores:
- Voice: give the writer explicit Rolling Stone swagger rules (take a stance, one vivid comparison, no hedging filler), checked by the reviewer for flatness, not just accuracy.
- Hooks: each read ends with a provocation or teaser that invites a reply (without revealing the next matchup's test).
- Use the frozen matchup sayings more boldly after each pick.
- Challenges: when pushed back on, the Critic argues its case with the specific songs, or concedes with style, rather than retreating to a safe line.
- Variety: block repeated openings and phrases across the last three replies.

## Technical details
- Migration: add nullable `entertainment` smallint (1-5) to the critic QA review table, and a small per-session QA verdict table (admin-only RLS).
- Update `critic-quality.ts` axes/rubric, panel, and server functions; add tests that the fifth score is required range 1-5 and the verdict values are limited.
- Kept-talking metric derived from existing chat records; no new listener-side writes, nothing exported, no routing/learning/V1 changes.
