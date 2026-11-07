# Railway monitoring runtime

Verified 2026-11-07 UTC (Nov 6 Pacific). **Hourly collection is active; Slack delivery is disabled pending the bot credential.**

| Resource | Actual value |
| --- | --- |
| Project | gallant-bravery / `ddc9d9d6-98be-4854-93c3-94ed324e3279` |
| Environment | production / `0b3a3e78-f9d0-454e-ba54-5eea5ac6a23a` |
| Worker | musicdna-infrastructure-monitor / `1d9c044e-30d7-40c6-8ee0-dc03f1c8ca16` |
| Volume | `c33c0344-8e36-48ea-ac8a-9192f5f58eaf` |
| Volume instance | `cb400445-e2b3-4c55-b0be-ebcd97731ebd` |
| Mount / owner | `/data/musicdna-monitoring`, UID/GID 10001, directory 0700, files 0600 |
| Capacity | 5000 MB, Railway Hobby default; creation API does not accept the proposed 1 GB size. Billing is based on used storage. |
| Replica/region | One, us-west2; application sleeping disabled |
| Public domain | None |
| Deployment | `49f920be-f792-4197-b9b3-a0a3ddfdd0b1`, SUCCESS |
| Runtime source | `d7012c12cd405d71283af163e134adaa7450d6e7`, CLI upload |
| Runtime image | `sha256:0d30596c6cc7dcce3a2bf4b4e99bfcf4eeed095a35553b98c763820ee0dc6b1a` |
| Command | `python -m monitoring.worker --state-dir /data/musicdna-monitoring --loop` |
| Runtime UID | Actual PID1 verified UID10001; `RAILWAY_RUN_UID=10001` |
| Restart | ON_FAILURE, maximum10 retries |
| Schedule | Continuous worker, hourly HH:05 UTC; no Railway cron or local automation |

The owner approved provisioning, credentials and hourly operation after merging
PR #16. Agent Brain and application production were not changed. Operation is
independent of Codex/laptop. A complete Railway/worker outage still needs an
independent dead-man monitor; none is configured.

## Evidence and safety

The owner completed `supabase login`. Its exact documented Keychain entry was
decoded in memory and transferred with Railway stdin without displaying or saving
the token. This is an account-wide CLI token: project-scoped/read-only credential
grants are **not** claimed. The worker always uses the read-only query endpoint,
explicit read-only transactions and validated local 10s timeout. A scoped-token
replacement is separate hardening, not automatic credential rotation.

Hosted checks under UID10001 passed four applicable DB templates, security/performance
advisors, numeric log aggregates and Agent Brain readiness. No raw customer/query/log
data, remediation, session cancellation, delivery retry or app DB change occurred.
The corrected log route is `/analytics/endpoints/logs`; error envelopes are rejected.
26 local tests pass, including this API contract and hourly restart/slot behavior.

The prior sanitized state/report/last-good copy were seeded with checksum verification
and retained the confirmed initial owner DM receipt. **The Railway volume is now
authoritative**; local files are preparation/mirror copies, never another monitor.
Operator terminals run as root even when PID1 is non-root: drop to UID10001 before
any diagnostic that saves state. State file ownership was corrected and verified.
Bootstrap used the installed client's existing authenticated Railway terminal;
no new SSH account key was generated or registered.

First hourly-loop run: `2026-11-07T07:30:20.422457Z`, slot `2026-11-07T07:00:00Z`.
Same-slot restarts must retain that slot and suppress a duplicate. Manual checks
cannot postpone the next slot; missed intervals are never fabricated. The next
timer slot is 08:05 UTC; later timer and incident/recovery delivery evidence remain open.
An actual worker restart passed: identical state SHA256, same 07:00 slot and last
attempt, retained one confirmed receipt, and PID1/state files still owned by UID10001.

Coverage is partial: insufficient API/Auth samples and comparable hourly/daily history;
no verified capacity limit; CPU/RAM/disk and downstream completion unavailable.
Hosted Health-advisor endpoint unverified and recorded unavailable. Unknown is never healthy.

## Finish Slack activation

`SLACK_BOT_TOKEN` is missing. The owner approved EdgeBot's bot; its Railway variables
and documented gateway configs contain no bot token. Integration docs place Slack
delivery in Echelon. Do not dump unrelated configs, rotate the bot, or modify Echelon
to extract secrets.

1. Owner copies the existing app's Bot User OAuth Token from Slack OAuth & Permissions
   directly into this worker's `SLACK_BOT_TOKEN` variable, never chat/git.
2. Verify the hosted bot resolves exact owner U32PGT1PA and opens only a DM. Required
   scopes: users:read, im:write, chat:write. Missing scopes must be reported, not bypassed.
3. Normal delivery suppresses resolved/superseded errors. The initial 73 advisor
   warnings already have one confirmed receipt and must not be resent. Ambiguous
   deliveries must never be automatically replayed.
4. Send only genuine current changes, record confirmed DM receipt, then enable
   `--loop --send`. Unit tests prove incident/recovery logic; do not manufacture a
   production outage. Verify quiet/restart behavior and update AB-37 before claiming
   alerting active.

References: [Railway volumes](https://docs.railway.com/volumes),
[sizing/billing](https://docs.railway.com/volumes/reference),
[Supabase logs API](https://supabase.com/docs/reference/api/v1-get-project-logs),
[token scopes](https://supabase.com/docs/guides/platform/personal-access-tokens).
