# AB-47 — bounded operator dispatch

Source implementation for review. This change creates no schedule, service, source,
credential, enrollment or enablement. It sends no production evidence during development.
The initial execution mechanism is an authenticated **one-run operator command**, separate
from the web/REST/Flutter request path. A recurring Railway deployment and owner notification
routing need their explicit activation review and AB-50 hosted proof. The existing hosted
infrastructure monitor is unchanged; this command alone is not a 24/7 deployment.

## Execution and credentials

Build and inspect without sending:

```bash
npm run build:learning-worker
npm run learning:worker -- --help
npm run learning:worker -- --source music-dna-staging --environment staging
npm run learning:worker -- --source music-dna-staging --environment staging --inspect <work-uuid>
```

Default mode calls only STABLE service-only metadata RPCs (PostgREST READ ONLY). Inspect
returns operational work/receipt UUIDs, state, timestamps and counters; never payloads,
subject refs, raw identities, lease tokens or secrets. Missing schema/permission/network
checks fail unavailable; they are not a healthy zero. `--help` needs no credentials.
The source/environment pair is closed and required. There is no tenant or endpoint URL
supplied by an application user. Tenant binding is checked against stored source records.

After reviewed migration/configuration and explicit pilot authorization, a manual run is:

```bash
npm run learning:worker -- --source music-dna-staging --environment staging --execute --batch 5
```

Execution additionally requires the private database flag `dispatch_enabled=true`.
It defaults false. Capture/enrollment authorization remains separate: pause dispatch with
this new flag to retain policy-compliant ready payloads; setting `capture_enabled=false`
continues AB-45's immediate local payload clearing. Do not infer approval from a merge,
an account, a public share, a caller privacy label or user_metadata.

Server/operator environment only:

| Variable                                 | Purpose                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_URL`                           | Existing Music DNA backend; defaults to `https://udycgnhvaanemhrchbuj.supabase.co`. Verify the target before execution.                          |
| `SB_SECRET_KEY`                          | Existing Music DNA server key. Existing aliases SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY are accepted. Never expose to a browser or chat. |
| `MUSICDNA_ECHELON_STAGING_INGEST_KEY`    | Approved Echelon per-source staging key, read lazily only for staging sends.                                                                     |
| `MUSICDNA_ECHELON_PRODUCTION_INGEST_KEY` | Separate approved production source key; never a staging fallback.                                                                               |

The endpoint is the already reviewed Echelon `/functions/v1/app-signal-inbound/learning`
on `yczomejrvihbmydyraqg.supabase.co`; deletion uses its `/delete` suffix. No global signal
secret, AGENT_TEST_HARNESS_KEY, Lovable AI key or OpenAI key can substitute for the source
key. No keys are generated/read/transferred by this PR. Operator composition derives
reference subkeys from the existing server key as AB-45 defines; it never re-derives
already committed wire bytes or enrollment refs after a rotation.

The bundled Node 22 worker is built separately with the existing Vite toolchain. It is
not imported into the app server entry or a user-facing MCP tool. Supabase clients disable
session persistence/refresh. `--execute` is deliberately explicit; there is no request
promise, fire-and-forget callback, anonymous trigger URL or automatic EdgeBot cron.

## Durable queue and finite execution

The loop recovers at most batch-size captured rows through AB-45's existing mapper,
then claims no more than 1–10 jobs per run. It stops starting claims after 45 seconds;
its operator process has a shared 60-second abort deadline, database calls have local
10-second client deadlines, and each external request is limited to five seconds.
A captured projection already committed atomically with feedback; no historical scan or
mutable catalog/result lookup is used for recovery. Mapping failure leaves a durable
row or an explicit exclusion. Materialization does not claim downstream delivery.

`musicdna_learning_dispatch_jobs` holds only source/environment, work UUID, immutable
tenant binding, lease/counters, bounded failure enums and receipt UUIDs. Payloads stay
on their original outbox/withdrawal rows; there is no extra copy in the job table.
Discovery skips all existing jobs before its bounded INSERT, so older delivered rows
cannot starve the 101st observation. Deletion is always selected before observation.

Claim and begin-send are distinct transactions under the existing scope advisory lock.
Claims have random 90-second leases; send authorization is single-use and requires at
least 15 seconds left. It rechecks the current dispatch gate, source binding, capture
eligibility, enrollment approval, expiry and withdrawal immediately before returning
the bytes. No database transaction/lock spans network I/O. Multiple workers may claim
different jobs, but durable per-scope rate state allows one request start per second.
The CLI sends sequentially. `Retry-After`/circuit cooldown returns backoff instead of
sleeping for minutes or busy-looping.

Expired leases recover the same work UUID/content with a new token. A crash before
send consumes a claim, not an attempt. `attempts_started` counts successful begin-send
authorizations (including validation/key failures before HTTP), not verified API calls.
`transport_calls` counts transport invocations; `http_responses` counts received HTTP
responses. Timeouts may have reached the receiver and are not called unsent. Only a
valid durable receiver receipt increments delivered/deleted counters.

Every observation is checked against the frozen synthetic-only validator, source pair,
observation UUID, canonical JSON and saved SHA-256 before sending. Deletions use the
closed six-field DTO and exact persisted deletion UUID/ref. HTTPS redirects are refused;
error response prose is cancelled unread. Successful response reads are capped at 8,192
bytes before UTF-8/JSON parsing. No credential, header value, body, user identity or
pseudonymous subject is logged.

A 200 observation response must match `learning-observation.v1`'s audit-only receipt,
including the expected observation UUID and null agent/approval IDs. A 200 deletion
response must say completed and match the expected deletion UUID. 202/other 2xx or an
invalid receipt is not success. The database independently validates receipt anchors
inside the lease-bound completion transaction. Deletion completion clears the routing
ref and stores its count/time atomically with delivered job metadata; local ack failure
rolls both back. A crash after remote acceptance retries the identical body and recovers
the receiver's idempotent receipt. A stale token or concurrent withdrawal cannot mark
work delivered or restore a removed payload.

## Failures, pause and operator response

| Result                                                          | Action                                                                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeout/network ambiguity, 408, 429, 5xx                           | Retry the same UUID/bytes with server-computed exponential backoff/jitter. Base 5s, bounded 1h; valid Retry-After seconds/date hints are capped 1h.                     |
| Five consecutive timeout/5xx failures                           | Five-minute per-scope cooldown; no busy retries. A confirmed later receipt resets transient circuit state.                                                           |
| 400/413, 409, invalid receipt                                     | Quarantine with a bounded code; retain uncertainty, never rewrite accepted IDs/payloads.                                                                             |
| 401,403,missing source key/endpoint                             | Durable scope halt and operator attention; stop further sends. 403 means authorization denied and can include source/lifecycle gating, not necessarily a missing key. |
| Missing/changed tenant binding                                  | Quarantine missing provenance or halt on rebind; never guess another tenant and call deletion completed.                                                             |
| Eight attempts in a cycle, observation age 24h or deletion age 7d | Quarantine; unresolved privacy obligations remain pending and visible.                                                                                               |

The initial operator is **Alan Edgett**. Exit 1 means unavailable/configuration; exit 2
means attention required. Structured reports plus durable halt/quarantine state are
the manual-run alert path. Hosted activation must connect these findings through the
approved operator integration to Alan's verified Slack DM U32PGT1PA, deduplicating new/
worsening findings and confirming notification receipts. That notification path is
**not provisioned or claimed operational by this source PR**. It must not fall back to
public/channel messages or silently label a missing alert destination healthy. Require
that routing before unattended runs and before the seven-day privacy deadline can be
claimed verified. Escalate deletion backlog before six days; seven days is a failure.

To rotate a key, stop dispatch for the scope, update only the approved source-specific
runtime credential through the normal secret channel, verify registry/tenant/environment
against the intended Echelon source, then authorize a bounded manual retry. The worker
can INSERT a halt but cannot UPDATE/DELETE it; a SQL owner clears one exact reviewed halt
with UTC reason/approval evidence and cleared_by when available. A successful request
from another job does not clear a credential halt. Never rebind or reopen a used scope;
old pending work retains its original tenant, and legacy deletion rows without that
binding are not backfilled by guessing.

One replay cycle is allowed only by an operator changing `replay_count` from 0 to 1 for
an exact reviewed quarantined job, setting it back to retry/due while preserving UUID,
payload, original age and counters. The service has no UPDATE permission on replay_count,
job anchors, tenant binding or source switches. Max-age/withdrawal/expiry checks still
apply. Do not replay invalid/conflicting content blindly or change bytes under an old
ID. Investigate accepted remote state first; withdraw/close ambiguous evidence when
needed. An unresolved overdue deletion may require an authorized direct reconciliation
against a confirmed receiver receipt; the old unleased completion RPC is revoked from
ordinary service callers after this migration. SQL owners retain it for explicit
reviewed reconciliation. There is no automatic remediation/key rotation/replay.

## Privacy maintenance and lifecycle integration

`--execute --maintenance` additionally performs **project-wide**, bounded privacy cleanup
(up to 100 objects per RPC), including sources other than the selected send scope. This
is an explicit operator maintenance action; omit that flag for a send-only run. It can
queue deletion obligations for expired enrollment, and it does not mean downstream
purge is complete. The operator must inspect all source/environment backlogs afterward.
Cleanup also runs while dispatch is paused if explicitly requested, but sends remain off.

Source withdrawal already clears captured/ready payloads under the same scope lock.
An observation authorized just before pause/withdrawal can be in flight: its late ack
cannot reopen cancelled local data, and Echelon's terminal subject suppression serializes
with receiver writes. After deletion commits remotely, late/replayed observations cannot
resurrect detail. Before that receipt, an offline receiver remains an unresolved deletion
obligation, not a claim of immediate remote erasure. Old reviewer copies/backups have
their separate policy and operator inventory.

New deletion records freeze their tenant from the still-existing enrollment, or from
the current exact scope for before-send withdrawal. Existing rows without provenance
remain null/quarantined; migration does not infer their target. Removing enrollment,
feedback, result or account still queues downstream deletion. The worker can deliver
these even if capture is off, the scope expired or its approver was deleted, as long as
dispatch is explicitly authorized and the original binding/key remains valid.

Job metadata expires at scope expiry +7 days or 90 days. The bounded purge deliberately
retains any unresolved deletion job/task for operator attention. Halt rows contain no
listener refs; SQL owners separately remove cleared halt metadata after 90 days while
preserving active unresolved incidents. Source outbox/enrollment and completed suppression
cleanup retain AB-45/49's policies. Domain evidence, listener activity, public shares and
client caches are untouched; real D06 implementation stays TGA-317. Restore reconciliation
must preserve scope closure, withdrawal and delivered/unknown receipt state before any
read or export resumes. This PR neither installs schedules nor claims backup erasure.

## Verification and rollout

Unit/fake-receiver tests exercise receipt validation, malformed/oversized responses,
redirect/key restrictions, pause, time budgets, retry hints, audit redaction and CLI
composition. Required native tests use separate disposable loopback PostgreSQL databases
and the actual AB-45/47 migrations. They cover competing workers, lease recovery, lost
remote ack, immutable content, atomic deletion ack fault rollback, rate/circuit limits,
quarantine/replay, binding changes, private grants, legacy ack denial, cleanup and the
worker loop with a fake receiver. CI also builds the separate worker and runs --help.
Local tests/negative production probes do not establish hosted positive delivery.

1. Confirm the corrected AB-45 migration from PR22 is applied once and its repository
   file matches native history. Do not rerun AB-49/45 merely to match filenames.
2. Merge this PR, then review/apply only `20261107214337_musicdna_learning_dispatcher.sql`
   once through the existing source backend workflow. Keep capture/dispatch false and
   enrollments empty. If the tool stamps a new version, retain one generated file matching
   applied history and reconcile its proposed duplicate/fixture path in the same change.
   No data backfill, source/key creation, worker/service deployment or schedule is needed
   just to install this schema. Return SQL/history/hash and private-grant receipts.
3. Verify only metadata/numeric aggregates in explicit READ ONLY + local 10s timeout:
   RLS, no browser table/RPC grants, no worker halt-clear/replay/switch privileges, flags
   false, zero jobs/enrollments, original receipts retained. Run status only; unavailable
   checks must fail. Store the deployment commit and submitted runtime hash separately.
4. AB-49/50 authorizes only a synthetic scope and separately verifies source key/binding,
   V2 mode, deletion backlog alert routing, manual receiver outage/restart/duplicate/crash/
   rotation/withdrawal traces and rollback. Only then authorize one manual execute job.
5. A later explicit Railway deployment/schedule approval must verify durable job state,
   owner notification receipts and repeated expiry/deletion completion before unattended
   24/7 delivery is described as live. No EdgeBot LLM, promotion or real-user consent gate
   changes are implied.

Rollback pauses dispatch and keeps queued bytes/leases/receipt/withdrawal metadata.
Stop the runtime, allow leases to expire, reconcile unknown remote acceptance, and correct
forward. Never restore an unleased acknowledgement path or older lifecycle-bypassing
writer, clear pending privacy obligations, or regenerate payload IDs to make retries pass.
