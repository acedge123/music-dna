# AB-49 — synthetic export lifecycle foundation

This implements a **synthetic-only control plane**, not a real-user exporter or the
D06/TGA-317 account deletion/consent flow. No browser/API route, source authorization,
key, flag, cron, observation payload or live network call is added. There are currently
no learning observation outbox records to purge. No share/account/action implies consent.
The reviewed receiver implementation is in `The-Gig-Agency/echelon-control`, documented
in `docs/musicdna-learning-lifecycle.md`. Both halves are required for rollout.

## Scope and durable withdrawal

A SQL owner approves `musicdna_export_scopes` for a reserved source/environment, exact
observed lower bound and fixed expiry (at most 31 days), matching Echelon's lifecycle
scope. The technical window bounds an explicitly approved synthetic pilot; it does
not change registered-readings or anonymous-session retention. Scopes are not seeded.
Normal server clients cannot create, change, extend, delete or reopen one. Never reuse
an expired scope/subject namespace, including after key rotation. Retain the closed
scope row after expiring subject markers so old observations remain ineligible.

`request_musicdna_learning_withdrawal` is a service-only SECURITY INVOKER RPC. It accepts
only the purpose-scoped synthetic subject ref, source/environment, durable UUID and enum
reason. It obtains a scope transaction lock and records terminal denial plus a pending
deletion in one transaction, even before the first observation was ever sent. Duplicate
requests preserve the first request ID/time/status; reused IDs for different subjects
or reasons conflict. Requests remain possible after expiry or approver removal so
cleanup can proceed. Clients cannot read or mutate these private RLS tables/RPCs.

`musicdna_learning_export_allowed` denies absent/expired/unapproved scopes, malformed
subject refs, observations outside the approved window and any withdrawn subject. It
is a **precondition, not an atomic enqueue/dispatch operation**. AB-45 must validate the
closed synthetic observation contract and take the scope advisory lock
`hashtextextended('musicdna-export-lifecycle:' || source || ':' || environment, 0)`
inside its enqueue transaction before checking eligibility and inserting a payload.
AB-47 must take that lock and recheck when claiming queued work; withdrawal must cancel
and physically purge pending observation payloads in the same transaction once that
outbox exists. Never restore eligibility from a late success/failure acknowledgement.
Both tickets must test this integration before AB-49 can close or AB-50 activate a pilot.

Withdrawal delivery is separate from observation delivery. `deliverLearningWithdrawal`
uses injected repository/transport ports. The Supabase adapter reads the one pending
source-bound task; a bounded HTTPS POST transport uses only the matching injected
source key, a ten-second timeout and rejects redirects. It sends only the portable
`learning-deletion.v1` DTO and bounds response bytes before parsing. No credential is
loaded or logged by this code; trusted server composition remains AB-47. The repo owns
that portable validator and 17 fixtures, checksum-pinned in Echelon alongside unchanged
`learning-observation.v1` (55 fixtures).

Only a 200, matching-ID, validated **completed** receipt calls the completion RPC.
Dispatch, 202, unauthorized responses, invalid receipts, timeout and offline receiver
remain pending with a bounded failure category and retry the original ID. A completed
request cannot be reopened by a late failure or duplicate acknowledgement. A database
acknowledgement failure is thrown; the caller cannot claim successful completion.
Completion clears the routing subject_ref while retaining its SHA-256 marker, request
ID, enum reason, timestamps and numeric count. These markers remain linkable pseudonymous
metadata, not anonymous records. An independently created receiver deletion may return
a different first ID: reconcile it; never acknowledge a mismatched receipt automatically.

## Retention, operations and dependencies

`purge_completed_musicdna_learning_withdrawals(limit)` is a bounded service-only sweep
(1–1000). It forgets completed subject markers only after the fixed scope expired seven
days ago; the closed scope still denies future export. Pending deletion is never
silently dropped: it retains only the purpose-scoped routing reference needed for
retry, without user identity, evidence body or prose, until confirmed/reconciled. The
operator must investigate pending work before seven days; prolonged failure is an
unresolved deletion obligation, not successful purge. Monitor pending age and require
a source/receiver restore reconciliation before any export resumes.

No sweep or delivery schedule is installed here. Before approving any pilot, AB-47/50
must verify a runner, retries, backlog alerts and completed active-system purge within
seven days. The receiver has independent immediate read/ingest expiry and bounded
physical purge. Its native concurrent tests verify both in-flight send/delete orders,
read-cursor denial and no resurrection. The two repos' scope windows must match.

No listener-activity clock, sessions, immutable result versions, evidence ledger,
public share links, debug logs or client caches are modified. D06 still owns those
classes: abandoned anonymous 30 days inactive, completed anonymous 90 days inactive,
registered until deletion, debug 30 days, content-free operational metadata 90 days.
That deferred work and verified consent/ownership remain TGA-317. Backup/PITR expiry
and hosted log retention are unverified; active purge does not mean immediate backup
erasure. Previously downloaded reviewer copies require operator inventory/deletion.
Real-user data/classes remain rejected by the frozen observation contract. Public V1,
`MUSICDNA_ROUTING_MODE=shadow`, local execution and EdgeBot LLM-off are unchanged.

## Rollout and verification

Merge this source PR and the Echelon companion PR. Apply only
`supabase/migrations/20261107202345_musicdna_synthetic_learning_lifecycle.sql` once to
Music DNA's existing authoritative Supabase after separate migration review; capture
source SHA, normalized SQL hash and journal receipt. Do not rerun earlier migrations.
Echelon applies only its named AB-49 migration and deploys `app-signal-inbound` with
existing JWT settings. No scopes, reviewer grants, sources, credentials or flags are
created by either migration. This code does not invoke production migration/deployment.

Run `npm test`, `tsc --noEmit`, scoped lint, and the Vercel production build. Source SQL
is exercised in disposable PGlite PostgreSQL, not hosted production; the receiver has
required native PostgreSQL concurrency suites in CI. Run both portable contract checks
and compare the deletion manifests across repos. Three pre-existing experimental tests
remain skipped; do not describe them as passing. Production verification uses the
metadata/numeric-only `learning-lifecycle-diagnostics.sql` within READ ONLY + local 10s
timeout. Never inspect listener rows or send real evidence to test this foundation.

AB-49 remains open for rollout plus AB-45/47 integration and AB-50 hosted synthetic
acceptance. Do not mark TGA-317 implemented. Rollback keeps learning disabled and
preserves terminal state; never restore an older receiver writer/read RPC that ignores
withdrawal. Forward fixes preserve deletion evidence and closed scopes.
