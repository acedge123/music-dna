# Music DNA infrastructure monitoring

Prepared for AB-37. **Hourly Railway collection and owner-only Slack alerts through Repo C are active.**
See [current Railway runtime facts](railway-runtime.md) for actual service/volume IDs,
credential coverage and activation gates. The proposal below remains a design record.
This is a separate hourly Railway worker with no dependency on Codex or Alan's
laptop. Mom Walk and Guild provide the detection/state
reference; their inspected schedules are local Codex heartbeats, not hosted workers.

## Identity and hosting assessment

- Source: `acedge123/music-dna`, backend `https://www.musicdna.fm/` on Vercel.
- Supabase: **Music DNA / `udycgnhvaanemhrchbuj`**, confirmed against source config
  and connected operator metadata. No application secret values were retrieved.
- Agent Brain is a separate stateless dependency: public `/ready` at
  `https://agent-brain-production-6956.up.railway.app/ready`. Only readiness and
  authentication-mode booleans are inspected; no recommendation/model request.
- Railway access works. Visible project `gallant-bravery`
  (`ddc9d9d6-98be-4854-93c3-94ed324e3279`), production
  (`0b3a3e78-f9d0-454e-ba54-5eea5ac6a23a`) initially had only Agent Brain and no
  monitor/volume. It now also hosts this worker and durable volume. No matching
  local automation was found or created.
  This inventory is limited to the connected/visible account, not every possible host.
- At initial inspection Agent Brain served merged PR #7 at `496881df5190ff7c75eddf8f1734568cb0b46d51`.
  Its separate IaC migration PR #8 is not applied by this work.
- Worker: **`musicdna-infrastructure-monitor`**, one replica, no sleeping, no public
  domain, explicit Dockerfile, durable volume at `/data/musicdna-monitoring`. Railway
  applied its default 5000 MB capacity rather than the proposed 1 GB. The deployment
  JSON is descriptive, not an executable manifest. Existing services and app DB stay unchanged.

## Safety boundary and credentials

Architecture: operator adapter → validated numeric/metadata observations → pure
policy/state transitions → atomic durable store → verified-owner Slack delivery.
This is operational tooling, separate from member-facing MCP and application APIs.

Every Postgres diagnostic uses explicit `BEGIN TRANSACTION READ ONLY`, local **10s**
statement timeout and `COMMIT`, and returns both settings for verification.
Templates are fixed and reviewed. No session cancellation, retries, delivery replay,
DDL, migrations, advisor fixes or automated remediation. No query text, cron
commands/return messages, customer/member rows, credentials or response error bodies
are saved. `chat_turns` is used only for numeric lease aggregates, never content.
Statement IDs and session PIDs are operational metadata, not query text.

The manual connected operator can read all stats but has broader access than these
transactions; a project-wide read-only credential restriction was **not** verified.
The hosted adapter deliberately uses Supabase's separate read-only query endpoint.
Its response compatibility is verified. The approved CLI credential is account-wide;
project-scoped/read-only credential grants are not claimed.

After authorization only, supply approved credentials through Railway variables:

- `SUPABASE_ACCESS_TOKEN`: approved operator access for this project, with the least
  available scopes covering read-only diagnostics, logs and advisors. A Management
  token can be broader than this project; document actual scope and owner rather
  than claiming isolation. Do not use the application service-role key.
- `CIA_URL`, `CIA_ANON_KEY`, `EXECUTOR_SECRET`: the existing approved Repo C operator
  connection, transferred from EdgeBot with stdin without displaying/storing values.
  The Slack bot token stays in Repo C; the worker does not require `SLACK_BOT_TOKEN`.
- Both operator connections are configured. Repo C's executor credential has broader
  operator authority; the adapter restricts its own requests to one fixed endpoint,
  TGA tenant, Slack action and recipient. Server-enforced narrow grants are not claimed.

Slack recipient **`U32PGT1PA`** was verified as Alan Edgett through the connected
Slack operator. The adapter always posts to that immutable user ID through Repo C's
`slack.chat.postMessage` action and confirms a returned D-prefixed DM ID plus timestamp.
Slack supports opening that user's 1:1 DM this way. No arbitrary channel targets,
member lists or message history are used. Hosted delivery has a confirmed receipt.

## Detection and accurate coverage

Defaults follow [Supabase detection guidance](https://supabase.com/docs/guides/observability/detecting).
Numbers are investigation thresholds, not service guarantees.

| Check | Policy and limitations |
| --- | --- |
| API/Auth 5xx | Last complete UTC hour vs preceding hour; each source separate; ≥100 valid responses each, ≥20 errors, ≥1% and ≥2× prior rate. Prior zero uses count/rate. Unknown status tracked separately. Missing/low samples are unable to assess. |
| Daily auth/authz | Same thresholds for 401/403 over two complete UTC days, per source; no user identities inspected. |
| Connections | Client backends / instance `max_connections`, alert at 80%, worsen at 90%, ERROR at 95% (operator escalation bands). Not pooler/application-available slots. |
| App sessions | Active/idle-in-transaction client backends older than 30s or blocked; own PID excluded, top20. Metadata only; no cancellation. |
| Query regression | Three 45–90 minute numeric snapshots, stable instance/version/global and per-statement reset markers/dealloc, nondecreased counters; ≥20 calls per interval, current mean ≥100ms and ≥2× prior mean. Top100 sampled statements only. Missing/evicted/reset samples remain unassessed; counters are never reset. |
| Advisors | WARN/ERROR per object; INFO preserved as context. Stable metadata/policy/index/role identifiers are hashed; descriptions/SQL discarded. Missing identity fails closed. Notices require intended-access/workload review, not a claim of exploitation. |
| Resources | DB and top20 table bytes, connections and complete-day API event growth (≥1000 events and ≥2× prior day; prior zero is new traffic without ratio). API events are not unique users or billing units. |
| Forecast | ≥7 daily samples 20–28h apart, positive growth, verified exact same metric/scope/units limit+source+time. Alert estimate ≤14 days or verified limit reached. No verified limit configured. DB bytes do not establish disk fullness. |
| Cron | Catalog presence first. Track failed/removed/disabled previously active jobs and missed expected UTC executions with 15m grace. Unsupported schedules/history gaps unable, never healthy. Scheduler success proves dispatch, not downstream completion. No `pg_cron` catalog currently. |
| Chat background work | Numeric pending/expired assistant leases and oldest expiry; expired leases alert. No mutation/retry. No generic delivery/outbox catalog found. |
| Agent Brain | Public readiness must have ok/auth_configured true and allow_unauthenticated false. Does not prove authenticated caller wiring or Music DNA learning readiness. |
| Monitor continuity | >90 minute saved observation gap alerts on recovery; never backfills invented samples. A stopped worker cannot independently notify while stopped. |

CPU/RAM/disk usage, pooler usage, Vercel-wide application errors, arbitrary external
schedulers, and downstream delivery completion are not available in the inspected
sources. They are explicitly unavailable/unverified. Hosted Health-advisor API has
no verified documented endpoint; the adapter records that gap rather than guessing.
Manual connected Health advisors can be checked separately. No independent monitor
of this worker/platform outage is configured yet; Railway platform notifications or
an external dead-man check would require a separate approved setup.

## Initial manual assessment

The saved local `state.json` / `latest-run.json` are the actual sanitized operator
snapshot, not test fixtures. Database snapshots were taken 2026-11-07 06:38 UTC
(Nov 6 Pacific); advisors/readiness were also checked during preparation.

- DB 23,653,523 bytes; **4/60** client connections (~6.7%); active1.
- No aged application sessions/blockers; no expired or pending chat leases.
- `pg_cron`/HTTP dispatch catalogs and delivery outbox were absent; cron is not
  applicable to the inspected database, not reported as healthy completed jobs.
- Security35 WARN objects; performance38 WARN and23 INFO objects. Existing notices
  need review; no advisor remediation performed. Manual Health advisors returned0.
- API last-hour sample only6 valid responses, zero5xx; preceding hour and both
  daily windows had no source rows. Rates/spikes and daily growth are **unable to
  assess**. Empty results do not prove healthy traffic or permission failure.
- Only one numeric performance snapshot and one daily resource point; regression
  and capacity history insufficient. No matching capacity limit verified.

## State, deduplication and delivery

`state.json` is authoritative: last-good per check, 48 resource points, six numeric
statement snapshots, 30 daily resource points, up to100 completed log windows,
acknowledged findings, per-object open/resolved state, pending events, confirmed
Slack receipts. No wholesale baseline reset or acknowledgement on delivery.
`latest-run.json` is the latest coverage report. `state.last-good.json` is the
previous validated atomic state. All runtime files are private and gitignored.

Persist with fsync + atomic replace, file mode0600, single process/file lock.
Missing/corrupt/wrong-project state fails closed and **never** seeds an empty baseline
automatically. Keep the source preparation snapshot and transfer its exact history,
acknowledgements and receipts to the volume; do not start a second independent state.
State files contain operational findings and should remain access-controlled.

New object, severity increase, threshold/band crossing, count worsening, doubled
latency/error magnitude, recurrence or changed collection failure queues an alert.
Agent Brain readiness recovery sends once after a confirmed incident DM.
Unchanged observations, lower severity, expected history warmup and routine success
stay quiet. Acknowledgements are retained and never clear worsening/recurrence.
Resolved/superseded pending events are not sent. Missing metrics never resolve a
prior finding as healthy; query resolution requires that specific reset-valid sample.

Delivery writes `sending` **before** transmission. Only a Slack response with exact
DM channel and timestamp is a confirmed receipt. Interrupted/ambiguous sends remain
unconfirmed and are not automatically replayed. Operator must inspect that DM and
reconcile the batch before considering any further action; do not retry deliveries
without explicit authorization. A delivery failure remains recorded in durable
state even if Slack cannot deliver a notification about its own failure.

## Authorized preparation and proposed activation

Local inspection/tests are preparation only; **no local recurring automation**.
The authoritative state is now the Railway volume. The mobile checkout's `monitoring/`
folder holds preparation/mirror artifacts only; never run a second monitor from it.
Source code lives in the separate backend Music DNA review branch. Actual state,
receipts and latest-run files must never be committed to either repository/image.

Provisioning, hourly collection and Repo C Slack delivery were authorized and are
active. The checklist below records the repeatable setup. See `railway-runtime.md`
for actual hosted evidence and documented coverage limits.

1. Review/merge the monitoring source PR. Build image from repo root using
   `monitoring/Dockerfile`; pin the reviewed image digest for deployment. No Python
   third-party packages. Railway container build and hosted diagnostics are verified.
2. Create only the proposed separate service and volume in the inspected Railway
   project. One replica, volume UID/GID10001, no public domain, no app sleeping.
   Configure the approved Supabase and Repo C operator variables without printing them.
3. Transfer the authoritative preparation state, latest report and receipts to the
   volume. Verify project/recipient identity, file permissions and retained history.
   Record the actual service/volume IDs and approved deployment SHA in state/runbook.
4. Run once **without** `--send` using the actual hosted credentials. Confirm the
   read-only endpoint supports these explicit transaction batches and all privilege
   markers; failures remain unable. Do not substitute a write-capable query endpoint
   silently. Verify advisor object identity and each log-source response shape.
5. Inspect pending/ambiguous events and confirmed initial receipts. Verify the fixed
   owner through an operator and confirm one genuine changed finding through Repo C.
   Enable `--loop --send` after that review. Use a fresh deployment snapshot after
   changing the command and inspect PID1; image-only redeploy can retain the old command. Worker
   runs once per HH:05 UTC slot (UTC windows are complete), deduplicates same-slot
   restarts independently of manual checks and never fabricates missed intervals.
   Railway cron is not used alongside this loop.
6. Restart worker and verify persisted receipts/history survive. Observe a second
   subsequent timer-driven run and confirm no unchanged DM. Record actual hosted
   evidence and only then label monitoring active. Query comparisons need three
   valid hourly snapshots; capacity needs matching history and limit.

Rollback: stop this worker and retain/export the volume. Never alter app production
or run remediation as part of monitor rollback. Loss of state requires explicit
operator recovery from last good copy, not automatic rebaseline.

## Verification and primary API references

Run from repository root: `python3 -m unittest discover -s monitoring/tests -v`.
The fixed Postgres templates were executed through the connected operator with
read-only/timeout markers; cron was not executed because its catalogs are absent.
32 tests pass. Container build, operator transport, volume seeding, overnight hourly
runs, owner-only Repo C delivery, unchanged-state quiet behavior and restart/receipt
preservation are verified. Real production incidents are not manufactured to test
recovery; that logic has deterministic tests. Unavailable metrics remain flagged.

- [Supabase read-only API](https://supabase.com/docs/reference/api/v1-read-only-query)
- [Supabase logs API/filtering](https://supabase.com/docs/guides/observability/advanced-log-filtering)
- [Slack users.info](https://docs.slack.dev/reference/methods/users.info/)
- [Slack user-ID DM delivery](https://docs.slack.dev/reference/methods/chat.postMessage/)
