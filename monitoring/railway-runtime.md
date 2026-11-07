# Railway monitoring runtime

Verified 2026-11-07. **Hourly collection and owner-only Slack alerts through Repo C are active.**

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
| Deployment | `4802780a-d8cd-4cf4-8a84-3364d36cfe0b`, SUCCESS |
| Runtime source | `143756318aa5bc98e7237883eb2e32f082d3d796`, CLI upload |
| Runtime image | `sha256:bb2bf8bc50eada17f8138115118b153c6af795be2f6a2e9517fa70c975a24264` |
| Command | `python -m monitoring.worker --state-dir /data/musicdna-monitoring --loop --send` |
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
32 local tests pass, including operator envelope/recipient/receipt constraints and
the existing counter/state/hourly restart behavior.

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
timer slots were subsequently observed through 16:05 UTC, including consecutive
13:05, 14:05, 15:05 and 16:05 collections. Manual hosted delivery acceptance at 16:20
UTC does not change the saved 16:00 scheduler slot.
An actual worker restart passed: identical state SHA256, same 07:00 slot and last
attempt, retained one confirmed receipt, and PID1/state files still owned by UID10001.

Coverage is partial: insufficient API/Auth samples and comparable hourly/daily history;
no verified capacity limit; CPU/RAM/disk and downstream completion unavailable.
Hosted Health-advisor endpoint unverified and recorded unavailable. Unknown is never healthy.

## Active Repo C Slack delivery

The owner clarified the existing **Repo C** operator integration. A separate Slack
bot credential is unnecessary. `CIA_URL`, `CIA_ANON_KEY` and `EXECUTOR_SECRET` were
copied from the approved EdgeBot service connection into this monitor, in memory
and via Railway stdin. No raw Slack token was exported or new SSH account key added.
Repo C and EdgeBot configuration were not modified.

The client fixes endpoint `https://rrzewykkwjdkkccwrjyf.supabase.co/functions/v1/internal-execute`,
tenant `1c625b8e-ad69-4209-aa1c-e4f0745efdbe`, service `slack`, action `chat.postMessage`
and recipient U32PGT1PA. It accepts only successful operator envelopes with a
D-prefixed DM channel and timestamp. No user lists, message histories, arbitrary
recipients, redirects or credential-bearing error bodies are used. The shared
executor credential itself has broader authority; these are client restrictions,
not a claim of server-enforced credential isolation.

The owner ID was freshly verified as Alan Edgett through the connected operator.
At 16:20 UTC the hosted UID10001 worker delivered one genuinely pending coverage
finding through Repo C and recorded its confirmed DM receipt. The initial 73 advisor
warnings were not resent; four resolved collection-error events were superseded.
Two confirmed receipts are retained privately. An unchanged-state recheck attempted
no network send, and the receipt survived redeployment. Actual PID1 command includes
`--loop --send`. No synthetic outage, delivery retry or user-facing MCP change occurred.

For command/config changes use a fresh `railway up` snapshot and inspect PID1.
An image-only `redeploy` retained the earlier no-send command during setup; it was
corrected before recording delivery as enabled. Normal same-slot restarts stay quiet.
Keep confirmed receipt details/private state out of git/images. Ambiguous sends
remain fail-closed and must never be automatically replayed.

References: [Railway volumes](https://docs.railway.com/volumes),
[sizing/billing](https://docs.railway.com/volumes/reference),
[Supabase logs API](https://supabase.com/docs/reference/api/v1-get-project-logs),
[token scopes](https://supabase.com/docs/guides/platform/personal-access-tokens).
