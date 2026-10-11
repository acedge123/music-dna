# MusicDNA Codex Parity Guide

Implementation companion version 1.2 | October 10 2026

Prepared for Codex and the MusicDNA engineering team

Repository copy: `docs/musicdna/codex-parity-guide.md`. Product authority: [Product Requirements](product-requirements.md). Keep both documents synchronized across music-dna, idea-builder, and The-Gig-Agency/agent-brain when revising shared requirements.

Implement the MusicDNA Product Requirements across the product repositories: acedge123/music-dna for Lovable web and shared-backend work, and acedge123/idea-builder for the active Flutter app under apps/mobile. The related The-Gig-Agency/agent-brain repository owns the MusicDNA routing reference and shared routing fixtures. Mobile Codex continues its parity tickets while Lovable completes the web work. Preserve the TypeScript engine and iOS foundation, and verify that the same controlled session tells the same story on both clients.

This guide is self-contained for execution planning. The companion PRD is the product authority for requirements such as DIA03 or SHR01. Requirements are targets; the original inventory used music-dna at d20d0d4687b1ecd9bd0863d33a106aa9b9862c67, including its mobile copy. Version 1.1 corrects the active mobile repository to idea-builder. Reconcile mobile findings against current Codex work before assigning or closing tickets. Proposed names and shapes in this guide are not existing endpoints or shipped schemas.

## 1 Execution instructions

Version 1.2 includes ACE's October 10 requirement to serve listeners whose favorite songs come from 2000–2026. The former blanket catalog-expansion exclusion is superseded; Section 4.7 records the parallel workstream. Preserve subsequent policy, fixture, and implementation handoffs already recorded in this repository.

October 10 decision/fixture handoff: [Parity Decisions V1](parity-decisions-v1.md)
records adopted D06, D05 measurement gates and compatibility/rollback limits.
[Product Parity Fixtures V1](product-parity-fixtures-v1.md) defines the F01-F26
catalog and complete requirement/gap trace. D06 policy is decided; its cleanup,
account linking and deletion implementation are not accepted by this record.

Read repository instructions and inspect the actual branch before editing. Record the current web SHA, mobile SHA, API deployment, active configuration, and any divergence from the baseline. Never assume the deployed site or TestFlight build matches main. Do not use local paths from older documentation as if they were valid on the current machine.

Keep the existing anonymous entry, three-song opening, lane constraints, ten canonical axes, ten archetypes, 0.35 prior seed multiplier, and deterministic choice math. Implement new experience behavior behind a compatible contract or feature flag. Treat scoring-policy corrections separately from a broad engine redesign.

ACE's September sequence is web first, review and approval, then Flutter parity. Work on shared services, tests, contracts, and safe mobile plumbing can proceed while the web is being prepared. Record the approved web commit and phone viewport before declaring the Flutter visual implementation complete. Creating these documents does not establish that the current web build has already been approved.

Include the 2000–2026 song and pairing expansion under CAT06–CAT08. Audit underserved musical territory and coordinate any necessary compatible lane extension with the backend owner. Do not add streaming, new personality axes/archetypes, compatibility scoring, or monetization. Do not move inference into Dart. Preserve current deployment and signing identity. Apply normal repository authorization for merges and distribution; producing a release candidate is distinct from publishing or uploading it.

### 1 1 Repository ownership and parallel work

| Workstream | Repository and responsibility | Work allowed now |
| --- | --- | --- |
| Lovable web/backend | acedge123/music-dna; evidence, persistence, REST, web and public result | Complete shared services and corrected web reference |
| Mobile Codex | acedge123/idea-builder/apps/mobile; native client and its tests | Reconcile existing tickets, define dependencies, build agreed DTO mappings and isolated client tests |
| Agent Brain reference | The-Gig-Agency/agent-brain; MusicDNA terrain mapper, regime scorer, knobs and routing fixtures | Keep reference/runtime contracts aligned when affected; no separate product evidence engine or mobile API |
| Shared handoff | One versioned contract and controlled fixture set | Agree schemas while evidence and reliability work proceeds; verify real responses before integration acceptance |

The observed idea-builder branch was codex/tga-281-mobile-web-parity at 9d533b37b7cf66c2aa95e9fd9b1fcb7ec8261368. Its pubspec identifies music_dna version 0.1.1+3. At inspection it was three commits ahead and three behind idea-builder main at ea42a94e07a1d9f1531ac4cc1d890c0b100eab2c. This identifies a published branch, not necessarily Codex's latest local work or a released build. Confirm the existing working branch and uncommitted changes before any branch reconciliation.

The targeted branch check still found lastFeedback-only state, a separate revealSession action, and a client completion fallback using round > maxPairingRounds. It does not establish the status of every mobile gap or of tickets being prepared elsewhere. The mobile baseline below remains a checklist to revalidate, not a claim that current work has done nothing.

Treat Phases B and C as shared-backend dependencies owned by the web/backend workstream. Mobile Codex should not independently implement a second evidence engine, REST server, or database migration in idea-builder because that repository also contains web/backend files. A backend change requested by mobile gets one assigned owner and implementation source. Confirm the deployed API origin; repository names alone do not prove which server the app calls.

Each parity ticket should identify PRD IDs, repository/branch, owner, current status, required contract capability, web/API dependency, fixture and acceptance evidence. Reuse existing tickets before creating duplicates. Useful states are ready for client work, blocked on API, blocked on approved web reference, ready for integration, and verified.

Lovable's handoff to mobile must include the implemented contract revision, web/backend commit, staging API origin, authenticated sample responses or fixtures with no secrets, migration/deployment readiness, compatibility behavior, and known limitations. ACE web approval adds the approved commit and phone-width reference captures. Draft mocks support client work but do not demonstrate API readiness. Contract definition therefore begins during evidence repair, rather than after sharing is finished.

### 1 2 Agent Brain handoff and source precedence

The reference integration is at The-Gig-Agency/agent-brain@4cf8a1261fde31cab1b45696d0f2e6b1a739bb91 under src/cognitive-router/integrations/musicdna. It exports sessionToTerrain, scoreMusicDNATerrain, recommendMusicDNARegime, legacyKnobsForMode, and regimeToPairingKnobs. The music-dna runtime uses its own src/musicdna/router modules called by nextPairingImpl; the inspected path does not require Flutter to call Agent Brain's generic HTTP service.

At music-dna@b83f9a35233a71078204434eacdcffed29dcb50f, MUSICDNA_ROUTING_MODE reads legacy/shadow/live and defaults to shadow. In shadow, regime knobs produce a comparison pick while the user receives the legacy selection. Source supports an explicit live mode; its deployed value was not checked. Preserve the existing deployment setting during parity and do not promote live routing as part of a client port.

The two repositories currently contain matching JSON data for fixtures/musicdna/parity-golden-v1.json, version musicdna-agent-brain-parity-v1, with early_uncertain_explore, settled_compound, and skip_pressure_explore cases. File comparison is not execution proof. If router changes become necessary, pin both source revisions, run each repository's existing relevant tests, compare structured terrain/regime/selection-mode/knob outputs, and record intentional differences before changing the reference or its copy.

The older analysis and integration plans mix historical facts, proposed design, and later progress. A design-not-started banner does not override implemented modules. Their five-song/12–15-round flow and two-support/0.55 gate do not override this PRD's three-song core opening, six-answer cap, and accepted D01. Their routing D1–D4 are a separate decision register from product D01–D04. Preserve the separate five-song decade mode and quarantined cross-lane probes.

Router confidence describes a routing score, not confidence in a claim about the user. Regime can steer selection only; evidence eligibility, completion, critic wording, and result versions remain in the product service. Preserve lane and recognition safeguards, deterministic comparison seeds, and fallback selection. Route missing-data handling through explicit unknown/fallback states rather than treating absent deltas as stable evidence. A fixed-sequence share challenge bypasses adaptive pairing selection while using the same evidence policy.

When shared routing code is touched, the handoff adds the Agent Brain reference SHA, runtime SHA, fixture version, routing mode, comparison output, and the assigned synchronization owner. Otherwise, completing the evidence contract and mobile parity does not require replacing the existing router, introducing a remote router dependency, or changing global Agent Brain weights.


## 2 Baseline findings and priorities

Most findings below originate in the September baseline. Rows updated for Lovable's October 10 repair identify that explicitly. D01–D04 are accepted decisions in the checked-in Lovable plan; do not reopen them as prerequisites to continuing implementation.

| ID | Priority | Verified source finding | Required outcome |
| --- | --- | --- | --- |
| GAP01 | P0 | Flutter retains only lastFeedback for pairings | Persist and render ordered exchanges |
| GAP02 | P0 | Web calls currentRead and finalSynthesis beyond mobile REST flow | Shared experience service and DTOs |
| GAP03 | P0 | Flutter requires Generate my reading | Automatic finalization and reveal |
| GAP04 | P0 | Original balanced-claim defect repaired in final synthesis by October 10 D01 helper | Apply the policy through one ledger on every surface |
| GAP05 | P0 | October 10 final synthesis filters supporting examples by direction | Preserve repair; add immutable support and counterevidence references |
| GAP06 | P0 | October 10 no-pattern copy no longer infers broad taste | Complete distinct sparse, mixed, zero-answer, catalog, and generation-failure outcomes |
| GAP07 | P0 | Harder knob mode is overridden by explicit selector mode | Verify and apply effective steering |
| GAP08 | P0 | Web share action uses session ID; UUID lookup requires public status | Canonical authorized share URL |
| GAP09 | P0 | Finalize response omits token expected by Flutter | Complete share creation and response |
| GAP10 | P0 | Public result still needs shared snapshot; sixty-matchup copy fixed October 10 | Stable public result and verified six-matchup copy |
| GAP11 | P0 | No Flutter living-read chat route | Native continuation over shared service |
| GAP12 | P0 | Same-choice challenge is not implemented | Separate fixed-sequence recipient session |
| GAP13 | P0 | Later October 10 running/final paths use buildLedger; absent tests still fall back to all dimensions | Validate declared axes, immutable evidence, and public-card integration |
| GAP14 | P0 | October 10 D02 adds three consecutive skips at any answer count | Verify persisted-event integration; implement a real catalog-exhausted reason |
| GAP15 | P0 | Chat extracts deltas and updates session vector | Separate provenance and result versions |
| GAP16 | P1 | Later October 10 source changes checkpoints to answered rounds 2/4/6 | Verify deployed views and six-answer event semantics |

The original two-to-two defect was reproduced by executing the pattern-building segment with four contrasts of plus 40, minus 40, plus 40, and minus 40 at full diagnostic weight. It returned two supports out of four, confidence 0.65, and a positive-direction claim that passed the former two-support and 0.55 threshold. Its examples included a negative-direction choice. The October 10 repair changes that path; retain this exact regression fixture for the full pipeline.

October 10 source was checked at b83f9a35233a71078204434eacdcffed29dcb50f. Reuse src/musicdna/engine/claims.ts with CLAIM_POLICY_VERSION d01-v1, its tests, and the completion tests. Final synthesis now requires at least 3 supports, consistency at least 0.65, and support exceeding contradiction; 3–1 is qualified and 2–2 is ineligible. It filters examples by direction and uses honest thin-evidence prompt/fallback copy. nextPairingImpl supplies recent choice/skip events to the new consecutive-skip rule. The catalog_exhausted type alone does not establish an emitted completion path.

Lovable reports all tests pass for the first slice, including the new claim and skip tests; this follow-up confirmed source and test presence but did not independently rerun them. Lovable's end-to-end session/copy review is still open. Do not close parent requirements because a helper or copy fragment is repaired.

The web source advanced again before publication, to 60381b0436f33a8802a2d19046ef0c0561c4e515. This later diff adds engine/evidence.ts with buildLedger, detectRevision, ledger-v1, and MIN_CONTRAST = 10. Running read and final reasoning now use the builder; final reasoning records ledger/policy metadata. New evidence tests cover 3–1, 2–2, missing values, duplicate pairing IDs, and revision detection. The roadmap reports chat consumes ledger claims and explicitly leaves public-card integration open.

The update also adds read_shown revision tracking, selected-pairing prompts in engine/prompts.ts, onboarding consumption of that prompt, and answered-round 2/4/6 stability checkpoints. New root AGENTS.md requires claims to use buildLedger/evaluateClaim, completion to use sessionCompletion, prompts to derive from the selected pairing, and revisions to use the prior read_shown event. Follow those instructions and extend the existing helpers.

These are source-confirmed advances, not full acceptance of DIA01, READ02, READ04, or MET02. Still verify immutable vote-time values and choice references, chronological finalization, valid declared axes, prompt neutrality before a vote, durable event order and resume, and deployed analytics/view compatibility. The builder currently falls back to all dimensions when tests are absent; reconcile that with the declared-test requirement. Tests in this later diff were inspected but not executed during this documentation task.

Remaining delivery includes public-card ledger integration, durable versioned results, distinct insufficiency outcomes, D04 self-report separation, atomic/idempotent mutations, full resume, catalog-exhaustion handling, explicit publish/revoke and legacy-link treatment, fixed challenges, the versioned experience contract/react endpoint/fixtures, and Flutter integration. Revalidate these statuses against subsequent work rather than rebuilding implemented helpers. A version string on a computed builder is not an immutable persisted session/result snapshot.

Current nextPairingImpl strips why_good and hypothesis from both normal and bootstrap responses. Flutter still has obsolete rendering support for whyGood; remove that dependency, but do not report the pre-choice spoiler as still being sent by this backend. The shared sessionCompletion hard cap also already exists; preserve it while improving its evidence and skip handling.

The review executed local completion and steering checks and the isolated evidence calculation. It did not run a deployed integration session, Flutter analyzer, an emulator, or TestFlight. Implementation acceptance must supply those missing runtime proofs.

## 3 Code ownership map

Paths starting apps/mobile belong to the active idea-builder repository. Web, engine, REST, and service paths refer to music-dna. Their historical line references come from the original music-dna review and must be revalidated on the implementation branches.

The explicitly labeled Agent Brain row below belongs to The-Gig-Agency/agent-brain; the similarly named MusicDNA runtime is a separate implementation to keep compatible.

| Concern | Current location | Implementation direction |
| --- | --- | --- |
| Web interview | src/routes/onboarding.tsx | Thin rendering of common experience |
| Web continuation | src/routes/me.tsx | Shared chat and session context |
| Web saved profile | src/routes/_authenticated/profile.tsx | Same persisted result version |
| Public result | src/routes/s.$sessionId.tsx | Explicit public snapshot |
| Web application logic | src/lib/musicdna.functions.ts | Extract reusable services incrementally |
| Selection and stop | src/musicdna/engine/pairing.ts | Preserve math; fix state and steering |
| MusicDNA router runtime | music-dna: src/musicdna/router and nextPairingImpl | Preserve routing mode, fallback, selector boundary, and golden outputs |
| Agent Brain reference | agent-brain: src/cognitive-router/integrations/musicdna and fixtures/musicdna/parity-golden-v1.json | Coordinate mapper/scorer/knob changes with runtime; keep product evidence policy outside router |
| Choice math | src/musicdna/engine/choice.ts | Keep applyChoice deterministic |
| Archetype fit | src/musicdna/engine/archetypes.ts and scoring.ts | One fit-tier implementation |
| Voice | src/musicdna/engine/critic.ts and voice.ts | Evidence-aware language ceiling |
| Mobile API types | src/lib/musicdna-mobile-api.ts | Executable request and response schemas |
| REST routes | src/routes/api/v1 | Compatible transport over services |
| Public service | src/lib/share.functions.ts | Shared lifecycle and safe projection |
| Flutter onboarding | apps/mobile/lib/src/features/onboarding | Preserve flow and repair recovery |
| Flutter session | apps/mobile/lib/src/features/session | Exchange history and unified state |
| Flutter navigation | apps/mobile/lib/src/app/router/app_router.dart | Result, continuation, history entry |
| Flutter networking | apps/mobile/lib/src/core/network | Capability header and typed errors |
| Flutter visuals | apps/mobile/lib/src/core/theme/app_theme.dart | Match approved phone reference |
| Catalog administration | src/lib/admin.functions.ts and admin route | Preserve authorization and diagnostics |
| Decade exploration | src/routes/_authenticated/1980.tsx | Preserve web; exclude from core Flutter port |
| Result feedback | submitFeedback and getMyFeedback in musicdna.functions.ts | Expose shared result-version feedback |

src/musicdna/engine/evidence.ts now exists and is the required evidence builder. Proposed additions remain src/musicdna/services/experience.ts for orchestration and src/musicdna/contracts/experience-v1.ts for schemas. Use the repository's established organization if it offers a cleaner equivalent. Avoid a large mechanical rewrite of the existing orchestration file.

## 4 Implementation sequence and review units

### 4 1 Phase A Baseline and reproducible fixtures

Continue the existing assigned branch or use an isolated worktree that preserves ongoing work. Reconcile the current parity tickets before creating more. Inspect actual deployed contract shapes using authorized staging access. Capture opening, selected-card, feedback, theory, revision, result, pushback, and share states at a small phone viewport. Read the PRD decision register and record accepted defaults or unresolved policy flags.

Add deterministic fixtures for current defects before changing behavior. Freeze song metadata and axis values in those fixtures. Establish actual package-manager and Flutter commands from the repository. Protect existing engine golden tests and replace absolute developer-machine paths in touched documentation with repository-relative paths.

Deliver a short baseline matrix with source SHAs, build numbers, observed routes, test results, and unresolved deployment differences. Do not change production catalog rows merely to make test sessions convenient.

### 4 2 Phase B Evidence and persisted result services

Complete DIA01 through DIA07 and RES03 through RES04 first. Extend the now-existing buildLedger and evaluateClaim helpers rather than introducing another ledger. Preserve running/final integration, same-direction examples, and thin-evidence repairs. Add durable ordered vote-time evidence, strict declared-test handling, public-card consumption, and distinct insufficiency outcomes. Keep priors separate from answered-pairing evidence and preserve the regression fixtures.

Persist one result object with a stable version. Include structured headline, supporting choice references, qualification, optional narrative, and archetype details. A retry returns the same completed result. Generation failure may attach a safe deterministic fallback without changing the evidence state.

Make the fit-tier code and narrative hedge use the same engine mapping. Current scoring.ts buckets at 0.50, 0.70, and 0.85; finalizeSessionImpl separately checks 0.50, 0.80, and 0.95. Resolve the presentation inconsistency without calling either set a calibrated probability.

Deliver pure evidence tests, application-service tests with persistence boundaries, before-and-after fixture outputs, and a migration plan where needed. Keep result versions auditable; do not rewrite historical readings implicitly.

### 4 3 Phase C Common experience contract and recovery

Extract currentRead into a reusable implementation callable through web and REST. Expose final synthesis, exchange history, reaction effects, and completion reasons. Implement mutation idempotency and a stable outstanding pairing. Keep old clients working while new clients opt in.

Return an authoritative session revision with every mutation. Make resume read the server snapshot, not reconstruct the session from a locally stored start object. Ensure the final accepted vote is durable even if narrative generation or the response fails.

Deliver executable schemas, route contract tests, a documented capability negotiation path, and a fixture response set consumed by both clients. Never use generated example JSON as proof that an actual route matches it.

### 4 4 Phase D Corrected web reference

Switch the web interview to shared experience data. Remove extra result paths that produce different headlines for the same session version. Bind hooks to actual selection purpose, fix reaction effects, display answer-based progress, and replace unsupported weak-result copy.

Repair publication, share URL creation, the public result, and fixed-choice challenges. Preserve the October 10 six-matchup share-copy fix and verify the rendered page. Make follow-up chat use the actual evidence ledger and preserve the original read. Record any intentional typography or interaction changes from the current site.

Preserve the corrected six-matchup landing metadata; check remaining positioning against ENT02 and verify the newly changed 2/4/6 analytics against deployed views and consumers under MET02. Preserve the separate five-song 1980s exploration; do not route those song submissions into the pairing ledger. Expose existing accuracy and sentence-level feedback to the new result surfaces under RES06.

Deliver a review URL, web SHA, paired fixtures, screenshots, and a phone-size recording. ACE reviews the first-session flow and result quality. Record the approved revision as the Flutter reference.

### 4 5 Phase E Flutter parity

Extend Dart entities and repository mappings to the approved contract. Add persistent exchange history, current theory, reaction state, server progress, automatic completion, result, continuation, and sharing. Preserve the existing auth and API foundations.

Match selected-state treatment, stacked small-screen cards, typography, text staging, and active-exchange visibility. Use native share and keyboard behavior where appropriate. Restore from a server snapshot after backgrounding or termination. Keep internal axis names, raw deltas, and percentage confidence out of the primary result.

Deliver equivalent phone screenshots and recordings from identical fixtures. Record web and Flutter SHAs, mobile version/build number, device sizes, and intentional platform differences. A successful compilation does not establish parity.

### 4 6 Phase F Release candidate and observation

Run the acceptance suite in Section 10, verify production configuration without exposing secrets, and build using the existing iOS release process. Ensure the old released client remains compatible with the deployed API. Produce a rollback plan that does not erase user evidence.

Observe a small first-user pilot and inspect unsupported-claim, skip, recovery, and share outcomes. Return a release report with each material gap marked passed, intentionally different, or unresolved. Follow existing authorization for distribution.

### 4 7 Parallel workstream: 2000–2026 catalog coverage

ACE's October 10 scope change includes CAT06–CAT08. Start this work alongside current parity tickets. Lovable/product curation owns active catalog additions in music-dna; mobile Codex verifies the same catalog behavior through the shared API; Agent Brain changes only if a reviewed routing interface or fixture needs synchronization.

1. Export a versioned inventory of active songs, pairings, lanes, declared axes, recognition inputs, missing metadata, and artist concentration. Split coverage into 2000–2009, 2010–2019, and 2020–2026; retain the older catalog. Source inventory access through the existing authorized workflow. Do not infer production counts from seed CSVs.
2. Build representative opener scenarios across contemporary pop, hip-hop, R&B, electronic, alternative/indie, and other supported territory. Record missing genre/language/routing coverage explicitly, including country, Latin, and K-pop where relevant. A documented lane is not proof of an eligible pool; do not force songs into a wrong lane just to satisfy a fixture.
3. Draft verified song candidates and then curated pairings. Record title/artist identity, original release year and relevant version, metadata source/access date, sub-lane, editorial rationale, ten-axis values, declared tests, and review status. Confirm 2026 releases have occurred. Keep factual metadata separate from subjective scores. Reuse existing curation tooling and schemas; do not assume draft JSON is directly importable.
4. Calibrate new song scores against reviewed anchors from the existing catalog. Pair different artists with credible familiarity and meaningful contrasts; include comparable-era tests and carefully justified cross-era comparisons. Ensure the actual eligible pool permits repeat tests, counterexamples, and skip/retest alternatives within the six-answer experience. Never lower D01 to make a new catalog seem successful.
5. Add deterministic product fixtures for each supported era/lane scenario, mixed eras, unfamiliar modern tracks, and same-artist concentration. Exercise the real selector under its current exclusions and routing mode. Confirm completed histories retain their frozen evidence after catalog edits and fixed challenges preserve their recorded pairing set. Record these as new catalog coverage fixtures alongside F01–F26; do not repurpose Agent Brain's routing-only golden fixtures as product acceptance.
6. Stage and review additions through existing catalog administration, then measure opener routing, skips, usable pool exhaustion, evidence diversity, and result specificity with listeners who know the intended territory. Record the catalog revision with web/mobile acceptance. A reviewed import and tested journey establish coverage; merely adding tracks does not.

Treat opener era as a soft signal without inferring age. Any new familiarity/era preference UI or request field must join the shared experience contract before mobile uses it; do not invent a client-only filter. Preserve the existing six-answer/skip rules, evidence ledger, and private result lifecycle.

Existing catalog-expansion-spec.md and canon_workflow.md contain useful curation material but historical counts, a roughly 12-matchup flow, and old prototype axes. The PRD v1.2 requirements govern this work: three openers, at most six answered pairings, ten active axes, and verified contemporary coverage. Song counts follow the audited gaps; streaming, playback licensing, and music-library import are separate features.

## 5 Evidence policy implementation

### 5 1 Build an immutable observation ledger

Each vote needs a stable choice ID and pairing revision. Store or capture the song values used at vote time so later catalog edits do not rewrite history. At minimum, retain chosen and rejected song IDs and labels, declared axes, raw contrast, weight, ordering, timing, and input provenance. Skips and reactions are separate event types.

Only a valid declared axis can contribute to an axis claim. The pre-publication ledger now implements an absolute raw contrast threshold of 10. Reuse and validate that versioned implementation against fixtures and catalog coverage rather than restoring older inconsistent thresholds. Reconcile the builder's all-dimensions fallback when tests are missing with the declared-test requirement. Do not treat count inputs alone as proof of valid, distinct observations.

Missing values do not become zero or 50 in the evidence ledger. Existing applyChoice compatibility can remain behind the legacy path while invalid catalog records are quarantined for the new experience. Do not silently recalculate all historical vectors.

For each candidate direction, derive distinct supporting pairing IDs, opposing pairing IDs, neutral/invalid observations, artist and song concentration, and choice examples. An example is support only when its sign agrees with that claim. No supporting ID may also occur in counterevidence.

### 5 2 Adopted claim policy and remaining ledger work

| State | Required condition | Language allowance |
| --- | --- | --- |
| Observation | One valid choice | Describe that choice only |
| Tentative | Two supporting choices, or otherwise incomplete evidence | Offer a question or qualified possibility |
| Supported | At least 3 distinct supporting pairings, support exceeds contradiction, directional consistency at least 0.65 | State a listening tendency with evidence |
| Contested | Meaningful opposing evidence remains | Qualify the claim and name the exception |
| Mixed | Neither direction meets the support policy, including a 2 to 2 split | Describe conflicting choices without selecting a winner |
| Insufficient | Too few usable observations or no usable catalog evidence | State what is missing and offer an appropriate next step |

For the adopted policy, directional consistency is support divided by support plus contradiction among meaningful relevant tests. Neutral and invalid observations are reported separately; they do not improve support. Contrast magnitude establishes whether the comparison is informative and may affect selection, but cannot inflate directional consistency. This ratio is an internal rule, not a probability of psychological correctness.

Supported and contested are not mutually exclusive: a 3-to-1 pattern may be supported with an explicit qualification. Use an evidence state plus a contradiction flag or equivalent representation. A confident, unqualified phrase must never suppress that qualification. Artist concentration remains a confound even when a numeric threshold passes.

D01 is an accepted editorial policy; the thresholds have not been scientifically validated. Keep it versioned and inspect sample outcomes with ACE. Do not tune until every fixture produces a strong read; some must remain inconclusive.

### 5 3 Track actual revisions

Extend the existing detectRevision/read_shown implementation to preserve the previous claim ID, axis/direction, support set, and counterevidence set for each exchange. Compare the updated ledger to that state. A changed axis alone is a new hypothesis, not proof that the critic changed its mind. A reversal should identify what previously supported the read and which new choice undermined it.

Early templates also need evidence-aware selection. Current POLES observations include language such as keeps winning and not an accident, and hedgeForRound escalates to I'm convinced by round six. Filter such copy by evidence state rather than round alone. Avoid interpreting a long timer as an emotional struggle; pause active-decision timing during app backgrounding and exclude network wait.

### 5 4 Keep the final result and chat honest

Preserve the October 10 no-pattern repair in SYNTH_VOICE and its fallback. Extend it to distinct zero-answer, sparse, mixed, missing-catalog, and narrator-failure outcomes. Preserve rejected-song context and chronological order; the reviewed finalization query does not explicitly order choices even though synthesis describes its list as ordered.

A model-generated headline must reference allowed claim IDs and actual choice IDs. Validate those references before persisting. Qualitative review checks that the wording does not smuggle in a new personality claim. Do not run separate model calls on web and Flutter for the same result version.

Current chat updates the vector using model-extracted deltas capped per turn. Under accepted D04, store self-report as separate conversational evidence and version subsequent interpretations. Keep the completed pairing vector and public result stable. Supply the actual session choices and counterarguments to the chat service; a list of opener songs and top axes alone is insufficient context for informed pushback.

## 6 Proposed experience contract

### 6 1 Compatibility strategy

Use the existing /api/v1 routes with an opt-in x-musicdna-experience: 1 header, or an equivalently explicit version agreed during implementation. This header is proposed in the September plan but is not implemented in the reviewed tree. Old clients retain their response semantics; new clients require the enriched contract and must show an update/retry state if it is unavailable.

Authentication remains bearer-based over HTTPS. Private responses use no-store cache controls. If a shared cache is ever used, it must vary by authentication and contract capability appropriately; private sessions should not be publicly cached. Validate input and output schemas at the transport boundary. Keep legacy snake_case and camelCase fields stable for old clients while normalizing the new envelope consistently.

### 6 2 Session envelope

The following is a proposed type sketch. Nullability, enums, and required fields must become executable schemas and generated or fixture-verified Dart mappings. Internal scoring data is omitted from the normal pre-choice view.

```ts
type Experience = {
  experience_version: 1;
  session_id: string;
  revision: number;
  mode: "adaptive" | "challenge";
  status: "collecting" | "playing" | "finalizing"
    | "completed" | "interrupted";
  progress: {
    answered: number;
    skipped: number;
    consecutive_skips: number;
    max_answered: number;
    done: boolean;
    stop_reason: "budget" | "confident"
      | "skip_bound" | "catalog_exhausted"
      | "user_exit" | null;
  };
  opening: OpeningTranscript;
  current_pairing: PublicPairing | null;
  exchanges: Exchange[];
  current_read: CurrentRead | null;
  result: ReadingResult | null;
  capabilities: string[];
};
```

PublicPairing contains pairing_id, presentation_id, safe prompt, and song_a/song_b metadata. It excludes why_good, hypothesis, tests, raw vectors, diagnostic weight, and expected answers. Keep operator selection diagnostics server-side or in an explicitly authorized debug response. The currently returned tests and selection_reason fields should not become part of the default new listener contract.

OpeningTranscript contains ordered submitted entries, display labels, saved reactions, and the tentative opening line. Exchange contains a stable ID, answer index, presentation ID, chosen/rejected metadata, feedback lines, the read at that point, an optional next hook, and reaction status. A refresh must not reroll these lines.

CurrentRead contains claim_id, evidence_state, direction, text, question, supporting choice references, counterevidence references, and an optional previous_claim_id. The server determines direction and eligibility. Flutter does not count evidence to generate its own state labels.

```ts
type ReadingResult = {
  result_id: string;
  result_version: number;
  evidence_policy_version: string;
  headline: string;
  evidence_state: "supported" | "tentative"
    | "mixed" | "insufficient";
  supporting_choices: ChoiceReference[];
  counterevidence: ChoiceReference[];
  tension: string | null;
  confidence_note: string;
  narrative: string | null;
  narrative_status: "generated" | "fallback";
  archetype_detail: ArchetypeDetail | null;
  allowed_actions: string[];
};
```

ChoiceReference includes choice_id, pairing_id, chosen and rejected song metadata, and a safe explanation of its relevance. ArchetypeDetail uses strength-of-fit wording and an ambiguity flag; raw percentages and numeric deltas belong only in optional technical/operator views. Public sharing is a separate projection of the frozen ReadingResult.

### 6 3 Endpoint responsibilities

| Endpoint | Baseline | Target responsibility |
| --- | --- | --- |
| POST /onboarding/react | Exists | Preserve per-song response and retry safety |
| POST /onboarding/opener | Exists | Save ordered opener and return analysis state |
| POST /session | Exists | Create or replay a session start with first stable state |
| GET /session/:id | Exists | Full recoverable experience snapshot |
| GET /session/:id/next | Exists | Return the same outstanding presentation until consumed or replaced |
| POST /session/:id/choice | Exists | Atomic vote plus updated experience |
| POST /session/:id/skip | Exists | Record unscored skip and updated experience |
| POST /session/:id/react | New | Record reaction and actual selection effect |
| POST /session/:id/reveal | Exists | Idempotent finalization returning persisted ReadingResult |
| GET and POST /session/:id/chat | New | Shared continued interview with explicit evidence provenance |
| GET and POST /session/:id/feedback | New transport | Reuse result-feedback service with result version |
| POST /session/:id/share | New | Explicitly publish frozen snapshot and return canonical URL |
| DELETE /session/:id/share | New | Revoke owned public snapshot |
| GET /share/:token | Exists | Read active public projection only |
| POST /share/:token/challenge | New | Create recipient fixed-choice session |
| GET /sessions | Exists | Owned session list and resume metadata |
| DELETE /account | Exists | Delete and invalidate owned data and links |

Every path above is relative to /api/v1. Reuse equivalent existing services where they already solve the responsibility. GET requests must not score, finalize, or repeatedly generate a different pairing. Select or persist the next presentation at session creation and accepted mutations, or make first retrieval atomic and stable.

### 6 4 Mutations and typed errors

New-contract mutations carry mutation_id and expected_revision. Choice requests also carry pairing_id, presentation_id, chosen_song_id, and optional active_decision_ms. Validate the song belongs to the presented pairing, the presentation is current, the session belongs to the caller, and the session accepts that mutation.

```json
{
  "mutation_id": "client-generated-uuid",
  "expected_revision": 4,
  "pairing_id": "pairing-uuid",
  "presentation_id": "presentation-uuid",
  "chosen_song_id": "song-uuid",
  "active_decision_ms": 1850
}
```

For the same idempotency key and identical request, return the original accepted response. Reusing a key with different content is a conflict. A stale expected revision returns a typed conflict and a safe way to fetch the current snapshot. Never silently resubmit a different song after a timeout.

Use explicit error codes for unauthorized, forbidden, invalid input, not found, conflict, rate limit, upstream failure, and internal failure. Legacy error behavior must remain compatible or be versioned. Error messages exposed to clients must not include SQL, secrets, or private content.

### 6 5 Reaction response and completion

A reaction response records kind, applied, reason, previous_presentation_id, replacement_presentation_id, and updated experience. That's me preserves scores. Not quite prefers a diagnostically relevant retest and excludes the currently displayed presentation when replacing it. If none exists, return applied false with an honest prompt. Harder must affect the effective selector inputs; top-level mode currently overrides knob mode and must not neutralize the request.

The engine owns all stop rules. Keep answered, presentation count, and skip count separate. Early completion must not use prior vector magnitude as a substitute for valid observed support. Accepted D02 stops a stalled session after three consecutive skips at any answer count; Lovable has added the rule, so verify its persisted-event integration and reset after an answer. The reason catalog_exhausted must be emitted by a real exhausted-catalog path and must not masquerade as a confident or budget-complete result.

## 7 Persistence and publication

Do not assume the existing choice unique constraint makes the whole operation safe. The current flow inserts a choice and then updates session state separately. An implementation must prevent a recorded vote without its corresponding vector/progress update, and prevent concurrent votes from overwriting each other. Use a transaction or equivalent atomic server operation with ownership checks, row locking or revision comparison, and replayable mutation records.

A result row or equivalent JSON record stores result content and evidence references once per result version. Preserve the relationship to the session revision used to generate it. If generation occurs outside the transaction, persist a finalizing state, use a single generation claim/lease, and allow recovery without duplicate model work or votes.

The current database can assign a token automatically, while the share reader accepts tokens separately from its public-UUID check. Do not treat token existence as consent. Implement an explicit published state or dedicated share record, and inventory old-token behavior before migrating it. A public URL must reference a deliberately shared result version. Revocation, deletion, and cache behavior must agree.

Share creation returns canonical share_url, share_token, published_result_version, and challenge availability. Copy and native share use that returned URL; clients must not build URLs from internal session IDs. Persist ordered challenge pairing IDs and relevant catalog versions. Reject or explain unavailable content instead of silently changing the challenge.

When changing Supabase persistence, inspect the live schema and current platform guidance, use an ordinary reviewed migration, and verify grants, RLS, ownership, and public projection. Privileged credentials remain server-side. Do not perform broad production data rewrites as a side effect of parity work.

## 8 Flutter implementation details

### 8 1 State model

Replace the latest-feedback-only model with an experience snapshot plus local pending mutation state. Keep server revision, current presentation, exchange history, current read, completion status, final result, and reaction availability in typed entities. Use null-safe optional fields during compatibility rollout without silently accepting a missing required capability.

| State | Visible behavior | Exit condition |
| --- | --- | --- |
| Restoring | Existing transcript or neutral loader | Server snapshot or recoverable error |
| Ready | Current pairing and latest exchange | Choose, skip, reaction, or leave |
| Submitting | Selected card remains marked | Accepted response or uncertain outcome |
| Reconciling | Preserve selection and explain retry | Snapshot confirms accepted or conflict |
| Revealing | Retain last exchange while result resolves | Persisted result or retryable failure |
| Result | Headline, evidence, uncertainty, actions | Share, details, pushback, or restart |
| Chatting | Result context plus ordered messages | Continue, return, or recover |
| Expired | Session context and sign-in recovery | Reauthentication or safe exit |

Do not clear an accepted vote's feedback when the next pairing fetch fails. Do not jump to a generic completed state that says there is enough evidence after a skip-bound completion. Trigger reveal once from authoritative completion; repeated lifecycle callbacks must reuse the same finalization mutation.

### 8 2 Presentation and navigation

Retain the existing fonts and palette, then match the approved phone viewport's actual sizes, weights, line heights, borders, radii, and spacing. Use scroll anchors to keep the active exchange visible. Preserve optional history and reduced-motion behavior. Choose selection emphasis over a generic global spinner.

Add continuation and result destinations without discarding the session ID. History and account routes may be staged as PRD HIS01 allows, but essential resume, deletion, and sign-out remain required. Test deep links as delivered URLs; registered platform associations alone do not prove navigation works.

Use the native iOS share sheet with a clipboard fallback and a visible failure path. Keep the canonical public URL origin separate from an API-only origin. A public share may safely open the web surface where native routing is not implemented, provided the experience remains functional and the limitation is documented.

### 8 3 Recovery and authentication

The local resume store should retain identifiers and pending mutation metadata, not act as the source of diagnostic truth. Restore the authenticated or anonymous identity first, then fetch the session. Clear private cache on sign-out or account deletion according to the product's account-switching policy.

Verify registration that requires email confirmation. Do not navigate as though a session exists when sign-up returns a user without an active session. Test anonymous-to-account conversion separately; the current signUp implementation does not itself prove existing anonymous readings are transferred.

## 9 Test fixtures and expected outcomes

Fixtures use frozen metadata and mocked/cached narrative strings for cross-client comparison. Integration tests separately validate actual model fallback and persistence behavior. Real song names may be used for human review, but mathematical regression fixtures should use clearly synthetic values rather than asserting unreviewed musicology.

| Fixture | Input or event | Required assertion |
| --- | --- | --- |
| F01 Stable | Three or more independent supports | Supported tendency cites valid choices |
| F02 Reversal | Earlier theory then meaningful counterexample | Revision identifies changed evidence |
| F03 Balanced | Plus 40, minus 40, plus 40, minus 40 | Mixed; no directional supported claim |
| F04 Zero answers | Three unfamiliar-song skips | Insufficient; no broad-taste identity |
| F05 Prior only | Strong opener vector and no usable choices | No observed-support claim |
| F06 Duplicate | Same mutation resent after timeout | One vote and one vector update |
| F07 Untested axis | Large gap on axis absent from pairing tests | Gap is excluded from claim support |
| F08 Missing values | Declared axis lacks a song value | Invalid evidence is flagged and excluded |
| F09 Artist confound | Winning choices concentrate on one artist | Alternative explanation preserved |
| F10 Harder | Low lane confidence and explicit steering | Effective selector mode reflects steering |
| F11 No retest | Not quite with no eligible replacement | Honest no-change response; no score change |
| F12 Late skips | Three answers then three consecutive skips; an answer between skips resets the sequence | Accepted D02 bound, durable event order, and correct reason |
| F13 Empty catalog | No eligible pairings remain | catalog_exhausted and appropriate result |
| F14 LLM failure | Valid evidence but generator unavailable | Same evidence with deterministic fallback |
| F15 Invalid narrative | Invented song or disallowed claim | Reject generated output and fall back |
| F16 Resume | App terminated after server commit | Same exchange, pairing, and revision |
| F17 Concurrent devices | Two conflicting answers to one presentation | One accepted outcome; other conflict |
| F18 Private share | Result not deliberately published | Public fetch is unavailable |
| F19 Share lifecycle | Publish, open, revoke, delete | Valid then unavailable; no private data |
| F20 Challenge | Recipient replays shared set | Same IDs/order, independent evidence |
| F21 Chat disagreement | User explains personal association | New provenance; old result unchanged |
| F22 Presentation | Small screen, long title, large text | No clipping or lost actions |
| F23 Old client | Requests without capability header | Existing client behavior remains usable |
| F24 Schema mismatch | New client sees incomplete enriched response | Explicit recoverable version error |
| F25 Result feedback | Feedback on reopened version | Stored against correct result; no score mutation |
| F26 Decade regression | Five-song 1980s flow | Existing web route works; no pairing votes fabricated |

For F01 and F02, do not assert only the archetype label. Verify evidence IDs, excluded observations, claim qualification, next question, and final headline source. For F03, verify that no opposing example is mislabeled as support even if an internal candidate direction exists.

## 10 Verification layers and acceptance evidence

### 10 1 Engine and service tests

Use pure tests for evidence aggregation, consistency, neutral/missing values, stop policy, and steering precedence. Use service tests for idempotency, transactional updates, persisted results, authorization, and error recovery. A mock that always returns the requested DTO cannot prove an endpoint contract or database guarantee.

Keep existing engine golden tests for preserved selection behavior. Rebaseline only where the accepted requirement changes behavior, and explain the change. Do not modify fixtures merely to make a broken implementation pass.

### 10 2 Contract tests

Validate actual route responses against executable schemas for both legacy and enriched variants. Confirm all required fields survive serialization and Dart parsing. The existing e2e suite expects pairing.pairing_id while current responses use id, and expects share_token plus nested archetype fields that finalization does not return. Correct those expectations against the intended version instead of treating a skipped suite as a pass.

The existing HTTP e2e tests need MUSICDNA_E2E_BASE_URL and AGENT_TEST_HARNESS_KEY. Run them only against an authorized test environment. Never expose the harness key, disable authentication in production, or create production test users without an approved test process.

### 10 3 Client and visual tests

Flutter Cubit tests must cover history accumulation, automatic reveal, reaction replacement, stale response rejection, pending mutation reconciliation, and result/share errors. Widget tests cover content and state, while screenshot review covers hierarchy and layout at equal phone dimensions. Replay the same fixture content and action order in both clients.

Capture eight comparison states: opener, selected pairing, feedback, theory, genuine revision, final result, pushback, and public share. Include reduced motion, screen reader semantics, 200 percent web zoom or large native text, keyboard-visible onboarding, long names, and small-screen scrolling.

### 10 4 Commands and result reporting

Use the repository's actual lockfile and package-manager convention. Current scripts include npm test, npm run build, and npm run lint. Verify their configuration before invoking them; do not claim an unavailable external integration has passed because unit tests are green.

From the idea-builder repository root, use the existing Flutter release process:

```bash
cd apps/mobile
flutter pub get
flutter analyze
flutter test
flutter build ios --release \
  --dart-define-from-file=config/prod.local.json
```

Archive from ios/Runner.xcworkspace using the established signing process. Confirm APP_ENV, API_BASE_URL, SHARE_BASE_URL, SUPABASE_URL, and the appropriate client key without printing their values. Increment the version/build number only for the intended release candidate.

Report each command as passed, failed, or not run, with the reason and environment. Do not convert a skipped integration suite into a success claim. Once required risks and gates are covered, avoid unrelated test expansion.

## 11 Requirement traceability and release checklist

| Requirement family | Main delivery | Minimum evidence |
| --- | --- | --- |
| ENT and ONB | Anonymous conversational opening | Both-client opening and auth fixtures |
| DUE and REA | Pairing state, stop rules, steering | F06, F10 to F13, F17 |
| READ | Shared theory and history | F01, F02, F07, F16 |
| DIA and VOI | Evidence ledger and allowed language | F01 to F09, F14, F15 |
| RES | Automatic persisted result | Final-vote recovery and stable reopen |
| RES06 and LEG01 | Result feedback and preserved decade flow | F25 and F26 |
| CHAT | Grounded continuation | F21 and private-history isolation |
| SHR | Publication and challenge | F18 to F20 plus native share recording |
| ACC and DAT | Ownership and lifecycle | Account deletion and cross-user denial |
| UX and NFR | Native parity and recovery | F16, F17, F22 and accessibility review |
| ARC | One service and compatible contract | F23, F24 and route schema tests |
| CAT05–CAT08 | Modern catalog coverage and era/familiarity integrity | Versioned inventory, reviewed songs/pairings, six-answer selector paths, skip/retest alternatives, and modern/mixed-era web/mobile fixtures |
| ARC06 | Routing reference/runtime compatibility | If routing changes: shared golden outputs, mode/fallback checks, and invariant evidence/completion behavior |
| ADM and MET | Preserved admin and useful telemetry | Role checks and six-round metrics |

Release acceptance requires the approved web SHA, Flutter SHA, mobile build number, API contract version, evidence policy version, catalog fixture revision, passing required tests, comparison screenshots, and recordings. Document any intentional difference and its product rationale. No P0 requirement may be silently deferred.

Use a deployment sequence that keeps existing clients operational: additive storage and shared service support first, opt-in web validation next, mobile release candidate afterward, then gradual activation and monitoring. Roll back new capability flags or client builds without deleting recorded choices or published snapshots. Destructive schema cleanup follows only after compatibility is proven.

## 12 Source references

Latest pre-publication source cutoff: https://github.com/acedge123/music-dna/commit/60381b0436f33a8802a2d19046ef0c0561c4e515. Reviewed the intervening diff, including AGENTS.md, evidence builder/tests, revision and prompt integration, checkpoint changes, and roadmap status; no test run or deployment check.

Agent Brain reference: https://github.com/The-Gig-Agency/agent-brain/tree/4cf8a1261fde31cab1b45696d0f2e6b1a739bb91. Checked its MusicDNA integration README, exports, recommender, integration plan/analysis, architecture guardrails, and golden fixture. Compared music-dna's src/musicdna/router/index.ts, routing call site and mode selection, integration progress notes, and matching fixture data. This was a source and fixture-data review, not a router test run or production configuration audit.

October 10 update: https://github.com/acedge123/music-dna/tree/b83f9a35233a71078204434eacdcffed29dcb50f. The checked-in .lovable/plan/gap-review-musicdna-product-requirements-v1-0-vs-current-bui-2026-10-10.md records ratified D01–D04; roadmap.md records the first implementation slice. Review claims.ts/claims.test.ts, pairing.ts/completion.test.ts, musicdna.functions.ts, and the landing/share copy diff for that slice. Test-pass and pending manual-session status are Lovable's report, not independently executed acceptance.

The original source review used https://github.com/acedge123/music-dna/tree/d20d0d4687b1ecd9bd0863d33a106aa9b9862c67. Its mobile copy is historical comparison evidence. The active mobile location is https://github.com/acedge123/idea-builder/tree/9d533b37b7cf66c2aa95e9fd9b1fcb7ec8261368/apps/mobile. Reconfirm line locations and current gap status on the implementation branches.

- src/routes/onboarding.tsx: pick around lines 349 to 435, reaction steering around 461 to 486, share action around 489 to 503, and result around 840 to 930.
- src/lib/musicdna.functions.ts: private-field stripping around 463 to 471; completion around 526 to 550; steering around 822 to 843; choice persistence around 1498 onward.
- src/lib/musicdna.functions.ts: final evidence around 1883 to 1985; final return around 2150 to 2158; synthesis around 3098 to 3217; chat extraction around 3501 to 3556; running read around 3701 to 3854.
- src/musicdna/engine/pairing.ts: completion policy and top-level selector precedence. src/musicdna/engine/scoring.ts and archetypes.ts: fit tiers and residual flags.
- src/routes/api/v1/session.$id.choice.ts, session.$id.next.ts, session.$id.reveal.ts, session.$id.ts, share.$token.ts, and e2e.test.ts: actual REST behavior and test expectations.
- src/lib/share.functions.ts and src/routes/s.$sessionId.tsx: public access and older result presentation.
- apps/mobile/lib/src/features/session/presentation/pages/session_stub_page.dart: last feedback, manual generate, whyGood rendering, result detail, and token-based sharing.
- apps/mobile/lib/src/features/session/presentation/cubit/session_cubit.dart and data/repositories/session_repository_impl.dart: lifecycle and parsing.
- apps/mobile/lib/src/features/auth/data/datasources/auth_remote_data_source.dart: anonymous entry, signup session distinction, sign-out, and deletion.
- docs/musicdna/intelligence_layer.md, archetype-bible.md, prior-weighting.md, experiments/cross-lane-probes.md, instrumentation.md, and mobile_flutter_api_contract.md: product constraints and historical contract notes.
- September 2026 Lovable web brief and Codex Flutter parity brief: original experience acceptance and ACE web-approval sequence.

## 13 Suggested initial Codex instruction

Read MusicDNA Product Requirements v1.2 and this guide. Include the parallel 2000–2026 catalog workstream and CAT06–CAT08 dependencies in the ticket map. Continue the existing mobile parity tickets in acedge123/idea-builder, preserving current local work and branch history. Revalidate the mobile baseline, map each ticket to PRD IDs and Lovable API/web dependencies, and implement ready client work against the agreed contract. Lovable owns web/shared-backend repairs in acedge123/music-dna; coordinate missing capabilities instead of duplicating that backend. The-Gig-Agency/agent-brain supplies the related routing reference: preserve its boundary and synchronize affected fixtures if routing code changes. Integrate against the implemented API and use the ACE-approved web commit as the visual reference. Return changes, actual verification results, contract compatibility evidence, and a parity matrix. Do not claim deployed or TestFlight parity from source inspection, mocks, or unit tests alone.
