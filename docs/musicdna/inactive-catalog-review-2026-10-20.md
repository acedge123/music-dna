# Inactive catalog review and Lovable correction instructions

Date: 2026-10-20. Scope: CAT06 modern alternative pilot, `cat06-draft-1`.

## Verdict and evidence boundary

Keep most song candidates, but keep the batch inactive while correcting calibration and pair construction. This document carries the complete song-by-song and pair-by-pair review into the repository so Lovable can act on it without needing the spreadsheet.

The audit used the live catalog: 37 inactive songs and 23 inactive pairings. Song rows had last been updated at `2026-10-20T16:09:06.679529Z`. Repository reference: `19c1e73ab61c59fa4fbbf09f4134f482d7a4967a`. Treat the numbers below as a dated snapshot, not a claim about later catalog versions. Re-query current records and compare before preparing updates.

Numeric failures are calculated from stored values. Suggested score ranges and lane assignments are editorial proposals, not empirically validated measurements. No full audio audition or listener study was performed. Assume original standard studio recordings only where the version is unambiguous; verify versions before final rescoring.

| Check | Result |
| --- | ---: |
| New inactive songs reviewed | 37 |
| Inactive pairings reviewed | 23 |
| Pairings passing every declared test at >=20 points | 1 |
| Pairings passing exactly one declared test | 4 |
| Pairings passing no declared test | 18 |
| Declared tests meeting >=20 contrast | 6 / 46 |
| Pairings with neither test reaching runtime's >=10 directional threshold | 7 |
| Songs with incorrect six-component DPS arithmetic | 0 |
| Songs missing canon_score | 37 |
| Songs missing routing_power | 37 |
| Songs with empty primary_dimensions | 37 |

All 37 songs have ten numeric axis values within 0–100 and at least three axes outside the inclusive 35–65 band. Those checks pass, but they do not establish a well-calibrated catalog. Every new confidence score is at least 60; every community score is at least 65. All 23 pairing weights are 50; expected splits and user-facing tradeoffs are null. All song review provenance is still pending.

## Read these rules first

1. Read the repository's [AGENTS.md](../../AGENTS.md).
2. Use [catalog-expansion-spec.md](catalog-expansion-spec.md) for the current ten-axis curation contract, and [engine/axes.ts](../../src/musicdna/engine/axes.ts) for actual dimension membership.
3. Respect the pilot scope and approval requirement in [catalog-2000-2026-scope.md](catalog-2000-2026-scope.md).
4. Use the six-component DPS arithmetic from [diagnostic_scoring_algorithm.md](diagnostic_scoring_algorithm.md), but **do not use that document's obsolete active-axis list**. Its legacy dimensions and candidate-axis language conflict with the current engine. [ontology.md](ontology.md) and the old TSV anchors also contain legacy language.
5. [engine/evidence.ts](../../src/musicdna/engine/evidence.ts) uses `MIN_CONTRAST = 10` for directional evidence. This is not the curation target: a new declared test must have **at least 20 points** of contrast. Do not lower either standard to make this batch pass.
6. Preserve [engine/claims.ts](../../src/musicdna/engine/claims.ts): at least three distinct supporting pairings, support greater than contradiction, and consistency >=0.65. Catalog changes must not rewrite frozen choice evidence or saved results.

Do not infer that an existing active song is a trusted calibration anchor merely because it is active. The inspected active pool also contains questionable values. Establish a small reviewed anchor set before using it to calibrate more songs.

## Axis meanings and recurring mistakes

| Axis | Low pole | High pole | Correction discipline |
| --- | --- | --- | --- |
| movement | Stillness | Forward motion | Score propulsion, not BPM alone or chart energy. |
| atmosphere | Direct statement | Immersive mood | Spatial mood is distinct from delayed payoff. |
| immersion | Immediacy | Slow reveal | A hazy song with an instant hook need not score high. |
| scale | Intimate | Vast | Score perceived musical space, not streams, venue capacity or fame. |
| community | Solitary | Communal | Score invitation to shared participation. Multiple singers and large audiences alone are insufficient. |
| perspective | Inside feeling | Outside witness | Confession, self-awareness and first-person fictional narration are not automatically outside-witness perspectives. |
| confidence | Vulnerability | Command | Loud vocals and strong performance can carry vulnerability. Evaluate the song's expressive stance. |
| tension | Release | Danger | Consider sustained musical/emotional pressure. Dark subject matter alone is not enough. |
| texture | Rawness | Refinement | Unusual instrumentation does not necessarily mean refinement. Separate complexity from polish. |
| transformation | Holds its shape | Becomes something else | Score meaningful musical/emotional development. A theme of change or routine chorus lift is not sufficient. |

Apply the existing calibration bands: 90–100 defining high pole; 70–89 clearly high; 55–69 somewhat high; 45–54 neutral; 30–44 clearly low; 0–29 defining low pole. Use the range honestly. Do not force extreme scores or quotas when the recording does not warrant them; replace or broaden candidates instead.

### Learn from these examples

- **Maps:** confidence 85 erases the vulnerability the pairing is supposed to test. Start the review near 20–35, not because a low value improves the pair, but because the song's exposed longing supports that pole.
- **Clearest Blue:** transformation 60 understates the delayed release. Review 85–95 for transformation and 75–85 for immersion. Its expressive uncertainty also deserves consideration when assigning confidence.
- **Not Strong Enough:** perspective 85 mistakes multi-voice confession for outside observation. Review 15–30.
- **Take Me Out:** transformation 40 misses its major rhythmic transition. Review 75–85.
- **Seven Nation Army:** communal chant value can be high while the sparse, gritty recording is less vast and less refined. Score those attributes independently.
- **Such Great Heights:** identify the Postal Service recording, not an acoustic cover. Electronic intimacy can coexist with brisk motion and immediate hooks.

Targeted supporting sources, accessed 2026-10-20: [Karen O interview on Maps](https://www.newyorker.com/culture/the-new-yorker-interview/karen-o-has-found-a-more-joyful-kind-of-wildness); [CHVRCHES Song Exploder transcript](https://songexploder.net/transcripts/chvrches-transcript.pdf); [Clearest Blue arrangement review](https://www.spinmagazine.com/2015/09/chvrches-clearest-blue-every-open-eye-this-is-the-best-song-stream/); [Gotye production interview](https://www.soundonsound.com/techniques/mixing-gotyes-somebody-used-know-francois-tetaz). These support musical descriptions, not precise numerical scores.

## Instructions for Lovable: correction workflow

### 1. Inventory before changing anything

- Fetch current song and pairing records, including IDs, active status, scoring version, updated_at, all ten axes, DPS components, metadata and review provenance.
- Compare with this snapshot. Preserve later edits and report discrepancies instead of overwriting them.
- Resolve songs by stable IDs. Use artist + title + recording/version for candidate matching; never join on title alone. Fail loudly on missing or ambiguous matches.
- Count existing and new songs together for the three-per-artist-per-lane cap. New-batch counts alone are insufficient.

### 2. Review songs independently of pairings

- First choose the correct primary lane and a specific sub-lane. Do not relabel a pop track alternative merely to satisfy a modern-alternative coverage target.
- Establish reviewed low, middle and high examples for each axis. Document why they belong at those poles. Verify the specific recording, source and original release year/version.
- Score all ten dimensions from the song, with a short reason for each material revision. Reconcile lyrics, delivery and arrangement; flag genuine ambiguity rather than pretending precision.
- Use the song proposals below as a challenge to the original values, not an automatic replacement list. Accept, revise or reject each proposal with a reason.
- Never change a song's vector solely to make a desired matchup clear 20 points. Score first; generate or select opponents afterward.
- Retain useful familiarity anchors, but distinguish their role from elite diagnostic probes. Prioritize more stillness, solitary intimacy and slow reveal in the modern alternative candidate pool.
- Review Beautiful Things, Ordinary and Messy for pop placement. These are recommendations, not already-approved lane changes. R&B/soul remains a separate lane decision under the pilot scope.

### 3. Complete independent metadata

- Populate canon_score (cultural influence/recognition/longevity) and routing_power (known enough and unambiguous enough to route correctly), each on 0–100. Do not derive either from sonic scale, community or DPS.
- Keep DPS as the sum of six bounded components: polarization 0–25, tradeoff_richness 0–20, pairing_density 0–15, identity_signaling 0–15, longevity 0–10, cross_genre_mapping 0–15. All current sums are correct; do not rewrite them merely to create higher totals.
- A proposed DPS target range is a prompt to revisit components. Never independently edit a computed DPS total away from its component sum. Re-evaluate pairing_density against plausible reviewed opponents.
- Populate 1–3 primary_dimensions and a concise rationale naming a revealing tradeoff and plausible same-lane opponent. Respect the existing schema for candidate-family notes rather than inventing a field silently.
- Record score version, source/recording information, scoring time, scorer identity or process, and review status using the existing schema. AI revision does not imply Alan approval; retain a pending-review state until approval is real.

### 4. Rebuild pairings from reviewed vectors

- Keep only pairs with both songs in the same primary_lane and pairing.lane matching that route.
- Declare 1–3 valid current axes. For **every** declared axis require `abs(song_a[axis] - song_b[axis]) >= 20`. Missing values are unknown, not 50 or zero.
- Numerical contrast is necessary, not sufficient. Check whether the musical contrast is credible, familiarity is reasonably balanced, and either song is a plausible choice for the intended audience.
- Remove unsupported tests. If no useful tests remain, replace the matchup rather than retaining an attractive but unmeasurable hypothesis.
- Assess confounding contrasts on other axes. Do not imply a listener chose for a single reason when many attributes changed together.
- Reject duplicate unordered song-ID pairs. Deduplicate across the existing catalog, not just the new batch.
- Give diagnostic_weight an individually reasoned 0–100 score. Under the expansion spec, 80+ is elite, 50 is decent and <40 should be dropped. Do not leave every row at a schema default or inflate all weights.
- Supply a directional hypothesis and hedged user-facing explanation. Map the spec's `why_this_matters` into the existing `user_facing_tradeoff`/`why_good` fields as appropriate after verifying current schema. Explain the musical tradeoff, not an assumed personality trait or genre preference.
- Add an honest expected_split estimate, labeled as editorial until measured. Avoid obvious dominance and do not invent observed listener percentages.

### 5. Validate at batch and lane level

Create or extend an appropriate deterministic catalog validator. Report separate errors and editorial review warnings, with offending song/pairing IDs. Do not assume the old CSV validator already implements the current ten-axis contract.

Required checks:

- Exactly the ten recognized axes; finite values in 0–100; no legacy axis names.
- Each song has >=3 axes outside the inclusive 35–65 band; mandatory metadata present; DPS components in range and sum correct.
- Stable song resolution; no unresolved IDs, duplicates, ambiguous versions or unexplained artist-cap exceptions.
- Every pairing has 1–3 unique recognized tests and every test clears >=20 contrast.
- Lane consistency, unique unordered pair IDs, hypothesis/explanation, and deliberately assigned weight/split metadata.
- Axis coverage reports count **qualifying** tests, not merely labels. Show the new batch and combined lane separately.
- The full expansion spec targets at least five pairs per axis. A reduced pilot must explicitly disclose shortfalls and still support repeated tests and counterexamples; do not claim the full target is met or lower claim thresholds. Twenty-three two-test pairs supply only 46 test slots, insufficient for 50 required slots even before validity checks.
- Run real-selector fixtures for modern-only openers, mixed-era openers, skipped/unfamiliar songs, same-artist concentration and pool exhaustion. Verify a listener can reach meaningful evidence without depending on invalid tests.
- Check behavior through the actual ledger/claim policy. Preserve historical evidence snapshots and saved readings. No client-side or narrator fallback may invent evidence from undeclared axes.

### 6. Stage a reviewable correction, then seek activation approval

Deliver a versioned before/after song report, revised pairing report with both axis values and deltas, coverage summary, validator results, fixture results and unresolved editorial decisions. Record proposed mutations separately from the audit snapshot.

Keep staged records `active=false`. Do not modify active tracks, change runtime thresholds, enable backend gates, change schema or activate a batch as an incidental part of this review. Propose any required broader change separately. Follow the existing catalog workflow and obtain Alan's activation approval under the pilot scope. This documentation push is not approval to execute a data migration or activate songs.

### Acceptance checklist

- [ ] Current records compared with the dated snapshot; later edits preserved.
- [ ] Reviewed calibration anchors and recording versions documented.
- [ ] All 37 song recommendations addressed, including lane-review decisions.
- [ ] Canon/routing scores, DPS components, primary dimensions and provenance completed.
- [ ] Every retained pairing passes every declared >=20 contrast test and has a credible musical rationale.
- [ ] Individual weights, split estimates and hedged explanations populated.
- [ ] Missing import candidates explicitly resolved; no silent omissions or cross-lane repair.
- [ ] Axis coverage and artist concentration reported for both batch and combined lane.
- [ ] Real-selector and evidence-policy fixtures pass without relaxing thresholds.
- [ ] Remaining uncertainty is explicit; human approval precedes activation.

## Import reconciliation

The two migrations proposed 44 songs and 33 pairings. Duplicate protection retained seven existing active songs instead of creating alternative duplicates: Anti-Hero, As It Was, bad guy, drivers license, Good 4 U and Royals already belonged to pop; Midnight City belonged to electronic. This left 37 new song rows.

Pairing joins required both endpoints to have `scoring_version='cat06-draft-1'` and matched by title. Ten candidate pairings therefore did not stage, leaving 23. The duplicate protection was useful; silent pairing omission was not. Do not fix this by blindly attaching existing pop/electronic rows to alternative pairings. Resolve the intended lane and IDs, then either redesign the pair or document its exclusion.

Relevant imports:

- [Initial songs and pairings](../../supabase/migrations/20261020152712_0b1ab642-9b4c-4ac3-97a7-69354098d070.sql)
- [Additional pairing candidates](../../supabase/migrations/20261020160229_a31421a0-517b-4fb9-8ffc-b5c68d46eba0.sql)

## Song-by-song editorial review

The changes below are proposed ranges, not applied updates. DPS means diagnostic power, not song quality. See the numeric snapshot appendix for all current values.

| Song / artist | Action | Proposed revisions | Reason | DPS assessment |
| --- | --- | --- | --- | --- |
| Banquet — Bloc Party | Keep; refine | confidence 85 to 65–80; perspective 55 to 25–40; transformation 45 to 25–40 | Angular propulsion and tension are the strengths. It can contrast with synth haze on atmosphere and immersion rather than movement. | DPS 67 is plausible. |
| Beautiful Things — Benson Boone | Move to pop review | confidence 80 to 30–50; perspective 55 to 15–30; transformation 55 to 70–85 | Large dynamic escalation and anxious attachment may be useful, but this fits the pop/arena-ballad pool more cleanly than modern alternative depth. | DPS 62 is plausible. Do not activate the Ordinary matchup as scored. |
| Breezeblocks — alt-J | Keep; rescore | tension 60 to 80–90; confidence 70 to 35–55; perspective 65 to 20–40; texture 85 to 60–75 | Unsettling intimacy and fractured rhythmic detail are the stronger tests. Unusual arrangement does not automatically mean highly refined texture. | DPS 73 is plausible. |
| Budapest — George Ezra | Support anchor | confidence 78 to 50–65; perspective 50 to 20–35; transformation 40 to 20–35 | A relaxed low-tension control is useful. Keep it for accessible contrast, not as a major source of identity claims. | DPS 56 is plausible. |
| Clearest Blue — CHVRCHES | Keep; rescore | transformation 60 to 85–95; immersion 55 to 75–85; confidence 80 to 40–60 | The delayed instrumental release is the diagnostic asset. The current scores understate that structural change and overstate emotional command. | DPS 63 looks low. Revisit components toward 75–85 after pair design. |
| De Selby (Part 2) — Hozier | Keep; review lane | movement 66 to 75–85; perspective 70 to 20–40; confidence 80 to 55–70 | Rhythmic drive and intimate, enveloping imagery are useful. Review the broad electronic_crossover sub-lane against an indie-soul/art-rock descriptor. | DPS 66 is plausible. |
| Do I Wanna Know? — Arctic Monkeys | Keep; rescore | perspective 60 to 15–30; confidence 85 to 40–60; community 82 to 50–65 | The riff has swagger, but the lyric and delivery involve uncertainty and desire. A high tension score is defensible. | DPS 70 is plausible. |
| Dog Days Are Over — Florence + the Machine | Keep; rescore | transformation 75 to 85–95; confidence 85 to 65–80; tension 45 to 25–40 | Escalation from a sparse opening to collective release makes this a strong transformation anchor. Keep scale and community high. | DPS 72 may be conservative; revisit after pair design. |
| Feel It Still — Portugal. The Man | Support anchor | immersion 25 to 10–20; transformation 45 to 15–30; perspective 60 to 30–45 | A concise, stable retro hook provides a good immediacy control. Its current pairing against The Adults Are Talking does not test movement or confidence. | DPS 63 is plausible. |
| Float On — Modest Mouse | Keep; refine | perspective 60 to 30–45; texture 50 to 35–50; transformation 60 to 25–40 | Personal mishaps delivered with shared reassurance support community. Optimistic content is not necessarily structural transformation. | DPS 65 is plausible. |
| Heat Waves — Glass Animals | Keep; rescore | perspective 60 to 15–30; confidence 70 to 35–50; scale 85 to 55–70; community 86 to 50–65; immersion 65 to 35–50 | Hazy production supports atmosphere, but the hook is immediate and the emotional stance is vulnerable. Popularity is separate from sonic scale. | DPS 67 is plausible. |
| Ho Hey — The Lumineers | Support anchor | confidence 80 to 45–60; perspective 45 to 20–35; transformation 45 to 20–35 | Community 90 and immediate access are credible. The underlying appeal is emotionally needy rather than commanding. | DPS 71 is defensible if polarization is demonstrated. |
| I Bet You Look Good on the Dancefloor — Arctic Monkeys | Keep; refine | texture 40 to 20–35; transformation 40 to 20–35; confidence 92 to 75–85 | Fast, immediate and abrasive is a coherent vector. High movement 88 and immersion 10 are defensible. | DPS 68 is plausible. |
| Kids — MGMT | Keep; refine | perspective 45 to 65–80; transformation 55 to 30–45 | Direct address and observational framing deserve a more outward perspective score. Its immediately recognizable synth hook supports low-to-middle immersion. | DPS 72 is plausible. |
| Kyoto — Phoebe Bridgers | Keep; rescore | perspective 85 to 25–45; confidence 75 to 40–60; immersion 60 to 30–45 | Observational detail sits within personal conflict. The bright, direct arrangement is more immediate than its immersion score suggests. | DPS 72 is plausible. |
| Last Nite — The Strokes | Keep; refine | texture 55 to 25–40; transformation 45 to 20–35; confidence 90 to 70–85 | Direct garage-rock immediacy is useful. Keep it relatively raw and structurally stable. | DPS 73 is plausible. |
| Lonely Boy — The Black Keys | Keep; refine | texture 45 to 25–40; transformation 35 to 15–30; confidence 92 to 75–85 | Raw, immediate blues-rock propulsion is useful. Do not pair it with another swagger song and call the contrast confidence. | DPS 60 is plausible. |
| Maps — Yeah Yeah Yeahs | Keep; rescore | confidence 85 to 20–35; perspective 55 to 15–30; community 70 to 35–55 | Intimate pleading and exposed feeling make this a valuable vulnerability anchor. Vocal intensity should not be scored as command. | DPS 76 is plausible. |
| Messy — Lola Young | Move to pop review | perspective 80 to 15–30; confidence 75 to 45–65; texture 60 to 35–50; community 80 to 50–65 | Defiance and vulnerability coexist in personal confession. Pop/soul placement is cleaner than generic britpop_indiepop; R&B would need a lane decision. | DPS 64 is plausible. |
| Mr. Brightside — The Killers | Keep; rescore | confidence 85 to 35–55; perspective 65 to 15–30; texture 50 to 65–80 | A communal anthem can still convey private jealousy and insecurity. Keep community near 90 while separating narrative vulnerability from audience participation. | DPS 68 is plausible for a familiarity anchor with diagnostic uses. |
| Nine in the Afternoon — Panic! at the Disco | Support anchor | scale 60 to 70–80; texture 65 to 75–85; transformation 55 to 30–45 | Theatrical, arranged pop-rock provides a refined contrast with raw guitar songs. Broad recognition alone should not make it an elite probe. | DPS 66 is plausible. |
| Not Strong Enough — boygenius | Keep; rescore | perspective 85 to 15–30; confidence 70 to 30–45; transformation 55 to 65–80 | Confession and self-doubt are inside the narrator's experience. Multiple singers do not make an outside-witness perspective. | DPS 71 is plausible; revisit after recalibration. |
| Ordinary — Alex Warren | Move to pop review | confidence 75 to 40–60; perspective 60 to 15–30; texture 55 to 75–85 | Useful contemporary pop recognition coverage. It adds little alternative diversity and closely duplicates Beautiful Things on declared tests. | DPS 61 is plausible as a support anchor. |
| Pumped Up Kicks — Foster the People | Keep; refine | perspective 75 to 60–80; transformation 40 to 20–35 | Narrative distance and dark subject matter against a buoyant hook are useful. Do not treat dark subject matter alone as sonic danger. | DPS 69 is plausible. |
| Rebellion (Lies) — Arcade Fire | Keep; refine | confidence 85 to 65–80; texture 60 to 40–55 | Communal accumulation and emotional lift are useful. Its existing community 90 and transformation 70 are defensible starting points. | DPS 80 is plausible. |
| Riptide — Vance Joy | Support anchor | community 85 to 65–75; confidence 70 to 45–60; perspective 55 to 25–45; transformation 40 to 20–35 | Acoustic immediacy and singalong familiarity are useful. It is too similar to Ho Hey to test the currently declared axes. | DPS 61 is plausible. |
| Seven Nation Army — The White Stripes | Keep; rescore | scale 92 to 60–75; texture 50 to 25–40; confidence 95 to 80–90; transformation 45 to 20–35 | Keep its communal chant value high. The sparse, gritty recording should not be scored as cathedral-scale just because stadium crowds adopted it. | DPS 62 is plausible for a recognition anchor. |
| Shut Up and Dance — Walk the Moon | Support anchor | texture 50 to 75–85; transformation 40 to 20–35 | Immediate movement and community are strong. The polished production should not sit at neutral texture. | DPS 65 is plausible. |
| Solar Power — Lorde | Keep; review lane | perspective 70 to 40–60; confidence 70 to 55–75; transformation 60 to 45–65 | The relaxed, low-tension profile is useful, but the alternative assignment needs a song-specific rationale because Lorde already supplies pop routing. | DPS 65 is plausible; keep routing power modest until tested. |
| Somebody That I Used to Know — Gotye | Keep; review lane | perspective 80 to 20–40; scale 85 to 40–60; community 88 to 40–60 | Two first-person accounts remain personal accounts. Sparse production and relationship intimacy should not inherit the song's global audience size. | DPS 66 is plausible. Crossover routing power should be moderate. |
| Such Great Heights — The Postal Service | Keep; rescore | movement 45 to 65–80; immersion 65 to 30–45; perspective 60 to 15–30; community 72 to 40–60 | The original Postal Service recording is brisk and hook-led. Avoid scoring it like a slow acoustic cover. Intimacy and refined electronic texture remain useful. | DPS 76 is plausible once the recording is specified. |
| Take a Walk — Passion Pit | Keep; rescore | perspective 70 to 25–45; confidence 75 to 45–60; transformation 50 to 25–40 | A fictional first-person character is still inside the experience. The useful tension is between bright production and heavy subject matter. | DPS 62 is plausible. |
| Take Me Out — Franz Ferdinand | Keep; rescore | transformation 40 to 75–85; confidence 92 to 65–80; perspective 50 to 25–40 | Its major early rhythmic transition distinguishes it from a straight garage single. Swagger is present, but command at 92 is overconfident. | DPS 75 is plausible. |
| The Adults Are Talking — The Strokes | Keep; rescore | immersion 40 to 55–70; confidence 85 to 55–70; transformation 45 to 55–70 | Cool surface, gradual development and emotional strain make this more useful than a generic legacy-act placeholder. | DPS 57 may be low; revisit components toward 65–75. |
| The Mother We Share — CHVRCHES | Keep; refine | texture 68 to 75–85; confidence 78 to 55–70; perspective 55 to 25–40; transformation 50 to 25–40 | Polished synth-pop with direct emotional appeal can work in the alternative crossover pool. Contrast it with a drier, more immediate track. | DPS 67 is plausible. |
| Time to Pretend — MGMT | Keep; refine | perspective 70 to 40–60; confidence 80 to 60–75; transformation 60 to 35–50 | Satire complicates the first-person fantasy, but does not fully turn it into detached narration. Refined synthetic texture remains useful. | DPS 72 is plausible. |
| Use Somebody — Kings of Leon | Keep; rescore | confidence 80 to 35–55; perspective 40 to 15–30; texture 45 to 60–75 | Arena scale can coexist with need and vulnerability. Production is more polished than the current rawness-leaning texture score suggests. | DPS 67 is plausible. |

## Pair-by-pair review

All deltas are absolute differences from the snapshot, before proposed rescoring. A numeric pass does not by itself confer editorial approval.

| Pair | Declared test gaps | Numeric result | Action | Suggested tests | Reason |
| --- | --- | --- | --- | --- | --- |
| Banquet vs Kids | movement: 7, texture: 15 | Fail | Retarget | atmosphere; immersion | Current atmosphere and immersion gaps are both 25. The intended guitar attack versus synth haze is better expressed here than by movement. |
| Beautiful Things vs Ordinary | scale: 3, community: 3 | Fail | Drop from alternative pilot | None | Both declared gaps are 3 and no axis reaches 20. Both also fit pop more cleanly. |
| Budapest vs Ho Hey | community: 10, scale: 10 | Fail | Replace | None | No current axis reaches 20. Both are low-tension, accessible acoustic-pop songs. |
| Budapest vs Solar Power | tension: 0, perspective: 20 | Partial | Retain; narrow tests | perspective; atmosphere (review) | Tension is exactly tied at 20. Perspective currently differs by 20, atmosphere by 22; confirm perspective and lane first. |
| Clearest Blue vs Shut Up and Dance | transformation: 20, movement: 6 | Partial | Retain; retarget | transformation; immersion | Current transformation/immersion gaps are 20/40 and could sharpen after calibration. Both are propulsive; movement is not the test. |
| De Selby (Part 2) vs Breezeblocks | texture: 10, atmosphere: 7 | Fail | Rescore, then retarget | movement; tension (candidate) | Current tests fail and no axis reaches 20. Correct the propulsion and menace values before retaining. |
| Do I Wanna Know? vs Lonely Boy | tension: 32, confidence: 7 | Partial | Retain; narrow tests | tension; immersion | Current gaps are 32 and 40. Remove confidence unless rescoring creates a genuine gap. |
| Feel It Still vs The Adults Are Talking | movement: 6, confidence: 0 | Fail | Retarget after review | immersion (after rescoring) | Movement differs by 6 and confidence is tied. Immediacy versus patient development is more defensible. |
| Float On vs Time to Pretend | perspective: 10, atmosphere: 13 | Fail | Retarget after review | texture; immersion (candidate) | Current gaps are 22 and 25. The dry guitar/direct hook versus synthetic fantasy is more useful than the declared small gaps. |
| Heat Waves vs Such Great Heights | immersion: 0, atmosphere: 5 | Fail | Rescore, then redesign | scale (candidate) | Immersion is tied and atmosphere differs by 5. Current scale gap is 35 but depends on inflated Heat Waves scale. |
| Ho Hey vs Riptide | community: 5, movement: 3 | Fail | Replace | None | No current axis reaches 20. Two accessible acoustic singalongs do not isolate community or movement. |
| I Bet You Look Good on the Dancefloor vs Nine in the Afternoon | confidence: 12, movement: 18 | Fail | Retarget | texture; atmosphere | Current gaps are 25 and 30. Raw attack versus theatrical polish is a clearer test than two high-confidence uptempo songs. |
| Kyoto vs Messy | perspective: 5, tension: 10 | Fail | Replace or move | None yet | No current axis reaches 20. Lane ambiguity and similar confessional stance make the promised contrast weak. |
| Last Nite vs Take Me Out | movement: 13, confidence: 2 | Fail | Rescore, retain concept | transformation | Both current tests fail. Take Me Out's structural turn can create a meaningful contrast with Last Nite's more stable form. |
| Maps vs Seven Nation Army | tension: 15, confidence: 10 | Fail | Rescore, retain concept | confidence; scale | The vulnerability-versus-swagger concept is good. Correct Maps confidence first; do not preserve tension unless the reviewed gap is at least 20. |
| Mr. Brightside vs Use Somebody | scale: 2, community: 5 | Fail | Redesign | tension (candidate) | Both are arena-scale communal songs. Tension currently differs by 20; rescore both vulnerable narrators before proposing another axis. |
| Pumped Up Kicks vs Take a Walk | perspective: 5, movement: 8 | Fail | Replace or redesign | None yet | No current axis reaches 20. Both share bright sound/heavy subject matter; the rationale describes a similarity. |
| Rebellion (Lies) vs Dog Days Are Over | community: 2, transformation: 5 | Fail | Retarget after review | tension (candidate) | Both are communal builders. Current tension gap is 20; transformation may remain close after honest rescoring. |
| Solar Power vs Float On | perspective: 10, tension: 15 | Fail | Replace or redesign | None yet | No current axis reaches 20. Both are low-tension releases, so the current hypothesis gives little discriminating value. |
| Somebody That I Used to Know vs Breezeblocks | perspective: 15, texture: 10 | Fail | Rescore, then redesign | tension (after rescoring) | Current scale/community alternatives depend on inflated Gotye scores. Correct the songs before selecting tests. |
| Such Great Heights vs Mr. Brightside | immersion: 25, scale: 38 | Pass | Retain concept; review scores | scale; atmosphere; texture | Only pair passing both declared numeric tests. Such Great Heights immersion is questionable; prefer sonic intimacy/refinement versus anthem scale after rescoring. |
| The Adults Are Talking vs Do I Wanna Know? | tension: 22, texture: 0 | Partial | Retain; narrow tests | tension | Tension differs by 22; texture is exactly tied. A narrower test is more honest. |
| The Mother We Share vs Shut Up and Dance | community: 8, movement: 12 | Fail | Retarget | atmosphere; immersion | Current gaps are 25 and 30. Validate relative familiarity and texture calibration. |

## Axis coverage at review time

| Axis | Song min | Song max | Declared tests | Tests with gap >=20 |
| --- | --- | --- | --- | --- |
| movement | 45 | 88 | 8 | 0 |
| atmosphere | 30 | 80 | 3 | 0 |
| immersion | 10 | 70 | 2 | 1 |
| scale | 50 | 92 | 4 | 1 |
| community | 65 | 90 | 6 | 0 |
| perspective | 35 | 85 | 6 | 1 |
| confidence | 60 | 95 | 5 | 0 |
| tension | 20 | 75 | 6 | 2 |
| texture | 40 | 85 | 4 | 0 |
| transformation | 35 | 75 | 2 | 1 |

## Appendix: original ten-axis snapshot

Values below are preserved audit inputs, not recommended replacements.

| Song | Artist | movement | atmosphere | immersion | scale | community | perspective | confidence | tension | texture | transformation | DPS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Banquet | Bloc Party | 82 | 40 | 25 | 60 | 78 | 55 | 85 | 65 | 55 | 45 | 67 |
| Beautiful Things | Benson Boone | 62 | 65 | 50 | 85 | 85 | 55 | 80 | 55 | 55 | 55 | 62 |
| Breezeblocks | alt-J | 55 | 68 | 60 | 55 | 65 | 65 | 70 | 60 | 85 | 55 | 73 |
| Budapest | George Ezra | 66 | 50 | 20 | 60 | 80 | 50 | 78 | 20 | 40 | 40 | 56 |
| Clearest Blue | CHVRCHES | 82 | 70 | 55 | 70 | 75 | 50 | 80 | 55 | 75 | 60 | 63 |
| De Selby (Part 2) | Hozier | 66 | 75 | 65 | 65 | 70 | 70 | 80 | 55 | 75 | 60 | 66 |
| Do I Wanna Know? | Arctic Monkeys | 58 | 70 | 55 | 80 | 82 | 60 | 85 | 72 | 65 | 40 | 70 |
| Dog Days Are Over | Florence + the Machine | 80 | 70 | 55 | 85 | 88 | 50 | 85 | 45 | 70 | 75 | 72 |
| Feel It Still | Portugal. The Man | 74 | 50 | 25 | 70 | 84 | 60 | 85 | 30 | 60 | 45 | 63 |
| Float On | Modest Mouse | 68 | 55 | 30 | 70 | 82 | 60 | 80 | 35 | 50 | 60 | 65 |
| Heat Waves | Glass Animals | 60 | 80 | 65 | 85 | 86 | 60 | 70 | 35 | 78 | 50 | 67 |
| Ho Hey | The Lumineers | 65 | 50 | 25 | 70 | 90 | 45 | 80 | 20 | 40 | 45 | 71 |
| I Bet You Look Good on the Dancefloor | Arctic Monkeys | 88 | 30 | 10 | 62 | 85 | 70 | 92 | 60 | 40 | 40 | 68 |
| Kids | MGMT | 75 | 65 | 50 | 75 | 86 | 45 | 75 | 30 | 70 | 55 | 72 |
| Kyoto | Phoebe Bridgers | 62 | 70 | 60 | 55 | 72 | 85 | 75 | 55 | 60 | 55 | 72 |
| Last Nite | The Strokes | 72 | 40 | 20 | 60 | 80 | 45 | 90 | 45 | 55 | 45 | 73 |
| Lonely Boy | The Black Keys | 78 | 35 | 15 | 70 | 80 | 40 | 92 | 40 | 45 | 35 | 60 |
| Maps | Yeah Yeah Yeahs | 55 | 65 | 70 | 65 | 70 | 55 | 85 | 75 | 60 | 55 | 76 |
| Messy | Lola Young | 55 | 68 | 55 | 70 | 80 | 80 | 75 | 65 | 60 | 55 | 64 |
| Mr. Brightside | The Killers | 78 | 45 | 40 | 88 | 90 | 65 | 85 | 70 | 50 | 45 | 68 |
| Nine in the Afternoon | Panic! at the Disco | 70 | 60 | 35 | 60 | 75 | 55 | 80 | 30 | 65 | 55 | 66 |
| Not Strong Enough | boygenius | 58 | 72 | 65 | 65 | 78 | 85 | 70 | 60 | 65 | 55 | 71 |
| Ordinary | Alex Warren | 58 | 70 | 55 | 88 | 88 | 60 | 75 | 40 | 55 | 55 | 61 |
| Pumped Up Kicks | Foster the People | 72 | 55 | 30 | 65 | 84 | 75 | 75 | 55 | 55 | 40 | 69 |
| Rebellion (Lies) | Arcade Fire | 74 | 62 | 60 | 88 | 90 | 55 | 85 | 65 | 60 | 70 | 80 |
| Riptide | Vance Joy | 62 | 60 | 30 | 65 | 85 | 55 | 70 | 25 | 45 | 40 | 61 |
| Seven Nation Army | The White Stripes | 70 | 45 | 30 | 92 | 88 | 50 | 95 | 60 | 50 | 45 | 62 |
| Shut Up and Dance | Walk the Moon | 88 | 40 | 15 | 75 | 88 | 35 | 90 | 25 | 50 | 40 | 65 |
| Solar Power | Lorde | 50 | 72 | 40 | 60 | 70 | 70 | 70 | 20 | 55 | 60 | 65 |
| Somebody That I Used to Know | Gotye | 50 | 72 | 60 | 85 | 88 | 80 | 70 | 68 | 75 | 55 | 66 |
| Such Great Heights | The Postal Service | 45 | 75 | 65 | 50 | 72 | 60 | 60 | 25 | 80 | 50 | 76 |
| Take a Walk | Passion Pit | 80 | 55 | 30 | 60 | 78 | 70 | 75 | 45 | 70 | 50 | 62 |
| Take Me Out | Franz Ferdinand | 85 | 35 | 15 | 65 | 84 | 50 | 92 | 55 | 45 | 40 | 75 |
| The Adults Are Talking | The Strokes | 68 | 55 | 40 | 60 | 70 | 65 | 85 | 50 | 65 | 45 | 57 |
| The Mother We Share | CHVRCHES | 76 | 65 | 45 | 65 | 80 | 55 | 78 | 35 | 68 | 50 | 67 |
| Time to Pretend | MGMT | 72 | 68 | 55 | 70 | 78 | 70 | 80 | 40 | 72 | 60 | 72 |
| Use Somebody | Kings of Leon | 60 | 60 | 45 | 90 | 85 | 40 | 80 | 50 | 45 | 50 | 67 |

## Appendix: original DPS components and record IDs

The six component sums reconcile for every song.

| Song | Song ID | polarization | tradeoff_richness | pairing_density | identity_signaling | longevity | cross_genre_mapping | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Banquet | cc669ae2-34b5-4149-818b-8b44dc8ce661 | 17 | 12 | 10 | 12 | 6 | 10 | 67 |
| Beautiful Things | c5422dfe-091c-4d3e-9d89-11b6c754d45b | 18 | 10 | 9 | 11 | 4 | 10 | 62 |
| Breezeblocks | e47be745-166e-4542-be82-089ce9f3fec2 | 20 | 14 | 10 | 13 | 6 | 10 | 73 |
| Budapest | 6ba8346a-5e96-44bb-8858-fd8912ef40ef | 16 | 8 | 8 | 10 | 5 | 9 | 56 |
| Clearest Blue | f0effd72-6c77-4529-872a-548cd95340e2 | 15 | 13 | 9 | 11 | 5 | 10 | 63 |
| De Selby (Part 2) | 15f5b02d-0efa-4683-bff8-32b006aeea7a | 16 | 13 | 9 | 12 | 5 | 11 | 66 |
| Do I Wanna Know? | 4d12cf5e-402d-47d5-bb60-697a3beea007 | 16 | 13 | 12 | 11 | 8 | 10 | 70 |
| Dog Days Are Over | 9bb1081d-3ca4-4e1c-b6a0-5a39e43a5682 | 15 | 14 | 11 | 12 | 8 | 12 | 72 |
| Feel It Still | 7a26a4be-30af-49f9-9c37-1f733c2eea7f | 15 | 11 | 10 | 10 | 6 | 11 | 63 |
| Float On | cf569731-a5a9-440a-b4f0-aba8fec94c1e | 15 | 12 | 10 | 11 | 8 | 9 | 65 |
| Heat Waves | 8be528c8-a73c-4cc0-bebd-2706161d480a | 15 | 12 | 11 | 11 | 7 | 11 | 67 |
| Ho Hey | 6a4e523f-3616-4c40-9e90-92464655b749 | 21 | 10 | 10 | 13 | 6 | 11 | 71 |
| I Bet You Look Good on the Dancefloor | a3e0dcd6-ab13-4ac8-9817-0c49e2d5991f | 17 | 11 | 11 | 12 | 8 | 9 | 68 |
| Kids | 438c1d74-5fb0-4aab-839d-62494db6dafa | 16 | 13 | 11 | 12 | 8 | 12 | 72 |
| Kyoto | 6f13c2ac-4b0f-425e-b814-3b55494ed96a | 18 | 13 | 10 | 14 | 7 | 10 | 72 |
| Last Nite | 07ebce3b-4698-409f-a5ef-f56e1e399683 | 18 | 12 | 12 | 13 | 9 | 9 | 73 |
| Lonely Boy | d97250cc-50e2-444f-b6a6-54dff776b7be | 15 | 9 | 10 | 10 | 7 | 9 | 60 |
| Maps | fd16e83c-9f44-430e-87f9-608d6d4917ca | 19 | 15 | 11 | 12 | 8 | 11 | 76 |
| Messy | ceb5d0a6-450d-469e-a8b9-11868047751a | 17 | 12 | 9 | 12 | 4 | 10 | 64 |
| Mr. Brightside | 6a2f760c-2d69-417f-9f99-356b768ff45e | 14 | 11 | 13 | 9 | 10 | 11 | 68 |
| Nine in the Afternoon | 36eb9016-e0b6-4127-af0a-c14dd6840882 | 20 | 11 | 8 | 13 | 5 | 9 | 66 |
| Not Strong Enough | f77a1c66-af97-4291-baa2-031d6fe3033a | 18 | 13 | 10 | 14 | 6 | 10 | 71 |
| Ordinary | 00e86d67-b353-4ead-867b-bff658957466 | 18 | 10 | 9 | 11 | 3 | 10 | 61 |
| Pumped Up Kicks | dbb70a54-533b-44c2-a661-d247de7fb08e | 18 | 13 | 10 | 11 | 7 | 10 | 69 |
| Rebellion (Lies) | ad7cfe1b-f058-4543-aa6b-47fbbd34354b | 19 | 15 | 12 | 14 | 9 | 11 | 80 |
| Riptide | e90493ec-ad1b-481b-a77b-212f38993cdb | 17 | 9 | 9 | 11 | 6 | 9 | 61 |
| Seven Nation Army | d3853ea6-6040-4347-b207-bb1d593f17c1 | 12 | 9 | 12 | 8 | 10 | 11 | 62 |
| Shut Up and Dance | 6ff8e3f7-c5d9-4f54-9e6d-9e76658265f6 | 19 | 9 | 10 | 11 | 6 | 10 | 65 |
| Solar Power | 85a72d6b-e319-4e23-adc9-0e9c550276ba | 20 | 12 | 8 | 12 | 4 | 9 | 65 |
| Somebody That I Used to Know | 1deb5d08-9c2c-4a18-b94f-98ff2e74de0e | 15 | 13 | 10 | 10 | 7 | 11 | 66 |
| Such Great Heights | c034ee2f-65ef-486f-a446-5165fb21c4da | 18 | 14 | 11 | 13 | 8 | 12 | 76 |
| Take a Walk | bc53aee1-55d7-4e54-82bd-50f547e33ca2 | 15 | 12 | 9 | 11 | 5 | 10 | 62 |
| Take Me Out | c176b6a9-8d68-452c-b8cb-cdab7acad5b9 | 18 | 13 | 12 | 12 | 9 | 11 | 75 |
| The Adults Are Talking | a4462070-3027-4955-888d-0b8acb80631f | 14 | 11 | 8 | 11 | 5 | 8 | 57 |
| The Mother We Share | d00eadbe-1ef8-44e0-b410-10b8eae4cab2 | 16 | 12 | 10 | 12 | 6 | 11 | 67 |
| Time to Pretend | b9c2e9db-de85-4e4e-952e-7ac4b45feec5 | 17 | 14 | 10 | 13 | 7 | 11 | 72 |
| Use Somebody | 6b2b3e84-86ab-4bc5-ae09-1c56541d8b50 | 19 | 10 | 10 | 11 | 7 | 10 | 67 |
