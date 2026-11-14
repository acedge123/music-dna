# Decision: staged retirement of legacy Archetype rankings

Approved by Alan, 14 November 2026 UTC.

## Decision

Frozen V2 matches are the identity authority on current reading panels. No V2 match means emerging identity, never substituting a legacy cosine winner. Legacy cosine scores and V2 profile scores measure different things; do not compare them or treat a legacy low_score flag as a failed V2 match.

## Stage 1 — presentation only

Admin labels the residual queue, winner heatmap and ranking-derived diagnostic measures as legacy. These remain available for historical audit, not current V2 validation or automatic profile expansion. No scoring, finalization, event, API, share, database, model or flag changes.

## Later retirement gates

1. Separate legacy ranking work from `emitChoiceDiagnostics`; retain trusted `choice_scored` round, raw_delta, chosen_artist, ms_to_decide and skip/attempt history consumed by routing.
2. Migrate compatibility consumers before disabling final legacy assignment: reveal v0/v1 fields, session/history DTOs, Flutter result/share headers, fallback public shares/metadata and admin ranking reports.
3. New compatibility identities may derive only from a frozen V2 match or explicit no-identity state. Preserve historical saved results and published snapshots verbatim. Do not retrofit old readings against today's profiles.
4. Mark discontinued ranking measurements unavailable, not healthy zero. Check deployed diagnostic view definitions; checked-in older views and emitted payloads differ.
5. Verify authenticated finalization/replay, older mobile responses, share publication/revocation, history and unchanged routing before turning computation off.

Keep legacy columns/events/history and the archetypes catalog. V2 profiles still reference the catalog for names. Field removal is a separately reviewed future migration, not part of this decision.

## Dependencies

Finalization currently computes legacy ranks and sets completion/reasoning (`src/lib/musicdna.functions.ts`). Never remove the whole finalization step. Routing consumes non-ranking choice diagnostics (`src/musicdna/router/index.ts`). Public share fallbacks and older clients still consume session archetype_id. Current Critic synthesis uses frozen-ledger claims, not legacy rankings.

## Rollout status

Stage 1 implemented in the checkout. Computation remains enabled for compatibility. Production deployment and authenticated admin acceptance are separate; no production flags or database changes authorized by this presentation update.