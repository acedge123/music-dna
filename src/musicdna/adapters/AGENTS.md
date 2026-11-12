# Adapter rules

- Halftime pushback goes through `recordHalftimePushbackImpl` (web + REST `/pushback`); the event id is derived from session + mutation_id so retries replay instead of duplicating, and it is self-report only.

- Saved reports are reopened via `GET /api/v1/session/:id/report` (`adapters/report-envelope.ts`): frozen fields replay the saved row, annotations derive from frozen choices, zero model calls or writes.

- Raw critic writer/reviewer output is stored in `critic_quality_attempts.decision_trace` only for owner-QA sessions (admin-read, never exported), so failures can be diagnosed without retaining listener prose.
- Direct OpenAI Critic models use role-specific settings with strict schemas; GPT-6 text calls set supported reasoning effort without sampling parameters, output caps, automatic downgrades or extra retries. General LLM and preview-provider calls remain separate.
- Pass the critic stage through the shared generator: conversational writers use low reasoning, final reveal uses medium, and independent review stays low, reducing latency without bypassing validation.

- Critic prose uses `critic-editorial` author/reference/semantic review; rejected drafts keep audit text and saved results replay untouched. Reveal twists come only from frozen-ledger exceptions.
- Post-choice sayings come only from the optional editorial block frozen by the vote trigger, alongside ledger-tested directions; never reread mutable sayings for historical choices or treat editorial metaphors as claim evidence.
- Critic quality stays local and separate from inference/feedback: shared attempts retain nullable measurements, admin-only rubric scores target exact output, and client-reported exposure binds to a trusted offer ID; none automatically promotes routing or learning.
- Song fact cards (`song_facts`) are admin-reviewed, source-cited catalog color; only approved rows may reach the critic, they never count as listener evidence, and live use must be frozen into the vote snapshot behind a default-off flag.
