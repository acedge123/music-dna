# D06 — Retention and account linking

Status: **policy decided (ACE, 2026-10-10); implementation deferred until launch.**

Deferred on purpose: the tables are small, so the sweeps buy no meaningful storage today. The policy stays settled here so it can be built in one pass when it actually matters — before public launch, or earlier if a user asks for deletion. Until then, nothing in this checklist is implemented: no activity timestamps, no purge job, no account-linking flow.

## Retention

| Data | Retention |
| --- | --- |
| Abandoned anonymous sessions | Delete after 30 days without user activity |
| Completed anonymous readings | Delete after 90 days without user activity; expire their share links |
| Registered users' readings and conversations | Keep until the user deletes the reading or the account |
| Detailed diagnostic/debug logs | 30 days |
| Operational metadata (errors, latency, cost) | 90 days, with no conversation content or credentials |

- **Inactivity clock:** only the listener's own actions reset it. Public-link views and background jobs do not.
- **Evidence is not debug logging.** Choices, the evidence ledger, result versions and the conversation history a reading needs follow the reading's retention, not the 30-day log rule. This includes evidence currently stored in `event_log` (`read_shown`, `pairing_skipped`, `reaction_submitted`, `self_report`, `choice_scored`). The purge job must tell these apart from debug events.
- **Deletion:** access is blocked and public links are revoked immediately. Data in active systems is purged within 7 days. The backup expiration schedule is documented separately (TODO: confirm with the Supabase plan's backup retention).

## Anonymous → account linking

- **New account:** after verification, upgrade the existing anonymous identity in place. This uses Supabase's anonymous upgrade (`updateUser` with email or password, or `linkIdentity`). Readings and ownership are preserved because the user ID doesn't change.
- **Existing account:** the listener must sign in successfully, then take an explicit "Save this reading to my account" action. The transfer runs as a server-verified, retry-safe operation, and existing readings stay as separate sessions.
- **Never:**
  - merge by email match alone;
  - overwrite an existing reading;
  - publish anything as part of linking.

## Implementation checklist (deferred until launch)

- [ ] Track a `last_user_activity_at` timestamp per session, updated only by the owner's own requests.
- [ ] Daily purge job, covering:
  - [ ] abandoned anonymous sessions at 30 days;
  - [ ] completed anonymous sessions at 90 days, with share links expired;
  - [ ] debug event types at 30 days;
  - [ ] operational metadata at 90 days.
- [ ] Split `event_log` event types into an evidence set and a debug set.
- [ ] Account deletion revokes links immediately and purges data within 7 days.
- [ ] Anonymous upgrade flow on web and Flutter.
- [ ] Retry-safe "Save this reading to my account" transfer for an existing account.
- [ ] Verification tests for each rule above.
