# CGPT interview repair — 2026-11-10

## Evidence diagnosis

The reported Electronic interview `a9ede1aa-632d-467a-92a8-2f4107b1b0c5` contains six bound `choice-evidence-v1` snapshots. Its first two votes (Star Guitar/Hyperballad and Teardrop/Firestarter) froze **empty declared tests** before the catalog repairs. Only four votes contain tests. Those two snapshots are not corrupt: they cannot support diagnostic claims. No current catalog data was substituted, and no saved evidence/result was rewritten. There are also 140 older `v:1` snapshots that do not meet the verified contract; they remain unavailable to inference.

## Repairs

- Home Start explicitly bypasses implicit resume. Active session IDs are pinned in the interview URL for refresh and Back. The result offers Start new interview. Explicit session resume now accepts a newly created zero-choice QA session.
- Registered admins can create a new **owner QA** interview atomically with a private purpose tag. This uses their existing opener profile, preserves previous readings, and does not imply independent synthetic provenance, consent, enrollment, or export permission. The button deliberately says New QA interview rather than falsely labeling a human administrator's answers synthetic.
- Five listener diagnostic views exclude tagged QA. Ontology, shadow-router summaries, and residual queues also exclude these sessions. Critic QA retains their private measurements for inspection. QA final synthesis does not replace the account's opening hypothesis. No export, routing, pilot, capture, or dispatch flags changed.
- New archetype assignment and all profile session labels require an eligible frozen-ledger claim. Existing stored results stay untouched. Completed finalization replays its saved reasoning/interpretation instead of regenerating it on each return.
- Shared critic expression/review is v2.2. Chat fallback no longer quotes the prompt: it explicitly reports failure and, where possible, names a verified past contrast without inferring motive. Full prompt echoes are rejected before semantic review with `prompt_echo`. Existing durable replies replay unchanged. Existing local per-stage quality attempts retain rejection reason and reviewer checks; no additional export was introduced.
- Post-choice sayings remain supplied only from revision-matched frozen editorial evidence. No pre-choice test disclosure or backfill.

## Verification

- Fresh preview Electronic interview: three openers, six votes, six snapshots with declared tests, authored running reads, saved version 1, a non-echo authored chat answer, version 2, exact transcript restored on reload, Back URL bound to the original interview, then Home Start returned to a fresh first-song screen. Desktop and 390px mobile inspected; no horizontal overflow or browser runtime errors.
- Snapshot readback confirms the reported older interview has four tested votes out of six, versus six of six in fresh acceptance session `660bd9b1-f22d-499d-ae80-9378a0037775`.
- All 75 focused evidence, expression, replay, quality, and conversation regressions pass; changed-file lint and preview build pass. The current-read test double was corrected to distinguish diagnostic inserts from engine events; it previously counted both as read events.
- QA tag/creation migrations applied; two introduced access warnings were corrected. 44 pre-existing security notices remain separate. The QA creation function is service-role-only and also checks the specified owner's admin role; the server verifies registered admin identity before loading the privileged client.

## Remaining acceptance

Registered-admin UI and cross-user hosted acceptance cannot be executed with the externally managed browser authentication available here. Production HTTP reachability is not proof of the deployed revision; the updated Vercel deployment and authenticated production flow remain unverified. No production serving SHA or public V1 acceptance is claimed.

Broader measurement recovery, independent retests, cross-session bias analysis and human voice scoring remain the existing separate work, not completed by this repair.