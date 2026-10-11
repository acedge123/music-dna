# Roadmap

## Done
- D06 retention: policy decided, implementation deferred until launch (docs/musicdna/data-retention-d06.md).
- Live anonymous walkthrough: interview, pushback, resume, share, revoke.
- Flutter parity fixes (TGA-305/307/310/311/313): chat replay stores the reply under `<mutation_id>:reply`
  (no timestamp guessing, 409 CHAT_TURN_PENDING on half-committed turns), chat history/context load the
  LATEST messages, chat GET returns result versions with full content, REST feedback endpoint with
  result_version binding + mutation_id idempotency, share publish returns canonical share_url +
  result_version, requirement trace refreshed to PRD v1.2 (CAT06–08).

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
- Vercel production env vars: musicdna.fm is live and serves the frontend + typed v1 errors, but every server function that touches the Supabase admin client (public share lookup, reveal, publish, onboarding) returns a 500 HTML page because `SB_SECRET_KEY` (and `SUPABASE_URL`) are not set in the Vercel dashboard. Add them there (plus `AGENT_TEST_HARNESS_KEY` if the REST e2e should run against prod) and redeploy; then rerun `MUSICDNA_E2E_BASE_URL=https://www.musicdna.fm` to confirm.
- Flutter parity: Codex is adopting the v1 contract.
- Signed-in walkthrough: this project's Supabase is user-managed, so no account can be minted here.
- D06 implementation: deferred until launch.

- [ ] 2000–2026 catalog (CAT06–08): scope in docs/musicdna/catalog-2000-2026-scope.md — alternative pilot draft sheet written (docs/musicdna/catalog-alternative-2000-2026-draft.md, 45 songs + 24 pairings); awaiting Alan's review before staging
