# Make the Critic faster without losing the voice

The voice is landing; speed is the remaining problem. Plan: measure first on the QA session, then apply only the fixes the numbers justify.

## Step 1 - Measure where the seconds go (no changes)
For QA session ff7abc43-5ecc-4271-ad1b-81412d8a080e, pull per-turn timings from the owner-QA traces and quality records:
- Was a pre-written reaction ready when the pick landed (hit / still drafting / miss)?
- Writer time, reviewer time, number of retries per turn
- Reveal and chat turn times
Output: a short table of each turn and the slowest step.

## Step 2 - Likely fixes, applied only if Step 1 confirms them
1. Pre-written reactions not ready in time: start drafting the moment the matchup appears (not after the screen settles), and for the next matchup while the current reaction is shown.
2. Reviewer retries dominate: when the first draft fails review, skip the second full rewrite on post-pick reactions and use the already-approved alternate or a short reviewed fallback.
3. Reviewer is serial: run the reviewer on a trimmed context (only the cited picks and rules), keeping the same reviewer model.
4. Reveal: begin writing it in the background as soon as the last pick is saved, so it is usually done before the screen opens.
5. Chat: keep live Sol, but trim transcript sent to the last few turns plus the saved reading.

## Unchanged
Sol writer, Terra reviewer, voice rules, evidence rules, frozen readings, routing, learning export, public V1 off.

## Success target
Post-pick reaction under 4s typical, reveal ready on open, chat under 8s, with reviewer pass rate no lower than today.

## Check
Re-run one guest six-pick interview in preview with timings, then ask ChatGPT to rerun a signed-in QA interview on the live site.
