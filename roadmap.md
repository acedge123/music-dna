# Roadmap

## Done
- D06 retention: policy decided, implementation deferred until launch (docs/musicdna/data-retention-d06.md).
- Live anonymous walkthrough: interview, pushback, resume, share, revoke.

## Open — found by the live walkthrough
- Resume drops the three opening songs. Picks, reads and the round counter come back; the ranked
  #1/#2/#3 list does not. Fix in the web resume path (src/lib/resume.functions.ts + the resume
  restore block in src/routes/onboarding.tsx) so the openers render after a refresh.
- "Share this read" has no on-screen link. It publishes and copies to the clipboard; if the clipboard
  is blocked, the listener gets nothing. Show the link (with a copy button) after publishing.
- Share-card copy contradicts itself: names an archetype, then says "no specific claims cleared the
  evidence threshold" and "Across the data provided". Rewrite so a thin reading says so in the
  critic's voice without naming the machinery.

## Open — blocked on others
- Flutter parity: Codex is adopting the v1 contract.
- Signed-in walkthrough: this project's Supabase is user-managed, so no account can be minted here.
- D06 implementation: deferred until launch.
