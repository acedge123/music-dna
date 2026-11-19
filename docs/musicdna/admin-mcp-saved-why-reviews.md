# Saved Song Why AI re-review (AB-92)

Status: implemented on a feature branch; NOT deployed and no paid acceptance calls run. This extends the existing OAuth MCP at `https://www.musicdna.fm/mcp`, with the current SDK and provider configuration. It introduces no widget, worker, cron, credentials, writer call or catalog backfill.

## Tools and human permission

- `song_whys_list`: bounded pages (default 20, maximum 50, adaptive whole-record byte limit), filtered by status, lane, song, axis and stale score. `lane` is the explicit alias for the existing `genre` filter; conflicting values are refused. Continue `next_cursor` until null. Mutable catalog pages are not a transactionally frozen export.
- `song_whys_get`: complete original explanation, historical review note/status, exact catalog identity, current score, `score_at_write`, live axis definition/poles, explanation `version` and `review_context_version`. Get this before requesting a review. ISRC/edition/audio identity is unavailable, explicitly; no exact recording verification is invented.
- `song_whys_request_ai_review`: **paid and writes an audit record**. Requires existing `catalog_review`, not merely `catalog_read`; one explicitly chosen explanation, expected explanation/context fingerprints, stable UUID `mutation_id`, and literal `confirm_paid_review: true`. Ask the human for permission for the selected saved text before calling. Approved explanations are eligible; their approval is not revoked. No tool accepts caller-supplied AI findings.
- `song_whys_get_ai_review`: read a request by ID, without starting work.
- `song_whys_list_ai_reviews`: bounded cursor pages, optionally by explanation, lane, state, `score_disputed`, `suggestion_unavailable` or stale result. `suggestion_unavailable` includes completed null suggestions; inspect the reason for uncertainty. It does not imply that all non-null suggestions are verified.

The mutation annotation is non-read-only, idempotent and open-world (one external model call). An annotation is not authorization: the SDK still verifies OAuth and fresh caller identity, the app checks capabilities, and each database RPC checks permissions again. No new role grants are created.

`catalog_review` authorizes explicit paid review plus saving its audit result. Reading permission authorizes neither. Existing deterministic `song_whys_run_audit` and manually recorded audit findings remain separate; they are not Terra calls or independent listening verification.

## One synchronous, bounded attempt

The existing `callLovableAi` server adapter is reused with `role: reviewer`, `stage: chat` and the existing strict Song Why review schema/instructions. No model ID override, key provisioning, provider switch, writer or explanation regeneration. The same provider selection remains in force (configured OpenAI reviewer on production; existing preview fallback only where configured).

Each request covers one attribute, at most 20 KB of complete snapshot data, a 20-second fetch/body deadline and 2,000 output tokens. Existing Critic callers receive no new output cap or deadline. Reservations are limited to ten per operator per hour; this is an abuse bound, not a cost estimate or permission to spend ten times.

This uses the existing synchronous MCP → server → provider path. It does not invent a background processor. Database reservation, single-use server claim and terminal audit persistence prevent replay from launching a second attempt. Replays **never invoke the model**, even if the first response was lost before processing started. A request interrupted before claim is not silently resumed. A running/requested record older than 90 seconds displays `expired_or_ambiguous`; this is not proof of cancellation or completion. After timeout the provider might still charge for its attempt. Read the same request; do not replace the mutation ID or automatically retry.

A provider failure/network uncertainty is recorded as ambiguous; malformed output is a failed review. Raw provider errors are not returned or saved. If the host/database interrupts completion, retain the running/expired record and investigate rather than submit another paid attempt. If hosted acceptance demonstrates that Terra cannot finish reliably within this bound, stop and propose reuse of a reviewed existing long-running processing path separately. Do not add a worker, extend retries, downgrade the model or increase caps silently.

## Snapshot, review and freshness

`musicdna_song_why_ai_reviews` retains a separate request/result for each explicit re-review. It captures:

- original explanation row including historical reviewer and approval;
- exact catalog song UUID/title/artist/year/lane, with unknown recording edition stated honestly;
- original score, current score at request, scoring version, live axis definition/poles;
- explanation fingerprint, full context fingerprint, review policy version;
- configured provider/reviewer and actual returned model/tokens when measured, latency and bounds; unavailable measurements and estimated USD cost are null, never zero;
- six per-attribute findings: `axis`, `verdict`, `note`, `score_disputed`, `suggested_score`, `reason`.

The original score is the review target. A stale explanation (`score_at_write != current_score`) is flagged separately; it is never rewritten to defend today's score. A full snapshot comparison runs again before a model claim, at completion and on later reads. A changed explanation, score, identity, lane or definition makes the result stale. A completion that was stale stays stale even if source content later returns to its old value. Reviews remain attached only to the captured explanation/context, never to a replacement version.

Only server-role RPCs can claim/finish a provider review, using the application's existing server-side Supabase client. No service credential is sent to ChatGPT, a browser, Railway or another integration. OAuth callers have no direct table write privilege and cannot forge a model completion. Terminal results cannot be overwritten through the RPC. Reviewer permission is rechecked before the paid claim.

No code in this review operation changes catalog scores, explanation text, approval status, original review note/verdict, pairings, routing, frozen choice evidence or saved readings. The review is an audit recorded now, not a review supposedly present at original approval.

## Human review

Admin → Song Whys → **Saved AI re-reviews → Load saved reviews** loads only stored results, without polling or a paid call. The original Hear/Means, original score, prior review/status, new finding, nullable suggestion/reason, staleness, policy and version are displayed together. No accept/apply-score button is added. An actual score correction remains a separate explicitly approved action.

The existing bulk-approval button now calls an atomic admin-only RPC. It skips stale drafts, existing failed/disputed drafts and unresolved/failed/disputed new reviews bound to the current explanation version. It does not revoke already approved explanations. An individual human approval/edit remains an explicit action in the existing queue, rather than automatic acceptance of a model suggestion.

## Deployment sequence (not executed)

1. Alan reviews the feature PR. Before promoting its app code, separately approve/apply **only** `supabase/migrations/20261119052334_musicdna_saved_why_ai_reviews.sql` to MusicDNA project `udycgnhvaanemhrchbuj`. Do not rerun earlier MCP or Song Why migrations. Prerequisites: the existing MCP catalog migration and advisory score columns (`20261119050947_3adcdaba-b292-4647-98ae-c258095cd09f.sql`) are already present. Confirm the applied history/SQL receipt before applying again.
2. Verify table RLS, read-only caller grants, server-only claim/completion grants, fresh capability gates and zero new review rows/model calls after migration. Existing server secret remains only in the backend; no OAuth settings or new secret are needed.
3. Merge/promote the reviewed app code and verify Vercel deployment. The code expects the new context/bulk-approval RPCs: **migration before app promotion**. No feature flag is added or enabled. The new tool remains protected by reviewer permission and explicit paid confirmation.
4. Refresh the ChatGPT connector's tool inventory. Generated files do not make tools live. Local extraction contains 44 tools, three new review tools, and the unchanged OAuth issuer/audience/resource/client-claim requirements.
5. Run read/deny/replay tests and the two specifically approved acceptance requests described below. Record actual request IDs, measured model, latency, tokens, results, freshness and catalog/history comparisons. No automatic retries on ambiguity. Do not call any other catalog entries.

Rollback: stop paid submissions and roll back app code if needed; retain audit rows/migration. Do not delete audit history or undo legitimate human catalog actions. No deployed source, production SQL, keys, OAuth settings or model calls were changed during implementation.

## Explicitly selected acceptance batch

Alan approved **these two explanations only**, at most one attempt each and 2,000 output tokens per attempt. Approval is recorded in this chat, not inferred from catalog-read permission.

| Recording / attribute                       | Explanation ID                         | Written/current score at selection |
| ------------------------------------------- | -------------------------------------- | ---------------------------------- |
| The Smiths — Ask (1986), Texture            | `001e68ad-de4d-4643-9aef-ca2451b5c5e1` | 88 / 88                            |
| beabadoobee — Glue Song (2023), Perspective | `004a00ee-908b-47a4-aad2-bf9688025835` | 15 / 15                            |

See `admin-mcp-saved-why-acceptance.json` for the selected source versions and unexecuted receipt slots. Refresh with `song_whys_get` after deployment. If the selected explanation text/version or score changed, stop for a new human decision; do not silently substitute a version. Get the new context fingerprint, retain one mutation UUID per explanation, and explicitly confirm each paid request. No ratings or listener data are part of this batch.

## Verification and references

Local native Postgres/PGlite tests exercise actual migrations/roles/RLS/RPCs; mocked gateway tests cover no-writer/no-retry execution, original-score prompts, provider configuration, caps, nulls and timeouts. These are not authenticated hosted-provider acceptance receipts. SSR rendering verifies that original/new findings appear together; no live admin-browser walkthrough is claimed.

The generated `.lovable/mcp/manifest.json` and `admin-mcp-tools.schema.json` are inspected for OAuth and annotations. Architecture remains the existing protected data-only operator server; no widget scaffold is necessary. Tool semantics follow the official [tool definition guidance](https://developers.openai.com/plugins/plan/tools), [MCP server guidance](https://developers.openai.com/plugins/build/mcp-server) and [reference](https://developers.openai.com/plugins/reference).

Local validation receipt (2026-11-19 UTC, base `3754e5a`): `npx vitest run` **818 passed, 109 skipped**; `npx tsc --noEmit`, targeted ESLint and `VERCEL=1 npm run build` passed. The new tests include 17 native database cases plus runtime/MCP/rendering cases. `npm test` separately stops at the pre-existing learning-contract hash mismatch (actual `2fb2ce35…`, pinned `1744309a…`, tracked separately in AB-75); this PR does not repin that unrelated contract. Provider acceptance, hosted role denials and live admin visual QA remain pending deployment.
