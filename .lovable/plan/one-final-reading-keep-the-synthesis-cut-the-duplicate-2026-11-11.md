# One final reading: keep the synthesis, cut the duplicate

Yes, I agree. I checked the code, and the end of an interview really does run the Critic twice on the same evidence.

- **Stage 1, the "interpretation":** Sol writes a reading, Terra reviews it, and it's saved as the session's interpretation. Its only visible use is the profile page and the old share fallback.
- **Stage 2, the "synthesis":** Sol writes the full closing reading (memorable opening, interpretation, exceptions), Terra reviews it, and it's saved as version 1, the reading that web, mobile, chat and sharing show.
- While the last matchup is on screen, we currently pre-draft **both** stages for **both** possible picks. That's four Sol drafts and four Terra reviews per interview, and only one of them is ever shown.

## What changes
1. **Keep the evidence math exactly as is.** Scores, supported patterns, exceptions, receipts, archetype and the claim rules are still worked out once, without AI.
2. **Remove the stage 1 writing.** Finishing an interview becomes instant and deterministic: it saves the analysis and marks the session done, with no Sol or Terra call.
3. **Keep stage 2 as the one Critic reading.** Same prompt, same voice, same examples, same Sol writer and Terra reviewer. No voice rewrite.
4. **One saved reading everywhere.** Once version 1 is saved, the same text also fills the old interpretation fields, so the profile page, share page, history and mobile all show identical prose. Older readings stay exactly as they were.
5. **Pre-drafting shrinks from four drafts to two:** one full reading for each possible last pick. Each one includes all six choices, because it's written for the exact pick, and it's reused only if the saved choices match exactly. If the listener's last pick changes the story, a fresh reading is written. So the sixth choice can still overturn the read.
6. **Recovery stays as it works today.** If the phone's wait runs out, retry returns the saved reading. A finished draft waiting in the background is picked up instead of being rewritten, and safety text is never stored as the Critic's reading.

## Terra: facts, not personality
- Terra keeps its current semantic checks: grounded in the evidence, proportionate, mentions exceptions, keeps self-report separate, no invented facts, no spoilers.
- Before shipping, I'll read the reviewer rules once more to confirm none of them punish metaphor, humor or provocation.
- Repairable format problems are already fixed: up to six citations, and duplicate citations are merged instead of rejecting the reading. I'll add a test that a reading citing four choices passes.

## Proof before it goes live
- **Offline comparison:** 10 identical listening histories, including contradictory and weak-evidence cases. Old path (both stages) versus new path (synthesis only).
- **Measured:** Terra approval on the first try, fallback rate, unsupported-claim rejections, total wait and AI calls per interview, plus side-by-side text so you and CGPT can judge the voice.
- **Rule tests:** finishing makes no AI call, one saved reading is shown everywhere, saved readings never change, the last pick is reflected, and timeout recovery returns the saved reading.
- This uses some OpenAI or gateway credits for about 20 reviewed readings.

## Not changing
Models, prompts and voice, matchup picking, chat, sharing consent, learning and export, and Flutter's API shapes. Mobile `/reveal` returns the same fields, filled from the one reading.

## Technical details
- `finalizeSessionImpl`: delete the `observedCritic(... CRITIC_VOICE, stage "reveal")` call and the `revealDraftKey` prepared read. Persist `session_reasoning` and `sessions` with `narrative`/`interpretation` left null. Keep the `llm_calls` analyst row, and drop the critic row for this stage.
- `finalSynthesisImpl`: after the version 1 insert wins, backfill `sessions.interpretation` and `session_reasoning.narrative` with the synthesis, only where they're still null.
- `prepareReads` final-pick branch: drop `[revealDraftKey, CRITIC_VOICE]` and keep `[synthDraftKey, SYNTH_VOICE]`. The `prepared_reads` schema is unchanged.
- REST `session.$id.reveal.ts`: unchanged order (finalize, then synth). The `interpretation` field now comes from the synthesis.
- The offline harness reuses the existing experiment pattern in `tools/musicdna/`, with the report saved to `/mnt/documents/critic-final-consolidation/`.
