# Backend parity implementation — review, not production acceptance

## Source and deployment identity

Implementation baseline: `2daeeb128df31c77f9fa44384011eb87e74003d1`. The changes in this review are additional working-tree changes, not an accepted/published backend SHA. Mobile PR #11 remains merged separately at `d477c9f` in idea-builder.

`GET /api/public/version` now returns the actual Vercel serving commit from `VERCEL_GIT_COMMIT_SHA` and persistence rollout state, with no caching. Locally: serving SHA unavailable, persistence off. The production URL returned HTTP 404 for this endpoint during review; the custom-domain serving SHA remains unverified. A recorded successful deployment is not a substitute.

## Reviewable implementation

1. **Feedback recovery/isolation:** GET includes mutation ID; an owner-locked transaction inserts immutable feedback operations bound to a saved owner/session/version. Identical keys replay their row; different payload/version/target conflicts. New operations preserve earlier feedback. Direct listener writes are revoked in the proposed SQL.
2. **Chat recovery/history:** generation leases expire after 60 seconds and interrupted legacy user turns can be adopted. Failed writes release the lease. Reply, revision and self-report event commit together. GET uses stable timestamp/ID cursors with `next_cursor`/`has_more`, eliminating the 200-message total cap.
3. **Actual revisions:** explicit self-report modifies qualified synthesis, retaining original evidence/content and recording originating mutation, message, applied/cumulative deltas, prior/base versions and renderer provenance. Self-report does not create eligible pairing claims or update the session vector.
4. **Public consistency:** a publication transaction pins a saved version, content and evidence snapshot. Public web/REST lookup derives picks from that frozen ledger and requires consent plus the token. Later chat does not change published content. Revocation clears the snapshot and rotates the token; session UUIDs are not share credentials on the new path.

SQL is intentionally review-only at `backend-parity-migration-review.sql`, outside automatic migrations. It has NOT been submitted as a production migration in this work. Apply only after explicit approval, existing-data/index review and a migration-chain rehearsal.

## Release gate / compatibility

`MUSICDNA_BACKEND_PERSISTENCE_V2` defaults off; legacy web feedback/chat/share behavior is preserved until schema rollout. **Those legacy paths do not satisfy the five acceptance items.** In particular, legacy sharing remains live-session based, not snapshot-pinned; do not claim it passes.

`MUSICDNA_EXPERIENCE_V1` defaults off at the server entry, including V1-only chat/feedback/share routes. Approved private acceptance additionally requires `MUSICDNA_BACKEND_ACCEPTANCE=1` and a matching `X-MusicDNA-Acceptance-Key`; ordinary bearer and ownership checks remain in effect. This private key is for test tooling only, never Flutter. V0 and the web remain available.

## Verified locally

- 28 test files / 210 checks passed, including nine isolated authenticated PostgreSQL persistence tests, three pagination/cursor tests (451 equal-timestamp messages), and four release-gate tests.
- Isolated PostgreSQL coverage: exact feedback recovery/replay, version preservation, conflicting key rejection, duplicate saves, expired chat leases, revised content/provenance, transaction rollback, pinned shares/revocation and cross-user denial.
- Changed persistence/server code passes lint; latest preview compilation reports build OK.
- Browser smoke test navigated from the landing page to the existing listener start screen successfully with rollout off.

**Limitations:** PGlite's concurrent queries share one process/connection; this is not a deployed multi-connection race test. Isolated RPC tests do not establish hosted HTTP persistence or model-driven revisions. Browser smoke is not an authenticated acceptance flow.

## Still blocked / next approved sequence

1. Review and explicitly approve production SQL; reconcile any existing schema and duplicate history before application. Keep the persistence flag off until applied.
2. Obtain approved matching Vercel harness configuration and two dedicated personas (bearer mint resets their test passwords). No key was configured here and no production migration or authenticated write test was run.
3. Deploy reviewed source and verify `/api/public/version` matches the approved backend SHA on musicdna.fm.
4. Enable private acceptance and persistence while keeping public V1 disabled. Run `tools/musicdna/verify-backend-acceptance.mjs` with approval, expected SHA, private key and dedicated completed session. It exercises owner persistence, exact retry/conflict, version isolation, actual revision readback, cursor restoration, pinned share consistency/revoke and cross-user denial.
5. Run controlled interrupted-turn/failure and >200-message fixtures against the deployed API as well. The runner explicitly does not claim these from its smaller normal-flow fixture.
6. Only after every deployed acceptance item passes may public/mobile V1 be enabled. D06 remains deferred; catalog draft approval is unrelated.