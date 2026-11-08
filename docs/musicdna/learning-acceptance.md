# AB-50 — first-hop acceptance

AB-50 is **In Progress** with a completed bounded delivery/recovery/withdrawal run
and remaining deployment/access/operational evidence gaps. The current evidence record is
[the November 7 run](acceptance/ab50-2026-11-07.json). Dates in that record are UTC;
November 7 is the operator's America/Los_Angeles work date.

## Approved test boundary

Alan approved a separate **Music DNA Acceptance** test area inside the existing
Echelon backend, with Alan as approving admin. This is a tenant/source isolation
choice, not another database, deployment or repository. Verify the actual Echelon
admin account before binding approval, membership, source ownership or review grants.
His verified Slack user is U32PGT1PA; a Slack email alone is not an Echelon identity.
The isolated staging source was provisioned through the normal approved flow during
this run. Its gates are now off and reviewer access is revoked; see the checkpoint
below for what remains retained.

The pilot uses only newly generated `ab50-<uuid>` synthetic personas and the frozen
synthetic observation/deletion contracts. It grants no real-user consent, does not
publish a share and leaves public V1/shadow routing/general signal model policy alone.
An explicit pilot run may enable only the exact approved synthetic source/scope,
and must restore its gates afterward while preserving receipts and suppression.
Do not change unrelated sources, rotate unrelated keys or deploy another service.

## Source runner

Architecture: operator CLI → injected journey use case → bounded HTTP adapter →
existing harness bootstrap/auth and authenticated REST. The module is not imported
by the app. It adds no API route, migration, dependency or background job.

```bash
npm run verify:learning-journey -- --help
# Supply AGENT_TEST_HARNESS_KEY through the existing private credential channel.
# Do not put a key value in a command, ticket, Git file, screenshot or report.
export MUSICDNA_LEARNING_ACCEPTANCE_APPROVED=1
export MUSICDNA_ACCEPTANCE_EXPECTED_SHA=<verified-serving-40-hex-sha>
export MUSICDNA_ACCEPTANCE_FIXTURE_PATH=/private/operator-directory/new-fixture.json
npm run verify:learning-journey
```

The parent directory must exist. Use a private directory outside Git. The CLI creates
the checkpoint exclusively with mode 0600; an existing filename fails before HTTP.
It creates one new persona per invocation, never resets/reuses another fixture, and
does not auto-retry a POST. Ambiguous failure retains the phase and known IDs for
operator reconciliation; do not blindly rerun it or fabricate missing acknowledgments.
Each HTTP request has a 30s bound, the process a 180s request deadline, the body reader
a 512KiB cap, and the run at most 24 requests. Redirects are refused. Credentials are
sent only to the fixed Music DNA origin and relevant API path. No tokens/content are
written to the checkpoint or stdout. IDs in that private checkpoint are synthetic
fixture selectors, not permission to enroll an arbitrary account or result.

The bootstrap and bearer actions use the harness. All session/choice/reveal calls use
the normal user-authenticated REST API, including v1's `completion.done` and progress
fields. Both v0 and v1 restoration must report six persisted choices, completed,
unpublished and immutable result version 1. This prevents a harness counter or a
service-role write from standing in for actual mobile API behavior.

The old harness's choice action was interrupted before a persisted vote in the first
probe. Its service-role path does not supply the `auth.uid()` expected by the choice
transaction. A subsequent normal authenticated choice succeeded. A second probe
stopped because the acceptance adapter initially read v0 completion fields from v1;
that was corrected in the runner. The final source journey passed. No application or
database change was made for either investigation. Private fixture inventory retains
these two interrupted runs as well as the completed run; do not call them three passes
or reset/delete them before reconciliation and the remaining checks.

## Execution order and evidence

1. **Read-only preflight.** Pin the serving Music DNA SHA and Persistence V2 flag;
   verify the installed migration hashes/grants and existing worker status. Record
   reported Echelon function source/settings separately from verified serving version.
   All operator SQL diagnostics use explicit `BEGIN READ ONLY`, local 10s timeout,
   metadata/numeric aggregates and `COMMIT`. No member records/raw query text/secrets.
2. **Prepare the isolated registration.** Resolve the approving/requesting Echelon
   user, then use the existing source request/decide flow for `music-dna-staging`,
   purpose `musicdna_learning`, staging environment and the approved test tenant.
   Verify the registry owns those bindings and both enable gates start false.
   Do not infer an actor from a display name or grant another account admin access.
3. **Safe credential handoff and review.** The once-only ingest key goes directly
   into the approved operator worker process/secret channel, never the report.
   Current AB-47 variable is `MUSICDNA_ECHELON_STAGING_INGEST_KEY`; production has its
   own `_PRODUCTION_INGEST_KEY` and is excluded from this test. AB-44's originally
   proposed generic key/URL/export env names are historical, not runtime settings.
   The endpoint is pinned by AB-47. Producer/delivery switches are private database
   `capture_enabled` / `dispatch_enabled`, both default false. The existing server
   credential authenticates the worker; the test-harness key cannot replace it.
4. **Source and reviewer authorization.** Verify the exact fresh synthetic owner,
   completed session/result fingerprint, six frozen choices, answered=6/unavailable=0
   and ledger version. Generate/persist the purpose/tenant-separated references once
   using the worker's server-managed secret, without exporting the secret. Approve
   matching fixed source/receiver lifecycle windows and one expiring reviewer grant.
   Do not infer this attestation from `user_metadata.harness`, sharing or an account.
5. **Capture/delivery/readback.** Enable only the approved test gates in reviewed
   order. Save exact-version feedback through authenticated REST; one authoritative
   feedback operation must create one captured item in its transaction. Replayed old
   unenrolled feedback must not backfill. Execute the existing bounded worker manually;
   verify exact persisted UUID/bytes, one durable receiver event/receipt and restricted
   paginated readback. Materialization, HTTP dispatch and delivery are separate facts.
6. **Failure and lifecycle matrix.** Run the table below using only this registration
   and synthetic fixtures. Network outages/429/crashes may be injected at the test
   transport boundary; label those receipts accordingly, never claim a real receiver
   outage/restart. Do not stop production functions, kill database sessions or change
   shared network settings. Only operator-reviewed controls may clear a specific halt
   or replay an exact quarantined item. No automatic remediation.
7. **Restore and report.** Stop sending; verify gates off, reviewer access revoked,
   pending deletion settled or explicitly escalated, and unrelated operational source
   behavior unchanged. Preserve the original UUID/receipt/withdrawal/closed-scope
   history; do not rerun migrations, extend/reopen a used scope or erase obligations.
   Fixed scope expiry is terminal: plan the last expiry test before closing it, and
   do not destroy the only readable fixture needed for the later AB-51 skill proof.

| Required case                                              | Evidence needed before pass                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Feedback/replay/version integrity while export off         | Hosted REST status/IDs plus read-only numeric persistence/zero-outbox evidence                             |
| Positive capture → dispatch → receipt → paginated readback | Hosted source+receiver checks with exact revisions and non-secret work/receipt IDs                         |
| Concurrent duplicate / same ID changed content             | One receipt / 409 with original unchanged                                                                  |
| Timeout after remote accept / process crash / stale lease  | Same bytes and UUID on retry; durable receipt convergence; no false delivered state                        |
| Outage / 429 / Retry-After / max attempts                  | Bounded observed retries/backoff/quarantine; identify injected versus real failure                         |
| Wrong key/source/environment/tenant/member/direct reads    | Denial at each real boundary, not merely a unit test or missing-auth probe                                 |
| Source disable / key rotation / dispatch pause             | Scoped halt, old-key denial, exact-byte replay after reviewed recovery, unrelated sources unchanged        |
| Withdrawal before/after send and during retry              | Local cancellation plus matching downstream completion/read denial/non-resurrection                        |
| Late/missing outcomes / immutable versions                 | Honest unknown/missing state and separate append-only operation/version receipts                           |
| Expiry/purge / rollback either order                       | Authorized fixed-window denial, bounded cleanup, preserved suppression/closed-state proof                  |
| No agent jobs/approvals/model/Slack from routine evidence  | Source-scoped before/after numeric counts and relevant worker/provider evidence                            |
| Delivery backlog alert                                     | Meaningful controlled failure to Alan's verified DM, exact UTC evidence and confirmed notification receipt |

Native PostgreSQL tests already exercise the failure/race/expiry mechanisms, but
their pass is recorded separately from hosted observations. A source SHA or SQL hash
is not an authenticated positive HTTP trace. Unavailable metrics/access are not zero.

## Ownership and operating limits

Alan responds to stalled delivery and quarantined work. Initial limits remain AB-47's
batch 5 (hard 10), one request/second/scope, 90s lease, 5s receiver request, finite
8-attempt cycles and 24h observation age. Deletions take priority; escalate their
backlog before six days, with seven days a failure. During this bounded acceptance run,
inspect the backlog before/after each fault and settle it before ending the run.
No unattended pilot may rely on this laptop or a callable cleanup RPC alone.

The existing hourly Railway infrastructure monitor remains separate. Its deployment
does not prove learning-delivery backlog coverage or scheduled cleanup. That coverage,
owner-only deduplicated alerts/confirmed receipts, hosted log/backup retention and any
external reviewer copies must be inventoried honestly before unattended delivery.
Only explicitly approved monitoring alerts go to U32PGT1PA; routine observations
create no Slack message. Do not send a fake incident to a channel or another recipient.

AB-44–49 close only against their specific evidence. AB-50 and AB-42 stay open until
the first connection's hosted report is reviewable. This work authorizes no real-user
export, per-pairing Agent Brain dependency, EdgeBot LLM activation, media buying,
automatic policy/skill changes or recurring Railway delivery deployment.

## November 7 bounded run: delivery proved, rollout held

The run used source `music-dna-staging`, tenant `musicdna-acceptance`, Echelon source
`197da0c2-8e93-4c90-ab93-1945398a474d`. The immutable window is
`2026-11-08T01:09:06.666Z` through `2026-11-09T01:10:06.666Z`. Never extend or
recreate that used scope. No migration, production-source registration, global LLM
switch, recurring worker or real-user export was added.

| Boundary        | Verified result                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source          | Six saved choices/frozen snapshots, unpublished version 1; feedback save/replay/conflict and cross-user checks passed; old unenrolled feedback was not backfilled.                                                                                                                                           |
| Delivery        | Nine new captured observations; eight reached distinct durable audit-only receipts; one unsent item was later cancelled by withdrawal. Paused dispatch claimed/sent zero.                                                                                                                                    |
| Readback/dedupe | Limit-one pagination, stable snapshot, late receipt on fresh same-window read, ten concurrent exact duplicates with one receipt, changed payload under the same UUID rejected 409.                                                                                                                           |
| Recovery        | Injected 429 respected seven-second Retry-After. Lost response and real disposable worker crash after actual acceptance converged to original receipts; restart before real lease expiry sent zero. Invalid receipt quarantined until one separate owner-controlled exact replay.                            |
| Authentication  | Actual source-key rotation rejected the old key; worker could not clear its own auth halt. Actual source-disable halt recovered only after separate operator action. Spoofed tenant/environment and direct Data API reads were denied.                                                                       |
| Withdrawal      | Delivered deletion while capture and receiver ingest were paused; eight receiver observations/events purged, unsent ninth cancelled, zero source payloads/pending deletions. Old cursor empty; replay/new-ID backfill rejected even after temporary re-enable. Repeated deletion returned stable completion. |
| Routine effects | Before purge: eight audit-only events, no linked agent jobs/approvals. Outcomes unknown. Provider-level model/Slack counters unavailable; ordinary operational-signal runtime regression not exercised.                                                                                                      |
| Owner alerts    | Controlled halt and recovery DMs confirmed to U32PGT1PA through Repo C; helper restart deduplicated the confirmed halt. These two operator alerts are separate from routine observations.                                                                                                                    |
| Closed test     | Capture/dispatch/receiver gates off, reviewer revoked and live read denied 403, key rotated again and plaintext discarded, exact operator session logged out, private JWT removed, controller terminated. Original reading remained unchanged.                                                               |

The Echelon approver was verified through normal login. Music DNA had no matching
human account: its FK approval uses a clearly labelled synthetic technical delegate
recording Alan's AB-50 instruction and verified Echelon actor. That identity received
no admin role. Do not represent it as Alan's Music DNA account or real-user consent.

Remaining closure work is explicit in the JSON report: exact serving Echelon function
management receipts; ordinary-member/other-tenant HTTP denial; actual terminal expiry
and retention boundaries; provider/no-routine-notification and operational-route
verification; backup/log/reviewer-copy inventory; owner acceptance. Native tests and
owner deployment receipts stay separate from those missing hosted checks. Attempt/age
boundaries have native coverage but were not all reached in this hosted run.

The closed test retains synthetic source readings/feedback/enrollment, minimal work
metadata and terminal scopes/suppression under the reviewed lifecycle policy. No
receiver observation detail remains. Metadata forgetting has not yet reached its
policy deadline; active purge is not backup erasure. No continuing laptop monitor,
Railway learning worker or cleanup schedule was installed. Do not claim unattended
coverage from the two manually generated monitoring notifications.

For AB-51's later skill smoke, use a fresh explicitly authorized fixture within a
valid approved scope. The withdrawn subject and used terminal scope may not be
reopened to retain a convenient demo. Development may use contract fixtures while
AB-50's remaining live evidence stays open; do not start another live batch by merge.
