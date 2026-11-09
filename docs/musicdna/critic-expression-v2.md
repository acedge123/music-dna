# Critic expression v2 — November 9, 2026

## Implemented

- Shared authored running reads, round insights, new reveal synthesis and both chat persistence paths use `critic-editorial.ts`. Existing persona/provider/model selection stays unchanged.
- Structured claims and choice references are checked against the frozen ledger. A separate auditor call, with no critic persona/history instructions, reviews semantics before display. This deliberately costs two calls per authored beat; a single-call alternative is not accepted as semantic validation.
- Rejected output falls back to the existing ledger projection; chat fallback acknowledges the actual self-report. Metadata-only rejection traces contain stage/status/reason/version, not conversation or rejected raw prose.
- `critic-expression-v2`, `audit_text`, and narration status accompany new reads/results. Saved old result content and same-answer read events replay untouched. Audit text remains available in the full web reading.
- Vote acknowledgements vary by the actual tested contrast and describe only that choice. Opener prompts now require song-specific detail rather than generic example lines.
- Harder uses effective diagnostic-first mode in initial and fallback selection. Shadow routing, claim thresholds, scores, six-answer completion, export and public V1 flags remain unchanged.
- Web renders the server reaction message. Server reaction messages no longer append upcoming test prompts; neutral pairing invitations remain mysterious.

## Flutter handoff

No second critic implementation or endpoint is needed. Render server `feedback.verdict/why`, `read.thesis`, reaction `message`, reveal `headline`, and saved chat `reply` verbatim. Optional additive `voice_version`, `audit_text`, `narration_status` accompany V1 read/reveal. Result content stores voice/audit metadata; old results may omit it. Preserve retry IDs, pagination and publication semantics. Do not show next-test rationale or substitute fixed response strings. Native UI adoption and deployed contract acceptance remain Codex tasks.

## Verification and limits

- 255 focused engine/adapter/service checks pass; changed-file lint passes; preview build OK.
- Real guest preview interview, reaction, reveal, chat correction and reload verified. An accepted reply acknowledged the vocal correction and discussed other actual choices; saved words restored exactly. Desktop and 390px chat screenshots checked, no page errors or horizontal overflow.
- First walkthrough exposed unsupported early tendencies and visible internal UUIDs. UUID prose now rejected; independent review tightened; fenced JSON parsed without bypassing schema checks.
- Early read generation still rejects too often and falls back to deterministic wording. Therefore **the six-item experience/voice acceptance is not fully cleared**. More fixture-based calibration and the audit's human review matrix remain required; no claims of a 12-session golden pass, predictive validation or human rubric score.
- Semantic model review is risk reduction, not a mathematical proof of arbitrary prose. Restricted traces intentionally omit raw personal content; a richer opted-in QA trace is not implemented.
- No migration, model swap, routing rollout, export enablement or public V1 activation. Vercel serving SHA and authenticated cross-user production acceptance not verified in this pass.
- Offer-vs-choice diagnostics and repeated-foil eligibility changes remain separate, not silently implemented.