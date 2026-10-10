# Agent rules

- Every claim about a listener (running read, final reasoning, chat context, share card) derives from `buildLedger` in `src/musicdna/engine/evidence.ts` and `evaluateClaim` in `claims.ts` — so no two surfaces can disagree about what the choices show.
- Session completion is decided only by `sessionCompletion` in `src/musicdna/engine/pairing.ts`; clients trust the server's `done`/`stop_reason` — so web, REST and Flutter stop identically.
- The "next question" prompt is generated from the pairing actually selected (`engine/prompts.ts`), never from the prior read — so the critic can't promise a test the next matchup doesn't run.
- Revisions are detected against the last `read_shown` event in `event_log`, not by comparing top axes client-side — so "revising" always means the evidence moved.
