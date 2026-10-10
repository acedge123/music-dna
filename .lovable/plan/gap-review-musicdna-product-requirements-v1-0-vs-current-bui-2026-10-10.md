# Gap review: MusicDNA Product Requirements v1.0 vs. current build

Short answer: **the web interview experience is close (roughly 60–70% of the P0 web items). The evidence system, sharing lifecycle, reliability, and everything on Flutter are not close.** The spec's ordering is right: fix evidence and sharing, get ACE web approval, then port to mobile.

## Done or mostly done (web)

- ENT01 / ONB01–03: anonymous start, three ranked songs, reactions, automatic move into pairings.
- DUE01: curator notes (`why_good`, hypothesis) are removed before pairings reach the client.
- DUE02 (partial): the winner lights up and the loser dims instantly; pending state exists.
- DUE05 (partial): skip exists and never touches scores.
- DUE06 (partial): one shared stopping rule on the server (6 answered cap, early stop at 4+, skip stop at 3 skips with 2 or fewer answers).
- READ01 (partial): early picks get specific observations instead of "Still listening"; the middle rounds get a hedged thread; direction chip (forming / holding / contested / revising).
- REA01 (partial): That's me / Not quite / Harder buttons exist and steer the next pick without counting as votes.
- RES01 / RES02 (partial): automatic result, headline-first, Push back and Share buttons.
- RES06: web result feedback (accurate / partly / missed) already exists.
- LEG01, admin: 1980s route and admin tools are intact.

## Gaps, by severity

### Correctness blockers (spec calls these "source-confirmed defects")
1. **DIA01 single evidence ledger.** The running read, final result, chat, and public card each build evidence their own way. No versioned ledger with per-choice records.
2. **DIA03 / D01 claim policy.** The current gate is "3 supporting, 0 contradicting" in one place and looser in the final synthesis. A 2-vs-2 split can still clear the final gate. The spec wants 3 distinct pairings, consistency of at least 0.65, and support greater than contradiction.
3. **Supporting examples can include opposing choices** (final synthesis).
4. **RES03 honest insufficiency.** The synthesis prompt still reads no patterns as "refused to collapse / broad ear". The spec forbids treating thin evidence as broad taste. It also needs separate outcomes for zero answers, sparse, conflicting, catalog missing, and generation failed.
5. **CHAT02 / D04.** Web chat on the reading page can still change the diagnostic vector based on text the model pulls from chat. The spec wants that kept separate and versioned.
6. **READ02 real revisions.** "Revising" is now computed from evidence, but it doesn't store the previous claim, the new evidence, and the changed interpretation.
7. **READ04.** The hook isn't guaranteed to match what the next pairing actually tests.

### Reliability
8. **DUE07 / ARC03 / NFR04 idempotency.** There's no mutation ID on choice or skip. Double taps and retries depend on luck plus database constraints. There's no atomic choice + vector + progress write.
9. **NFR01 / READ03 resume.** Resume restores the last state, not the full chronological exchange history.
10. **DUE04 progress label.** It needs to show answered / max from the server everywhere. Check that skips can't produce "Round 8 of 6".
11. **DUE06 / D02.** There's no rule for 3 consecutive skips after real progress, and no separate "catalog ran out" completion reason.

### Sharing and results
12. **SHR01 / SHR05 / D03.** Sharing isn't explicit opt-in publication, owners can't revoke, and some links use the session ID while others use the token.
13. **SHR04 same-choice challenge.** Nothing stores a share's pairing set, and recipients can't replay it as a fixed sequence. Today "Try these choices" is just a generic new test.
14. **RES04 / DIA07 stable snapshot.** There's no result version, policy version, or engine version saved with the result, and later chat could change what a shared link shows.
15. **SHR02.** Audit the public payload: no raw vectors and no private data.

### Copy
16. **ENT02.** The landing page metadata says "Twenty song matchups". The public share page says "Sixty matchups". Both should say six.
17. **MET02.** Analytics still expect rounds 8 / 10 / 12 / 14.

### Mobile contract (ARC02)
18. These aren't built yet: the versioned contract opt-in (`x-musicdna-experience: 1`), the server-recorded `POST /session/:id/react` reaction endpoint (steer is currently only a query hint on `/next`), `docs/musicdna/experience-contract-v1.md`, and fixtures for stable, contradiction, sparse, zero-answer, and artist-confounded sessions.

### Flutter (all P0, deliberately not started until web approval)
19. Feedback while a pick is processing, the running theory, reactions, automatic result (it still has a manual Generate button), follow-up chat, result feedback, share token, native share sheet, challenge flow.

### Not yet assessed
- DIA06 confounds (artist, era, repeated song), VOI04 checking that the AI's copy only cites real songs and choices, UX03 accessibility (keyboard, announcements), MET01 event vocabulary, ACC02 checks that deleted data can't still be read with an old login.

## Decisions (ratified by ACE)

- **D01 claim policy:** at least 3 distinct supporting pairings, at least 0.65 directional consistency, and more support than contradiction. A 3–1 pattern supports a qualified claim. A 2–2 split cannot. These are editorial thresholds, not validated probabilities, and the copy must never present them as probabilities.
- **D02 skips:** 3 consecutive skips end the session at any stage. The existing early-skip rule stays. The result says plainly whether the session ended because songs weren't recognized or because the catalog ran out.
- **D03 links:** new shares require explicit publish and allow revocation. Legacy links get inventoried first. A token existing does not make a reading public.
- **D04 chat:** the original pairing evidence and result are frozen. Chat refines the interpretation through separately recorded self-report, which produces a new result version.

Guiding principle: the critic should get more interesting as evidence accumulates, and more thoughtful when challenged.

## Sequence

0. **Immediately:** fix the "Twenty" and "Sixty" copy and re-point the round-number metrics.
1. **Evidence and contract:** build one versioned ledger and apply the D01 policy everywhere (running read, final result, chat context, public card). Add honest insufficiency outcomes and examples that match their claim. Add hooks that match what the next pairing tests, and revisions that record the prior claim and the new evidence. Then build the versioned experience contract, the react endpoint, the contract doc, and fixtures (stable, 3–1 qualified, 2–2 mixed, sparse, zero-answer, artist-confounded, catalog-exhausted).
2. **Reliability and persisted results:** mutation IDs on choice and skip with replay, atomic writes, full history on resume, the D02 skip rule, and a catalog-exhausted reason. Save each result with its result, policy, and engine versions. D04 chat self-report gets recorded separately and produces new versions.
3. **Sharing and challenges:** D03 explicit publish and revoke, token-only links, legacy link inventory, a saved pairing set, a fixed-sequence challenge with a label, and a neutral "unavailable" state.
4. **Web acceptance:** ACE reviews on a small phone, with reduced motion and large text.
5. **Flutter parity.**
