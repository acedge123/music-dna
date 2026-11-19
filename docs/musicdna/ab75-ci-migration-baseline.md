# AB-75 — CI and fresh database baseline repair

Baseline: web main `8795ddcc8ad6177c17d8e5c6df2f0ee7f93ec724`.
Branch: `codex/ab75-ci-migration-baseline`. All changes are repository-only.

## Reproduced failures

1. Unchanged baseline `npm test` failed the V1 learning validator checksum before
   running the test suite. Once unblocked, deletion/V2 pins, routing fingerprint,
   a formatter-only lint issue and a removed dispatcher export were exposed.
2. A new local PostgreSQL 17.11 database, with managed Auth/role/extension
   prerequisites, applied 50 baseline migrations then failed AB-45 because
   `save_result_feedback(uuid,jsonb)` was missing.
3. The source contained two executable copies of the deferred-read creator and
   used a proposal timestamp for the already-applied saved-Why review migration.
4. After schema recovery, three historical catalog batches failed because they
   relied on songs loaded by operators outside migration history.

## Contract and generated-source repairs

- Restore the exact reviewed V1, deletion V1 and V2 portable modules from their
  original commits. Manifest/fixture hashes and payload validation rules are
  unchanged. V1/deletion drift was formatting; V2 also lost two public exports.
  The reviewed public module API is restored. Byte-pinned modules are now excluded
  from routine Prettier rewriting. All 55 + 17 + 12 contract checks pass.
- Refresh the routing source fingerprint using its existing generator after
  reviewing the source inventory since `318719c`: opener-profile loading/era
  placement, frozen checkpoint flow, frozen optional Song Why color, narration
  exemplars/hunch and presentation additions. AB-75 changes no selector algorithm
  or gates. The new hash records the current source for future attribution;
  historical saved outcomes and pinned pilot assignments are not rewritten.
  An assignment pinned to another source version still follows the existing
  mismatch/default behavior; a new hash is not consent or pilot re-enrollment.
- Restore `executeHostedDispatch`'s export required by the Edge Function. Its body
  and the generated bundle's runtime bytes are unchanged. This is not a worker
  deployment or an inference/dispatch run. Correct the existing outbox type's
  formatting so the required scoped lint command can run cleanly.
- Extracted the protected MCP manifest and inspected it: no generated changes,
  tool count/permissions/OAuth change or new paid capability from restored exports.

## Migration reconciliation

See [verified receipts](ab75-migration-receipts.json).

- Recover **20261020040000 backend_parity_acceptance** from the live history's
  20 stored DDL statements. Join the exact statements with semicolon/newline;
  recovered SQL SHA-256 matches the independently computed history reconstruction.
  This restores the already-applied feedback/chat/publication dependency in order.
- Keep **20261112192158** as the one executable deferred-read migration. Its bytes
  match live history. Remove the unapplied **20261112183759** proposal duplicate.
- Rename the unchanged saved-Why review SQL to applied version **20261119054831**.
  Its bytes match history. This includes the filename reconciliation also proposed
  in open PR #58; do not apply it a second time. PR #58's other deployment receipt
  notes are separate from this repair.
- All **111 local migration versions match the 111 applied history versions** at
  the read-only verification window. No extra version was invented to run a repair
  against production. History SQL/version/name was never updated remotely.
- The three catalog imports have replay-only, all-or-nothing prerequisite guards.
  A fresh environment lacking exact external song IDs reports the entire batch as
  unavailable and skips it. It does not create placeholder songs or bypass foreign
  keys, score/eligibility/contrast assertions or approval. With all parents present,
  deliberately invalid fixture data still triggers the original validation in all
  three batches. Original applied SQL is preserved byte-for-byte under
  `ab75-applied-originals/`, with both original and guarded replay hashes pinned.
  These replay copies intentionally differ from the applied historical SQL.

Production inspection used metadata-only **READ ONLY** transactions and local
10-second statement timeouts. No listener records, secrets or production catalog
rows were retrieved. No migrations, history repair, reset, keys, flags, consent,
publication or jobs were changed in production.

## Regression prevention and validation

`npm run check:learning-migrations` now verifies recovered/retained SQL hashes,
canonical creator uniqueness, archived originals and replay-guard receipts.
`npm run test:migration-replay` creates and drops its own UUID-named database on an
explicitly permitted disposable loopback PostgreSQL server. It is mandatory in CI.
The script rejects remote URLs and requires the existing `AB45_TEST_DATABASE_URL`
fixture convention. It never targets the linked Supabase project.

Local results:

- Full `npm test`: **863 Vitest tests passed, 109 existing environment-dependent
  skips**, plus 3 hourly-worker checks; all contract/migration/routing prechecks pass.
- Native suites: **80** outbox/dispatcher/real-QA/heartbeat checks, **20** attribution
  checks and **13** pilot checks passed. Counts overlap some unit coverage and are
  not a sum of unique tests.
- Clean replay: **111 migrations passed**, with **3 catalog batches explicitly
  unavailable**. Owner denial, service-only deferred-read permissions, private-table
  RLS/grants, feedback retry/conflict/version isolation, unchanged original content,
  zero capture/enrollment/scope state and all three preserved catalog guards passed.
- TypeScript and required scoped lint pass. Deno 2.9.6 scoped function type-check,
  Edge bundle generation plus byte-identity check, worker build/help, acceptance
  CLI help and Vercel-target web build pass. No network/model worker was executed.

The replay uses real PostgreSQL 17.11 with a minimal managed Auth schema/function
fixture, not a running GoTrue/Auth server or hosted Supabase Preview. It establishes
DDL order and native SQL behavior, not email/login behavior or a complete seeded
catalog. The 3 skipped catalog imports are not labeled as successful content loads.
GitHub/preview results are recorded on AB-75 after the PR runs.

## Merge and rollout

Alan reviews/merges. No production SQL reapplication, migration repair or flag flip
is needed for this source/history alignment. Do not run `db reset`, `db push
--include-all` or replay archived originals against production. A separate future
schema change must use a new reviewed migration. The source version fingerprint
will describe future attribution only; no historical assignments/results should be
backfilled to the new hash. Apple packaging and mobile parity acceptance remain
separate tickets.
