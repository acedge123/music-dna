# Immutable Choice Evidence

TGA-303. Source baseline: `1030fbd`. Migration and deployed acceptance are pending.

## Contract

`choices.evidence_snapshot` is populated by an invoker-rights trigger inside the existing
atomic vote transaction. The database captures choice/session/pairing/song IDs, vote ordering
and timestamp, mutation ID, timing, pairing revision, whitelisted song metadata and ten-axis
values, normalized declared axes, signed contrasts, weight and a content revision.
Curator notes, opener priors, skips, reactions and chat self-report are not pairing evidence.

The scorer supplies `_expected_catalog` internally. A catalog change between scoring and
commit raises `40001`; the existing bounded retry recomputes. That internal property is
removed from stored/replayed responses. No REST or legacy client DTO changes are required.

`loadChoiceEvidence` reads snapshots only, ordered by timestamp then choice ID. Running
reads, final reasoning, result synthesis, public defining choices, profile defining choices
and chat context use this loader and `ledger-v2`. Concentrations of chosen artist, song,
era and lane are possible confounds, not personality claims. Timing is retained but cannot
establish decisiveness. New production scoring excludes undeclared/duplicate axes and
missing values; historical vectors and the legacy pure-math default are not recalculated.

## Legacy And Rollout

- Old votes remain NULL snapshots: historical evidence unavailable, not reconstructed
  from a mutable catalog. They count as answered but cannot corroborate a new claim.
- Existing saved results replay verbatim. No rewriting of vectors/results or automatic
  historical backfill. Any explicit historical reconstruction needs separate approval.
- Vote identity, snapshot and committed response are immutable. Direct individual-vote
  deletion is revoked for authenticated users; whole-reading/account deletion remains
  through the existing session cascade/trusted service.
- Apply the migration in an approved test environment **before** deploying the new loader.
  A missing migration is an explicit error, not a fallback to live catalog joins.
- Keep routing in shadow. No Railway call, remote Agent Brain dependency or live activation.

## Verification

Unit tests cover normalization, unknown/missing/nonfinite values, distinct pairings,
directional support, confounds, legacy/corrupt snapshots and snapshot-only adapters.

The SQL harness uses isolated in-memory PostgreSQL (PGlite), a minimal schema and owner RLS.
Install the pinned test runtime in a temporary directory, not the application:

```sh
npm install --prefix /tmp/musicdna-db-tests --ignore-scripts --no-package-lock @electric-sql/pglite@0.3.14
MUSICDNA_TEST_PGLITE_MODULE=/tmp/musicdna-db-tests/node_modules/@electric-sql/pglite/dist/index.js node tools/musicdna/test-choice-evidence.mjs
```

It executes the real atomic RPC and new migration, asserting capture, catalog-edit stability,
immutability, legacy preservation, duplicate/stale rollback, catalog-race rejection and
foreign-owner denial. This is not a full Supabase migration-chain, deployed route, concurrent
multi-connection or device acceptance test. Those remain required before release.
