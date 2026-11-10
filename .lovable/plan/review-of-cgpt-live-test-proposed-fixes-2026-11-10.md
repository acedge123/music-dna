# Review of CGPT live test — proposed fixes

## Verdict
Voice is working ("Three exits. All ignored."). The remaining problems are reliability and one copy contradiction, not writing quality. Keep Sol/Terra and the v2.4 rules unchanged.

## Findings and proposed fixes (priority order)

1. **Final reading stuck on "Thinking..." past 40s, and recovery stalled** (highest)
   - Investigate first: pull the session's trace and server logs to see whether the reveal call was slow, retried several times, or finished but the screen never picked it up.
   - Fix: when the deadline passes, check the saved result before showing an error, so a finished reading always appears; show a clear "Still writing your reading — retry" instead of indefinite Thinking.

2. **First matchup needed a reload**
   - Investigate: likely the opener matchup loads alongside the two background draft reactions; confirm the drafts never block the matchup from showing.
   - Fix: show the matchup immediately; drafts run fully in the background.

3. **One pick still saving after 15s**
   - Investigate: was the prepared draft rejected (fingerprint mismatch or review failure), forcing a live Sol + Terra call?
   - Fix: record hit/miss per pick in the owner-QA trace; if misses are common, fix the cause rather than adding speed tricks.

4. **Halftime said "no pattern" while the critic described three matching choices**
   - Cause (confirmed in code): halftime judges "pattern" only from the running read's top trait, while the critic talks about the traits each pick actually tested. They can disagree.
   - Fix: build the halftime line from the same evidence ledger the critic uses, so both always agree (matches the project rule that every claim comes from one ledger).

5. **Cache stores but doesn't serve** — expected; that was the agreed scope. No change now.

## Acceptance
- Five signed-in owner-QA runs: no reload needed, every pick under ~8s, reveal shows or offers retry within 45s, halftime never contradicts the critic.
- Add a test for the halftime/ledger agreement rule.

## Not changing
Models, reviewer rules, voice prompts, routing, learning/export, V1 flags, frozen saved readings.
