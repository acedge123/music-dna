# Critic reliability: fix 0/9 accepted before tuning prose

## Model
- On Vercel the Critic uses `gpt-4o-mini` (the default when `OPENAI_MODEL` isn't set). In preview it uses Gemini 3 Flash through the Lovable gateway. That's why preview and production behave differently.
- Proposal: point the writer at a stronger model and keep a cheaper, fast model for the semantic reviewer. On Vercel that means setting `OPENAI_MODEL`, or preferably sending the writer through the Lovable gateway's default model so preview and production match. I'll confirm which option you want before switching.
- Who does it: I can't open your Vercel dashboard, but I can make the change without Codex. I'll set the app's built-in production default to a stronger OpenAI model for the writer and keep a small model for the reviewer. It goes live with the next GitHub auto-deploy and uses the same OpenAI key, so no new key is needed. Afterward, you could also set `OPENAI_MODEL` in Vercel to override it with no code change.

## Step 1: check QA isolation (read-only first)
- Find out why the chat attempt recorded `learning_enrollment: enrolled` while reading/reveal showed `not_enrolled`. It could be a labeling bug in the trace, or a real enrollment row.
- Query enrollments and the outbox for that session. If a real row exists, report it to you before removing anything.
- Fix: owner-QA sessions can never enroll unless you explicitly opt them in. Chat traces must show the same enrollment status as the session.

## Step 2: strict structured output from the writer
- Request JSON via a strict schema instead of free text. This fixes the 2 malformed-JSON failures (extra closing characters).
- Add a tolerant parser for trailing junk, recorded as `repaired_json` in the trace and never silent.

## Step 3: allowlist claim IDs and axes
- The schema only allows axes and evidence references from that stage's eligible set. Anything outside it fails at generation time, not in review. This fixes the 2 invalid-reference failures.
- The existing evidence validator stays unchanged as the final gate.

## Step 4: specific semantic-review checks
- The reviewer returns named pass/fail checks, for example `unsupported_motive`, `lifestyle_inference` (solitude or a party), `overclaims_count`, `ignores_question`, `prompt_echo` and `cross_lane`, with the offending span quoted.
- On rejection, allow one retry that feeds the failed checks back to the writer. Fall back only after that retry fails. Both attempts are traced.

## Step 5: a chat fallback that engages
- When a challenge names songs (Shania Twain, The Cure), the fallback cites those picks' frozen tested contrasts instead of the generic failure line. No motive inference.
- Stop the same deterministic read from repeating across stages: rotate between evidence-grounded templates, chosen from what changed since the last read.

## Step 6: retest
- Target: at least 90% of attempts accepted and grounded across 5 owner-QA runs, measured from Admin → Critic QA.
- Score originality and engagement separately afterward with the four-axis review.

## Unchanged
Evidence ledger, frozen results, hidden matchups, routing, learning export flags and V1 flags.

## Technical notes
- `src/musicdna/adapters/llm-gateway.ts`: add `response_format: json_schema` support and per-call model selection (writer vs reviewer).
- critic-editorial author/reviewer: version bump to v2.3, a dynamic schema enum per stage, and a structured review verdict.
- Tests: an off-allowlist axis is rejected, malformed JSON is classified, the retry consumes the failed checks, and QA sessions never enroll.
