# AB-57 — real testing feedback

**Current checkpoint — November 9, 2026, 10:22 PM Pacific:** producer owner-only real capture is ON. Echelon PR #25 is merged, its migration is applied and the four compatibility functions are deployed per native receipt. The new real-QA source is approved but remains disabled; the owner has explicit bounded reviewer access and authenticated readback returns an empty window. Dispatch/model reviews remain OFF. Music DNA PR #34 and EdgeBot PR #23 still await manual merge. Automatic draft reviews have an approved $5/day maximum; no automatic review worker/schedule or model job has started. The later receipts below supersede earlier pending-deployment/budget notes.

Alan authorized real learning for current Music DNA testing on November 9, 2026. This supersedes the synthetic-only activation restriction for his verified account; it does not relabel historical evidence or enroll future people by signup. No additional hosted synthetic demonstration is required.

The existing chain is reused: immutable feedback capture → leased operator delivery → private Echelon receipts/readback → EdgeBot draft review → existing deterministic Agent Brain guidance. Real observations use `learning-observation.v2`, `consented_qa`, `explicit_tester_opt_in`, `real-qa.v1`, and `music-dna` / `production`. V1 remains unchanged for prior synthetic compatibility. The matching lifecycle policy is `real-qa-lifecycle.v1`.

## Collection

One private explicit account consent covers all new sessions/results during the bounded scope, rather than AB-52's first-reading assignment. The database enrolls each newly saved completed result and captures committed enum/numeric feedback in its existing transaction. Pre-consent sessions, other accounts and empty feedback do not enter the stream. Feedback corrections are separate immutable events, not independent people or improvements. The AB-52 evaluator still owns its separate first-response metric.

The account's purpose-scoped subject token is recorded once. Fresh random decision/result tokens are stored once per result; feedback tokens retain the existing purpose/source/environment/tenant-separated HMAC. The wire payload contains no emails, names, song choices, comments, reading prose or chat transcripts. Export approval is independent of public sharing and ordinary signup. Real QA can enter the outbox only under its truthful V2 projection; the human-pilot exclusion still protects V1.

The service-only `enroll_musicdna_real_qa` RPC requires a confirmed non-anonymous Auth account, explicit consent/approval references, the matching production lifecycle scope, matching approver and a maximum 31-day window. Browser roles cannot read/write consent or invoke the RPC. Consent deletion invokes the existing withdrawal lifecycle; expired or withdrawn scopes cannot be reopened. Existing result/account deletion hooks and leased retry behavior remain in use. These permissions are verified with native role-switching tests.

## Activation order and truthful status

1. Apply the reviewed producer and Echelon forward migrations once, recording exact SQL hashes/history receipts. No configuration is seeded by either migration.
2. Register/approve the new production-purpose Music DNA source in the existing Music DNA Acceptance workspace, under Alan's verified Echelon admin account. Do not reuse/reopen the expired staging source/scope. Transfer its one-time key privately to the existing operator worker configuration.
3. Create matching fresh bounded producer/receiver scopes and consent Alan's verified Music DNA account. Enable capture for future real QA. This immediately affects both web and TestFlight because they save to the same database; it does not need a mobile binary or change pairing behavior.
4. Deploy the V2-capable receiver functions and source worker before enabling dispatch. Verify an actual saved real feedback event reaches a durable receiver receipt. No synthetic rating is substituted if no new feedback exists.
5. Deploy the V2-capable EdgeBot review adapter. Grant only the approved reviewer/source access and configure manual draft reviews unless Alan chooses an automatic schedule and daily spend cap. Keep global app-signal LLMs and automatic app-policy changes off. Existing hard per-job/daily reservations and no-inference-retry behavior remain mandatory.
6. Record current gates, source revisions and actual delivery/review receipts here and in AB-57. Dispatch is not review completion, and no owner QA result establishes improved readings.

No recurring learning delivery/retention worker is installed by these code changes. A separate hosted schedule needs an explicit deployment/configuration receipt; the existing infrastructure monitor is not that worker. Expiry denies future capture/read/export even if a worker is unavailable; active purge and downstream deletion still require verified worker execution. Do not claim 24/7 operation or backup erasure from a successful dispatch.

## Checks

Producer native PostgreSQL: multiple new readings, other-account/pre-consent exclusion, real V2 mapping/materialization, append-only feedback corrections, verified-account/browser denial and withdrawal, plus existing outbox/dispatcher regression suites. Receiver native PostgreSQL: truthful receipt classification, replay, tenant/reviewer denial, scoped draft queue/start and HTTP projection, and withdrawal. EdgeBot checks reject mixed/synthetic receipts on the production QA path and permit one bounded draft call in mocked offline tests. Development fixtures are local regression inputs, never production evidence.

Source type checking, contract guards and worker build pass. The whole Music DNA lint command currently reports unrelated existing formatting failures; the touched TypeScript/JavaScript files are checked separately. A stale routing-source artifact inherited from main was refreshed to include the current pairing-eligibility source; no selector policy, invitation pin or routing flag was changed.

## Stop

Disable dispatch to pause sending. Disable capture to clear queued local details under existing scope rules. Withdraw the subject to request downstream erasure and revoke reviewer access to deny reads. Preserve immutable receipts and unknown-cost reservations. Reconcile pending deletion tasks and suppression/expiry state before any restore or subsequent activation.

## Live activation receipt — November 9, 2026 Pacific

Capture for Alan's verified Music DNA account is **on**, effective `2026-11-10T05:34:05.187Z`, through `2026-12-10T05:34:05.187Z` (30 days). One tester is consented. This database capture applies to future completed readings saved by both web and TestFlight, independent of this computer. No historical backfill or invented feedback was performed. At `2026-11-10T05:36Z`, real captures were zero: a real saved feedback receipt is still pending tester activity, not claimed as passed.

**Dispatch remains off; Echelon delivery and EdgeBot model review are not live.** Echelon PR #25 needs its forward migration and four named functions deployed, and EdgeBot PR #23 needs worker deployment. The daily automatic-review cap/schedule is unanswered; no model request or automatic schedule was started. No new source key, reviewer grant or receiver scope was created. The expired staging scope stayed off and unchanged.

Applied source migrations, exactly once; retained filenames match history and hashes match stored SQL:

- `20261110053326_musicdna_real_qa_learning.sql`: SHA-256 `4c310a9926e5af1070271b3f30f2d861b2cf72a6489009e5760e113e64c2b5e9`.
- `20261110053647_musicdna_real_qa_approver_cleanup.sql`: SHA-256 `a50d3d1e2710e1837f3eb19cfa3bdbb8a171227671f023585972d7b0e25b6880`. This forward correction makes approver-account deletion cascade through consent withdrawal instead of blocking deletion when other testers are invited. The applied earlier SQL/history was not edited or rerun.

Hosted ACL verification: consent RLS on; guest/signed-in browser table reads and enrollment RPC execution denied; service-role enrollment allowed; approver deletion cascade confirmed. Security advisors retained 27 existing warnings; the private table is included in the intentional no-policy informational finding. No advisor warning was reported as resolved by this change.

Latest source validation on concurrent main `57b99d0`: 461 application checks passed, 105 native-environment checks skipped in the general run; 77 separate native source/outbox/dispatcher checks passed. Lovable's concurrent work was retained with a regular merge. A test double was corrected to keep private critic measurement writes separate from event-log writes; production critic behavior was not changed. Source type-check, touched-file lint, contract guards and operator-worker build passed.

Reviewable changes: Music DNA PR #34, Echelon PR #25, EdgeBot PR #23. AB-57 is In Progress under AB-6 on board 101-133, Sprint 171. End-to-end real delivery and a completed real model draft remain outstanding, separately from code verification.

## Echelon compatibility deployment and source approval receipt

Echelon PR #25 merged as `3922c4be3fc94a871924946af2eda187fb6bae17`, containing reviewed head `5c3c074f55610af32670a4b771863db047b6c1dd`. Lovable's authorized deployment request `umsg_01m7218r3sf13brfhbq3xva9m2` completed; no second migration/deployment was performed when reconfirming.

- Native migration ID **9**, applied `2026-11-10T06:10:59.587Z`, executable `drizzle/migrations/0007_musicdna_real_qa_learning.sql`, journal index7. SQL SHA-256 `6a631c2ddec8b54ea5d984180afb6d862df579ded4355ecbcce74217d6e8b855`. Codex independently verified the live ID/hash/time and the native file at receipt commit `6c1daec`; both match the requested SQL.
- Native deployment receipt covers only `app-signal-inbound`, `musicdna-learning-read`, `musicdna-learning-review`, `musicdna-learning-review-worker`, preserving JWT settings false/true/true/false. Lovable reported all four unauthenticated calls returned401 at `2026-11-10T06:11:34Z`.
- Submitted source/settings hashes, respectively: `e96c8f1727d8c69ca3d8d2a53f2bb54f8f41d1102beac3918e47f5a774f74067`, `cc1652031cd8c997aa4c3868583fdd4d61ffd53015ee2e1227c90d4bb002c54e`, `140047690c23a866c453704420c50ef75da1aaa7ee1c693c922e1c383e5ffed8`, `4582f08c447631bbbd1d57861c3a4ac51b4da2657ab65dae8a91d8c4cdea3b09`. These are submitted hashes, not independently observed provider bundle hashes. Provider version IDs, deployment timestamps and independent JWT inventory remain unavailable.
- Codex independently checked V1/V2 constraints, all six private tables' RLS/browser denial, and service-only execution on all eight relevant functions using explicit READ ONLY transactions and local10-second timeouts. No deployed V2 evidence projection has been exercised yet.

Using Alan's fresh normal Echelon admin session, the ordinary `signal-source-request` and `signal-source-decide` APIs created and approved request `325c6e7c-2eac-42c2-8dd5-87eab7047d05` for production source `4f5950e1-4662-4e90-9c10-ce32b479b28a` (`music-dna`, `musicdna-acceptance`, purpose `musicdna_learning`). The one-time key was retained in private operator storage and was never printed or committed. Provisioning left `enabled=false` and `learning_enabled=false`. No existing source or credential was rotated.

The receiver's fresh `real-qa-lifecycle.v1` scope matches the producer window `2026-11-10T05:34:05.187Z` through `2026-12-10T05:34:05.187Z`. Only Alan's verified Echelon admin account received its explicit source-specific read grant. The expired staging scope/grants were not reused or reopened.

Normal authenticated production readback returned **403 read_forbidden** before that grant at `2026-11-10T06:21:31.877Z`, and **200**, zero receipts/no more pages, after approval at `2026-11-10T06:22:00.500Z`. These are live owner-authorization/empty-window checks, not a member/cross-tenant denial proof or successful V2 evidence delivery. No test users/evidence/jobs or model requests were created. Source remains disabled, active review scopes0, in-progress reviews0. Source-key transport/worker setup, the remaining code merges/deployments, hosted delivery/review scheduling and actual real-feedback receipts remain outstanding.

The owner approved a **$5/day maximum** for automatic EdgeBot draft reviews. It is a ceiling, not a spend target; existing stricter per-job/daily safeguards remain until deliberately configured. This approval does not enable automatic app changes, global app-signal LLM processing, memory writes or OpenClaw autonomous behavior.
