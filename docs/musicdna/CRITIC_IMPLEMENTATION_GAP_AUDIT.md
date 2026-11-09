# MusicDNA — Critic Implementation Gap Audit

**Audit basis:** `acedge123/music-dna` at `6e22afb15ca0c1b3d6250d3718ca868b22162b40` (November 9, 2026 UTC). The live `/api/public/version` endpoint returned this same serving SHA during the audit.

**Scope:** Critic experience, evidence-to-expression handoff, conversation, adaptive testing, result, and their existing acceptance tests.

**Status:** Independent source-level audit plus two previously observed real-session examples; **not** approval of implementation, a model-quality benchmark, or a completed 12-session live evaluation.
**Change policy:** Audit/documentation only. No runtime code, scoring, database, rollout flags, API contracts, or saved results changed.

> **Executive finding: the critic already exists on paper and in its persona prompt; the production path prohibits it from writing the words the listener sees.** This is principally an intentionally narrow **expression contract**, not evidence that the model lacks musical intelligence. A model swap or visual redesign cannot fix it alone.

## 1. Source of truth — do not redesign again

1. [`docs/musicdna/product-requirements.md`](product-requirements.md), especially **DUE03, READ01–04, REA01, RES02–05, CHAT01–02, VOI01–04, CAT07–08**. Product intent is evidence → interpretation → expressive critic, with counterarguments and replayable, reversible claims.
2. [`docs/musicdna/intelligence_layer.md`](intelligence_layer.md): specifically *“Encode the process, not the prose”* and the **Analyst → Critic** separation. The Analyst decides what is supportable; the Critic writes interesting but bounded prose.
3. [`src/musicdna/engine/critic.ts`](../../src/musicdna/engine/critic.ts): already specifies a sharp, humane, music-literate critic, with good/bad examples. Do **not** replace the persona as the first fix.
4. [`docs/musicdna/MUSICDNA_UX_EXPERIENCE_RESET_2026-11-08.md`](MUSICDNA_UX_EXPERIENCE_RESET_2026-11-08.md): the reviewed interaction direction and ten acceptance criteria. Its header calls it a **proposed direction**, so mockup copy is not diagnostic-policy approval.
5. [`docs/musicdna/claim-language-v1.md`](claim-language-v1.md) and [`AGENTS.md`](../../AGENTS.md): binding evidence, provenance, immutable results, safety, and parity invariants. **Important tension:** `claim-language-v1.md` deliberately forbids free prose pending a separately evaluated validation contract. That is the historical reason the current implementation sounds rigid. The remediation must satisfy—not silently bypass—that safety gate.
6. [`docs/musicdna/critic-web-presentation-2026-11-08.md`](critic-web-presentation-2026-11-08.md): Lovable explicitly reported that the visual pass **did not implement** a new backend expression model, offer-versus-choice audit, catalog change, or playable friend challenge.

Older instructions that said *one LLM call* and later instructions that describe *two AI roles* do not require a new provider or necessarily two network calls. Start with **one structured generation containing bounded editorial text**, then compare it with a two-pass option for quality, cost, and latency. Any change to the accepted claim policy or production rollout needs explicit approval.

## 2. Traceability and verdict

Status legend: **WORKING** = a concrete behavior exists; **PARTIAL** = mechanism exists but misses the approved experience; **BROKEN FOR EXPERIENCE** = code structurally prevents the promised behavior; **MISSING** = absent from inspected production flow; **UNVERIFIED** = needs live/operational acceptance.

| ID | Approved behavior | Status | Source evidence and root cause | Priority |
|---|---|---|---|---|
| C01 | A consistent, perceptive critic voice | **PARTIAL** | `engine/critic.ts:12–39` supplies it; `musicdna.functions.ts:3165–66,3312–14` overrides final/chat modes with *JSON only, no prose*. | **P0** |
| C02 | Song-specific opener reactions without premature traits | **PARTIAL** | `musicdna.functions.ts:2579–2680` uses AI and catalog context, but its *good* examples for songs 1–2 are literally “Interesting place to start,” “Still listening,” and “Two very different rooms.” Deterministic fallbacks are similarly bland. | **P1** |
| C03 | Immediate choice-specific banter | **BROKEN FOR EXPERIENCE** | `musicdna.functions.ts:1434–35` returns `winner over loser` plus the exact same `"Choice noted. A pattern needs independent evidence."` after every vote; `use-interview.ts:442` displays it. No contextual critic observation is produced here. | **P0** |
| C04 | Evolving, nonrepetitive hypothesis | **PARTIAL** | `engine/read.ts:36–110` calculates real tier/direction/revision, but `thesis = boundedClaim(...)` and recurring `hook` strings. No narrative beat or anti-repetition contract. | **P0** |
| C05 | Next question matches the actual next pairing | **WORKING (bounded)** | `engine/prompts.ts:19–28` and `musicdna.functions.ts:1231–35` derive it from selected tests. Safe, but only ten canned axis lines plus generic “same question.” | **P1 voice** |
| C06 | Adaptive retest or harder matchup | **PARTIAL / specific defect** | `engine/pairing.ts:256–317` genuinely boosts/forks on leaning axes; `musicdna.functions.ts:1097–1115` changes knobs. **But** `harder` sets `liveKnobs.mode = diagnostic_first` while the same caller passes a top-level `mode` into `selectPairing`; `engine/pairing.ts:234` explicitly gives that top-level mode precedence. Thus the requested diagnostic-first mode does **not** take effect for general/low-confidence sessions (though `canon_floor: 0` still does). No guaranteed independent counterexample. | **P1** |
| C07 | Disagreement visibly changes the conversation | **PARTIAL** | Backend saves reaction, steers next pairing and returns a message (`musicdna.functions.ts:4270–4310`). UI stores **`reactionDisplayMessage(r.effect)`** rather than `r.message` (`use-interview.ts:571`), reducing the visible reply to four generic variants (`lib/critic-display.ts`). | **P1** |
| C08 | Big reveal is a fresh, arresting interpretation | **BROKEN FOR EXPERIENCE** | `adapters/evidence-narrator.ts:9–35` asks for *claim/choice IDs only* and forbids prose. `engine/claim-language.ts:66–120` discards generated wording and composes template text. `musicdna.functions.ts:3293–3303` stores it as the final synthesis. | **P0** |
| C09 | Memorable, evidence-bounded hero headline | **PARTIAL** | `lib/critic-display.ts` strips count parentheticals and takes the **first sentence**; `components/musicdna/reading-result.tsx:21–24` renders that as hero. This is formatting, not editorial interpretation. | **P0** |
| C10 | Responsive, genuinely conversational pushback | **BROKEN FOR EXPERIENCE** | Both persisted chat paths (`musicdna.functions.ts:3823–40,4046–63`) demand JSON with only claim IDs, one of five `question_id`s, and acknowledgement boolean. `engine/claim-language.ts:141–181` assembles canned response or “I couldn't ground that reply.” | **P0** |
| C11 | Per-user tone/tactic memory changes the critic | **PARTIAL** | `musicdna.functions.ts:3333–3399` maintains tone dials, but C10 constrains the actual visible response to the same few templates. Memory cannot meaningfully express the intended voice. | **P1** |
| C12 | Confounds separate *what was offered* from *what was chosen* | **MISSING** | `engine/evidence.ts:96–106,172–180` counts **chosen-side** artist/song/era/lane only. No offered-side denominator or selection-exposure report. | **P1 research** |
| C13 | Claim independence is credible to the listener | **PARTIAL** | `engine/evidence.ts:87–91` dedupes by **pairing ID**, not repeated opponent song/artist. Thus two wins over *Such Great Heights* can count as two distinct pairings. That satisfies current D01, but overstates intuitive independence if left unexplained. **Do not silently alter D01 thresholds.** | **P1 research** |
| C14 | Current stage and latest read dominate the viewport | **WORKING** | `routes/onboarding.tsx:175–380` stages current interaction; `interview-history.tsx:67–143` moves history to a drawer, keeps reactions inline, and shows progress. This is real Lovable progress. | **Preserve** |
| C15 | Song cards feel visually specific | **PARTIAL** | `components/musicdna/song-choices.tsx:3,36–42` uses the **same `listening-record.jpg`** on both cards. Labels are clear, imagery is interchangeable. Original-artwork/licensing remains optional. | **P2** |
| C16 | Chat opens ahead of the full report, with reliable history | **WORKING (presentation)** | `routes/me.tsx:63–103` collapses saved read and prioritizes conversation; `reading-conversation.tsx` displays stored messages. Persistence/retry is separately tested; conversational *quality* still fails C10. | **Preserve** |
| C17 | Share recipient can play the exact same choices | **MISSING in public UI** | `routes/s.$sessionId.tsx:103–121` offers *Get your own reading*, not an exact-pairing replay. Already called out as pending TGA-312 in `tga-314-web-reference.md`. Separate release backlog, not a reason to stall C03/C08/C10. | **P2 / tracked** |
| C18 | Runtime diagnosis distinguishes model, validator and fallback | **PARTIAL** | Final reasoning logs `narration_status` (`musicdna.functions.ts:1959–1990`), but no independently scored editorial quality or visible trace of **model-proposed copy → validation → accepted copy** exists for the new expressive contract. Live deployment model/env was not inspected. | **P0 to validate fix** |

### Verified central call chain

```text
Frozen pairing choices
  -> loadChoiceEvidence -> buildLedger -> evaluateClaim       [keep]
  -> narrateEvidence -> AI emits only {claims:[IDs]}         [too narrow]
  -> validatedNarration -> deterministicNarration             [template prose]
  -> finalSynthesis.synthesis -> persisted session_results    [frozen]
  -> readingLead(first sentence, strip count) -> hero          [cosmetic]

Chat: ledger + user self-report + history
  -> AI chooses {claims, question_id, acknowledge_self_report}
  -> validatedChat canned assembly OR fallbackChat            [no real banter]
```

**Important nuance:** The safety layer is working as designed; it is simply doing the *Critic's editorial job* as well as the Analyst's evidentiary job. The approved PRD's `VOI01` allows paraphrase/connection within eligible claims; the later conservative `claim-language-v1` decision forbids it until validation is evaluated. The next implementation must resolve this **contract gap explicitly**, not delete `validatedNarration` or tell the model to ignore the rules.

## 3. Real-session evidence (observed, not a fabricated benchmark)

### Session A — ACE's pasted reading (November 8)

- Visible result: **“Across these matchups, you favored communal over solitary.”**
- Supports: *Ho Hey* over *Such Great Heights*; *Dog Days Are Over* over *Such Great Heights*; *Kids* over *Maps*.
- 3 recorded supports / 0 against; **two supports reuse the same rejected song**. Confounds shown: 2000s 5/6 chosen, MGMT 3/6 chosen, electronic crossover 3/6 chosen.
- **Observed:** the headline is the literal `boundedClaim` pattern; confounds are exposed as bookkeeping rather than a teasing, qualified question. **Not inferable from this paste:** the unobserved six full frozen song snapshots, the production model actually used, or the offered-side distribution.
- **Needed behavior:** do not claim a stable personal identity or independently proved love of crowds. An editorial hook may ask whether this is communal energy **or** two dislikes of the same foil, while acknowledging that the ledger still counts three distinct pairing IDs under D01.

### Session B — prior live first-session review (November 8)

- Openers: Talking Heads *Once in a Lifetime*; Joy Division *Love Will Tear Us Apart*; Childish Gambino *Redbone*.
- Six choices: *Rebellion (Lies)* over *Dog Days Are Over*; *Maps* over *Heat Waves*; *Banquet* over *Kids*; *Breezeblocks* over *De Selby (Part 2)*; *Mr. Brightside* over *Use Somebody*; *Kids* over *Maps*.
- Live claim: **danger over release**. User challenged: “I chose Maps because of Karen O's vulnerable vocal, not because I want danger ... What else do you notice?”
- Observed stored reply: **“I couldn't ground that reply in your choices. Which part of the music mattered most to you?”** The user statement was saved; it was not meaningfully engaged. The revised version retained the same core claim.
- Four of six offered pairings were **2000s-versus-2000s**, so a 2000s concentration of winners is not independent evidence of an era preference.

These two examples make the issue concrete. They are **not** 12 fresh instrumented replays or a valid statistical quality sample. Do not claim they prove a specific model is inferior.

## 4. Target implementation contract — narrow, testable, no new taxonomy

### P0-A — Bounded editorial output (C01, C03, C04, C08, C09)

- **Keep** the canonical ledger, D01 thresholds (`>=3` distinct pairings, support > contradiction, consistency `>=.65`), immutable evidence snapshots, real revisions, and existing audit renderer.
- Introduce a separate **versioned editorial output contract**, e.g.:

```ts
type CriticBeat = {
  stage: 'opener' | 'choice' | 'theory' | 'revision' | 'reveal';
  claim_refs: string[];        // eligible claim/evidence IDs, or empty for observations
  headline: string;            // short, human, music-specific; not a new unsupported claim
  supporting_choice_ids: string[];
  uncertainty_ref: string | null;
  follow_up: string | null;    // must match actual next pairing if it promises a test
  voice_version: string;
};
```

- Let the model **author** only `headline` and `follow_up` within the supplied claim ceiling; it must not author the axis verdict, numeric confidence, song IDs, or claim status. Deliver real supporting receipts and caveats as separate structured fields.
- Validate the schema and referenced IDs, plus stage-specific limits and refusal to upgrade provisional/mixed claims. **A regex-only prose validator cannot establish semantic grounding.** Pair mechanistic validation with a red-team fixture suite, reviewed approved examples, and deterministic fallback.
- Capture **model output, rejection reason, fallback reason, accepted display copy and versions** in a restricted QA trace, not public telemetry; minimize personal data. A failed editorial generation must remain a *generation failure*, not a listener insufficiency.
- Avoid doubling provider calls by default: try one strict structured output with factual IDs **and** bounded creative fields, then benchmark a two-step Analyst/Writer implementation. Provider/model A/B comes **after** this contract works.
- Existing saved v1 results remain byte-identical. New expressive results need explicit `voice_version` / result-version migration policy; never silently rewrite previously published snapshots. Preserve web/Flutter server response parity and public V1 gates.

**Acceptance:** A session with unchanged top axis across rounds 3–6 produces different but factually consistent narrative beats; an insufficient session cannot get an invented revelation; every displayed song citation maps to real frozen choices; the saved audit text remains available.

### P0-B — Conversational pushback (C10, C11)

- Replace the output restriction *not the safety evidence* in both `chatTurnImpl` persistence paths. A constrained turn should return `{acknowledgement, substantive_reply, evidence_refs, uncertainty, question}` or an equivalent versioned structure.
- Treat user self-report as an explanation to acknowledge/discuss, **not a new vote**. Example: *“Karen O's voice, not danger—fair point. That choice can't settle motive. Want to test that with a different singer?”* Acknowledge before debating.
- Keep exact `mutation_id` replay, saved-message-only rendering, lease recovery, `chat_self_report` version separation, unchanged session vector, and publication privacy.
- Validate response claims, cited choices, absence of invented music facts/psychological diagnoses, and consistency with previous turns. If validation fails, a **specific, honest, context-aware fallback** should quote/paraphrase the user's correction without pretending agreement or inventing a changed score.

**Acceptance:** The Karen O correction gets a relevant answer—not `fallbackChat`—and the original frozen reading remains unchanged. A later repeated `mutation_id` returns that exact saved reply. Cross-client rendering does not invent one.

### P1-C — Make reaction and pairing steering legible (C02, C05–C07)

- Remove generic *good* examples from `microReactVoice(0/1)`; require a grounded song/artist-specific phrase or an honest neutral fallback. Keep one-song/no-trait discipline.
- Replace static vote `why` with a factual choice observation, not a fabricated supported theory. DUE03 allows naming a choice tradeoff but not claim inflation.
- Display the server's `recordReactionImpl.message` (or a vetted editorial response bound to its actual effect), not only `reactionDisplayMessage(effect)`; explain the *actual next selected pairing's tests*, and its limitations.
- Preserve `nextPromptFor`'s **selected-pairing-first** invariant. A request for a counterexample is only presented as fulfilled if selector telemetry proves the pair actually tests the same uncertain axis and differs materially from prior foils.
- Fix the proven `harder` mode-precedence defect: make the selection mode effective without violating the selector's documented backwards-compatible precedence. Add an integration test on `nextPairingImpl`'s actual argument composition for a general/low-confidence listener; the existing `engine/pairing.test.ts:174–220` tests the precedence correctly **in isolation** but does not catch the caller's conflicting inputs.
- Check recent **song/artist** exposure separately from used pairing IDs; track catalog diversity. Changes to pool filtering/weights require reviewed catalog and routing tests, not spontaneous score rewrites.

**Acceptance:** At round 2, `Not quite` visibly changes the next question and gives a non-generic in-context reply; `Prove it` selects a truly harder valid comparison or says no alternative; no prompt promises an unsupported test.

### P1-D — Evidence-quality diagnostics (C12–C13)

- Add a **read-only audit** of all *offered* songs/eras/artists/lanes vs *chosen* songs per session. Do not conflate exposure with selection.
- Add a repeated-foil / repeated-artist concentration warning distinct from D01 support counting. ACE's two wins over *Such Great Heights* are real pairings but not three disjoint A-vs-B stimuli.
- Keep D01 unchanged for this remediation unless a separately reviewed policy version changes eligibility. Make caveat presentation more intelligible, not a deterministic identity accusation.
- Report lane/era coverage, viable independent challenges, skipped-known-song failures, and which test axes were actually offered.

### P2-E — UX finishing and social loop (C15, C17)

- Differentiate the two song cards using licensed art where available or code-native differentiated design; do not ship the same image twice as proof of musical specificity.
- Preserve the already-shipped stage/history/progress/chat hierarchy and keyboard/reduced-motion behaviors.
- Track same-choice share challenge under TGA-312; don't call an independent new reading a replay of a friend's exact choices.

## 5. Twelve-session golden acceptance matrix

These are **proposed test cases to implement and run**, not 12 sessions already executed. Reuse the existing `fixtures/musicdna/experience-v1/` and `product-parity-v1.json` where applicable; create frozen sample evidence for the two user sessions only with authorized snapshots, never reconstruct unseen scores from prose.

| Case | Input / perturbation | Must pass factually | Must pass editorially |
|---|---|---|---|
| G01 | ACE communal/solitary, repeated *Such Great Heights* | 3 distinct pairing supports, repeated-foil caveat; chosen vs offered distinct | Specific, intriguing headline; asks a falsifiable question |
| G02 | Live danger/release session + Karen O challenge | No self-report promoted to vote; original result stable | Acknowledges vocal interpretation, reasons about it, proposes a relevant retest |
| G03 | Three supports, no contradictions, diverse opponents | Supported threshold met; citations real | Strong but bounded tendency, not personality diagnosis |
| G04 | 3–1 supported with exception | Exception and qualification persist | Engaging tension without hiding the losing decision |
| G05 | 2–2 mixed | No supported directional lean, even with large magnitudes | Honest *interesting uncertainty*, not a fake revelation |
| G06 | Exactly two directional supports | Tentative/observation only | Curious, explicit need for further test |
| G07 | Zero answered / skip-bound | No invented supporting evidence | Clear incomplete result, useful graceful exit |
| G08 | Invalid/missing frozen catalog snapshot | Invalid evidence explicitly unavailable | Technical failure not disguised as a taste insight |
| G09 | Repeated chosen artist and lane (e.g. MGMT) | Confounds as context, not identity | Names plausible alternative without overstating it |
| G10 | Era-concentrated *offered* pairs | Reports offered and chosen era distributions separately | No claim that listener independently chose an era |
| G11 | `Not quite`/`Harder` + alternate-catalog exhausted | Actual selector/test reason and `no_alternative` truthful | Specific in-context reply; no fake “harder” choice |
| G12 | Replay/resume, same `mutation_id`, published v1 | Byte-stable saved result/reply, no cross-user/private disclosure | Same exact visible words on web/Flutter, no phantom second critic turn |

### Editorial rubric (human review, not a probability score)

For each supported G01–G04/G09–G11 turn, reviewers score **intelligence, personality, specificity, responsiveness, forward pull** on a 1–5 scale. Proposed gate: **average >=4.0, no category <3**, with *zero* factual/provenance/ceiling violations. Review two independent critic outputs per fixture to catch brittle first-sample wins; assess insufficient cases for **honest interest**, not theatrical claims. This is a suggested **product acceptance target**, not a metric already observed.

Compare three separate measures:

1. **Structural safety:** factual IDs, claim ceiling, exception, replay, ownership, share, parity (automatable, must be 100%).
2. **Editorial quality:** independent human rating on real outputs; note over-repetition or boilerplate.
3. **Engagement:** exposure → answered pair → challenge → next pair → completion; instrument actual next-step actions and fallback rates before assigning success thresholds.

Log provider/model actually used, latency/tokens/cost where available, version, validation status and fallback frequency. In production Vercel, `OPENAI_API_KEY` takes precedence over Lovable's key (`adapters/llm-gateway.ts`); the source cannot reveal which secret is deployed, so **do not attribute a response to a specific provider without runtime evidence**.

## 6. What existing tests prove—and do not prove

- The evidence policy and renderer are genuinely tested (`engine/claim-language.test.ts`, `adapters/evidence-narrator.test.ts`). In fact tests **explicitly reject free prose** and assert a canned fallback. This is valuable safety coverage but also codifies the experience problem.
- UI tests (`lib/critic-display.test.ts`, `components/musicdna/reading-reference.test.tsx`) verify counts removed, reference presentation, selected states, replay, and insufficiency. They **do not test whether an original insight is memorable, differentiated, or responds to a listener's correction**.
- Lovable's `critic-web-presentation` report asserts **53 focused tests plus a local 390px walkthrough**. This audit inspected the source but **did not independently rerun** them: dependencies were absent from the clean audit worktree. That prior report explicitly excludes backend expression quality and production acceptance.
- Earlier `tga-314-web-reference.md` also says the share challenge, human voice/device acceptance, and model-quality acceptance were pending. The observed UI improvement is real; green visual tests do not close the critic gap.
- During this audit production's public version endpoint returned SHA `6e22afb15ca0c1b3d6250d3718ca868b22162b40`, matching the reviewed GitHub tree. This establishes deployment parity **only**, not that twelve critical-path sessions passed live QA.

## 7. Execution handoff — sequential, no scope creep

**PR 1 / P0: Editorial contract and validation, tests first.** Do not change `buildLedger`, `evaluateClaim`, immutable choice evidence, routed selection, privacy or V1 gating. Build schema/validator + failure trace + G01/G03–G08, then wire into **new** reads. Preserve old version-1 frozen readings. Add one canary path on staging; show actual accepted copy and fallback in screenshots.

**PR 2 / P0: Real chat turn.** Implement constrained authored response in both persistence paths, retaining replay/lease/version semantics. Pass G02/G12 and a red-team pack (invented song, personality diagnosis, support inflation, invented listening motive, self-report counted as vote). Human-review at least ten saved conversations.

**PR 3 / P1: Opening/vote/reacted reply and retest transparency.** Pass G09–G11 and 390px/desktop/reduced-motion/keyboard QA. Keep `nextPromptFor` pairing-tied. Avoid replacing authentic server output with generic UI strings.

**PR 4 / P1: Offer-vs-choice/repeated-foil analytics**, default-off/read-only until reviewed; use catalog validation for any selector edits. Same-choice friend replay remains its existing independent ticket.

**Release gate:** exact deployed SHA; fixture run IDs and frozen evidence; safety/voice rubric table; 390px video/screen captures including actual challenged conversation; latency and fallback report; ACE approves the experience on web before copying to Flutter. Avoid merging unaccepted runtime changes into auto-deployed `main`.

### Explicit open decisions

1. Approve a **separately validated bounded editorial-expression contract** to replace `claim-language-v1`'s prose ban in *new* readings, preserving its eligibility rules and deterministic fallback.
2. Choose single structured call by default vs a second writer call only after comparative quality/cost data. Neither requires a new provider as a first step.
3. Decide whether repeated opponent songs should **only be disclosed as a caveat** (recommended now) or change confidence/eligibility in a separately versioned claim-policy revision later.
4. Keep existing stored/public readings immutable; migrate only via explicit versioned new result and tested client compatibility.

---

**Bottom line:** Stop asking whether the persona prompt is cool enough. It already is. The code intentionally converts the critic into an ID selector and a deterministic reporter. Preserve the evidence guardrails, give authored **bounded expression** its own tested contract, and accept the product on real conversations rather than passing JSON/unit tests alone.
