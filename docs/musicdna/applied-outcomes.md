# AB-29: join routed choices to later feedback

Status: code prepared; production migration and emitter activation are **not performed** by this PR. AB-52 owns experiment design, routing activation and acceptance. Nothing here demonstrates improved Music DNA readings.

## Small extension to the existing path

1. An authorized operator may freeze a **synthetic-only**, session-scoped experiment assignment before its first decision. `assign_musicdna_routing_experiment` requires the exact owner, eligibility version, experiment/arm, expected policy and strategy versions, expected routing mode and a 60-second–30-day feedback window. Repeating the identical assignment returns its stored UUID/time; a changed assignment conflicts. Concurrent assignment, serving and voting serialize on the session row. Completed/previously answered sessions cannot be enrolled retrospectively. No assignments are seeded and no randomization or routing is activated here.
2. The existing `regime_recommended` server event may carry an `applied-routing.v1` snapshot when `MUSICDNA_APPLIED_OUTCOMES_V1=1`. The database retains this added context only for an operator-assigned synthetic pilot session; unassigned sessions keep their existing event shape. It records the proposed regime separately from the actual selection mode, effective knob overrides, bootstrap/fallback and steering. Requested live routing with no recommendation is explicitly legacy behavior. A shadow pick matching the actual pick does not establish application of its recommendation. This event establishes server selection/serving, **not proof the UI displayed it**.
3. The existing atomic vote freezes an exact compatible served context on `choices.routing_context`, together with the unchanged catalog evidence and response. Context must match session, owner, pairing, prior vector and answered count. Repeated identical serving is safe; differing contexts for the same state are **ambiguous**, not resolved by picking the latest. A stale vote rolls back its snapshot and score together. A committed choice establishes that the listener selected from that pairing, not that the recommendation improved anything.
4. A saved pairing result freezes all six exact choice/event joins on `session_results.routing_context`. Ledger entries may repeat a choice across axes. Incomplete, foreign, ambiguous or mixed-artifact joins remain unknown. Chat revisions retain their exact result version but are not automatically attributed to pairing policy. Existing historical rows are not backfilled.
5. Feedback for an operator-enrolled result goes through the existing transactional outbox, portable validator, canonical materialization, leases, receiver receipts and withdrawal path. Only the frozen result supplies policy attribution. `session_results.policy_version` continues to mean **claim policy**, never routing policy. Capture, dispatch, transport and learning gates are unchanged.

The older `experiment_assignments` table allows listener inserts. It is deliberately **not** a source of trusted pilot attribution. The new assignment is protected on the existing session row; there is no new telemetry table/service.

## Source pin and arm matching

`src/musicdna/learning/routing-artifact.json` pins the selector orchestration, engine and domain-router source files with a SHA-256 hash. That artifact identifies both the executed selector policy and its strategy implementation; the proposed regime and effective controls remain separate per-choice fields. After a reviewed source change, regenerate with:

```sh
node scripts/check-routing-artifact.mjs --write
```

CI rejects an out-of-date pin. The pin identifies **source**, not a deployed bundle or deployment receipt. It does not claim that Agent Brain was called: this captures Music DNA's existing local deterministic router.

An experiment arm is exported only when all six choices share the same frozen assignment/artifact and match its expected policy, strategy and routing mode. For an expected live arm, non-bootstrap choices must actually have used router knobs. Bootstrap is recorded as a shared bootstrap path. Steering overrides are explicit; AB-52 must decide in advance how to analyze them. A mismatched assigned arm stays visible locally with `assignment_match=false`; it does not become an applied treatment in exported evidence. Operators must freeze AB-52's control/treatment definitions and allocation method before making assignments.

## Measurement and ingestion limits

`read_musicdna_routing_outcome(result_id)` is service-only and returns:

- exact session/result version, assignment and six choice/event IDs;
- immutable window start/end, anchored to **result persistence**, not UI exposure;
- feedback UUID/time, accuracy/rating, observation UUID;
- separate capture state, dispatch state and confirmed receiver receipt UUID, when present.

No rating before the deadline is `awaiting_feedback`; no rating after it is `missing`. No verified assignment/window is `unknown`. A known assignment deadline survives missing or ambiguous routing evidence, without conferring policy attribution. Each actual feedback item is classified `on_time`, `late`, `before_result` or `unknown`; absence is never converted into a negative rating or zero. Comment-only feedback does not count as a measured rating. Feedback on a later result version cannot satisfy an earlier version. The window never slides when read/retried. Reader time is database statement time.

The frozen cross-repository `learning-observation.v1` wire contract is unchanged: it carries exact purpose-scoped decision/result/feedback references, observation ID/time, result version and known policy/experiment attribution. Detailed strategy, choice joins and measurement windows remain in the producer's frozen records and operator readback; the receiver alone cannot infer the feedback deadline. A six-choice result has no single recommendation event, so the wire's `recommendation_event_id` stays null rather than naming an arbitrary event. AB-52 must join producer outcome readback to the receiver receipt for evaluation. Receiver acceptance or a delivered dispatch is not model review completion, human approval or product success.

## Privacy, access and lifecycle

Only numeric scores/knobs, bounded version/enum labels and internal IDs are added. No prompts, songs, lyrics, feedback comments, transcripts, tokens or personal records are added to the wire projection. Existing owner RLS governs local session/choice/result reads. Listeners cannot assign pilots, forge server routing contexts or call the operator outcome reader. Captured contexts cannot be rewritten. No real-user consent basis is introduced; real-user learning/export remains outside the synthetic-only contract.

Existing user/session/result deletion cascades remove these added columns with their parent records. Existing enrollment/feedback deletion and withdrawal cancel or clear outbox payloads and initiate downstream removal; this PR does not create independent retained evidence. The result fingerprint includes new frozen context while preserving fingerprints of pre-migration null-context rows.

## Migration handoff and rollback

After review/merge, apply **only** `supabase/migrations/20261108175602_musicdna_applied_outcomes.sql` once to Music DNA's backend `udycgnhvaanemhrchbuj`. AB-45/47 must already be applied. This adds three nullable columns, private invoker triggers, two service-only invoker RPCs and replaces the existing private capture/fingerprint functions. The existing capture function remains a definer because the authenticated feedback transaction must insert into the private outbox; its grants, owner guard, lifecycle locks and exclusions are preserved. No new definer is introduced.

Return SQL hash, actual history version/name, confirmation of one executable local migration, function grants, and zero assignment/activation changes. If the native migration workflow stamps a different history version, reconcile the one local file without rerunning earlier migrations. Do not invent a second executable copy.

Keep `MUSICDNA_APPLIED_OUTCOMES_V1` absent/0 until migration verification and a separately approved AB-52 pilot. Merging auto-deploys application code but the emitter defaults off and performs no new-column request while off. Applying SQL alone creates no assignment, scope, key, schedule or transport/model work. The assignment RPC does not change which routing mode the app uses. It is **not** an activation API.

Use `tools/musicdna/sql/routing-outcomes.sql` for diagnostics: explicit READ ONLY transaction and local 10-second statement timeout. Reversible stop: remove/disable the emitter flag. Preserve frozen rows and migration history; do not rewrite old evidence or clear dispatcher halts. Existing export/dispatch/learning controls are independent and remain subject to their own approvals.

## Verification

Run `npm test`, `npx tsc --noEmit`, and `VERCEL=1 VERCEL_ENV=production npm run build`. Native database checks require a disposable loopback PostgreSQL database named `ab45_*`, supplied as `AB45_TEST_DATABASE_URL`; run `npm run test:applied-outcomes`. CI runs these alongside the existing outbox/dispatcher suites. Tests use synthetic fixtures, the actual vote/evidence/feedback functions, actual roles and native transaction rollback. No production queries, migrations, model calls or deliveries are needed.
