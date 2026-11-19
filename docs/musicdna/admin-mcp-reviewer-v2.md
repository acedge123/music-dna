# MCP reviewer v2 alignment

The existing protected MCP keeps its canonical `https://www.musicdna.fm/mcp` URL and OAuth/caller permissions. This change aligns its descriptions, inputs, filters and rates validation with Lovable’s three-verdict reviewer. It makes no model/provider/key changes and starts no paid review.

## What is already live

At implementation time, production `/api/public/version` served Lovable commit `b81f9b268fceee00177f388e97c1b1154233ab6f`. The v2 request and policy-specific rate RPCs are installed in MusicDNA’s database; migrations `20261119172021` and `20261119172202` appear in history. Do not reapply them.

The original cohort was read completely through normal OAuth MCP pagination (three response pages, ten distinct explanations). All ten remain completed under `saved-song-why-review-v1`: nine Fail and one Pass. The original text, scores and verdicts are not changed by this upgrade. Those outcomes are not proof of a 90% catalog-error rate.

## MCP contract 0.4.0

- `song_whys_get` returns an additive top-level `review_policy` alongside the original `record`. It identifies current policy `saved-song-why-review-v2`, the three verdicts and their criteria, independent score advice, rate semantics and the unchanged paid-call safeguards. Explanation/context fingerprints are unchanged by this metadata.
- `song_whys_request_ai_review` identifies v2 explicitly and accepts `expected_policy_version: "saved-song-why-review-v2"`. Omission defaults to v2 for existing clients. An explicitly different policy is rejected before reservation/model work. Literal `confirm_paid_review: true`, reviewer permission, exact version/context and stable mutation UUID remain required. The existing v2 RPC binds the resulting audit to v2. Historical v1 requests/results remain accessible through read tools; do not reuse their mutation IDs to request a new v2 verdict.
- `song_whys_list_ai_reviews` supports `policy_version` and a separate `verdict: "pass" | "fail" | "uncertain"`. This is independent from operational `state` (for example, `failed` means a request failed to produce a verdict) and from nullable score advice. Cursors remain caller/filter-bound.
- `song_whys_get_ai_review_rates` remains read-only, with a required policy and optional explicit cohort of at most 50 explanation UUIDs. Each policy counts the latest attempt per explanation. Fractions are `fail / completed` and `uncertain / completed`, separately; operationally unavailable attempts are counted outside those denominators. No completed reviews means null fractions, never healthy zero.
- Rate responses are validated before presentation. Unknown/mismatched policies, inconsistent count sums, more returned cohort entries than requested, non-null empty-denominator rates, or fractions that do not match their numerators/denominator return `REVIEW_RATES_UNAVAILABLE`. Bad server data is not blamed on user input and is not displayed as a reassuring percentage. The database remains the authority for counts; MCP does not reinterpret old verdicts.

Pass means coherent explanation/score without an identified substantive issue, not verified listening. Fail means an identifiable contradiction, unsupported interpretation, axis confusion or meaningful score mismatch. Uncertain means a recording-specific detail needs verification without an identified substantive failure. Missing audio alone must not cause failure or a score dispute. Suggested scores remain advisory, integer 0–100 or null; they never update the catalog.

No approved explanation is revoked automatically. Existing individual human review and bulk-approval exclusions for Fail, Uncertain, disputes and unavailable work remain in place. The original ten are not relabelled, deleted, overwritten or silently retried.

## Retest boundary

The original ten are pinned in [reviewer-v2-ten-item-retest.md](reviewer-v2-ten-item-retest.md). That is a selection plan, not authorization to spend on ten calls. The earlier two-example approval does not authorize this ten-item cohort. No retest is executed by this PR or a deployment/metadata refresh.

For a separately approved ten-item run, read each exact explanation/context first, retain its new mutation ID and call once. Keep the existing **ten new requests per caller per rolling hour** limit; do not bypass it using another account, a server credential, reused old mutation IDs or altered clocks. Maximum per-attempt bounds remain 20 seconds and 2,000 output tokens. No writer, automatic retry or full-catalog backfill is added. Record v2 results next to v1, compare the same ten IDs, and state any changed source snapshots or stale results before discussing differences.

## Release requirements

This feature branch must be reviewed/merged by Alan. The existing Git-linked Vercel deployment then publishes MCP contract 0.4.0. No new migration, feature flag, key or OAuth configuration is required for this alignment. The underlying Lovable v2 backend is already deployed; this document does not claim this branch’s new metadata/filters/validation are live before its merge/deploy.

Extract the manifest using `npx lovable-mcp-extract-manifest .` and inspect the generated 45-tool inventory, current request-policy default, separate verdict/policy filters, read-only rates annotation and unchanged OAuth resource/issuer/audience/client-claim requirement. Update `admin-mcp-tools.schema.json` from that extraction. Refresh the connection metadata in the client that will run the retest after deployment. A model call is not needed to verify metadata or read prior results.

PR #58 separately records the first deployment and reconciles its original migration filename to the actual applied timestamp. It is still Alan’s merge decision; this upgrade does not duplicate that migration or rerun production SQL.

## Validation

On base `b81f9b2`, the full Vitest suite passes: **839 passed, 109 skipped**. TypeScript, targeted ESLint and the Vercel production build pass. New tests cover policy mismatch before any reservation, legacy default compatibility, verdict/policy cursor binding, generated manifest annotations, inconsistent and empty-denominator rate responses, bounded cohort reads and permission denials. Lovable’s native tests continue to verify preserved v1 results and separate v2 Uncertain outcomes. No production writes, paid review calls, score changes or retests were made for this MCP alignment. The unrelated learning-contract hash check remains tracked separately under AB-75; this PR does not alter its pinned contract.
