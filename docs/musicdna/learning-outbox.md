# AB-45 — transaction-captured synthetic evidence outbox

Status: source implementation prepared for review; no production migration, enrollment, capture
flag, scheduler or outbound delivery is enabled by this work. AB-47 supplies the
recovery/dispatch runtime; AB-50 supplies approved hosted synthetic acceptance.
Real-user export stays outside the frozen `learning-observation.v1` contract and
blocked on TGA-317. Account existence and public sharing never authorize learning.

## Transaction and architecture

The existing web/REST/Flutter `submitFeedbackImpl` → `save_result_feedback` path is
unchanged. The reviewed V2 RPC still verifies ownership, locks the session, compares
retry payloads, binds the saved result version and commits an immutable feedback row.
An AFTER INSERT trigger writes one unique `musicdna_learning_outbox` row **in that
same transaction** for an explicitly enrolled synthetic result. If capture storage
fails, both feedback and capture roll back; the error is not swallowed. Unenrolled
feedback and default-disabled scopes do not create learning records. No HTTP call,
post-commit promise or model call is inserted into the user path.

A captured row already is the durable outbox entry: one persisted observation UUID,
unique feedback-operation anchor, exact result enrollment, trusted feedback timestamp
and minimal frozen projection. `created_at` from the source feedback is represented
at millisecond precision in the wire observation; dispatch/retry never changes it.
A process can stop immediately after feedback commits and a fresh worker can discover
the row using the indexed `state='captured'` queue. There is no historical scan of
result_feedback or repair by rereading a mutable result/catalog. Replaying an accepted
mutation performs no INSERT and creates no second observation; different mutations
append. Captured operations cannot be overwritten through a legacy UPDATE.

The server-only, injected mapper validates this projection against the checksum-pinned
portable contract, generates only the operation's purpose-scoped feedback reference,
and computes canonical JSON. A service-only materialization RPC checks exact equality
with the transaction projection and current lifecycle state, then changes `captured`
to `pending` and clears the redundant projection. Matching retries keep identical
bytes/UUID/fingerprint; conflicting content cannot overwrite them. No Echelon request
is sent by this use case. `pending` means ready for dispatch, not receiver acceptance.
AB-47 must separately validate a durable Echelon receipt before claiming delivery.

## Eligibility and evidence

The default-off export/capture flag is the private database column
`musicdna_export_scopes.capture_enabled=false`. This avoids another environment-variable
switch. An operator must also supply `receiver_tenant_id`, the matching fixed synthetic
scope, and an approved `musicdna_learning_enrollments` row for **one exact result**.
The common `musicdna_learning_export_allowed` helper now checks this flag too. Neither
ordinary clients nor the application service can enable scopes or insert/update an
enrollment. A privileged SQL owner must attest synthetic provenance and matching
owner/session/result plus its fingerprint; a client-provided privacy label is ignored.
No scope, attestation, key, sample record or approval is seeded by the migration.
An activated pilot additionally requires the existing MUSICDNA_BACKEND_PERSISTENCE_V2=1
mode: RPC presence alone does not verify that runtime flag. Legacy update-in-place
feedback is not an eligible producer path; immutable capture deliberately rejects
an attempted overwrite of an already captured operation. Verify V2 mode in AB-50
before authorizing any synthetic enrollment.

An enrollment stores persisted subject/decision/result HMAC references, not a public
share token. `learningReferences` derives a distinct HKDF purpose key from an injected
existing server-managed secret and HMACs purpose, receiver tenant, source/environment,
reference kind and internal ID. No secret is loaded, exposed or logged by shared code.
The operator/worker composition supplies it server-side. Persist enrollment references
once; never regenerate a subject namespace on managed-key rotation. Already materialized
rows are not remapped on retry. This avoids changing withdrawal targets or accepted
payloads during key rotation. Concurrent materializers with different keys must preserve
the first committed bytes and surface a conflict, not overwrite them.

Capture requires the enrolled owner/session/version, completed session, a matching
approved result fingerprint, six answered choices, zero unavailable evidence, matching
ledger version, and frozen entries with valid choice IDs. Missing/invalid provenance
and comment-only feedback become explicit `excluded` rows with bounded reasons and no
payload. New feedback predating enrollment is not captured; enabling capture later does
not backfill old feedback or replayed mutations. An absent/expired/withdrawn scope simply
creates no learning entry. Original feedback persistence remains the domain record.

Only these derived fields enter the wire projection: persisted pseudonymous references,
result version/source, exact six-answer count, ledger version, actual frozen catalog
revision when consistently known, explicit normalized accuracy/rating and fixed synthetic
privacy constants. Mixed/missing catalog revisions stay null. Current `session_results`
policy_version identifies the claim policy, not an Agent Brain recommendation policy;
routing/recommendation/experiment attribution stays null rather than being invented.
No reading prose, comments, quotes, songs/artists, vectors, prompts, chats, emails,
credentials, raw user IDs or share tokens enter the projection or ordinary logs.

The local outbox has private internal feedback/result foreign keys only to bind the
source operation and enforce deletion. These are not exported. Enrollment additionally
holds the internal owner/session linkage needed for approval and deletion; cleanup
removes that derived mapping. Pseudonyms and hashes remain linkable metadata, not
anonymization or inferred consent.

## Permissions and concurrency

Both new public tables use RLS with no client policies/grants. Service access is:
SELECT/DELETE enrollment (withdrawal/cleanup only, no approval/creation), SELECT/DELETE
outbox, and column-limited UPDATE of processing state/projection/canonical payload/
fingerprint. The service cannot rewrite observation IDs, source binding or operation
anchors. Materialize/exclude/purge RPCs are SECURITY INVOKER and service-only.

Private trigger functions use SECURITY DEFINER deliberately, with an empty search_path,
fully qualified relations and no direct EXECUTE grants to PUBLIC/anon/authenticated/
service_role. They live in the non-exposed `musicdna_learning_private` schema. This is
needed to atomically write private captures from the existing authenticated transaction
and to preserve auth-admin deletion cascades without giving listeners table access.
Capture verifies a non-null auth.uid matches the enrolled feedback owner; trusted
operator/auth-admin cascades operate on stored approved bindings, never caller-authored
user_metadata. No new callable elevated public RPC is introduced.

Lock order for capture is enrollment FOR SHARE → existing source scope advisory lock
→ scope row FOR SHARE → outbox write. The enrollment lock must precede the scope lock:
otherwise deleting an enrollment can deadlock the outbox foreign-key check. Withdrawal
and materialization acquire the scope advisory lock before touching outbox rows.
Materialization reads scope policy without FOR SHARE, preserving service SELECT-only
scope privileges. Policy edits atomically cancel the affected outbox rows and serialize
with materialization on those rows; they must not acquire the advisory lock after a
scope UPDATE. Native forced-overlap tests exercise these orders across independent
connections, not a single in-process database session.

## Withdrawal, deletion and retention

The existing AB-49 withdrawal RPC uses the same scope lock. Its first suppression
INSERT triggers immediate cancellation and clearing of **both** captured projections
and ready canonical payloads, in the withdrawal transaction. A send/capture that wins
first is subsequently cleared; a withdrawal that wins first prevents new capture or
materialization. Terminal states cannot be reopened by a stale worker/materialization.
Revoking/changing enrollment also queues downstream withdrawal; local clearing alone
would not block detailed Echelon readback. Deleting feedback, enrolled result or session
queues a minimal pending downstream deletion before local FK cleanup. Auth-admin account
deletion works without granting it access to private tables. These hooks do not implement
the deferred D06 account-deletion UI, auth-session revocation or public-link cleanup.

Turning capture off is a producer pause and atomically clears queued local detail.
It is distinct from per-subject withdrawal: use the withdrawal RPC to delete previously
received subject evidence. Closed/expired scopes and withdrawal suppression remain
terminal. Dispatch/receipt/retry integration is AB-47; it must never restore eligibility
from a late success/failure. Echelon's independent lifecycle gate remains authoritative
for receiver read denial and deletion; zero source tasks is not proof of receiver purge.

`purge_musicdna_learning_outbox(limit)` processes 1–1000 objects per call (default100)
under scope locks. It deletes expired outbox rows and cancelled minimal rows aged seven
days, then removes expired/withdrawn/revoked enrollment mappings after their outbox rows
are gone. Enrollment removal retains only the existing minimal pending downstream task;
it does not silently mark that task completed. The RPC returns **separate numeric
purged_outbox / purged_enrollments counters**. Domain readings/evidence remain governed
by D06 and are not removed by export cleanup. Completed withdrawal markers still use
the AB-49 expiry helper; retained closed scope rows prevent resurrection after markers
are forgotten. No listener-activity timestamp is changed by mapping or cleanup.

There is no cleanup/recovery schedule in this PR. AB-47/50 must prove the runner,
backlog escalation and active-system purge deadline before any scope is enabled.
Backups, hosted logs and reviewer copies need their separately recorded retention;
active purge does not claim backup erasure. A restore must reconcile terminal scope/
withdrawal state before reads or exports resume.

## Verification and rollout

### Applied AB-45 receipt — 2026-11-07

- Backend: `udycgnhvaanemhrchbuj`.
- Applied exactly once, history version `20261107205842`, history name `b8473d97-8f49-41d5-a8ad-84377600e976`.
- Retained file: `supabase/migrations/20261107205842_musicdna_learning_outbox.sql`; timestamp matches history, so fixture references remain unchanged. No duplicate creator exists.
- SQL SHA-256: `96987806da549c8d4fb90ff8d79359372d156b6252dd91f50e5390e27440f0e1`.
- Generated-record commit: `97adfeaa48834d9667cfb4fe67a197a6cb0b02e1` (not a serving/deployment SHA).
- Hosted metadata readback: both tables have RLS enabled and zero policies intentionally denying browser access. `anon`/`authenticated` have no table privileges. `service_role` has read/delete on both tables, plus only the five declared outbox update columns; no insert or whole-table update grants.
- All eight private functions deny direct execution to browser roles and service_role; the three new public invoker RPCs allow only service_role execution.
- Capture default is `false`; scopes, enabled scopes, enrollments and outbox counts are all zero. `cron.job` is absent. No keys, schedules, scopes or enable flags were created; AB-49 and earlier migrations were not rerun.
- Linter: two new informational no-policy findings are intentional fail-closed private tables; 37 pre-existing findings remain outside this rollout.
- Native disposable-database tests remain unavailable locally without `AB45_TEST_DATABASE_URL`; metadata/access checks do not constitute activated synthetic-pilot acceptance.

`npm test` runs the existing suite, mapper/reference/privacy cases, both frozen contracts
(55 observation +17 deletion fixtures) and the applied AB-49 migration duplicate/hash
guard. Native `npm run test:learning-outbox` is required separately; missing database
access fails that command explicitly. It accepts only a disposable loopback PostgreSQL
URL in AB45_TEST_DATABASE_URL with an ab45_* database name. Fixtures apply the reviewed
V2 persistence functions, the exact applied AB-49 migration, and this actual AB-45 SQL
in an isolated per-suite database. GitHub CI supplies PostgreSQL17.11. Three pre-existing
experimental tests remain skipped; a unit-only run also marks native cases unavailable.
The pinned postgres4.1.0 **development-only** driver is locked in npm and Bun; no runtime
SDK/version change is needed.

Native acceptance covers default-off compatibility, transaction and materialization
fault rollback, post-commit process recovery, 12 concurrent retries/materializers,
original/revised feedback append, changed provenance, no mutable-catalog fallback,
private grants/immutable anchors, forced withdrawal/capture and withdrawal/materialize
in both orders, enrollment deletion overlap, auth-admin account deletion, downstream
pending evidence, expiry and bounded removal of derived mappings.

1. Merge the reviewed PR. Keep capture disabled and enrollment tables empty.
2. Confirm the V2 feedback RPC and applied AB-49 receipt first. Apply only
   `supabase/migrations/20261107205842_musicdna_learning_outbox.sql` once on the existing
   Music DNA backend through its reviewed native workflow. Do not rerun AB-49 or earlier
   migrations. The migration asserts the V2 feedback prerequisite.
3. If the native tool assigns a different history timestamp, capture its receipt/hash,
   retain the generated migration matching that applied version, remove the equivalent
   proposed duplicate from the executable directory, and update this runbook plus the
   native fixture path in the same change. Preserve SQL bytes/generated types/history;
   do not repair remote history or run SQL again merely to match filenames. Rerun tests
   and the existing duplicate guard before syncing to GitHub. There must be one creator
   for each new table in supabase/migrations.
4. Verify metadata/numeric diagnostics in explicit READ ONLY + local10s timeout: RLS,
   no browser grants, private definer trigger ACLs, service invoker RPCs, zero active
   capture flags/enrollments/outbox, and original lifecycle history unchanged. Return
   applied-version/hash and generated-record commit receipts. No function/worker deploy,
   credentials, enrollment or flag activation is needed just to install this schema.
5. AB-47 composes bounded recovery, scoped claim/recheck, transport receipts and expiry/
   deletion jobs. AB-50 provisions only explicitly approved synthetic data and verifies
   hosted persistence/denial/race/rollback behavior before activation. TGA-317 is still
   required for any real-user contract.

Rollback: set the private scope capture flag off and keep delivery stopped. Preserve
terminal withdrawal/closed-scope state. Do not detach lifecycle triggers, restore older
writers/readers or drop the outbox after activation without reconciling pending captures
and downstream deletion. Correct forward; installed-but-disabled schema is safe to retain.
