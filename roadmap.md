# Roadmap

## Current — critic-quality and measurement-bias proposal

- [x] Approved plan; private diagnostic/review/exposure schema applied through migration approval boundary, guest-policy warnings corrected. Shared stage measurements, four-axis admin review and exact web/REST offer acknowledgement implemented; 39 focused tests and guest vote/readback pass. Exports/flags unchanged.
- [ ] Finish commit-bound attempt links/recovery, full review conversation context and aggregate bias reporting; these are not yet implemented (details: docs/musicdna/critic-quality-measurements.md).
- [ ] Registered-admin review and deployed acceptance: external-managed registered test access and updated Vercel deployment are unavailable. Independent human retests require consented recruitment; Flutter needs display acknowledgement adoption.

## Current — sign-in flash and sign-out

- [x] Shared root session state and account/sign-out controls on home/interview/protected pages; sign-in waits for hydration and anonymous guests no longer get bounced out. Lint/build pass; guest interview → sign-in remains stable, mobile fits, no runtime errors.
- [ ] Registered sign-in → sign-out end-to-end and live rollout: external-managed authentication prevents restoring a registered test session; Vercel deployment and live signed-in verification remain required.

## Current — post-choice pairing sayings

- [x] Freeze new sayings at vote time; shared author/reviewer receive answered, revision-verified saying, tested traits and chosen direction only. No pre-pick disclosure or historical backfill.
- [x] 35 tests, lint and preview build pass; real guest vote/readback verifies frozen saying and round advancement. Reviewer rejected that run's prose, retaining the safe fallback; voice acceptance is not claimed. Details: docs/musicdna/post-choice-sayings.md.

## Current — specialist lanes and full catalog review

- [x] Imported and activated the approved 69 songs / 46 matchups; all contrasts and unique phrases pass, existing historical evidence unchanged.
- [x] Added four distinct shared opener lanes and admin filters; 49 focused tests pass, guest Yacht Rock opener → same-lane choice → next round verified.
- [x] Audited all 721 songs / 487 pairings; findings and coverage documented in docs/musicdna/catalog-audit-2026-11-10.md (review only, existing catalog not silently repaired).
- [ ] Production specialist interview and authenticated admin acceptance: waits on updated Vercel classifier deployment and external-managed signed-in test access; preview guest flow verified.

## Current — Hip-hop expansion

- [x] Added 20 independently scored Hip-hop songs and 24 specific matchups, all inactive; existing scores/readings and Electronic untouched. Approval would bring Hip-hop to 59 songs / 44 live matchups.
- [x] Database readback verifies zero weak tests, ten-trait coverage and unique sayings; pinned fixture and focused regression tests added. Activation awaits Alan's review; predictive validation remains unproven.

## Current — critic audit review

- [x] Reviewed CRITIC_IMPLEMENTATION_GAP_AUDIT.md against current code: agree expression contract blocks authored critic prose; preserve evidence/replay/privacy, reject revealing next tests, reuse persona/one bounded editorial seam. No critic changes made.
- [x] Added versioned authored reads/reveal/chat with reference checks and independent semantic review, specific opener/vote/reaction copy, harder-mode override, full audit text and additive Flutter fields. No evidence/flags/migrations changed.
- [x] 255 focused tests, changed-file lint and preview build pass; guest interview/reaction/reveal/chat correction and exact reload verified, desktop/390px/no overflow. Handoff: docs/musicdna/critic-expression-v2.md.
- [ ] Early-read authoring still rejects too often and falls back to old templates; human voice matrix and production serving/ownership acceptance remain pending. Flutter display adoption needs Codex. This is not full critic-quality acceptance.

## Current — album artwork for web and Flutter

- [x] Enabled 333 checked covers (294 hosted assets); 23 suspicious/unavailable candidates held. Web uses branded fallback for 161 missing/held songs and image errors; exact database binding readback, 19 tests and guest rendering verified.

- [x] Checked all 494 songs: 356 candidates with artwork, 16 candidates without front artwork, 118 no eligible matches, four upstream errors. Candidate report preceded the separately checked, owner-rights-approved launch above.
- [x] Applied protected song_artwork storage and additive nullable artwork fields to both shared web/Flutter pairing selection paths; approved-only reads and documented-rights validation. Initial empty table now has 333 approved display records.
- [x] Grants/RLS readback, 18 focused tests, changed-file lint, preview build and interview opening checked. Receipt: docs/musicdna/album-artwork.md.
- [ ] Remaining 23 candidate covers need release confirmation/download retry; Flutter rendering needs Flutter team, deployed Vercel artwork acceptance awaits synced website deployment.

## Done — critic-first web presentation

- [x] Keep next matchups mysterious: neutral invitations and effect-only reaction acknowledgements; selection rationale/test prompts are not displayed, including history. Server selection and contracts unchanged.

- [x] Replaced transcript-first interview with one active stage, original vinyl imagery, progress and an accessible history drawer.
- [x] Server-confirmed reaction acknowledgements appear inline; compact saved reveal and conversation-first challenge; saved fallback replies remain verbatim with contextual follow-up drafts.
- [x] 53 focused regressions and changed-file lint pass. Real 390px preview session: three openers, six choices, reaction/steered pairing, history, reveal, chat saved/read back after reload and return to completed result. Desktop result checked; no runtime errors or overflow. Latest preview build OK.
- Scope: presentation only. No backend/catalog/flags changed; new editorial narration, offer-side diversity audit and playable friend challenge are not implemented by this pass. Production deployment acceptance remains separate.

## Current — zero-pairing song coverage

- [x] Added 21 active matchups covering 42 previously unpaired songs across seven already-classified musical families. Every test has at least 20 points of contrast; database readback confirms 21 eligible and no invalid tests. Seven focused tests passed. Song scores, classifications, existing pairs and flags unchanged. Receipt: docs/musicdna/zero-pair-coverage-2026-11-09.md.
- [x] Added eight active Pop matchups covering all 13 never-paired Pop songs; database readback confirms eight eligible and zero remaining. Thirteen tests passed; existing pairs/scores/flags untouched. Receipt: docs/musicdna/zero-pair-coverage-2026-11-08.md.
- [ ] Remaining 71 non-Alternative-tagged never-paired songs: blocked on editorial lane classification (all primary_lane=general; actually sophistipop, punk/noise and artrock). No indiscriminate general-lane pairing or silent reclassification.

## Done — PR #26 AB-52 database rollout

- [x] Applied only merged PR #26 SQL once as `20261108194533` (history name `9e66b3e2-84f7-4f37-83f7-8ff896e6b4c7`); merged/local/history SHA-256 `a111d24d2d86d47412c6cdf719c897887fbae5e9b625e7f010a39d390af67e8c`. One executable file, operator/private grants, RLS exclusions and four new triggers verified. Zero pilot invitations; existing two export enrollments untouched, capture/dispatch disabled. No flags, keys, schedules, deployments or earlier reruns. Three unit tests passed; ten native DB tests unavailable. Receipt: docs/musicdna/ab52-pilot-plan.md. Pilot activation/acceptance remain separate.

## Open — cross-repo first-hop acceptance gate (Music DNA → Echelon)

- [ ] Uploaded gate doc (Nov 6, 2026 source review): record deployed SHAs/migrations/flags/fixtures; trace one synthetic six-answer session domain commit → outbox → dispatcher → durable Echelon receipt → paginated readback; chaos cases (duplicate delivery, reused-ID changed payload, out-of-order/late outcomes, timeout after acceptance, receiver outage, lease expiry, 429, source disable/key rotation, replay); redaction/denial for wrong source/key, spoofed tenant, ordinary member, cross-tenant; opt-out/deletion during retry with non-resurrection; kill switch and sender/receiver rollback in either order; batch/rate/age limits and quarantine ownership; acceptance report with pass/fail and owner decision. Real-user export stays disabled; MUSICDNA_ROUTING_MODE=shadow preserved.
- Blockers: Echelon side (The-Gig-Agency/echelon-control) is outside this project; needs approved harness key, deployed staging targets, worker deployment, and explicit owner approval before any enablement. No production enablement authorized.

## Current — PR #23 AB-47 dispatcher database rollout

## Done — PR #25 AB-29 database rollout

- [x] Applied only merged SQL once as `20261108175602` (history name `be2ceb1f-664f-4cfb-9b16-4178f4169568`); SHA-256 `df939895cc3d2ee39131870c6cc0c0ab4eb5ceecf5aef3e1dbd7ff2feb17bde9`. One matching executable migration. Operator RPC/private-function grants, RLS and four triggers verified. Zero routing assignments and zero enabled capture/dispatch scopes. Existing one scope/two enrollments untouched; no keys, schedules, workers, flags or earlier reruns. Receipt: docs/musicdna/applied-outcomes.md. Activation and cross-repo acceptance remain separate.

- [x] PR #23 merged at 6ae7d5c; dispatcher applied once as 20261107214337 (history name aa6badb6-8540-4b07-991d-c05311776aa7). Merged/local/history SQL SHA-256 d739082d087a2ad1f5e0d932f525992d4da00e6440a55878a7cff10ea0f17645; one executable file. Private grants/RLS verified; read-only service status confirms disabled capture/dispatch and no scopes/enrollments/jobs. No keys, sources, schedules, worker deployments or earlier reruns. Receipt: docs/musicdna/learning-dispatcher.md. 35 unit tests passed; 29 native DB tests unavailable.

## Current — PR #21 AB-45 database rollout

- [x] Confirmed AB-45 enrollment/outbox tables are absent from the connected Music DNA backend.
- [x] Applied corrected AB-45 once: history version 20261107205842, name b8473d97-8f49-41d5-a8ad-84377600e976; generated-record commit 97adfeaa48834d9667cfb4fe67a197a6cb0b02e1. RLS and restricted grants verified; capture defaults false and scopes/enrollments/outbox remain empty. One executable SQL file; no keys, schedules or earlier migration reruns.

## Current — inactive catalog recalibration

- [x] Compared all 37 draft songs and 23 pairings with the dated review; no later song edits found.
- [x] Recalibrated all 37 vectors and metadata independently; lane moves remain proposals and rows stay inactive.
- [x] Rebuilt 23 matchups plus 7 new repeat/counterexample candidates; verified 30 saved pairs and unchanged evidence/results.
- [x] Documented before/after scores, sources, coverage and editorial gaps in docs/musicdna/cat06-recalibration-2026-10-20.md; added catalog/selector/evidence regressions.
- [x] Activated Alan's approved 31-song subset and its 23 mutual matchups; six flagged songs remain inactive. Database readback and 12 focused catalog tests passed.
- [ ] Predictive validation: recording/year reconciliation, broader movement/scale coverage and real-listener testing remain pending; activation does not establish these.

## Current verification — merged PR #11

- [x] Explain the harness key: private access to dedicated test personas/bearer issuance; distinct from Supabase keys and migration approval.
- [x] Implement five backend gaps behind default-off persistence rollout with review-only SQL and 16 focused regressions (210 suite checks): feedback recovery/isolation, chat recovery/pagination, revised content/provenance, frozen publication. Review summary: docs/musicdna/backend-parity-implementation-review.md.
- [ ] Obtain approved matching production harness configuration and verify serving SHA before authenticated acceptance; keep MUSICDNA_EXPERIENCE_V1 disabled.
- [x] Audit merged idea-builder PR #11 and backend source; report: docs/musicdna/backend-pr11-verification-2026-10-20.md. All five acceptance items have source gaps; 194 regression tests pass, not production acceptance.
- [ ] Authenticated production acceptance for all five items: blocked by unapplied review SQL, default-off persistence rollout, and unapproved/mismatched production harness key; current custom-domain serving SHA also unverified. Recorded successful production deployment SHA: 1015b28fe965b15f77f13e3b199c9f0e0145831b. No production migrations authorized.

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

- [ ] 2000–2026 catalog (CAT06–08): 37 inactive pilot songs recalibrated and 30 inactive pairings saved; activation still awaits editorial/recording review, coverage completion and listener testing (docs/musicdna/cat06-recalibration-2026-10-20.md).
