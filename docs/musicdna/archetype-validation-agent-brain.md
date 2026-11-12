# Archetype validation via Agent Brain (future)

Status: agreed direction, not built. Production profiles never change from this loop without human approval.

## Principle
Do not let the matcher validate itself with the same traits that produced its prediction. Validation needs independent evidence: lyric/theme assessments, listener "fits me" answers (`result_feedback.target = 'archetype:<name>'`), and chat pushback.

## First experiment: Seeker
Objective: determine whether the revised Seeker is independently distinguishable from Transformer, Atmospherist and Witness, and recommend evidence-backed adjustments without changing production profiles.

1. Hypothesis: Seeker listeners favor observation, transformation, vastness and atmosphere, and music that explores questions rather than delivering answers.
2. Test set: 20–30 songs. Plausible Seeker songs plus hard alternatives from Transformer, Atmospherist and Witness.
3. Independent assessment: Sol explains fit, including lyrical themes. Terra checks the reasoning against song evidence. Humans review a sample.
4. Listener test: replay saved six-pick sessions offline against draft profiles. Then collect new "Does this describe what you seek in music?" answers.
5. Measure: correct matches, neighbor confusion, false positives, confidence calibration.
6. Learn: Agent Brain proposes weight or signal changes. A human approves them, and the change ships as a new `archetype_profiles` version. Saved readings keep their frozen match.

Flow: MusicDNA (choices, traits, receipts) -> Agent Brain (hypothesize/test) -> Echelon (measure/record) -> evidence strong enough? -> human approval -> versioned profile update. EdgeBot may coordinate tasks.

## Guardrails
- Offline first. Record every hypothesis, prediction, result and proposed correction.
- Owner-QA sessions are excluded from metrics.
- No listener data leaves MusicDNA except through the existing consent-gated learning paths (AB-57). The synthetic-only V1 rules still apply.
- Then repeat for Architect, Storyteller and Believer.
