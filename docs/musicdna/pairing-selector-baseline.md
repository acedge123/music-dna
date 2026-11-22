# How MusicDNA selects a pairing

Reviewed Discover mode at `3fa9a4273fd4b954312af2ad677e0d2df8252b9a`, November 22, 2026. This describes source behavior. The production routing flag and the fraction of sessions taking each path were not verified.

## From three opening songs to one offer

1. The shared server entry [nextPairingImpl](../../src/lib/musicdna.functions.ts#L841) loads session lane, lane confidence, the current preference vector, choices and skips. It checks completion first. Refine and decade Explore have separate selectors. Discover draws from active, already-authored two-song matchups.
2. Opening-song analysis supplies candidate lanes. Catalog-matched opening songs with known years supply a soft era window. In the first three answered rounds, prefer pairs with **both** songs between the earliest known opener year minus ten and the latest plus ten, provided at least three unused candidates meet that test at the era-filter stage. Unknown years, small pools or later rounds weaken or remove that constraint. The implementation computes a 3:2:1 weighted center, but it lies inside the min/max span, so slot order does not narrow the resulting window. Openers from 1975 and 2015 yield 1965–2025. [Era code](../../src/musicdna/engine/opener-era.ts)
3. A general-lane session with fewer than two answered bootstrap probes first tries marked, diagnostically valid pairs. Before a skip, a match to the opener lanes on **either** song or the pairing suffices. After a skip it can widen. It prefers two different primary lanes and draws **uniformly** from the survivors. Two bootstrap winners agreeing on a specific lane can promote the session. No eligible bootstrap pair means ordinary selection. [Bootstrap](../../src/lib/musicdna.functions.ts#L1147)
4. Ordinary selection starts with the session lane, or all active pairings for general. It removes previously answered or skipped pair IDs, same-artist comparisons and pairs without a valid contrasting test. General sessions favor recognition. A specific lane below 0.6 confidence blends recognition and diagnostic weight. Higher confidence favors diagnostic weight. Recognition uses catalog-level pair scores and a minimum canon score, a proxy for recognizability. A recognition floor can relax when no pair clears it.
5. The default fork rule prefers pairs that test one of the three strongest leaning axes (absolute vector score at least 15) when any qualify. Within the eligible pool the baseline combines diagnostic weight and recognition (recognition shares of 0%, 40% or 60% by mode), multiplies by an axis-need factor and applies a 1.5× boost for challenging a leaning axis. It samples proportional to weight with a session-and-round seed. If every survivor matches the fork, that common boost cannot affect their relative odds. A specific lane that runs dry retries the general lane and may ultimately report catalog exhaustion. [Scoring and draw](../../src/musicdna/engine/pairing.ts) · [Caller and fallback](../../src/lib/musicdna.functions.ts#L1310)
6. Listener steering can soften the fork filter or favor a harder diagnostic. A skip prevents re-serving that pair, can widen probes and contributes to stopping rules. It supplies no preference vote. The skip endpoint accepts optional decision time and has no reason field. MusicDNA offers no previews. [Skip handling](../../src/lib/musicdna.functions.ts#L1885)

## What Brain can compare

Legacy, shadow and live are execution modes. Shadow can compare the baseline and alternate router knobs for the same ordinary round using the same seed and pool. Live can apply local regime-derived knobs. Bootstrap uses a separate unseeded uniform draw. The caller also supplies an explicit selection mode that takes precedence over the knob object's mode. Changing a knob alone may therefore leave a candidate behaviorally identical. Audit actual offers and effective settings. [Call site](../../src/lib/musicdna.functions.ts#L1332) · [Pilot routing](../../src/musicdna/learning/pilot-routing.ts)

## Proposed first selector experiment

Freeze the served baseline by artifact hash and effective mode. Keep bootstrap and the intended diagnostic contrast identical between arms. For a single challenger, estimate familiarity for **each** song from the three openers (lane/genre and era where available); prefer pairs whose less familiar side still scores reasonably well. Record missing opener matches and use the baseline when evidence is insufficient. Existing catalog recognition and the broad era window provide an informative baseline.

Have Agent Brain compare versioned candidates on identical saved contexts first. Check eligible coverage, divergence, both songs' estimated familiarity and preservation of the intended contrast. Shadow results describe alternative offers; historical skips label only the pair actually shown. Then use the existing [pilot assignment design](ab52-pilot-plan.md) to assign consenting listeners to a fixed selector for an interview. Include selector and configuration hashes, served exposure, round, both songs, axis tested, fallback, choice or skip and optional decision time. Compare skips per served offer by round, report completion per assigned listener and original-reading accuracy with response coverage. Count abandoned offers separately. Track how often the challenger actually changes the offer. Treat fast clicks as ambiguous. Promote only after reviewing real outcomes, with a rollback to the pinned baseline.


## Experiment backlog for Codex and Lovable

These are proposed experiments. Run one challenger against the pinned baseline at a time. Keep the number of rounds, critic prompts, scoring and UI consistent across arms. A result applies to the population and rounds where the policy could change the offer.

| Order | Candidate and eligible population | Question and primary outcome | What could go wrong |
|---|---|---|---|
| 1. Familiarity on both sides | In ordinary Discover rounds, keep the intended contrast and favor the pair with the better minimum of its two opener-based familiarity estimates. Keep bootstrap identical. | Does balancing familiarity reduce skips per served ordinary offer? Report by answered-round index and show completion and original-reading accuracy. | Repeatedly serving familiar hits could narrow coverage and yield less revealing readings. Report unique artists, diagnostic axes covered and fallback frequency. |
| 2. Match an actual opener era | For interviews with widely separated known opener years, prefer early pairs whose songs are each near an actual opener year. For an initial candidate, define widely separated as at least 25 years and near as within 10 years. Preserve baseline lane, diagnostic and bootstrap rules; vary the ordinary-round era preference only. Fall back if too few eligible pairs survive. | Does excluding the empty middle between distant opener years reduce early skips? Compare skip rates on ordinary offers before the third answered choice in eligible interviews. | A listener may genuinely like the intervening decades. Report coverage, catalog exhaustion, fallbacks and completion. Lock distance and minimum-pool settings before enrollment. |
| 3. Recover after a skip | On the first skip of an ordinary pair, try one replacement testing the same axis in the listener's strongest opener lane with high catalog recognizability on both sides. Resume baseline behavior after that offer. Use the standard fallback if no such match exists. | Does a listener answer the next offer more often? Count eligible first-skip interviews and report next offer answered, skipped again, abandoned, or unavailable. | The skipped pair may have been too close to call. A skip alone gives no basis for a lasting taste adjustment. Track same-axis coverage, recovery eligibility and eventual completion. |

### Evidence and release decision

- **Before enrollment:** pin baseline and challenger code/configuration hashes. Replay both on the same eligible catalog and saved decision state. Hold the random seed fixed for ordinary rounds. Capture divergence, invalid pairs, contrast preserved and fallback counts. Identical outputs indicate little opportunity to measure a difference.
- **During the pilot:** persist one assignment per eligible listener/interview under the existing pilot design. Link the assigned version, actually served version, exposure ID, round, candidate pool size, both song IDs, intended axis, relevant opener-match features, fallback and subsequent outcome. Keep skips, unanswered offers and completions distinct. There are no previews. Optional decision time is descriptive only.
- **After the pilot:** show raw numerators and denominators, arm differences and uncertainty accounting for repeated offers per listener. Report all assigned interviews, including those that never reached an eligible round. For final accuracy show both the response distribution and how many completed listeners responded. Set the minimum worthwhile benefit, acceptable guardrail losses, sample target and stopping rule before reviewing arm outcomes. Small samples can justify another pilot.
- **Handoff:** MusicDNA owns serving, exposure/outcome records and the rollback artifact. Agent Brain can compare versioned replay and pilot reports and recommend a candidate. Echelon can attach that evidence to a reviewed proposal. Record the decision and verify which version actually served after release. These are proposed responsibilities for selector testing; the existing perceived-accuracy proposal contract would need extension to represent skip or recovery outcomes as primary metrics.

An optional skip-reason question could distinguish unfamiliarity, dislike and a difficult choice. Test that UI separately or show it identically in both arms. Asking can itself change completion, and unanswered reasons stay unknown.

---

## Pairing-selector experiments with Agent Brain

### Status and review

**Design approved by Alan on November 22, 2026; implementation remains on hold.** Approval covers the future plan, not code changes, paid model calls, enrollment, migrations, exports, flag changes or production rollout. The shared review and approved plan live in `docs/musicdna/pairing-selector-baseline.md`.

Reviewed merged PR **62** (`ccd3062`), which adds `docs/musicdna/pairing-selector-baseline.md`, against the existing MusicDNA experiment, reporting and learning documentation. Production settings and the current Agent Brain/Echelon deployments were not verified.

**Assessment: the direction is sound.** Start with a pinned baseline, change one selector behavior at a time, compare identical decision contexts offline, and require real listener outcomes before calling a challenger better. Agent Brain should evaluate and recommend—not choose songs through a remote call during the interview or automatically release a policy.

#### Owner emphasis: soft lane-and-era familiarity

The target is a **soft lane-and-era preference**, not a rigid decade fence or a personal recognition claim. Alan's hypothesis is that people exposed to music in a similar era tend to know similar songs, especially in their familiar lane or lanes, with familiarity generally declining for earlier and later recordings.

Use the three openers as evidence of musical exposure—not as a way to infer age or upbringing. Estimate affinity to their supported era or eras and lane or lanes; proximity should fade gradually on both sides rather than end at a hard year boundary. A broad continuous span must not automatically assign equal familiarity to every year between distant openers. Multiple opener-supported eras can form multiple soft peaks.

For the first challenger, apply this weighting only within the existing eligible lane/test pool. Multiple supported lanes can inform familiarity without authorizing cross-lane dimension comparisons or new lane-expansion behavior. Preserve catalog recognition as another imperfect signal, evaluate both songs, and retain baseline fallback for insufficient inputs. The exact decay curve, relative weights and any earlier/later asymmetry remain parameters to propose and pin during future offline work; no values are approved or implemented here. Experiment two's ±10-year neighborhoods remain a separate bounded comparator, not the ultimate familiarity rule.

#### What the new document gets right

- The three experiments address different problems: unfamiliar opponents, the empty middle between distant opener years, and recovery after a skip.
- Both songs matter. A recognizable winner does not make an unfamiliar opponent a good test.
- Shadow comparisons measure alternative offers, not how a listener would have answered those offers.
- Skips, abandoned offers, completed readings and missing accuracy feedback must remain separate.
- Keep the six-answer default, existing optional completion rules, Critic prompts, musical scores, evidence checks and presentation unchanged between arms. Explore and Refine are outside this study.
- A human reviews the evidence and approves any release, with a pinned rollback.

#### Clarifications needed before implementation

1. **The era window is broader than a weighted average suggests.** The current code uses earliest known opener minus ten through latest plus ten. Its 3:2:1 center does not narrow that span. Thus 1975 and 2015 allow 1965–2025 initially. PR 62 correctly documents this and experiment two addresses that specific gap; this is a refinement of the earlier simplified explanation, not an authorization to change the policy now.
2. **“Familiarity” is an estimate, not knowledge of recognition.** Three songs plus catalog lane/year information cannot establish which other recordings a listener knows. Start with a transparent, deterministic rule; mark missing inputs unknown. Do not spend on a new model-based familiarity scorer for the first test.
3. **Preserving a contrast needs an exact definition.** Pin the intended lane-local axis/test and contrast eligibility before comparing pairs. Changing to an easier, different test would confound the familiarity experiment. Multiple-test pairs need a deterministic primary-test rule.
4. **The existing accuracy pilot is reusable infrastructure, not a ready-made skip experiment.** Its assignment, evaluator and proposal contracts need a separately versioned design for skip/recovery metrics. Do not overwrite the original AB-52 accuracy study or relabel its owner QA.
5. **Existing history is not automatically replay-ready.** Pin the candidate catalog, opener inputs, decision state and effective settings. A reconstructed context using today's mutable catalog/profile is not an exact historical replay. Exclude or separately label incomplete histories; preserve saved choices and readings.
6. **Real-QA export consent is not blanket consent for this study.** AB-57 supports bounded real-QA feedback export, but its current minimized payload does not carry all proposed selector inputs/outcomes. Keep detailed data inside MusicDNA and begin with local/offline reports. Any new cross-app payload or purpose needs separate contract, consent and lifecycle review.
7. **Two smaller qualifications matter.** The current minimum-three era pool is checked before all diagnostic/artist/recognition filters, not after full eligibility. Also, the exposed skip endpoint lacks a reason field, although internal skip handling supports one; adding a listener question would still be separate work.

Source checks confirm that AB-52 currently maps control/treatment to shadow/live regime routing, not arbitrary challengers (`src/musicdna/learning/pilot-routing.ts:12–31`). Current exposures can fail to save without blocking an offer, and skips do not carry exact exposure IDs (`src/musicdna/adapters/critic-quality.ts:212–244`; `src/lib/musicdna.functions.ts:1905–1953`). These are measurement prerequisites, not reasons to change ordinary listener behavior in this review.

### Proposed sequence

#### 1. Establish the baseline and replay dataset

- Verify the actually serving source revision, routing mode and effective selector controls—not just the merged SHA or requested mode.
- Freeze a versioned catalog snapshot and baseline artifact, including the ordered candidate pool and recognition lookup. Capture the three ranked opener matches/unknowns, lane/confidence, vector, answered count, used/skipped pairs, steering, resolved defaults and effective settings at each decision boundary. Supplied knob overrides alone are not the fully resolved configuration.
- Use synthetic fixtures first, including unknown opener years, distant years, sparse lanes, repeated artists, skips and exhausted pools. Only use real saved contexts with an authorized purpose and sufficient frozen inputs.
- Keep bootstrap outside the ordinary-round comparison and identical between arms. Its existing unseeded draw must not create apparent challenger differences.

**Deliverable:** a reproducible baseline receipt and dataset inventory, with exact, reconstructed and unavailable contexts clearly distinguished.

#### 2. Implement one offline challenger: familiarity on both sides

- Estimate each song's familiarity from the openers using a versioned, explainable soft lane/era rule with gradual earlier/later falloff and support for multiple opener eras/lanes; do not compare preference-axis scores across lanes or change lane eligibility.
- Favor the pair with the stronger minimum familiarity estimate while preserving the intended diagnostic contrast and all eligibility rules.
- Pin the strength of that preference and the insufficient-input fallback before evaluation. Missing inputs use the baseline.
- Replay baseline and challenger on the same contexts, catalog and ordinary-round seed. Separately audit effective controls so a setting that is overridden cannot masquerade as a treatment.
- Report changed offers, eligible population, both-side estimates, coverage, artist/era concentration, test preservation, invalid selections and fallbacks. Inspect representative changed and unchanged offers.

**Gate:** deterministic replay, no invalid pairings or weakened evidence rules, and enough actual offer divergence to justify testing. Offline results cannot establish fewer skips or better readings.

#### 3. Let Agent Brain evaluate the evidence

- Extend the offline experiment/report format for selector metrics; retain the existing perceived-accuracy format unchanged.
- MusicDNA produces validated replay and aggregate outcome reports. Agent Brain compares versioned candidates and explains trade-offs. Echelon attaches the evidence to a reviewable proposal.
- Start with deterministic evaluation without model/network calls. Any later paid interpretation is separately authorized and subject to existing budgets, source/reviewer scope, consent and deletion controls.
- Recommendations must cite the report and pins, show unknowns, and allow “insufficient evidence.” No autonomous tuning, enrollment or release.

**Deliverable:** a baseline-versus-challenger report and human-review recommendation, not a claim of listener benefit.

#### 4. Owner QA, then a separately approved listener pilot

- First verify serving, exact assignment, resume/retry, fallback and rollback with owner QA; do not treat Alan or agent walkthroughs as independent randomized listeners.
- Before inviting independent adults, approve the consent text, eligibility, smallest worthwhile improvement, acceptable guardrail losses, sample target, feedback window and stopping rule.
- Persist a fixed assignment for the entire interview; never rebucket on resume. Preserve original assignment and actually served policy separately.
- Join authoritative served offers and exact client display acknowledgements to choices/skips. Add explicit outcome handling for abandoned/unavailable offers and deduplicate reload/retry exposures. Define an observation cutoff for unanswered offers; missing telemetry is unknown, never inferred abandonment or successful recovery. Validate durable measurement or exclude/report missing records rather than biasing the denominator.
- Validate the same path on web and Flutter. Older clients' missing display acknowledgement remains unknown, not proof an offer was seen.

**Primary metric:** skips per unique served ordinary offer, by answered-choice position, with participant-level uncertainty and served-versus-client-reported-shown coverage.

**Secondary outcomes and guardrails:** six-answer completion and optional early exits, abandonment, original frozen reading accuracy plus response coverage, diagnostic-axis coverage, repeated artists/era concentration, fallback/exhaustion and policy mismatches. Entertainment and desire to continue talking stay separate from accuracy; use them only when independently collected, never infer them from completion. Unmeasured errors, latency or cost remain unavailable.

Report all assigned interviews, including those never reaching an eligible round, plus eligible-round results. Repeated offers are not independent participants. No sample size or “winner” threshold is assumed from the old ten-per-arm reporting floor.

#### 5. Review, release or stop

- Produce raw counts, rates, arm differences, uncertainty and missing-data coverage. Distinguish positive, negative, null and insufficient evidence.
- Alan approves any release only after trustworthy joins, stable guardrails and real outcomes. Verify the actual serving version after release and both-client behavior.
- Roll back to the pinned baseline if provenance, eligibility or agreed guardrails fail. Preserve all historical readings, assignments and reports.

### Remaining experiments, in order

| Candidate | Scope | Primary outcome | Additional design gate |
|---|---|---|---|
| Actual-opener-era windows | Ordinary offers before the third answered choice; known openers at least 25 years apart | Early skips per served eligible offer | Freeze ±10-year neighborhoods around actual opener years and the stage at which minimum pool size is checked; preserve lane/test/bootstrap rules and baseline fallback |
| One-off skip recovery | First ordinary skip, followed by one recognizable same-axis offer in the strongest opener lane | Next offer answered, skipped, abandoned or unavailable | Define strongest-lane ties, multiple tests, known both-side recognition thresholds and retry-safe one-shot consumption; missing recognition is not high familiarity; never offer recovery after the normal stop policy completes the session |

Run each against its pinned control, one challenger at a time—not a combined three-change experiment. Keep skip-reason questions out of the first study; they are a separate UI test or must appear identically in both arms.

### Technical scope and handoff

- **MusicDNA / Lovable and Codex:** local challenger, frozen replay inputs, trusted exposure/outcome joins, versioned assignment design, web/REST parity and rollback verification. Reuse the selector, pilot and diagnostic infrastructure where contracts genuinely fit.
- **Agent Brain:** offline replay/pilot evaluator and bounded, evidence-linked recommendations. Its live implementation and cross-repository compatibility require a separate review before extension.
- **Echelon / operator learning services:** proposal primary-metric extension and any separately approved minimized transport. Existing accuracy feedback receipts, automated dispatch or queued reviews do not demonstrate selector efficacy.
- **Flutter / Codex:** exact exposure acknowledgement and acceptance checks. No new listener-facing feature or different interview pacing is needed for the first server-owned challenger.

Relevant references: `pairing-selector-baseline.md`, `ab52-pilot-plan.md`, `applied-outcomes.md`, `critic-quality-measurements.md`, `real-qa-learning.md`, `ab57-live-status.md`, and `ab57-automation.md`. Older integration-plan sections are historical design, not current release authority.

**Next future work, only when separately authorized:** build the frozen baseline/replay harness and first offline soft-familiarity challenger. The plan is approved, but code changes remain on hold; listener enrollment, production activation, migrations and cross-app export remain separate gates.
