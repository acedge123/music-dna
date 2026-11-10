# Trace the pick-6 wait before ChatGPT reruns

## Where we are
Background drafts already record when they started and finished, and whether they succeeded. They do NOT record what happened when you tapped: whether the draft was used, didn't match, wasn't ready yet, or got thrown out so the Critic wrote live. That's the missing half of the story, so a rerun today couldn't explain a slow pick 6.

## What I'll add (small, admin-only)
1. For every pick that could use a background draft, save one timing record: when the matchup appeared, when each draft started and passed review, when you tapped, and the outcome — used / not ready (waited X seconds) / didn't match / failed / live fallback — plus total wait until the reading showed.
2. Show these in the existing owner-QA trace in admin, one row per pick.
3. Nothing changes for listeners: same Sol writer, Terra reviewer, rules, six picks. Records stay private and are never exported.

## Then
- ChatGPT runs one six-pick owner-QA interview and sends the session ID.
- I read the timeline and tell you exactly where the seconds went before we touch speed again.

## Technical details
- Add outcome columns to `prepared_reads` (requested_at, consumed_at, outcome, wait_ms, reviewed_at) via migration; service-role only, existing RLS kept.
- Write outcome in `currentRead`/reveal consume path; test each outcome branch.
