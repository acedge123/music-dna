# Roadmap

## Current — broader recognition catalog

- [x] Retry interrupted 2010s/2020s lookups and continue bounded modern-decade imports: 534 new identities read back (335 2010s, 199 2020s); era totals 443/260, overall 3,293. Existing rows unchanged; six operator tests pass; maximum three expansion songs per artist/decade. Saved progress at 181/1,000 artists, no background job, scoring or activation.
- [x] Rebuild missing temporary 2010s output with durable checkpoints; import/read back the first 108 verified 2010s identities without overwriting prior rows. Original full temporary sample was not recovered; replacement is partial.
- [ ] Finish 2010s/2020s and broader decade collection to 5,500 distinct title/artist identities. Now 3,293 total; 2,207 remain. Paused after bounded modern-only imports at 181/1,000 ranked artists saved in docs/musicdna/recognition-expansion-5500. Remaining provider/indexed-identity gaps require further paced operator steps; no background job. Retain three-per-artist/decade cap and no scoring/activation.

- [x] Import the approved ’90s review identities: 413 new, two existing recording IDs; all 415 source IDs and new values verified, 1,890 recognition rows total. No scoring/activation, existing duplicates unchanged, provisional dates hidden.
- [x] Build and save the 2000s review sample: 598 recordings across 200 artists, maximum three per artist; docs/musicdna/recognition-sample-2000s. Provisional dates and provider gaps documented.
- [x] Import the owner-approved 2000s sample: 598 new unscored recognition records; all source IDs/values read back and replay verified. Recognition total 2,488; no scoring/activation or demand counts.
- [x] Replace lost temporary 2010s collection with durable selected metadata, decade CSVs, gaps and readback receipt; partial rebuilt selection imported under the owner's new authorization. Full breadth target remains open above.
- [x] Import all approved 1,477 ’80s sample records into a separate unscored recognition table; preserve provenance and leave scored songs/pairings untouched. Confirmed stored batch during ’90s readback.
- [x] Build and save a ’90s review sample from ListenBrainz-ranked artists: 415 recordings, 140 artists, maximum three per artist; docs/musicdna/recognition-sample-1990s. Includes 25 provider gaps and provisional date/version cautions; no ’90s import or scoring.
- [ ] Verify recognition storage/search and document Flutter behavior and sample limitations.

## Current — PR 62 selector experiment planning

- [x] Add the approved offline-first test plan to docs/musicdna/pairing-selector-baseline.md so Chat can read it; emphasize soft, opener-derived lane/era familiarity with gradual earlier/later falloff and multiple supported lanes/eras. Documentation only; no code, experiments or activation authorized.

## Current — uncertainty-aware reviewer and ten-item retest

- [x] Add Pass/Fail/Uncertain with independent score disputes and policy-separated failure/uncertainty rates; preserve all original reviews and approvals. V1 caller compatibility retained through distinct v2 request.
- [x] Update storage, MCP and admin presentation; 37 focused tests pass, lint clean and preview build OK. All three verdicts, rates, policy comparison and provenance verified with isolated desktop/phone fixtures; MCP manifest extracted with 45 tools.
- [ ] Retest the exact ten saved v1 explanation IDs only after the new policy is deployed and an authorized caller can submit; no remaining-catalog paid review. Cohort pinned in docs/musicdna/reviewer-v2-ten-item-retest.md. Original ten remain 9 Fail/1 Pass; no paid rerun performed. External-managed admin auth and deployed v2 are required.

## Current — Song Whys score challenges

- [x] Strengthen musical accuracy, score magnitude and axis-confusion review; retain failed/disputed drafts with advisory scores and reasons, without rescoring. Additive review columns applied; no access/model/routing changes.
- [x] Display challenges in admin and exclude them from bulk approval; isolated desktop/phone examples show both numerical and uncertain suggestions, no overflow/errors, and individual override confirmation. Focused rule/storage tests and lint verify safeguards.
- [ ] Authenticated live drafting→saved review→approval acceptance: requires externally managed admin access and Vercel deployment; isolated fixtures are not authenticated acceptance. No catalog rescoring or historical review backfill performed.

## Current — automatic rejected-report recovery

- [x] Check owner-visible saved v1 before generation and after rejection/error; automatically retry an explicitly rejected unsaved draft once without restarting wait presentation. Unknown in-flight errors only check saved state; second rejection retains manual Retry.
- [x] 43 focused regressions and touched-file lint pass; preview build OK. Real existing guest saved v1 opens through updated flow on desktop/phone. Retry, concurrent-save and timeout branches verified with deterministic tests; a new naturally rejected live generation was not forced. Flutter recovery guidance updated; deployed production/Flutter adoption remains separate.
- [x] Desktop/phone UI fault-injection hides initial saved lookups and changes the first replay response to explicit rejection: the actual completed-reading flow automatically requests once more, displays real saved v1 without manual Retry, and opens all six matchups with zero page errors. No stored reading or provider response was modified; injection affects only the test browser.

## Current — report recovery and complete pick-six quips

- [x] Reported session c6160a69: HTTP 200 returned invalid_generation with no saved version; chosen final pre-draft failed semantic ceiling review, live attempt failed references/schema. Calls completed in seconds, not a 45-second timeout. Owner retry later saved accepted v1 at 04:36:19 UTC. Raw rejected listener drafts were not retained, so the precise invalid field is unavailable.
- [x] Gate Overtime on saved hunch; pick six selects an unused compatible two-line Person pair (four primary beats). Add writer schema limits matching local validation and field-specific repair feedback; remove redundant pick-six interim generation and distinguish rejected drafts from running requests. Evidence/reviewer gates, models, flags and frozen history unchanged; Flutter handoff updated.
- [x] 85 focused tests and touched-code lint pass; preview build OK. Fresh real guest f81e8d3e: Neutral at 0s, Reaction 2.56s, setup 5.12s, punchline 7.51s, Overtime 10.06s; accepted saved v1 delivered around 15s, exact report restored on reload with no page errors. Phone-sized saved-report readback has no horizontal overflow.
- [x] Follow-up desktop/phone browser check delays the saved hunch 6.5 seconds and starts final-writing beforehand: Neutral holds, then Reaction → unused two-line Person → Overtime in order at both widths. Saved report inspected with save popup dismissed at both widths. Isolated wait test supplies the normal query context; real six-pick delivery remains the end-to-end evidence above.
- [ ] Production/checkpoint/Flutter acceptance remains separate: requires deployed revision and client implementation; registered owner session is externally managed. This repairs diagnosed sequencing/output-contract defects, not a guarantee every model draft will pass review.

## Current — six-pick pacing and Overtime

- [x] Apply agreed category order after picks 1–6 in both saved flows, preserve 2.5-second beats and complete person pairs; use Overtime only during pick-six final writing.
- [x] Add the twelve approved Overtime lines to shared copy/API/admin library and update Flutter handoff with acceptance checks; existing API fields, flags and saved flow stay unchanged.
- [x] 44 focused regressions and touched-file lint pass; preview build OK. Real guest six-pick run displays every agreed category pattern, with ordered pick-two pair and final Overtime. All six isolated waits fit 1280px/390px; all twelve Overtime lines rotate in order and hold without repeats or page errors. Product has one dark theme.
- [ ] Completed-report/production/checkpoint and Flutter acceptance: real six-pick preview reaches the existing unsaved-report Retry screen, so successful final delivery remains unverified. Requires separate report recovery verification, deployment and Flutter presentation change. V1 endpoint remains correctly disabled; no flags changed.

## Planned — fix three: decade staples pack

- [x] Plan approved; prepared 160 sourced review candidates and a read-only 886-song catalog identity/pair-count baseline in docs/musicdna/staples-pack-2026-11-15. Initial audit: 43 active, 2 inactive, 9 identity holds, 106 without exact identity; no scoring or writes.
- [ ] First owner review gate: approve shortlist direction and resolve source/year balance holds (1991–2005 publisher pages returned 2006; early-2000s coverage and provisional-2026 sourcing remain incomplete). Original recording identities/years remain pending; no candidate is scoring-ready.
- [ ] After shortlist/identity review, run bounded OpenAI scoring for verified missing recordings and prepare within-lane pairing/coverage artifacts; production writes and activation require separate explicit approval.

## Current — listener song intake

- [x] Capture all three opener submissions atomically for guests and registered listeners; deduplicate demand without counting save retries. Applied intake/capture and hardening migrations; a real preview guest saved three entries and opened an older Pop matchup with no page errors.
- [x] Add admin-only AI scoring and exact-draft atomic promotion into inactive songs. One real SDK proposal identified Roxanne (1978) with ten validated dimensions; no catalog songs approved or activated.
- [x] 42 focused regressions pass including database guest/registered capture, demand replay, privacy denial, deletion and promotion replay; touched-module lint and preview build pass. Shared Flutter behavior documented in docs/musicdna/song-intake.md. New security warnings resolved; 52 pre-existing findings remain outside scope.
- [ ] Registered admin UI scoring→promotion and production/mobile acceptance: external-managed admin session unavailable; Vercel must deploy controls. Intake now uses its existing OPENAI_API_KEY directly, with managed preview fallback only when no OpenAI key is set. Capture already applies to future existing-client profile saves. No automated job or catalog seeding added.

## Current — opening interview parity

- [x] Approved narrow repair; reproduced the unsupported sessions-to-profiles lookup as PGRST200 using a real anonymous caller, while its direct profile read succeeds.
- [x] Read Discover opener analysis directly by visible session owner; shared three-song save requires returned owner/song data before success. Completed and Explore/refine selection bypass the opener lookup; policy/catalog/flags/history unchanged.
- [x] Real anonymous web and REST receive older Pop matchups from a 12-pair eligible 1973–1993 pool; saved openers read back, reload restores matchup, skip produces another older matchup with zero answered/one skipped and no page errors.
- [x] 79 focused regression tests pass; new adapter/ownership tests pass again after formatting, touched-test lint is clean and preview compilation is OK. No schema, flags or production deployment changed.
- [ ] Registered-owner and production/mobile acceptance: external-managed registered test access is unavailable; Vercel must deploy this repair and Codex/owner must verify mobile. Registered/guest owner wiring is covered by focused tests.
- [x] Trace shared web/REST creation and selection: era bias falls back when fewer than three eligible near-era matchups exist; profile-based opener persistence is not session-frozen. Original newer-song reproduction traced to the broken relationship lookup; production/mobile revision differences remain unverified.
- [x] Add visible Preparing your interview / Noted stage during third-song classification and first-offer loading; real guest opener-to-pairing browser check, eight regressions and page lint pass. No selection, model, flags or Flutter changes.
- [ ] Cross-client deployment confirmation: shared lookup failure is reproduced, but Flutter's deployed API destination/revision and registered opener readback still need Codex verification; no era-policy change authorized.

## Current — staged legacy Archetype retirement

- [x] Label residual rankings, winner heatmap and ranking-derived admin diagnostics as legacy-only; remove misleading V2/profile-validation conclusions. No computation, API, routing, flags or historical changes.
- [x] Record approved retirement decision and compatibility gates in `docs/musicdna/legacy-archetype-retirement.md` and project memory.
- [x] Admin lint and 7 existing routing regressions pass; preview build OK. Authenticated admin rendering remains unverified because this project's externally managed account session cannot be restored here.
- [ ] Disable ranking-only computation after migrating mobile/share/history consumers and validating compatibility; preserve trusted non-ranking choice records. Blocker: older-client and deployed authenticated compatibility acceptance.

## Current — flagged Song Whys

- [x] Implement optional frozen approved, score-matched audible descriptions behind default-off `MUSICDNA_SONG_WHYS_V1`; prepared/live fingerprints include annotations. Review SQL remains outside applied migration history.
- [x] Supply frozen descriptions to existing Critic writer/reviewer and deterministic final receipts; scores, claims, routing and quips unchanged.
- [x] 60 focused tests pass, including isolated PostgreSQL capture/immutability; touched-module lint and preview build OK; isolated desktop/390px receipts render without overflow. Flutter/flag contract: `docs/musicdna/song-whys-integration.md`.
- [ ] Apply reviewed capture SQL after explicit owner approval, then enable flag and verify a real completed reading. Production migration/deployment and external-managed authenticated acceptance are not available in this turn; flag stays off.

## Current — guest reading saving

- [x] Add post-reading guest save prompt and shared verified in-place account upgrade, preserving source reading URL; remove unsafe signup handoff and premature Saved copy. Ordinary guest signup redirects to upgrade; sign-in warns it cannot transfer.
- [x] Document Flutter contract in `docs/musicdna/flutter-guest-save-contract.md`; four identity/confirmation tests pass.
- [ ] Hosted confirmation/upgrade/readback acceptance: external-managed Auth prevents authenticated end-to-end validation; redirect allowlist/email delivery need deployment verification.
- [ ] Existing-account transfer: requires separately approved atomic ownership migration and shared endpoint; kept unavailable rather than pretending sign-in saves a guest reading.

## Current — consistent quip dwell timing

- [x] Use displayed-line timestamps and reject stale/doubled callbacks; each next quip gets 2.5 seconds, with no catch-up bursts.
- [x] 14 regressions and lint pass; isolated real browser rotation across hunch/final updates measured 2498–2501ms between lines, build OK. Ready results still replace waits immediately; production split-second behavior not independently reproduced.

## Current — admin quip library

- [x] Add read-only searchable quips with ordered setup/punchline groups, tone, conditions and compatibility; no copy edits or interview changes.
- [x] Isolated browser check: 8 personality groups, search finds the complete favorite-interview joke, 390px layout has no overflow or page errors; 10 relationship regressions pass and build OK.
- [ ] Authenticated admin-tab acceptance: external-managed auth prevents restoring an admin session; existing admin gate retained unchanged.

## Current — separate checkpoint interview stages

- [x] Keep flag-on pairing, quip wait, checkpoint commentary and final/retry screens mutually exclusive; preserve flag-off presentation. Unsaved/empty final output shows a retry, not a false completed report.
- [x] Add ordered quip relationship metadata and compatible group selection without changing approved copy; Flutter reference updated without changing the API shape.
- [x] 26 focused tests and touched-file lint pass; real guest first pick/wait/next pairing verified with no page errors in flag-off preview.
- [ ] Full checkpoint/final and mobile acceptance: preview uses per_pick; requires flag-enabled deployed client tests. Recording's underlying production narration failure is not diagnosed from the video alone.

## Current — checkpoint waiting-screen pacing

- [x] Stabilize the first quip through save/read transitions; checkpoint flow uses one quip after 1/3/5, up to three after 2 and four after 4.
- [x] Keep unused approved quips rotating throughout final-reading waits, preserving punchlines and showing ongoing activity without delaying ready results.
- [x] 18 focused regressions passed; guest first-pick preview showed each sampled line once with no page errors. Flutter sequencing notes updated.
- [ ] Checkpoint/full-six production acceptance: waits on deployment and both-client testing; final wait pool verified in focused tests, not a completed browser six-pick run.

## Current — waiting-copy and skip cleanup

- [x] Retire the boomer skip line and generic blood quip without changing rotation timing; shared API retains its compatible neutral recent-song field.
- [x] Skips never show a previous picked-song heading; visible choice numbering excludes skips, including history, while reaction keys remain server-bound.
- [x] Real guest pick → skip → pick verified in the preview: no picked-song heading on skip, second choice numbered 2, two history entries, no page errors; 12 focused tests pass and preview build OK. Flutter handoff updated; production/mobile rollout remains deployment-dependent.

## Current — reveal voice diagnosis, production credit blocker

- [x] Session 49974641-02bf-4e72-a9cc-25d2ea44c8db reused deterministic fallbacks, not accepted Sol reveals; prepared payloads record OpenAI 429 insufficient credits. Initial drafts also encountered reference/schema or motive review rejection.
- [ ] Restore OpenAI API credits, then repeat a fresh six-pick run and verify accepted reveal, voice and latency together. Blocker: owner's OpenAI billing balance. No model, prompt, timing, routing, learning or saved-reading changes made during diagnosis.

## Current — pre-write final reading during pick 6

- [x] While the default final pick is on screen, draft the reveal for both outcomes; finalize reuses only an exact frozen-ledger match, else writes live. Same writer/reviewer/rules.
- [ ] Verify speed in a live six-pick interview after Vercel deploys.

## Current — promote tested three-moves examples, hold facts

- [x] Promote the tested moves2 examples and open-question rules to the shared Critic; optional questions and no redundant uncertainty taglines. Models, complete ledger, strict checks and required independent review unchanged; song facts remain offline-only.
- [x] 31 focused regressions passed, including one-line acceptance with mandatory review and facts excluded from live calls; preview compilation passed.
- [ ] CGPT production retest: waits on Vercel deploying this revision; saved replies remain immutable.

## Current — journey, halftime and optional four-choice reveal

- [x] Introduced six-choice journey and halftime pause after three using the saved read, never a fabricated contradiction.
- [x] Optional four-choice completion guarded by shared server policy; six remains default, skips/exhaustion remain valid exceptions. Completed sessions return no more pairings; reveal counts and tests use frozen evidence.
- [x] Complete saved reveal, actual eligible-claim exception as twist, correction question and expandable receipts. Routing stays shadow; existing lane-local challenge weighting stays unchanged, so the immediate next pair is not guaranteed to test the emerging hypothesis.
- [x] 90 focused regressions (89 initial plus added service guard), touched-file lint and preview build passed. Fresh guest four-choice exit and six-choice completion both verified, including halftime, receipts counts, exact completed reload, 390px fit and zero page errors. Shared additive reveal contract documented.
- [ ] Production signed-in acceptance and Flutter rendering: await Vercel deployment/owner retest and mobile adoption. No flags or migrations changed.

## Current — faster replies and complete final reading

- [x] Measured direct OpenAI calls: Sol writer averages 13.0s read / 11.7s reveal / 6.9s chat; Terra review adds 2.4–3.0s, retries add another round. Conversational writers now use low reasoning; final reveal retains medium. Models, schemas, evidence and independent review unchanged.
- [x] Entire saved synthesis is visible at interview completion; audit details remain secondary and saved content is not rewritten.
- [x] 59 focused tests, touched-file lint and preview build pass. Fresh guest interview completed; full 302-character synthesis visible on desktop and 390px with no horizontal overflow. Signed-in production speed/quality after this change is unverified.
- [ ] Measure actual Sol latency and acceptance after updated Vercel deployment; direct OpenAI credentials/settings are unavailable in this sandbox. Preview uses Gemini, so its timings cannot establish a Sol improvement.

## Current — approved Critic model upgrade

- [x] Upgrade direct OpenAI Critic writer to GPT-6.1 Sol (medium reasoning), reviewer to GPT-6.1 Terra (low); strict schemas, replay and inference boundaries unchanged. Astra remains an explicit experimental writer override, not an automatic fallback. General LLM/preview calls unchanged.
- [x] 44 focused tests and touched-file lint pass; preview build OK. Role routing, strict schemas, reasoning effort, explicit overrides, actual model measurement and no silent downgrade covered. Handoff: docs/musicdna/critic-model-upgrade-2026-11-10.md.
- [ ] Production model readback: Vercel serves 08acb9a95a8e088cd3123249778447012fc020e5, whose defaults are still GPT-4.1/GPT-4.1-mini. Waits on updated deployment; existing Vercel role overrides may also need updating. No direct OpenAI key or Vercel settings access in sandbox; account-specific access and signed-in owner-QA acceptance remain unverified.

## Current — mixed Critic versions in production QA

- [x] Confirmed mixed versions in reported QA session; live SHA 792cb774c9fa97e48dfd17544e687eab55e0f8f9 already has one shared v2.3 generator. Fresh production vote in session 4afc2bf0-efd4-4fa1-ad5e-7418c94b2d3a read back accepted v2.3 / GPT-4.1 writer / GPT-4.1-mini reviewer. Exact cause of the older calls remains unproven; stale loaded clients/deployments are a hypothesis, not a confirmed diagnosis.
- [x] 40 focused tests pass, including interim v2.3 role/schema routing, zero eligible claims and Critic model defaults ignoring the general GPT-4o mini override; changed-file lint and preview build pass. Saved results and learning/routing flags unchanged.
- [x] Stop restoring mutable account-profile opener prose into a resumed zero-choice interview. Fresh production entry and vote verified; registered-owner QA acceptance still requires the owner's live retest after reload.

## Current — signed-in opening and conversation hangs

- [x] Repair stale session pinning on fresh Start and cancellation during restored-session opening; add bounded retryable waits without changing saved outcomes. Repeated same-user sign-in events no longer invalidate the interview.
- [x] 17 regression tests and lint/build pass; preview guest opener → pairing → exact reload and fresh Start pass; skip-ended conversation saves and reads back after reload. No page errors. Live public root/interview/auth work; no deployment configuration changes needed.
- [ ] Production registered-account opening/chat acceptance remains blocked by external-managed browser access and deployment of this fix; registered hangs are not claimed verified.

## Current — CGPT interview defects

- [x] Traced reported session: first two frozen votes have no declared tests, four of six are diagnostically usable; no historical reconstruction.
- [x] Shared v2.2 chat fallback reports failure without quoting prompts; full prompt echoes rejected and reasons measured locally.
- [x] Fresh Start, pinned resume IDs, result restart and atomic registered-admin owner-QA creation implemented; QA excluded from five diagnostic views, ontology, residual and shadow summaries. Tags imply no export eligibility.
- [x] New archetype assignment and profile labels require frozen-ledger support; completed finalization replays stored interpretation. Saved results unchanged.
- [x] 75 focused tests, changed-file lint and preview build pass; fresh guest Electronic six-choice result, non-echo chat, exact reload and fresh Start verified; 390px fits. Receipt: docs/musicdna/cgpt-interview-repair-2026-11-10.md.
- [ ] Registered-admin QA creation/profile acceptance and Vercel deployed acceptance: external-managed registered browser access and verified updated serving revision unavailable. 44 pre-existing security notices remain separate; no new migration warnings remain.

## Current — critic-quality and measurement-bias proposal

- [x] Approved plan; private diagnostic/review/exposure schema applied through migration approval boundary, guest-policy warnings corrected. Shared stage measurements, four-axis admin review and exact web/REST offer acknowledgement implemented; 39 focused tests and guest vote/readback pass. Exports/flags unchanged.
- [x] Added forward exact-output result/chat links, local prior-beat/self-report review context, lane/catalog partitions and repeated offered-song metrics. No saved listener content changed.
- [ ] Durable telemetry-write recovery and running-read event linking remain incomplete; cross-session aggregate reporting is not yet available (details: docs/musicdna/critic-quality-measurements.md).
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

- [x] Critic decision trace for owner-QA sessions (Phase 1 instrumentation)
- [ ] Run 5 signed-in owner-QA diagnostic interviews and report cause per run (needs admin sign-in on www.musicdna.fm after deploy)
- [ ] Phase 2: fix chat rejections (invalid_json / bad references / reviewer rejections on gpt-4o-mini)

- [x] Critic v2.3: strict JSON schema, axis/ID allowlist, named reviewer checks, one guided retry, song-aware chat fallback, stronger OpenAI writer model
- [ ] Rotate deterministic read templates so fallback reads don't repeat across stages
- [ ] Retest 5 owner-QA runs on production; target >=90% accepted

- [x] Decade gap songs: Country, Metal, Pop, recent Alternative (81 songs, 105 matchups live)
- [x] Explore your DNA: decade runs after a reading, admin decade × trait coverage
- [ ] Explore: Critic-written decade read, guest-to-account carryover (Flutter endpoints done)
- [x] Evaluate CGPT decade pack — report done
- [x] Decade pack loaded: 84 songs scored, 76 live, 75 matchups live

## Final reading payoff (plan 2026-11-12)
- [x] Music DNA panel: identity status, top-3 dimensions ("X of Y relevant comparisons"), receipts with one contradiction, invitation with guest save prompt (web + v1 `dna_summary`)
- [x] Sol signature name + hook with Terra fact check (live voice check pending)
- [x] "Refine My DNA" cumulative six-more run (database change applied; web + REST)
- [ ] Combined profile across readings on the Me page
- [ ] Guest reading carried into a new account (safe account linking, still open)

## Earn the archetype (plan 2026-11-12)
- [x] Readings show no archetype until v2 profiles are approved and `MUSICDNA_ARCHETYPE_V2=1`
- [x] `archetype_profiles` (10 drafts on current traits) + admin "Archetype v2" review tab + v2 matcher with tests
- [x] `song_trait_explanations` table (review-first) + coverage count in admin
- [x] Six profiles approved; Transformer reworked; match frozen per saved reading
- [ ] Finish Architect, Storyteller, Seeker, Believer (draft); then turn on `MUSICDNA_ARCHETYPE_V2` in Vercel
- [x] Archetype v2 on in preview; "Does this archetype fit you?" question
- [x] Song Whys drafting (batches of 10, most-picked first) + admin review queue
- [ ] Vercel: set `MUSICDNA_ARCHETYPE_V2=1` (owner)
- [ ] (Future) Agent Brain validation loop, Seeker first: see docs/musicdna/archetype-validation-agent-brain.md
- [ ] Freeze approved explanations into picks and feed the Critic/chat

## Current — Critic checkpoints behind a flag
- [x] Web + server: Critic only after picks 2 and 4, Next pairing button, "Get my reading now" / "Keep going (final pair)" after 4, quips between all picks, pushback in checkpoints; unit tests and docs.
- [ ] Set `MUSICDNA_CRITIC_CHECKPOINTS=1` in Vercel and run a live 4- and 6-choice test. Blocker: owner flips the flag.
- [ ] Flutter adopts the flow (Codex).
- [x] `MUSICDNA_ARCHETYPE_V2=1` set in Vercel by owner; applies to new readings after redeploy.
- [ ] Share: Instagram button directly on reading page (awaiting user yes)
