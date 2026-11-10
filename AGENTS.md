# Agent rules

- Album artwork is optional release-specific catalog decoration shared by web and Flutter through `withPairingArtwork`; caller-scoped reads and documented rights/release verification gate display, and artwork never changes frozen evidence or routing.

- Web song choices use `SongCover` with a branded fallback; hosted cover URLs are absolute for external clients.

- The critic-first web stage keeps the active pairing and latest read primary; history and audit text stay secondary. Presentation may omit numeric parentheticals but never strengthen, fabricate or rewrite saved claims; full frozen content remains available.

- Every claim about a listener (running read, final reasoning, chat context, share card) derives from `buildLedger` in `src/musicdna/engine/evidence.ts` and `evaluateClaim` in `claims.ts` — so no two surfaces can disagree about what the choices show.
- `sessionCompletion` owns stops: optional listener exit after four, six by default; clients trust server completion.
- The "next question" prompt is generated from the pairing actually selected (`engine/prompts.ts`), never from the prior read — so the critic can't promise a test the next matchup doesn't run.
- Revisions are detected against the last `read_shown` event in `event_log`, not by comparing top axes client-side — so "revising" always means the evidence moved.
- `/api/v1/*` opt-in contract v1 via `X-MusicDNA-Experience: 1` (shapes in `src/routes/api/v1/-experience.ts`, spec in `docs/musicdna/experience-contract-v1.md`); without the header routes return v0 — so shipped Flutter builds never break.
- Public V1 is default-disabled by the server entry until deployed acceptance passes. Private acceptance additionally requires explicit acceptance mode plus the matching harness header; all normal bearer/ownership checks remain mandatory. This allows production verification without opening V1 to listeners.
- A pick's vote, feedback and score update commit in one DB call (`record_choice_atomic`, guarded by the prior vector; stale → recompute once) — so a crash can't save a vote without its score.
- Session history for any resume comes from `loadSessionHistory` (`src/musicdna/adapters/session-history.ts`) — so web and mobile restore the same conversation.
- Picks are replay-safe: the committed feedback is stored on `choices.response` and returned on retry; a different song for the same pairing is a 409 — so retries can't double-count.
- Results are saved in `session_results`; version 1 (source `pairings`) is frozen and replayed verbatim, chat only adds `chat_self_report` versions and never writes `sessions.vector` — so shared readings never change underneath anyone.
- Engine-driving event_log types (read_shown, pairing_skipped, reaction_submitted, self_report, choice_scored, archetype_ranking_snapshot, regime_recommended) are written only by the server via `trustedEventLog()` after an ownership check; RLS rejects them from listeners — so a listener cannot fake skips or revisions.
- Each pick freezes server-captured evidence on `choices.evidence` inside the atomic vote transaction; all ledger readers use `loadChoiceEvidence` (`src/musicdna/adapters/choice-evidence.ts`). Only valid declared tests count; historical rows without the verified snapshot contract never fall back to mutable catalog evidence.
- Public share lookups require `is_public`; publish/revoke go through `setSharePublication` (`src/musicdna/adapters/share-publication.ts`), and revoke rotates the token — so a token alone is never consent.
- Persistence rollout uses `MUSICDNA_BACKEND_PERSISTENCE_V2=1` only after the reviewed SQL is applied; it defaults off to protect GitHub auto-deploys before migration approval. The proposed transaction boundary owns feedback operations, leased chat recovery, atomic reply/revision completion and publication snapshots; public readers use the pinned snapshot, never mutable catalog/session content.
- Reactions go through `recordReactionImpl` (web `reactToRead`, REST `/react`), stored in `session_reactions` plus a trusted `reaction_submitted` event, failing loudly on write errors — so web and mobile share one durable contract.
- LLM calls go through `src/musicdna/adapters/llm-gateway.ts` only; it prefers `OPENAI_API_KEY` (Critic: `OPENAI_CRITIC_*_MODEL`) when set (Vercel) and falls back to the Lovable AI Gateway with `LOVABLE_API_KEY` otherwise — used in the Lovable preview.
- Chat turns go through `chatTurnImpl` (web `chatTurn`, REST `/api/v1/session/:id/chat`); a `mutation_id` makes a retried submit replay the saved reply, and `GET /chat` returns the transcript plus result versions — so chat is retry-safe and restorable on every client.
- Reveal never returns a `share_token`; sharing is an explicit `POST /api/v1/session/:id/share` publish/revoke (D03) — so finalizing a reading never implies publication consent.
- `/api/v1/*` production preflights use `V1_CORS_HEADERS`; Vite echoes localhost origins in dev, so differences are expected.
- Catalog batches keep versioned before/after data; `tools/musicdna/validate-catalog.ts` separates errors from activation-blocking review warnings. Numeric passes never imply prediction or approval.
- Coverage-only pairing batches preserve song scores and existing pairings, pin reviewed song values, and test lane/test validity plus selector reachability; coverage expansion must not silently rescore the catalog.
- Production runs on Vercel at `https://www.musicdna.fm/` (auto-publish from the GitHub repo); the Lovable preview is not production — verify API behavior against the live domain, and remember Vercel needs its own server env vars (`SUPABASE_URL`, `SB_SECRET_KEY`, `AGENT_TEST_HARNESS_KEY`), since Lovable-managed secrets do not propagate there.

- Learning export defaults off. V1 remains synthetic-only. AB-57 V2 permits explicitly consented, verified real QA accounts through the private consent RPC and matching production lifecycle scope; its trigger enrolls only future completed results. AB-45 captures minimal evidence in the existing feedback transaction; recovery maps only the frozen outbox projection. Never relabel real feedback as synthetic. Never infer enrollment from sharing/account/user_metadata, reread mutable catalog data for history, bypass lifecycle locks, or enable learning from a PR merge. See `docs/musicdna/learning-outbox.md`.

- AB-47 delivery runs only in the operator worker, with explicit --execute plus private default-false dispatch_enabled. Preserve stored bytes/UUIDs, single-use leases, tenant binding and validated receipt completion. Never use AGENT_TEST_HARNESS_KEY for export, clear your own credential halt, or mark dispatch/timeout as downstream success. See `docs/musicdna/learning-dispatcher.md`.

- AB-29 routing attribution uses only trusted served context frozen inside the vote and saved result. Keep `MUSICDNA_APPLIED_OUTCOMES_V1` default-off until its migration and separately approved pilot. Never trust listener-writable experiment_assignments, infer application from a shadow match/requested live mode, or reuse the claim-policy column as routing policy. Preserve unknown/mixed joins, measurement deadlines and source pins; see `docs/musicdna/applied-outcomes.md`.

- AB-52 uses operator-only consented invitations under `ab52.*` in existing experiment_assignments, two default-off pilot/instrumentation flags, and the pinned local selector. Never classify owner QA as an independent randomized cohort, infer consent, rebucket on resume, export human pilot feedback via the synthetic outbox, or record unavailable error/latency/cost counters as healthy zero. Separate AB-57 consent can authorize truthful V2 real-QA export; it does not alter AB-52 assignment, its original consent, or its experiment metric. See docs/musicdna/ab52-pilot-plan.md and docs/musicdna/real-qa-learning.md.

- Pairings activate only via the `pairings_activation_checks` trigger (mirrored in `engine/pairing-eligibility.ts`): ≥1 declared trait with ≥20-point contrast plus a specific unique saying; repairs never rewrite frozen evidence.

- Specialist genres are distinct top-level opener lanes shared by web and REST; exact catalog lanes precede legacy family aliases, so activation does not silently remap historical Alternative songs.


- Account UI consumes the root's single hydrated auth context; anonymous sessions remain guests, and shared sign-out cancels queries and clears cache before ending the session and replacing navigation, avoiding misleading sign-in flashes and stale private views.

- Fresh interview URLs bypass implicit resume; active IDs are pinned for reload/Back. Operator QA sessions are atomically tagged, excluded from listener diagnostics, and never imply synthetic export eligibility or pilot consent.
- Archetype assignment and profile presentation require frozen-ledger support; historical saved content stays immutable, and rejected chat generations must not echo the user's question.
- Interview URL pinning waits for restore completion and never carries an old session into fresh Start; bounded conversation waits preserve pending mutation IDs because a timeout does not prove a failed write.

- AB-57 hourly learning runs in a separate Railway operator service, with a source-bound automated queue endpoint and durable metadata receipts. Railway holds only narrow caller keys; backend/ingest credentials stay inside Supabase Edge Functions and outside EdgeBot/model context; preserve source/reviewer/consent gates, global $5/day reservations, no ambiguous inference retries and draft-only output. Queue/dispatch success is never completed model work. See docs/musicdna/ab57-automation.md.

- Completed-reading accuracy controls use the existing authenticated feedback write plus owner/version-scoped readback; show Saved only after matching the durable operation. Keep ratings optional, below the completed read, absent during song choices and on public shares, and reuse the per-reading/version operation key across retries/reloads.
- Post-pick reads are pre-drafted server-side and reused only on exact `readFingerprint` match; only approved stand-alone first-pick drafts enter `critic_reaction_pool`.
