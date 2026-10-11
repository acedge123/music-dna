# Product Parity Fixtures V1

TGA-302 | PRD v1.1 | web snapshot `8352e32`, original mobile release `9d533b3`

`fixtures/musicdna/product-parity-v1.json` is the shared F01-F26 catalog.
It includes frozen synthetic songs, declared axes, ordered choices with IDs and
timestamps, catalog/policy/engine versions, cached result/next responses and
explicit acceptance procedures. Values are synthetic test arithmetic, not
unreviewed musicology. Cached prose is a controlled reference, not generated
proof or a capture of an authenticated API response.

`fixtures/musicdna/requirement-trace-v1.json` maps all 76 PRD v1.1 requirement
IDs (including ARC06) and GAP01-GAP16 to existing YouTrack tickets. Each entry
has an explicit pending integration/manual procedure. Routing goldens and
Lovable's six existing experience fixtures remain unchanged.

## Executable Checks

- `src/musicdna/engine/product-parity-fixtures.test.ts` validates the catalog,
  evidence summaries, directional examples, exact +40/-40/+40/-40 regression,
  revision decision, skip reset and legacy/v1 next projection. Projection tests
  call the real transport helpers but do not invoke authenticated routes.
- The active idea-builder app reads the identical files in
  `apps/mobile/test/product_parity_fixtures_test.dart`. It checks shared response
  shape/content and scenario references. This is client fixture consumption,
  not a production v1 DTO/UI port or a Dart evidence implementation.
- Both repos commit byte-identical catalog and trace files. Compare them with
  `cmp` before integration. Do not copy a changed file without rerunning both
  readers; changes to target responses need a contract review.

## Acceptance Layers

Every F01-F26 acceptance status starts pending, even if its helper checks pass.
F06 deduplication in buildLedger is not transactional retry proof. F09 helper
eligibility is not confound copy validation. F12 a supplied streak is not durable
event ordering. F13's target response is not a test of catalog exhaustion.
F23 next projection is not released-client compatibility across all endpoints.

For service/route/database acceptance, use an authorized staging origin and
test identity. Record API commit, migrations, contract header, requests and
sanitized responses, persisted row counts and error/replay behavior. Verify
both clients against the same ordered actions; retain result/catalog versions.
Do not run harness writes or create test identities on production by default.

For F22 and visual acceptance, capture equal phone viewports plus large text,
keyboard, reduced motion and screen-reader states. Record the approved web SHA
and native build. F26 requires the independent five-song decade flow; its
opener is not converted into pairing votes.

For D06, use the adopted policy in `parity-decisions-v1.md`: distinguish owner
activity from public/background activity, reading evidence from debug data,
immediate access denial from seven-day active purge, and backup expiration.
Registered-to-anonymous account switching and stale-token/public-cache checks
belong to TGA-317, not a JSON shape test.

Update a trace entry only with the actual evidence layer, pinned revisions,
result and reviewer. Do not mark every parent requirement accepted because this
catalog is complete or because Lovable reports its implementation finished.
