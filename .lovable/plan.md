# Pairing-selector experiments with Agent Brain

## Status and review

Future-work proposal only. This review does not authorize implementation, paid model calls, enrollment, migrations, exports, flag changes or production rollout.

Reviewed merged PR **62** (`ccd3062`), which adds `docs/musicdna/pairing-selector-baseline.md`, against the existing MusicDNA experiment, reporting and learning documentation. Production settings and the current Agent Brain/Echelon deployments were not verified.

**Assessment: the direction is sound.** Start with a pinned baseline, change one selector behavior at a time, compare identical decision contexts offline, and require real listener outcomes before calling a challenger better. Agent Brain should evaluate and recommend—not choose songs through a remote call during the interview or automatically release a policy.

### What the new document gets right

- The three experiments address different problems: unfamiliar opponents, the empty middle between distant opener years, and recovery after a skip.
- Both songs matter. A recognizable winner does not make an unfamiliar opponent a good test.
- Shadow comparisons measure alternative offers, not how a listener would have answered those offers.
- Skips, abandoned offers, completed readings and missing accuracy feedback must remain separate.
- Keep the six-answer default, existing optional completion rules, Critic prompts, musical scores, evidence checks and presentation unchanged between arms. Explore and Refine are outside this study.
- A human reviews the evidence and approves any release, with a pinned rollback.

### Clarifications needed before implementation

1. **The era window is broader than a weighted average suggests.** The current code uses earliest known opener minus ten through latest plus ten. Its 3:2:1 center does not narrow that span. Thus 1975 and 2015 allow 1965–2025 initially. PR 62 correctly documents this and experiment two addresses that specific gap; this is a refinement of the earlier simplified explanation, not an authorization to change the policy now.
2. **“Familiarity” is an estimate, not knowledge of recognition.** Three songs plus catalog lane/year information cannot establish which other recordings a listener knows. Start with a transparent, deterministic rule; mark missing inputs unknown. Do not spend on a new model-based familiarity scorer for the first test.
3. **Preserving a contrast needs an exact definition.** Pin the intended lane-local axis/test and contrast eligibility before comparing pairs. Changing to an easier, different test would confound the familiarity experiment. Multiple-test pairs need a deterministic primary-test rule.
4. **The existing accuracy pilot is reusable infrastructure, not a ready-made skip experiment.** Its assignment, evaluator and proposal contracts need a separately versioned design for skip/recovery metrics. Do not overwrite the original AB-52 accuracy study or relabel its owner QA.
5. **Existing history is not automatically replay-ready.** Pin the candidate catalog, opener inputs, decision state and effective settings. A reconstructed context using today's mutable catalog/profile is not an exact historical replay. Exclude or separately label incomplete histories; preserve saved choices and readings.
6. **Real-QA export consent is not blanket consent for this study.** AB-57 supports bounded real-QA feedback export, but its current minimized payload does not carry all proposed selector inputs/outcomes. Keep detailed data inside MusicDNA and begin with local/offline reports. Any new cross-app payload or purpose needs separate contract, consent and lifecycle review.

## Proposed sequence

### 1. Establish the baseline and replay dataset

- Verify the actually serving source revision, routing mode and effective selector controls—not just the merged SHA or requested mode.
- Freeze a versioned catalog snapshot and baseline artifact. Capture the three ranked opener matches/unknowns, lane/confidence, vector, answered count, used/skipped pairs, steering and effective settings at each decision boundary.
- Use synthetic fixtures first, including unknown opener years, distant years, sparse lanes, repeated artists, skips and exhausted pools. Only use real saved contexts with an authorized purpose and sufficient frozen inputs.
- Keep bootstrap outside the ordinary-round comparison and identical between arms. Its existing unseeded draw must not create apparent challenger differences.

**Deliverable:** a reproducible baseline receipt and dataset inventory, with exact, reconstructed and unavailable contexts clearly distinguished.

### 2. Implement one offline challenger: familiarity on both sides

- Estimate each song's familiarity from the openers using a versioned, explainable lane/era rule; do not compare preference-axis scores across lanes.
- Favor the pair with the stronger minimum familiarity estimate while preserving the intended diagnostic contrast and all eligibility rules.
- Pin the strength of that preference and the insufficient-input fallback before evaluation. Missing inputs use the baseline.
- Replay baseline and challenger on the same contexts, catalog and ordinary-round seed. Separately audit effective controls so a setting that is overridden cannot masquerade as a treatment.
- Report changed offers, eligible population, both-side estimates, coverage, artist/era concentration, test preservation, invalid selections and fallbacks. Inspect representative changed and unchanged offers.

**Gate:** deterministic replay, no invalid pairings or weakened evidence rules, and enough actual offer divergence to justify testing. Offline results cannot establish fewer skips or better readings.

### 3. Let Agent Brain evaluate the evidence

- Extend the offline experiment/report format for selector metrics; retain the existing perceived-accuracy format unchanged.
- MusicDNA produces validated replay and aggregate outcome reports. Agent Brain compares versioned candidates and explains trade-offs. Echelon attaches the evidence to a reviewable proposal.
- Start with deterministic evaluation without model/network calls. Any later paid interpretation is separately authorized and subject to existing budgets, source/reviewer scope, consent and deletion controls.
- Recommendations must cite the report and pins, show unknowns, and allow “insufficient evidence.” No autonomous tuning, enrollment or release.

**Deliverable:** a baseline-versus-challenger report and human-review recommendation, not a claim of listener benefit.

### 4. Owner QA, then a separately approved listener pilot

- First verify serving, exact assignment, resume/retry, fallback and rollback with owner QA; do not treat Alan or agent walkthroughs as independent randomized listeners.
- Before inviting independent adults, approve the consent text, eligibility, smallest worthwhile improvement, acceptable guardrail losses, sample target, feedback window and stopping rule.
- Persist a fixed assignment for the entire interview; never rebucket on resume. Preserve original assignment and actually served policy separately.
- Join authoritative served offers and exact client display acknowledgements to choices/skips. Add explicit outcome handling for abandoned/unavailable offers and deduplicate reload/retry exposures.
- Validate the same path on web and Flutter. Older clients' missing display acknowledgement remains unknown, not proof an offer was seen.

**Primary metric:** skips per unique served ordinary offer, by answered-choice position, with participant-level uncertainty and served-versus-client-reported-shown coverage.

**Secondary outcomes and guardrails:** six-answer completion and optional early exits, abandonment, original frozen reading accuracy plus response coverage, diagnostic-axis coverage, repeated artists/era concentration, fallback/exhaustion and policy mismatches. Entertainment and desire to continue talking stay separate from accuracy; use them only when independently collected, never infer them from completion. Unmeasured errors, latency or cost remain unavailable.

Report all assigned interviews, including those never reaching an eligible round, plus eligible-round results. Repeated offers are not independent participants. No sample size or “winner” threshold is assumed from the old ten-per-arm reporting floor.

### 5. Review, release or stop

- Produce raw counts, rates, arm differences, uncertainty and missing-data coverage. Distinguish positive, negative, null and insufficient evidence.
- Alan approves any release only after trustworthy joins, stable guardrails and real outcomes. Verify the actual serving version after release and both-client behavior.
- Roll back to the pinned baseline if provenance, eligibility or agreed guardrails fail. Preserve all historical readings, assignments and reports.

## Remaining experiments, in order

| Candidate | Scope | Primary outcome | Additional design gate |
|---|---|---|---|
| Actual-opener-era windows | Ordinary offers before the third answered choice; known openers at least 25 years apart | Early skips per served eligible offer | Freeze ±10-year neighborhoods around actual opener years and a minimum eligible pool; preserve lane/test/bootstrap rules and baseline fallback |
| One-off skip recovery | First ordinary skip, followed by one recognizable same-axis offer in the strongest opener lane | Next offer answered, skipped, abandoned or unavailable | Define strongest-lane ties and multiple tests; decide whether the original ordinary skip belonged to the study policy; return to baseline after the recovery offer |

Run each against its pinned control, one challenger at a time—not a combined three-change experiment. Keep skip-reason questions out of the first study; they are a separate UI test or must appear identically in both arms.

## Technical scope and handoff

- **MusicDNA / Lovable and Codex:** local challenger, frozen replay inputs, trusted exposure/outcome joins, versioned assignment design, web/REST parity and rollback verification. Reuse the selector, pilot and diagnostic infrastructure where contracts genuinely fit.
- **Agent Brain:** offline replay/pilot evaluator and bounded, evidence-linked recommendations. Its live implementation and cross-repository compatibility require a separate review before extension.
- **Echelon / operator learning services:** proposal primary-metric extension and any separately approved minimized transport. Existing accuracy feedback receipts, automated dispatch or queued reviews do not demonstrate selector efficacy.
- **Flutter / Codex:** exact exposure acknowledgement and acceptance checks. No new listener-facing feature or different interview pacing is needed for the first server-owned challenger.

Relevant references: `pairing-selector-baseline.md`, `ab52-pilot-plan.md`, `applied-outcomes.md`, `critic-quality-measurements.md`, `real-qa-learning.md`, `ab57-live-status.md`, and `ab57-automation.md`. Older integration-plan sections are historical design, not current release authority.

**Next future approval:** authorize only the frozen baseline/replay harness and first offline familiarity challenger. Listener enrollment, production activation, migrations and cross-app export remain separate gates.