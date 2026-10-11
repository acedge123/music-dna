# MusicDNA Product Requirements

Product specification version 1.1 | October 10 2026

Prepared for ACE and the MusicDNA product and engineering team

Repository copy: `docs/musicdna/product-requirements.md`. Companion: [Codex Parity Guide](codex-parity-guide.md). Keep these two documents synchronized across music-dna, idea-builder, and The-Gig-Agency/agent-brain when revising shared requirements.

MusicDNA helps people discover what they seek from music through a short conversation and revealing choices between songs. The first session should feel like a perceptive music critic paying attention: a recognizable opening, a difficult choice, a specific observation, a fair challenge, and a conclusion the listener can question or share.

The next release must complete that experience on web and reproduce it in the existing Flutter app. Shared scoring already exists. The work now is to make the evidence, conversation, result, and continuation equally coherent on both platforms. Correctness repairs precede the mobile port so that parity preserves the intended product rather than copying known defects.

## 1 Product intent and governing principles

The central question is what a listener chooses when two appealing songs require different tradeoffs. A preference for a song is an observation. Repeated comparable decisions can support a listening tendency. The critic makes that tendency understandable and interesting while preserving competing explanations.

The useful outcome is a listener recognizing an unexpected pattern in their own decisions. MusicDNA may discuss emotional release, immersion, intimacy, conviction, or other qualities sought from music when the choices support them. It must not convert those qualities into diagnoses, demographic assumptions, or claims about the person's general character.

The editorial matchup catalog is a core product asset. Each pairing should reveal a meaningful choice; expanding the song count alone does not improve the product. Familiarity, artist loyalty, era preference, and personal association remain alternative explanations rather than inconveniences to omit.

### 1 1 Product rules

- The three opening songs establish context and routing. Pairwise decisions provide the primary diagnostic evidence.
- Evidence comes before interpretation. Interpretation comes before expressive copy.
- A compelling observation must remain traceable to actual chosen and rejected songs.
- Uncertainty is a valid result. A contradiction should change the question or qualify the conclusion.
- The first session has a bounded length. Strong evidence is welcome but never required to manufacture a satisfying ending.
- Web and Flutter consume the same server decisions and experience content. Presentation remains native to each platform.
- Current canonical axes, archetypes, prior weighting, and lane boundaries remain intact unless a separately recorded product decision changes them.

### 1 2 Specification status

Requirements below describe the target release. The original baseline describes acedge123/music-dna at d20d0d4687b1ecd9bd0863d33a106aa9b9862c67, including its mobile copy. ACE subsequently identified acedge123/idea-builder as the active mobile repository. Version 1.1 corrects repository ownership and records Lovable's October 10 progress. Reconcile the original mobile gap inventory against active Codex work before closing tickets. D01 through D04 are recorded as ratified in Lovable's checked-in decision register; they do not require another decision before implementation continues. Section 16 separates accepted direction from remaining implementation and operational decisions. Existing behavior is not evidence that a requirement has passed acceptance.

The companion MusicDNA Codex Parity Guide supplies the implementation sequence, source files, proposed API contract, reproducible fixtures, and release evidence. The September handoff sequence remains applicable: ACE approves the corrected web experience before Flutter becomes its visual and behavioral counterpart.

Lovable is completing web and shared-backend work in acedge123/music-dna. Mobile Codex is preparing parity tickets in acedge123/idea-builder, under apps/mobile. That planning can continue in parallel. Define the shared contract alongside evidence and reliability changes, then make mobile integration depend on the implemented contract and approved web reference. Code duplication between repositories does not authorize a second backend implementation. The companion guide records the observed mobile branch and the coordination handoff.

The-Gig-Agency/agent-brain is the related routing reference: it contains the MusicDNA session-to-terrain mapper, regime scorer, selection-knob mapping, and shared golden fixtures. music-dna has its own local runtime implementation of that integration. Keep the reference and runtime compatible without moving product evidence policy into the router or adding routing logic to Flutter. Section 11 defines this boundary.

## 2 Audience and product scope

### 2 1 Users and their needs

| User | Primary need | Successful outcome |
| --- | --- | --- |
| First time listener | Learn something interesting without setup or homework | Completes a short session and understands why the read was made |
| Curious returning listener | Challenge or refine an earlier interpretation | Sees the critic respond to specific evidence and pushback |
| Share recipient | Understand a friend's read and try the same choices | Can participate without seeing private conversation |
| Catalog curator | Author informative and recognizable matchups | Can inspect diagnostic intent, coverage, confounds, and performance |
| Product operator | Know whether the experience works and fails safely | Can inspect completion, evidence quality, feedback, errors, and cost |

No demographic cohort or psychometric validity claim is assumed. Initial research should include different levels of music knowledge and several supported lanes, rather than only expert alternative-music listeners.

### 2 2 Release scope

The parity release includes anonymous entry, three-song onboarding, adaptive pairings, skips, immediate feedback, a visible evolving read, reactions, automatic final results, evidence disclosure, follow-up conversation, sharing, the same-choice challenge, session recovery, account controls, and operational verification. Existing web administration remains part of the overall product and must not regress.

The same-choice challenge is a lightweight replay of the sender's selected pairing set. A side-by-side compatibility score, social network, public feed, or friend leaderboard is outside this release.

Streaming playback, music-library import, playlist generation, subscriptions, payments, catalog expansion, new archetypes, a new personality taxonomy, and a new model provider are outside parity scope. Metadata and licensed outbound music links may be retained where already available. In-app audio is not a dependency for V1.

### 2 3 Product surfaces

| Surface | Target responsibility | Platform |
| --- | --- | --- |
| Entry | Explain the experience and start with minimal friction | Web and Flutter |
| Interview | Opening songs and subsequent pairings as one continuous experience | Web and Flutter |
| Result | Headline, supporting choices, uncertainty, and next actions | Web and Flutter |
| Living read | Follow-up discussion anchored to the completed session | Web and Flutter |
| History and account | Resume, revisit readings, sign in, sign out, delete | Web and Flutter |
| Public reading | Explicitly shared snapshot with challenge entry | Web, opened or routed from mobile |
| Administration | Catalog, ontology, diagnostics, residuals, prompts, router monitoring | Web only |
| Decade interview | Existing five-song 1980s exploration and curated prompts | Web only in this release |

## 3 Primary journeys

### 3 1 First session

The listener opens MusicDNA and starts without mandatory registration. The app asks for three songs, one at a time, with a short response after each of the first two. After the third, the critic offers a tentative thread and moves into the first pairing without asking the user to understand lanes or scoring.

The listener chooses between two songs. The chosen card responds immediately; the other recedes. A short observation names the decision. As evidence accumulates, the critic exposes a working theory and a useful next question. Prior exchanges remain available without crowding out the active choice.

The server ends the initial session after at most six answered pairings, or under an earlier completion rule. The result appears automatically. A weak session receives an honest incomplete read rather than a confident label. The listener may push back, share, inspect the fuller explanation, or leave with a complete first-session experience.

### 3 2 A listener challenges the critic

During the interview, the listener can acknowledge, disagree, or request a harder matchup. Acknowledgment changes conversational pacing only. Disagreement changes the next diagnostic question when an eligible alternative exists. The critic explains when the catalog cannot supply a useful alternative. Reactions are never counted as song votes.

After the result, the listener can explain why a choice meant something different. The critic references the actual decision and separates this new self-report from observed pairing evidence. The original result remains a reproducible snapshot. A subsequent read can be revised with explicit provenance.

### 3 3 Unfamiliar songs and interrupted sessions

The listener can skip without inventing a preference. The pairing leaves the session's eligible pool, the answered count does not increase, and the UI explains the next step. Repeated skips lead to an honest short result or a supported exit. An interrupted session resumes from the last server-confirmed state, including feedback and current pairing; it never silently creates an extra vote.

### 3 4 Sharing and challenge participation

The listener deliberately shares a public snapshot containing the approved headline, supporting choices, and qualification. The recipient sees no private messages, email, or internal user identifier. A challenge starts a separate session with the same pairing IDs and order, while keeping the sender's choices out of the recipient's pre-choice screen. Challenge results are labeled as a fixed sequence rather than an adaptive diagnostic.

## 4 Functional requirements

Priority P0 means required before parity release. P1 means a supporting product requirement that may be staged after the first parity candidate when explicitly recorded. Requirement IDs remain stable across the companion guide and implementation tickets.

### 4 1 Entry and onboarding

**ENT01 P0 Anonymous start.** Provide a clear start action that establishes an anonymous authenticated session behind the scenes. Preserve existing anonymous entry on both clients. Explain recoverability when the listener chooses to save across devices; do not require an account before the first read.

**ENT02 P0 Accurate positioning.** Align landing-page, metadata, public-card, and app copy with the actual first-session budget and evidence boundaries. Lovable corrected the web landing metadata and public card from twenty/sixty to six in the October 10 source update. Preserve the real maximum of six answered matchups, while allowing an earlier honest ending. Describe self-discovery through musical choices without implying a validated personality test.

**ONB01 P0 Three ordered songs.** Collect exactly three opening entries in sequence, preserving their ranking and submitted wording. Accept title and artist text without requiring an exact catalog match. Blank input and over-limit text receive actionable validation. A failed request retains the unsaved entry for retry.

**ONB02 P0 Conversational reactions.** React to each of the first two songs with concise, relevant commentary and a next prompt. A reaction may describe the song but should point toward a question about the listener's choices. Avoid claiming an established personal pattern from one song.

**ONB03 P0 Tentative opening.** After the third entry, show a tentative hypothesis, then start pairings automatically. The user must not be stranded on an intermediate success screen. Keep the opener transcript accessible within the same experience.

**ONB04 P0 Routing integrity.** Persist lane analysis and priors through the shared service. Distinguish catalog matches from model classification. Unknown or ambiguous entries may lead to general routing; do not silently substitute a different song and treat it as confirmed input.

### 4 2 Pairings and feedback

**DUE01 P0 Clear forced choice.** Each pairing shows two identifiable songs with artist and available year metadata. Use neutral pre-choice copy. Curator rationale, tested axes, hypothesis, expected answer, and scoring weights must not be shown to the listener before the vote.

**DUE02 P0 Immediate response.** Mark the selected song and dim the rejected song immediately, then render server-confirmed feedback. Disable duplicate submissions while a request is pending. A network failure preserves the visible choice and offers recovery without implying that the vote was lost.

**DUE03 P0 Choice-specific observation.** Feedback names the chosen and rejected songs and may describe an observed tradeoff. Repeated-pattern language such as always, again, or every time requires matching evidence. Response speed must not be treated as proof of confidence or emotional struggle.

**DUE04 P0 Session progress.** Display answered count against the server's maximum. Skipped and replaced pairings must not produce a misleading Round 8 of 6 label. Both clients use the server's completion status and reason.

**DUE05 P0 Unknown-song skip.** Permit a skip when one or both songs are unfamiliar or the user cannot make a meaningful choice. Preserve an optional skip reason for product analysis. Skips never change preference vectors, support counts, or archetype fit.

**DUE06 P0 Completion.** Retain the six-answer hard cap and minimum four answers for early completion while the evidence-aware early-stop refinement is decided. Retain the existing low-recognition rule of three skips when answers are two or fewer. Under accepted D02, three consecutive skips also end a session at any answer count. Lovable added that rule and tests; verify persisted event order and both-client behavior. Catalog exhaustion must be emitted as a distinct completion reason, not merely declared as a possible type.

**DUE07 P0 Reliable replay.** A repeated request with the same mutation ID returns the already committed result. Double taps, timeouts, retries, and multi-device requests must not duplicate choices or lose a vector update.

### 4 3 The evolving read

**READ01 P0 Visible theory.** Show observations in the first two choices, then a tentative thread when justified. Show a supported interpretation only when the common evidence policy permits it. Display readable states such as theory forming, the thread holds, and one choice challenges this.

**READ02 P0 Real revisions.** A revision records the previous claim, new evidence, and changed interpretation. Merely changing the top axis or rotating a template is not a revision. Refer to the actual contradictory decision where practical.

**READ03 P0 Conversation history.** Retain opening reactions and pairing exchanges in chronological order. Keep the latest exchange prominent, with older rounds compact or expandable. Resume restores this history rather than only the last line.

**READ04 P0 Next question.** The critic's follow-up hook must correspond to the next selected pairing's diagnostic purpose. It cannot promise a test that the next question does not perform.

**REA01 P0 Reactions.** Offer That's me, Not quite, and Give me a harder one from an appropriate earned point, normally after the second answer. The server records the reaction and responds with its effect. Not quite selects a useful retest or counterexample when available. Harder increases the relevant difficulty without simply making the songs obscure. Neither reaction changes recorded song choices or scores.

### 4 4 Result and continuation

**RES01 P0 Automatic reveal.** Finalize and display the result automatically after server completion. No mandatory Generate my reading action. A failed generation has a retry state; accepted choices remain safe.

**RES02 P0 Result hierarchy.** Lead with one distinctive sentence, followed by up to two actual supporting choices and one unresolved tension or alternative explanation when warranted. Put longer prose, archetype detail, and technical explanation behind a secondary disclosure. If fewer than two examples qualify, show fewer and explain the limit.

**RES03 P0 Honest insufficiency.** Zero answers, too few relevant choices, conflicting evidence, missing catalog data, and generation failure have different meanings. None automatically implies broad taste, inconsistency, an eclectic identity, or a strong archetype.

**RES04 P0 Stable result.** Persist the exact result content, evidence references, policy version, and result version. Reopening or sharing the same version renders the same read. A later conversation does not silently replace an already shared snapshot.

**RES05 P0 Useful actions.** Provide Push back, Share this read, and access to the full reading. Public results offer Try these choices. These actions must lead to functioning destinations on both platforms.

**RES06 P0 Result feedback.** Preserve the web feedback concepts of accurate, partly accurate, and missed, plus an optional useful sentence, inaccurate sentence, and comment. Make equivalent lightweight feedback available in Flutter and attach it to the exact result version. Feedback is separate from the in-interview reactions and does not automatically change song scores.

**CHAT01 P0 Continued interview.** Provide a native Flutter continuation equivalent to web's living read. Load the completed session's choices, allowed claims, counterevidence, and recent messages. Responses remain short and address the user's actual challenge.

**CHAT02 P0 Evidence provenance.** Keep pairing observations, opener priors, and conversational self-report separately identifiable. Reaction clicks never mutate the diagnostic vector. Current web chat can change that vector from model-extracted text; D04 defines the target handling and is not a reason to replicate the mutation silently.

**HIS01 P1 History.** Let registered listeners reopen saved readings and distinguish an in-progress interview from a completed result. Cross-device restoration uses server ownership and state. Anonymous restoration works only while the anonymous identity remains available; explain that limitation before claiming durable account recovery.

**LEG01 P1 Existing decade experience.** Preserve the web 1980s route, which asks five songs against curator-managed decade prompts, forms an initial hypothesis after three, and refines after two more. It is a separate exploration mode with different evidence provenance from forced-choice pairings. Do not represent its five submitted songs as five pairing votes. Its mobile port is deferred; shared-service changes must not break the existing route or decade-prompt administration.

### 4 5 Sharing and account controls

**SHR01 P0 Deliberate publication.** Create or activate a share only from an explicit share action. Return a canonical URL and an opaque token. Make the private/public distinction visible to the owner. Opening a private result is not consent to publish it.

**SHR02 P0 Public snapshot.** Return only the approved result snapshot and selected public evidence. Do not include private chat, raw model prompts, email, profile records, raw vectors, or unrelated sessions. Token and legacy-ID access must follow one documented visibility policy.

**SHR03 P0 Share interaction.** Use the native share sheet on iOS and available web sharing, with clipboard fallback. Show an actionable error when a link cannot be created. Do not report success merely because text was copied if the URL is invalid.

**SHR04 P0 Same-choice challenge.** Persist the pairing set associated with a share. Create an independent recipient session that replays it without exposing the sender's choices before voting. Handle unavailable pairings explicitly; do not silently claim an identical challenge after substitution.

**SHR05 P0 Revocation.** The owner can stop sharing. Revoked or deleted snapshots return a neutral unavailable state and do not disclose whether a private account exists. D03 governs migration of existing links.

**ACC01 P0 Account lifecycle.** Preserve sign in, sign up, email-confirmation handling, sign out, and deletion. Saving an anonymous reading into an account must preserve ownership or clearly explain when transfer is unsupported; do not promise automatic transfer without a tested flow.

**ACC02 P0 Deletion and isolation.** Account deletion removes or invalidates owned readings, private messages, and public links according to the approved retention policy. Clear local caches. Verify old access tokens cannot continue retrieving deleted data. Every private resource requires ownership checks; admin status is checked server-side.

## 5 Diagnostic model

### 5 1 Canonical dimensions

The active implementation uses ten dimensions. Earlier documents describing nine or fifteen dimensions are historical context, not permission to change the schema. The following pole labels reflect current code. They describe music and listening preferences rather than human personality traits.

| Dimension | Lower pole | Higher pole |
| --- | --- | --- |
| movement | Stillness | Forward motion |
| atmosphere | Statement | Immersive mood |
| immersion | Immediacy | Slow reveal |
| scale | Intimate | Vast |
| community | Solitary | Communal |
| perspective | Feeling | Witness |
| confidence | Vulnerability | Command |
| tension | Release | Danger |
| texture | Rawness | Refinement |
| transformation | Holds its shape | Takes you somewhere |

In particular, the confidence axis concerns a song's command versus vulnerability. It must never be confused with certainty about the diagnostic result. Words such as dreamy, nostalgic, raw, or hopeful are derived editorial descriptors; they are not new scored dimensions.

### 5 2 Current calculation and preserved boundaries

The session begins with candidate dimension priors multiplied by 0.35. This is a seed multiplier, not a guarantee that the opener contributes 35 percent of the result. Each answered pairing adds the chosen-song value minus rejected-song value, weighted by diagnostic weight, on the pairing's declared tested axes.

The engine uses the evolving vector for selection and aesthetic archetype matching. The evidence ledger must separately record which individual decisions support or oppose a proposed claim. A large seeded vector or one large axis contrast cannot substitute for repeated observations.

**DIA01 P0 Single evidence builder.** Running read, final result, follow-up context, and public evidence must derive from the same versioned ledger. Each contribution identifies session, pairing, chosen and rejected songs, tested axis, direction, magnitude, timestamp, and applicable catalog version or captured values.

**DIA02 P0 Relevant evidence only.** Count only declared, valid tests with usable axis values. Missing metadata is unknown rather than a neutral preference. A distinct pairing is counted once; repeated songs and artists are tracked as limits on independence. Rejected choices remain available for counterevidence.

**DIA03 P0 Claim eligibility.** Separate contrast magnitude from directional consistency. A two-to-two split is mixed evidence and cannot earn a directional claim because the songs are strongly different. Evidence examples attached as support must agree with the claim's direction. Opposing examples are labeled separately.

**DIA04 P0 Graded language.** Preserve observation, tentative theory, supported tendency, contested tendency, and insufficient-evidence states. Accepted D01 requires at least three distinct supporting pairings, directional consistency of at least 0.65, and more support than contradiction. A 3-to-1 pattern needs qualification; a 2-to-2 split does not support a directional claim. The system may still make a useful observation before that threshold; it must not promote it by prose alone.

**DIA05 P0 Higher-order interpretation.** The final reading may connect supported tradeoffs into one interpretation, but every clause must have a defensible evidence path. Do not infer introversion from solitary music, trauma from sad songs, or a life value from an aesthetic dimension. The model may acknowledge uncertainty and propose a next question.

**DIA06 P0 Confounds.** Track concentration by artist, era, lane, and repeated song, and preserve the strongest relevant alternative explanation. Timing is contextual telemetry, not proof of decisiveness. Backgrounding, reading speed, disability, or network delay may affect response time.

**DIA07 P0 Reproducibility.** Persist selected pairing order, raw choices, evidence policy, engine version, catalog values or revision, narrative version, and result version. A replay must distinguish deterministic engine output from cached generated language.

### 5 3 Aesthetic archetypes

The ten existing archetypes are secondary summaries of what a listener seeks from art. Do not add or rename them during parity work. A poor or ambiguous match remains unassigned or explicitly qualified in the primary user experience.

| Archetype | Core question |
| --- | --- |
| The Architect | How well is it built |
| The Romantic | How deeply does it feel |
| The Atmospherist | Where does it take me |
| The Anthemist | Who can I share this with |
| The Transformer | Does it change me |
| The Seeker | What truth is it chasing |
| The Storyteller | What story is it telling |
| The Hedonist | How good does it feel |
| The Believer | What does it stand for |
| The Witness | What does it notice |

Cosine similarity measures fit to an authored signature, not a probability that a person belongs to a category. The engine's fit tiers are editorial buckets. Primary screens should use ordinary uncertainty language, not percentages that imply validated psychological accuracy. Existing score and margin flags must remain available to operators.

## 6 Pairing selection and catalog requirements

**CAT01 P0 Routing.** Preserve lane-native selection and the existing prohibition on cross-lane probes for a confidently routed session. Test alternative explanations across artists and suitable subcultures within the allowed territory. General-lane bootstrap and documented fallback are distinct from re-enabling experimental lane flipping.

**CAT02 P0 Pair quality.** An active pairing must identify two different songs, a clear tradeoff, declared axes, diagnostic weight, routing lane, and editorial rationale. Validate song metadata and sufficient axis contrast. Exclude same-artist comparisons from the standard selector as current code does; any future exception is an explicit product decision.

**CAT03 P0 Recognition.** Balance diagnostic value against likely familiarity using the existing recognition inputs. Catalog scarcity must be surfaced to operators. A skip must not be interpreted as taste against the songs or their genre.

**CAT04 P0 Adaptive purpose.** Selection should resolve a specific uncertainty or retest a proposed pattern. The server returns a safe user-facing prompt while keeping diagnostic notes private. A counterexample must meaningfully distinguish the primary interpretation from its alternative, not merely repeat the same axis label.

**CAT05 P1 Coverage audit.** Report active songs and pairings by lane, axis, recognition level, artist concentration, missing values, and skip rate. Do not publish a fixed catalog count in the product without checking the live catalog. Controlled fixture catalogs remain stable even as the production catalog grows.

Current code and documents include alternative, pop, hip-hop, electronic, classic rock, metal, R and B, general routing, and references to country content. Shipping lane availability must come from the active catalog and routing configuration. Documentation is not proof that every lane has enough usable pairings.

## 7 Critic voice and result composition

The critic should sound knowledgeable, curious, direct, and occasionally provocative. Humor comes from recognizing a revealing choice. It must remain humane and should not shame a listener's age, knowledge, taste, or response speed.

**VOI01 P0 Evidence constrains expression.** The narrator receives explicit allowed observations and claims, counterevidence, and a language ceiling. It may paraphrase or connect approved claims; it may not invent a new dimension, song selection, or confidence level.

**VOI02 P0 Brevity with specificity.** A normal exchange uses a short observation and a follow-up hook. A result uses a sharp headline with optional supporting prose. Repeated filler, identical templates, and unexplained jargon are defects even when the API succeeds.

**VOI03 P0 Honest fallbacks.** If model generation fails, render deterministic copy from the same evidence. If evidence is insufficient, state the limit. Generation failure and insufficient evidence are separate statuses so the product does not misdescribe a network problem as a listener trait.

**VOI04 P0 Narrative validation.** Validate cited song and choice IDs against the session. Block unsupported certainty, diagnostic labels, and evidence-free repetition claims. Invalid generated output falls back safely and is logged for review. Wording variation must not change the underlying claim.

An illustrative result might notice that a listener repeatedly favors emotional escalation across otherwise different songs, while preserving the possibility that a particular artist accounts for the pattern. The real result must name the actual decisions; this example is not copy to serve indiscriminately.

## 8 Design and accessibility

The existing Warm Static visual identity uses editorial typography, warm dark surfaces, newsprint-colored text, and restrained ember, gold, and teal accents. Preserve that identity. Phone-width web behavior is the visual reference for Flutter after web approval; desktop two-column geometry is not the mobile specification.

| Design token | Current reference |
| --- | --- |
| Background | #15110F |
| Surface | #0E0B09 |
| Foreground | #F1E7D6 |
| Muted foreground | #A89A88 |
| Primary ember | #D9342A |
| Gold | #E8B547 |
| Teal | #1F6B7A |
| Display type | Instrument Serif |
| Body type | Inter |
| Utility type | JetBrains Mono |

**UX01 P0 Responsive geometry.** Use stacked song cards at narrow widths where the approved web layout stacks them. Support long titles, larger text, keyboard presentation, and safe areas. Current Flutter's rounded side-by-side cards are a baseline difference to resolve, not a new design requirement.

**UX02 P0 Reading rhythm.** Selected-state feedback appears immediately. Text can arrive in short staged lines, but users can skip decorative delay. Respect reduced motion. A new pairing must not pull focus away before the preceding observation can be read.

**UX03 P0 Accessibility.** Provide semantic song buttons, announced selected/busy/error states, visible keyboard focus, sufficient contrast, and meaning beyond color. Verify at 200 percent web text zoom and large native text. Use at least 44 logical pixels for key touch targets and test with screen readers on representative flows.

**UX04 P0 Honest waiting.** Preserve context during loading, retry, and backgrounding. Distinguish a pending vote from a pending narrative. Avoid two spinning song cards that hide which choice was made.

## 9 Accounts data and privacy

### 9 1 Logical information model

| Entity | Purpose | Exposure |
| --- | --- | --- |
| Profile | Opening songs, routing context, account association | Owner and authorized service |
| Session | Progress, lane, versions, current state, completion | Owner |
| Choice | Chosen and rejected song, pairing, timing, ordering | Owner; selected facts may be shared |
| Reaction | Acknowledgment or request to retest | Owner and service |
| Evidence ledger | Support, contradiction, provenance, eligibility | Service; approved explanation to owner |
| Result version | Headline, evidence, qualification, archetype detail | Owner unless explicitly shared |
| Chat message | Continued interview and self-report | Owner |
| Share snapshot | Explicit public projection and challenge reference | Anyone with active link |
| Catalog | Songs, values, pairings, archetypes, revisions | Curator; safe metadata to listeners |
| Diagnostic event | Funnel and quality telemetry | Authorized operators |

These are logical responsibilities, not a requirement to create one new database table per row. Reuse existing storage when it can preserve ownership, versioning, and recovery correctly.

**DAT01 P0 Private by default.** Enforce ownership in private reads and writes. Never ship privileged database credentials to web or Flutter. A public route exposes only its dedicated projection, not a general session query.

**DAT02 P0 Minimize telemetry.** Use pseudonymous session IDs in ordinary analytics. Avoid raw free-text chat, email, tokens, and complete model prompts in general logs. Restrict richer diagnostic records to authorized operational review with a defined retention period.

**DAT03 P0 Retention and consent.** Explain what is stored, how AI services process submitted content, how sharing works, and how deletion is requested or performed. Product behavior and privacy text must agree. Retention durations and treatment of abandoned anonymous sessions are explicit decisions, not invented defaults.

**DAT04 P0 Public link lifecycle.** Deletion and revocation invalidate future public reads. Existing token behavior must be inventoried before migration so no private result is accidentally published and no preservation promise is made without evidence.

## 10 Administration and content operations

The current web admin includes songs, pairings, archetypes, decade prompts, ontology, residual review, diagnostics, and router monitoring. Preserve server-side administrator authorization. Mobile parity does not require rebuilding these tools in Flutter.

**ADM01 P0 Safe catalog edits.** Validate critical song and pairing fields server-side. Audit edits that affect diagnostics. Existing sessions and shared results must remain interpretable after catalog changes through a revision or captured values. Prefer deactivation over destructive removal of referenced content.

**ADM02 P0 Diagnostic inspection.** Operators can inspect why a pairing was selected, what was scored, what evidence was allowed or blocked, whether a model fallback occurred, and why a session ended. Internal labels stay out of listener-facing copy.

**ADM03 P1 Editorial workflow.** A curator authors a tradeoff, checks song values and lane eligibility, previews neutral pre-choice copy and possible post-choice interpretations, and verifies balanced evidence before activation. Changes receive a review record and rollback path.

**ADM04 P1 Residual learning.** Review weak and ambiguous archetype matches, repeated unknown-song skips, and rejected interpretations. These records inform catalog quality and future policy experiments. They do not automatically create new archetypes.

## 11 Architecture and service boundaries

The current web app uses React with TanStack Start; Flutter uses repositories, Cubits, and a versioned REST transport. Supabase supplies authentication and data storage. TypeScript modules hold selection, vector updates, archetype scoring, and voice helpers. Some orchestration and experience logic remains in musicdna.functions.ts.

**ARC01 P0 One domain implementation.** Share the application services behind web server functions and REST endpoints. Flutter must not reproduce scoring, claim eligibility, completion, selection, or critic copy in Dart. A web UI may retain server functions provided both transports use the same application service and DTOs.

**ARC02 P0 Versioned experience contract.** Expose progress, pairing presentation, ordered exchanges, current theory, evidence, reaction effects, completion, final result, and sharing through a documented contract. Preserve released-client compatibility during rollout.

**ARC03 P0 Transactional mutation.** Accept choice, vector update, progress, and revision changes atomically or with an equivalent recoverable protocol. Idempotency applies to choices, skips, reactions, reveal requests, chat submissions, and share creation.

**ARC04 P0 Model boundary.** Deterministic code owns the evidence and permitted claims. The model provides language within those bounds. Cache generated content by the relevant session/result revision; retries must not reroll the read or repeatedly charge for identical work.

**ARC05 P0 Environment discipline.** Keep dev, staging, and production configuration explicit. Preserve existing mobile bundle identity and signing workflow. Confirm API and public-share origins independently. No credential belongs in the PRD, logs, fixtures, or a distributed build.

**ARC06 P0 Routing integration boundary.** Preserve the Agent Brain integration as a server-side pairing-selection capability. Regime recommendations may influence selection knobs; they do not establish listening claims, change choice math or the six-answer/skip stopping policy, write critic copy, or revise completed results. Keep router confidence distinct from evidence consistency and archetype fit. Pin reference/runtime revisions and controlled fixtures when routing changes. Flutter consumes the chosen pairing through the MusicDNA experience API.

### 11 1 Agent Brain relationship and current status

| Repository | Verified role | Ownership boundary |
| --- | --- | --- |
| acedge123/music-dna | Product backend, local src/musicdna/router implementation, selector integration and router diagnostics | Owns production experience, evidence, completion, API, web, and routing deployment configuration |
| acedge123/idea-builder | Active apps/mobile Flutter client | Consumes the product API; no independent regime or evidence engine |
| The-Gig-Agency/agent-brain | Reference integration under src/cognitive-router/integrations/musicdna and fixtures/musicdna/parity-golden-v1.json | Owns reusable mapper/scorer/knob reference and its evaluation; coordinate runtime changes with music-dna |

At music-dna b83f9a35233a71078204434eacdcffed29dcb50f, MUSICDNA_ROUTING_MODE supports legacy, shadow, and live; source defaults to shadow. Shadow computes an alternative pick while serving the legacy pick; live requires an explicit setting. This review did not inspect deployed configuration or authorize a routing rollout. Parity work must preserve the configured mode and fallback behavior. Missing router inputs must not be treated as proof of stable taste.

At agent-brain 4cf8a1261fde31cab1b45696d0f2e6b1a739bb91, the MusicDNA reference implementation exists. The three cases in parity-golden-v1.json match the web repository's fixture contents. That comparison establishes shared fixture data, not passing runtime parity or better user outcomes. Routing policy improvements and promotion from shadow to live remain their own measured workstream.

Older integration prose contains superseded descriptions: five opening songs, 12–15 rounds, two-support/0.55 claim gates, active cross-lane probes, or a design-not-started banner. Use this PRD's three-song core opening, six-answer maximum, accepted D01/D02, and current pinned source for parity. The separate five-song 1980s mode remains valid. Routing-plan D1–D4 are different decisions from this PRD's D01–D04; do not conflate their status.

## 12 Reliability and performance

The following are target release budgets to validate, not measured production results. Immediate local selection feedback should appear within 100 milliseconds on representative devices. Target the next usable round within 2 seconds at the median and 5 seconds at the 95th percentile under a documented network profile. Cached results should reopen within 2 seconds; an uncached final narrative may take longer but must show an honest waiting state and bounded retry.

**NFR01 P0 Recoverable state.** An accepted vote remains accepted after timeout, refresh, backgrounding, or app termination. Resume reconciles with server revision and restores the current exchange. A stale client cannot overwrite newer state.

**NFR02 P0 Graceful service failure.** Catalog failure, authentication expiry, model failure, and offline state have distinct recovery actions. A narrator outage does not erase scored choices. Do not continue an endless spinner after a terminal failure.

**NFR03 P0 Safe observability.** Record request IDs, revisions, typed failures, duration, and fallback reason without leaking secrets. Track model calls, latency, and cost per completed session so UX experiments have an operational budget.

**NFR04 P0 Concurrency.** Two devices answering the same outstanding pairing yield one accepted mutation and one replay or conflict response. Two different concurrent mutations cannot lose a vector update. Test this against the persistence layer, not only a mocked Cubit.

## 13 Measurement and research

The primary product measure is the proportion of completed sessions in which the listener identifies at least one specific useful observation and can connect it to their choices. A high completion rate alone does not establish insight. Agreement alone can reward generic flattering copy, so qualitative evidence and contradictory cases are essential.

| Measure | Definition | Use |
| --- | --- | --- |
| Start to result | Sessions viewing a result divided by sessions starting onboarding | First-session friction |
| Opener completion | Sessions submitting three songs divided by sessions submitting the first | Opening relevance and usability |
| Pairing skip rate | Skipped presentations divided by all presented pairings | Recognition and catalog fit |
| Useful observation rate | Respondents naming a useful sentence divided by respondents asked | Specific perceived value |
| Revision credibility | Observed revisions judged to follow the cited choice | Quality of adaptation |
| Share success | Valid share snapshots created divided by share attempts | Functional sharing |
| Challenge conversion | Recipient challenge starts divided by public result visits | Invitation effectiveness |
| Recovery success | Interrupted sessions resumed without duplicate or lost choices | Reliability |
| Unsupported claim rate | Audited claims lacking permitted evidence divided by audited claims | Evidence integrity |

**MET01 P0 Event vocabulary.** Track opener start/submit, pairing shown, choice accepted, skip accepted, read shown, reaction submitted/applied, session completed with reason, result viewed, pushback submitted, share created/opened/revoked, challenge started/completed, and recovery outcomes. Include client, app build, contract, policy, and catalog versions.

**MET02 P0 Six-round instrumentation.** Reconcile existing analytics that expect rounds 8, 10, 12, or 14. A metric that never receives data in the shipping flow cannot substantiate stability. Compare clients using the same definitions and denominators.

**MET03 P1 Pilot research.** Run a proposed 8 to 12 moderated first-session studies across several lanes and knowledge levels. Ask where the critic noticed something specific, where it overreached, and what participants wanted to challenge or share. Treat two memorable moments per session as a research aspiration, not a generation requirement or proven metric.

## 14 Current implementation assessment

The table preserves the original September source baseline. The dated update immediately below supersedes repaired findings. Mobile entries need reconciliation against idea-builder and ongoing Codex work.

| Capability | Web baseline | Flutter baseline | Required change |
| --- | --- | --- | --- |
| Opening interview | Individual reactions and transition | Similar sequence | Preserve and verify edge cases |
| Selection feedback | Winner emphasis and staged text | Disabled cards and spinner | Match phone experience |
| Running theory | Current read and hooks | Latest feedback only | Shared contract and native rendering |
| Reactions | UI and partial steering | Absent | Correct steering then port |
| Completion | Automatic synthesis | Manual generate step | Shared automatic result state |
| Evidence policy | Inconsistent running and final gates | Receives final gate | Unify and validate |
| Weak evidence | Broad-taste fallback | Older interpretation path | Distinct honest outcomes |
| Follow-up | Living read chat | No equivalent route | Shared service and native chat |
| Sharing | Session-ID link mismatch | Reveal token missing | Canonical token lifecycle |
| Public result | Older archetype presentation | Opens shared web route | Same result snapshot |
| Challenge | Generic new-test entry | Absent | Fixed-pairing recipient flow |
| Operations | Catalog and diagnostic tools | No admin parity needed | Preserve and update relevant metrics |
| Decade exploration | Five-song 1980s route | No equivalent | Preserve web; defer mobile extension |
| Result feedback | Accuracy and sentence-level feedback | No equivalent in session result | Add lightweight shared feedback |

The original review reproduced a balanced two-to-two pattern clearing the final claim gate, opposing choices appearing as support, and a synthesis prompt interpreting missing evidence as broad taste. Keep those regression cases even though the October 10 repair addresses those paths. Separate evidence and result-generation paths remain open work.

### 14 1 October 10 implementation update

Source checked: music-dna at b83f9a35233a71078204434eacdcffed29dcb50f. This is a source check, not proof of deployment or an accepted end-to-end experience.

| Area | Confirmed source change | Remaining acceptance or delivery |
| --- | --- | --- |
| Six-matchup copy | Landing and public share copy now say six | Verify rendered copy and other surfaces; see subsequent metrics update below |
| D01 final claim gate | Shared claims.ts helper uses 3 supports, 0.65 consistency, support greater than contradiction; 3–1 qualified, 2–2 ineligible | Apply through one ledger everywhere; enforce distinct valid pairing evidence and confound handling |
| Supporting examples | Final synthesis filters examples to the claim's direction | Trace support and counterevidence to immutable choice IDs |
| Thin evidence | No-pattern prompt and fallback no longer infer broad taste | Separate zero-answer, sparse, conflicting, missing-catalog, and generation-failed outcomes; review actual result copy |
| D02 consecutive skips | Shared completion rule stops after 3 consecutive skips at any stage; caller supplies recent choice/skip events | Verify event persistence, resume, reason rendering, and a real catalog-exhausted path |

Lovable reports the new claim and completion tests and existing suite pass. Source review confirmed the new tests exist; this documentation update did not independently rerun that suite. Lovable has not yet played the updated session end to end. Keep that review open before ACE web acceptance.

At this first-slice checkpoint, remaining work included the ledger, revisions, next-test hooks, reliability, result versions, sharing, contract, and mobile integration. The later update below supersedes the ledger/revision/hook/metrics status. Preserve the sequence of evidence and contract, reliability and persisted results, sharing, web acceptance, then Flutter parity. Mobile ticket preparation can continue throughout.

### 14 2 Subsequent source update before publication

The web source advanced again before publication, to 60381b0436f33a8802a2d19046ef0c0561c4e515. This later diff adds engine/evidence.ts with buildLedger, detectRevision, ledger-v1, and MIN_CONTRAST = 10. Running read and final reasoning now use the builder; final reasoning records ledger/policy metadata. New evidence tests cover 3–1, 2–2, missing values, duplicate pairing IDs, and revision detection. The roadmap reports chat consumes ledger claims and explicitly leaves public-card integration open.

The update also adds read_shown revision tracking, selected-pairing prompts in engine/prompts.ts, onboarding consumption of that prompt, and answered-round 2/4/6 stability checkpoints. New root AGENTS.md requires claims to use buildLedger/evaluateClaim, completion to use sessionCompletion, prompts to derive from the selected pairing, and revisions to use the prior read_shown event. Follow those instructions and extend the existing helpers.

These are source-confirmed advances, not full acceptance of DIA01, READ02, READ04, or MET02. Still verify immutable vote-time values and choice references, chronological finalization, valid declared axes, prompt neutrality before a vote, durable event order and resume, and deployed analytics/view compatibility. The builder currently falls back to all dimensions when tests are absent; reconcile that with the declared-test requirement. Tests in this later diff were inspected but not executed during this documentation task.

Remaining delivery includes public-card ledger integration, durable versioned results, distinct insufficiency outcomes, D04 self-report separation, atomic/idempotent mutations, full resume, catalog-exhaustion handling, explicit publish/revoke and legacy-link treatment, fixed challenges, the versioned experience contract/react endpoint/fixtures, and Flutter integration. Revalidate these statuses against subsequent work rather than rebuilding implemented helpers. A version string on a computed builder is not an immutable persisted session/result snapshot.

## 15 Acceptance and rollout

The release is accepted when the same controlled session produces the same pairing decisions, evidence ledger, allowed claims, result content, and continuation context on web and Flutter. Screens may use native platform controls, but the critic must express the same interpretation and uncertainty.

The implementation sequence is evidence and service repairs, corrected web experience, ACE web approval, Flutter parity, cross-client validation, then a release candidate using the existing distribution process. Documentation and code preparation may proceed before approval; the visual mobile reference must be the approved web revision.

Minimum acceptance includes stable, contradictory, sparse, zero-answer, artist-confounded, and unavailable-catalog sessions; deliberate reactions; resume after a committed-but-timed-out vote; account deletion; active and revoked share links; same-choice challenges; reduced motion; large text; keyboard-visible states; and smaller iPhone layouts. The build must not claim readiness while those material paths remain unresolved.

## 16 Decisions and scope controls

| ID | Decision | Direction | Status and remaining work |
| --- | --- | --- | --- |
| D01 | Common claim policy | Supported tendency needs at least 3 distinct supporting pairings, consistency at least 0.65, and support exceeding contradiction; 2 supports stays provisional | Accepted; helper and running/final ledger integration implemented; public-card integration and complete acceptance pending |
| D02 | Skip bound after meaningful progress | End after 3 consecutive skips regardless of answer count; retain existing early skip rule and distinct catalog exhaustion handling | Accepted; consecutive-skip rule implemented, end-to-end behavior and catalog-exhausted path pending |
| D03 | Existing public links | Explicit publication and revocation for new shares; a token's existence does not make a reading public; inventory legacy links before migration | Accepted direction; implement lifecycle and document the inventory-based migration treatment |
| D04 | Chat and diagnostic scores | Preserve original pairing ledger and result; store conversational evidence separately and version any subsequent read | Accepted; separate self-report and result versioning remain to implement |
| D05 | Performance budgets and pilot thresholds | Use Section 12 budgets and collect baseline before setting business conversion targets | Validate on representative devices and hosting |
| D06 | Retention and account linking | Adopt d06-v1: abandoned anonymous 30 days inactive, completed anonymous 90 days inactive; registered until deletion; debug 30 days, content-free operational metadata 90 days; verified explicit linking; immediate access denial and active purge within seven days | Policy decided October 10; implementation/verification pending; backup expiration needs operator inventory. See [decision record](parity-decisions-v1.md). |

No new streaming integration, cross-lane probe rollout, taxonomy expansion, billing, or broad engine redesign should be bundled into parity. An exact API shape can evolve during implementation if the product requirements and released-client compatibility remain satisfied and the contract document changes with it.

## 17 Source register and traceability

Latest pre-publication source cutoff: https://github.com/acedge123/music-dna/commit/60381b0436f33a8802a2d19046ef0c0561c4e515. Reviewed the intervening diff, including AGENTS.md, evidence builder/tests, revision and prompt integration, checkpoint changes, and roadmap status; no test run or deployment check.

The product baseline is the acedge123/music-dna repository at commit d20d0d4687b1ecd9bd0863d33a106aa9b9862c67, dated September 8 2026 UTC. Current deployed behavior and live catalog contents must be verified as part of implementation acceptance.

- Original MusicDNA concept discussions from June and July 2026, recovered for the October 10 comparison.
- 01-Music-DNA-Lovable-Web-Brief.md, September 8 2026, and 02-Music-DNA-Codex-Flutter-Parity-Brief.md, September 8 2026. These establish the web-first approval sequence and intended parity.
- docs/musicdna/positioning_one_pager.md and project_learnings_v1.md establish the choice-driven product thesis.
- docs/musicdna/intelligence_layer.md, prior-weighting.md, archetype-bible.md, and product_gotchas.md establish evidence and ontology constraints.
- src/lib/musicdna.functions.ts and src/musicdna/engine contain the reviewed live code paths and calculations.
- src/routes/onboarding.tsx, me.tsx, s.$sessionId.tsx, and _authenticated/profile.tsx define the web experience.
- src/routes/api/v1 in music-dna defines the reviewed transport. The original apps/mobile review used the copy in that repository; active Flutter implementation is in idea-builder/apps/mobile.
- .lovable/plan/make-the-first-session-feel-like-a-real-critic-conversation-2026-09-08.md records the September web plan; planned items are not assumed implemented.
- .lovable/plan/gap-review-musicdna-product-requirements-v1-0-vs-current-bui-2026-10-10.md records accepted D01–D04 and the current work sequence. roadmap.md records Lovable's completed first slice.
- October 10 source follow-up at b83f9a35233a71078204434eacdcffed29dcb50f checked claims.ts, claims.test.ts, completion.test.ts, pairing.ts, musicdna.functions.ts, and the two copy changes. Lovable's test-pass and no-manual-session statements are implementation-owner reports.
- Agent Brain source: https://github.com/The-Gig-Agency/agent-brain/tree/4cf8a1261fde31cab1b45696d0f2e6b1a739bb91. Checked README.md, docs/architecture-guardrails.md, docs/integrations/musicdna-integration-plan.md, the older musicdna-agent-brain-analysis.md, the MusicDNA integration README/entry point/recommender, and the shared golden fixture. Compared with music-dna's local router, call-site routing modes, integration plan, and fixture; no router suite or deployed-mode check was run.

Repository source: https://github.com/acedge123/music-dna/tree/d20d0d4687b1ecd9bd0863d33a106aa9b9862c67

Version 1.1 mobile source correction: https://github.com/acedge123/idea-builder/tree/9d533b37b7cf66c2aa95e9fd9b1fcb7ec8261368/apps/mobile. The observed branch was codex/tga-281-mobile-web-parity. This targeted source check confirmed the Flutter project and inspected its session Cubit; it was not a full mobile re-audit or a deployed-build test. ACE reported ongoing parity-ticket preparation while Lovable completes the web work.
