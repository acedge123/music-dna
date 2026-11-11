# AB-50 Echelon acceptance closeout

Project: Echelon Control f3e34537-501f-410b-a5e9-436b98c17e44; backend yczomejrvihbmydyraqg.
Source: music-dna-staging, staging, Music DNA Acceptance tenant musicdna-acceptance, source ID 197da0c2-8e93-4c90-ab93-1945398a474d.
This request is for specific remaining acceptance evidence, not another model run.

## Boundaries

Do not deploy, migrate, change credentials/keys, change existing user accounts/roles, alter sources, create reviewer grants, enable learning/reviews, or extend/reopen any scope. No model calls, Slack messages, deliveries or schedules. Keep the original window 2026-11-08T01:09:06.666Z to 2026-11-09T01:10:06.666Z unchanged.
All SQL diagnostics: explicit BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; ... COMMIT. Return only metadata, numeric aggregates and sanitized error codes. No member records, raw log/query text, keys, passwords or tokens.

## Read-only operator evidence

1. Obtain current provider deployment/version ID, deployment time, verify_jwt and deployed artifact/bundle hash or immutable revision for:
   app-signal-inbound; musicdna-learning-read; signal-source-request; signal-source-decide; signal-source-rotate-key.
   Use deployment management inventory or actual deployed bundles, not local index.ts hashes, latest repo commit, prior submission receipts or no-auth responses. If the tools cannot expose this, say unavailable, identify the missing capability and do not redeploy to manufacture a receipt.
2. Inventory configured database backup/PITR retention, function/runtime/access log retention and external log drains or review copies relevant to this synthetic test. Distinguish configured/verified settings from documentation targets (debug30d/operational90d). Never claim active deletion erased backups. State the restore rule: reapply terminal scope/withdrawal state before reads/export.
3. If provider invocation, model and Slack counters for the Nov8 AB-50 run are available, report source-scoped numeric evidence only. Separate explicit AB-51/54 synthetic model tests and the two authorized owner monitoring DMs from routine ingestion. Missing counters are unavailable, not zero. Do not send a routine operational signal to create proof.

## Disposable authenticated denial checks (requires the owner's approval accompanying this request)

Use two NEW clearly labelled disposable QA Auth identities, one member-only in musicdna-acceptance and one member-only in a separate isolated AB-50 test tenant. No platform admin/tenant admin/reviewer/source rights. Do not reuse, reset or alter an existing real account. Do not send signup/invite/reset emails. Create through supported Auth admin workflow only; then obtain each actual short-lived user session through normal password login, with random temporary passwords kept solely in the private process. Never forge JWTs, inject auth rows or use service-role credentials as the HTTP caller. If that workflow is unavailable, stop this subsection and report exactly what is missing.
For each actual user session:

- POST musicdna-learning-read for music-dna-staging/staging and the original valid past window, limit1: require403 read_forbidden and no evidence.
- POST signal-source-rotate-key for source_key music-dna-staging: require denial and confirm key metadata unchanged; do not supply/generate a new key.
- Read private learning receipt/lifecycle/grant/suppression tables through Data API: require denial and no records.
- Do not call signal-source-request/decide or learning ingest/delete as they can mutate state; report those as not exercised.
  Return only role/tenant relationship labels, UTC time, endpoint, HTTP status and sanitized error code, never tokens or identity details.
  Finally sign out/revoke both QA sessions and remove only the two newly created identities and isolated test tenant/memberships through their supported cleanup workflows. Verify cleanup with numeric counts and gates still off. If cleanup fails, retain private identifiers securely and escalate the exact remaining obligation.

## Response

A concise receipt with passed/failed/unavailable/not-exercised sections, exact deployed evidence where obtainable, and cleanup confirmation. No application code changes or new commit required. Do not call missing evidence healthy.
