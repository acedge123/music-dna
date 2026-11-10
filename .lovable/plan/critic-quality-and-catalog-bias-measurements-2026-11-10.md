# Critic quality and catalog-bias measurements

## Goal
Distinguish an insightful critic from merely lively writing, and distinguish listener evidence from what the catalog happened to offer. These measurements diagnose quality; they do not automatically change scoring, routing, claim thresholds or saved readings.

## 1. Record a local critic-quality event
- Cover every actual choice/read/reveal/chat authoring attempt through the shared critic boundary, including safe fallbacks and failures. Saved-result replay must not count as a new generation.
- Store the frozen choice/pairing/test references, traits and tradeoff actually supplied, chosen/opposing song references, stage, result version where available, author/reviewer prompt versions and actual models, authored/fallback status and specific rejection checks.
- Measure writer/reviewer durations and token usage separately. Record cost only when a documented provider price and model/version allow it; otherwise cost is unavailable, not zero. Distinguish no call from failed call and unavailable timing.
- Keep conversations, candidate prose and raw choices inside MusicDNA. Operational measurements reference owned evidence rather than copying conversations into telemetry.
- Use durable, retry-safe records, validated and written by the server after ownership checks. Record missing telemetry honestly without losing an already-committed vote or changing its replay.

## 2. Independent quality assessment
- Add an operator-only review queue and a versioned rubric with four separate scores: **inference accuracy**, **musical specificity**, **prose originality**, and **conversational relevance**.
- Use a consistent anchored 1–5 scale, with “not assessed” available separately for each dimension. Store reviewer identity, rubric version and the exact saved beat/result being reviewed.
- Ground inference assessment in frozen ledger evidence and specificity in supplied musical facts; expressive language cannot compensate for unsupported inference.
- Keep the existing listener accuracy feedback unchanged: perceived accuracy, semantic safety review and independent writing QA are different measurements.
- Keep assessment separate from authoring and semantic acceptance. Blind reviewers to authored/fallback labels and experiment arms while scoring where practical. A model-generated rubric score must be labelled automated, not human-independent QA.

## 3. Measure offering bias before interpreting preference
- Record trusted pairing selection separately from actual client-reported display; do not claim that a selected pairing was seen. Bind display acknowledgements to the owned, served pairing and deduplicate refresh/retries.
- Join committed choices/skips to those offers without rewriting frozen evidence. Report offered-versus-chosen counts, repeated opponents, and artist/era concentration for **both** offered and selected songs, by lane/session/catalog revision.
- Show denominators, missing exposure reports and unknown historical data. Do not reconstruct historical offers from today's mutable catalog or treat chosen concentration as preference.
- Define independent retests separately: repeated pairs or the same session are not independent support. Initially report retest availability; any new consented retest study needs its own reviewed design. Do not introduce extra interview questions or bypass the six-choice rule.

## Privacy and release boundaries
- No new external export path, human-pilot export, capture/dispatch activation, enrollment, routing promotion or model learning.
- Any future export needs a separately approved purpose, minimal aggregate projection and lifecycle safeguards. Existing synthetic-only outbox restrictions remain unchanged.
- No retention sweeps or account transfers in this scope. Diagnostic measurements must not silently retain conversations beyond their reading lifecycle.
- Submit any required database migration for approval before production application. Preserve web/REST/Flutter compatibility through additive contracts.

## Technical approach
- Reuse `authorCritic`, frozen `criticFacts`, the single LLM adapter, trusted event writing and existing exposure/routing provenance where suitable. Existing reveal logging and console rejection messages are not complete per-stage telemetry.
- Preserve specific failed semantic-review checks rather than reducing every rejection to one generic reason; transport/provider usage must survive the currently text-only convenience call.
- Add dedicated local quality/assessment storage only where current tables cannot provide retry-safe, version-bound records with appropriate access controls. Explicit grants and RLS accompany new tables.
- Extend existing admin inspection rather than adding listener-facing scoring controls. Flutter shares server-side attempt records; add display acknowledgements only as an additive contract.

## Verification
- Tests for all four stages, success/fallback/no-call/failure, retry deduplication, immutable replay, specific rejection reasons, unknown cost/usage, owner/admin permissions and telemetry-write failure.
- Four-axis rubric tests and version isolation; no score from one dimension substitutes for another.
- Exposure tests for served-but-not-shown, shown/repeated/retried/skipped offers, selected-side denominators, unknown historical data and non-independent retests.
- Run an authenticated interview through saved result, review and readback. Verify deployed behavior separately; source tests alone do not clear production acceptance.