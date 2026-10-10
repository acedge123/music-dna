# Agent rules

- Every claim about a listener (running read, final reasoning, chat context, share card) derives from `buildLedger` in `src/musicdna/engine/evidence.ts` and `evaluateClaim` in `claims.ts` — so no two surfaces can disagree about what the choices show.
- Session completion is decided only by `sessionCompletion` in `src/musicdna/engine/pairing.ts`; clients trust the server's `done`/`stop_reason` — so web, REST and Flutter stop identically.
- The "next question" prompt is generated from the pairing actually selected (`engine/prompts.ts`), never from the prior read — so the critic can't promise a test the next matchup doesn't run.
- Revisions are detected against the last `read_shown` event in `event_log`, not by comparing top axes client-side — so "revising" always means the evidence moved.
- `/api/v1/*` opt-in contract v1 via `X-MusicDNA-Experience: 1` (shapes in `src/routes/api/v1/-experience.ts`, spec in `docs/musicdna/experience-contract-v1.md`); without the header routes return v0 — so shipped Flutter builds never break.
- Picks are replay-safe: the committed feedback is stored on `choices.response` and returned on retry; a different song for the same pairing is a 409 — so retries can't double-count.
- Results are saved in `session_results`; version 1 (source `pairings`) is frozen and replayed verbatim, chat only adds `chat_self_report` versions and never writes `sessions.vector` — so shared readings never change underneath anyone.
