# Test: one Sol call writing both possible reactions

## Goal
Find out whether asking Sol for both reactions (one per song) in a single request, then reviewing both, keeps the voice while cutting cost and making reactions ready the moment the listener picks. This is an offline test only. The live critic stays the same.

## What we compare
Use the same recent frozen interviews as the Sol vs Terra test, picks 1–4.

| Arm | Writer | Review |
|---|---|---|
| A. Current | One Sol call for the song actually picked | Terra, current rules |
| B. Two separate | Two Sol calls in parallel, one per possible pick | Terra reviews each one |
| C. Combined | One Sol call returning both reactions, labelled by song | Terra reviews both in one call, judging each separately |

Every arm uses the same model settings, evidence, rules, v2.4 examples and reviewer. Only the request shape changes.

## Guardrails for arm C
- Each reaction may only use evidence for its own song choice. A reaction must not refer to the other one ("unlike if you'd picked…").
- Each reaction is approved or rejected separately. If one fails, only that one is rewritten.
- The pairing saying is still shown only after the pick, never before.

## What we measure
- First-pass approval for each reaction, plus the reasons for rejections
- Voice: blind side-by-side sheet for you/CGPT (A vs C for the picked song), plus a quick AI rating marked as a rough guide
- Sameness: how much the two reactions in one combined call echo each other (same openings, same structure, mirrored lines)
- Speed: time from the start of the request until both reactions are approved (median and slow-case)
- Tokens: input and output per finished pick, for each arm

## Decision rule
Keep C if, compared with B:
- approval is no more than 3 points lower,
- the blind voice ratings are not worse, and
- the two reactions don't noticeably mirror each other.

Otherwise, if we still want reactions ready before the pick, B is the fallback.

## Deliverable
A report and blind sheet in Files (critic-pair-gen-test). No live changes. Moving anything live is a separate step that needs your approval.

## Technical notes
- Offline script reusing the existing writer/reviewer adapters and frozen evidence snapshots. Arm C uses a strict schema with two items keyed by song ID, checked against each song's allowed references.
- Small sample (about 24 matchups × 3 arms). Workspace credits limited earlier tests, so the script saves partial results as it goes.
