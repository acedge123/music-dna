# MusicDNA Parity Decisions V1

TGA-301 | October 10, 2026 | product policy, not deployment certification

Source precedence: PRD v1.1, its companion parity guide, the accepted D01-D04
Lovable plan, and ACE's October 10 D06 adoption in the parity task. This record
does not reopen D01-D04. Reviewed runtime snapshot: music-dna `8352e32`;
mobile reconciliation: idea-builder PR #8, original release SHA `9d533b3`.
Routing reference stays Agent Brain `4cf8a12`; routing is outside these product
decisions. No policy is implemented in Dart.

| ID | Adopted Direction | Version / Fixtures | Implementation And Acceptance |
| --- | --- | --- | --- |
| D01 | At least 3 distinct valid supports; support exceeds contradiction; consistency >= 0.65; 3-1 qualified, 2-2 mixed; these are editorial thresholds, not probabilities | `d01-v1`, `ledger-v1`; F01-F09 | Helpers and running/final paths exist. Immutable vote-time evidence, declared-axis handling, confounds and full-surface acceptance still require proof. |
| D02 | Three consecutive skips end a session at any answer count; keep early skip bound and six-answer cap; catalog exhaustion is a different reason | F04, F12, F13 | Rule and exhausted path exist in source. Verify durable ordering, retries, answer reset and client framing. |
| D03 | New links require explicit publication and revocation. A token is not consent. Inventory legacy links before migration. | F18-F20 | Publication lifecycle and fixed challenges remain unchecked on the latest roadmap. Legacy treatment must follow inventory, never automatic publication. |
| D04 | Original pairing evidence/vector/result stay unchanged; chat is separate self-report and produces explicitly versioned interpretations | `engine-2026-10`, result contract 1; F21 | Saved results and self-report versions exist in source. Replay, concurrency, public snapshot and cross-owner tests remain required. |
| D05 | Use the PRD performance targets below; collect baseline before setting conversion/pilot success thresholds | F14, F16, F22; TGA-320/TGA-325 | Target budgets are adopted by the PRD, not measured results. Device/network measurements and pilot thresholds are pending. |
| D06 | Adopt ACE's V1 retention, deletion and linking policy below | `d06-v1`; F16, F18, F19, F23; TGA-317/TGA-279/TGA-323 | Policy decided; implementation and verification pending. Backup expiration is an explicit unresolved operational fact. |

## D05 Measurement Gate

- Immediate selection feedback: within 100 ms on representative devices.
- Next usable round: median <= 2 s, p95 <= 5 s under a documented network profile.
- Cached result reopen: <= 2 s. Uncached narration has an honest waiting state
  and bounded retry; do not invent a final-narrative latency threshold.
- Report device/OS, web/mobile/API SHAs, hosting region, cold/warm state,
  network profile, sample count and distribution, and failure/fallback rates.
- Measure the complete tap-to-usable-round path, not just a mapper call.
  Keep per-pairing routing local; telemetry and calibration stay batch-first.
- TGA-320 records measurements; TGA-325 ratifies pilot/business thresholds
  only after baseline and qualitative research. No conversion target is set here.

## D06 Adopted Product Policy

| Data | Retention |
| --- | --- |
| Abandoned anonymous sessions | Delete after 30 days without owner activity |
| Completed anonymous readings | Delete after 90 days without owner activity; expire associated share links |
| Registered readings and conversations | Keep until the user deletes the reading or account |
| Detailed diagnostic/debug logs | 30 days |
| Content-free operational errors, latency and cost metadata | 90 days; exclude conversation content and credentials |

Owner activity, not public-link views or background jobs, drives the inactivity
clock. Choices, evidence ledgers, result versions and required conversation
history follow their reading's retention period, even when physically stored
in `event_log`. Storage location does not classify them as debug logging.

New-account linking upgrades the existing anonymous identity after successful
verification, preserving its readings and ownership. Existing-account linking
requires successful sign-in and explicit "Save this reading to my account".
Use a server-verified retry-safe transfer; retain readings as separate sessions.
Never merge by matching email alone, overwrite an existing reading, or publish
anything during linking. Until that flow is verified, clients must state its
limitation rather than promise transfer.

[Supabase's anonymous-auth documentation](https://supabase.com/docs/guides/auth/auth-anonymous)
supports identity conversion and explains why existing-account data conflicts
need application-specific handling. Those capabilities do not prove the
current MusicDNA linking flow is implemented or safe.

Deletion blocks access and revokes public links immediately. Purge active-system
data within seven days. Inventory and document the actual backup-expiration
schedule separately; do not assume seven days covers backups. Pending work:
owner-activity timestamps, classifying mixed-use event records, cleanup jobs,
idempotent transfer, token/cache invalidation, purge evidence and backup inventory.

## Compatibility, Activation And Rollback

- Source opts into the new experience with `X-MusicDNA-Experience: 1`; without
  it, routes retain legacy response shapes. Validate actual authenticated
  responses before mobile integration acceptance. No new flag is invented here.
- Preserve `MUSICDNA_ROUTING_MODE=shadow`; source default is not evidence of
  the deployed value. D01-D06 never authorize live routing or Railway calls.
- Storage changes are additive and reviewed by the web/backend owner. No
  migration, retention cleanup or account transfer runs from this docs ticket.
- Roll back new experience exposure/client rollout without deleting recorded
  votes or result versions. Keep privacy revocations/deletions effective during
  rollback; never restore access to expired or deleted data as a fallback.
- Before activating D06 cleanup, verify inactivity clocks and data classes on
  staging; record backup handling. Stopping a faulty cleanup job does not permit
  extending a promised deletion deadline or resurrecting removed data.
- No production migration, deployment, publication, deletion or account linking
  is authorized by a green fixture test. TGA-300's deployed contract gate and
  TGA-314's ACE web acceptance remain open.
