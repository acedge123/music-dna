# Critic checkpoints (paired choices) behind one server flag

## What listeners will see (flag on)
1. Choice 1 -> short funny quip -> choice 2 appears automatically.
2. Choice 2 -> waiting quips -> Critic reply on its own screen (both choices considered, 2-3 sentences) -> **Next pairing** button.
3. Choice 3 -> quip -> choice 4 automatically.
4. Choice 4 -> Critic checkpoint #2 (uses all four choices, adds something new) -> two buttons: **Get my reading now** or **Keep going for two more**.
5. Choices 5 and 6 with a quip between, then the final reading as today.
- Optional pushback moves into both Critic checkpoint screens; the separate pick-3 link goes away.
- Quips keep their current list, timing and no-repeat rules.
- Skips never count toward checkpoints or the finish.
- Flag off = exactly today's behavior (Critic after every pick, six picks).

## Cost and speed
- Critic is written only after answered choices 2 and 4; no per-pick writing or pre-drafting otherwise.
- A four-choice reading is written only if the listener taps Get my reading; otherwise the normal six-choice reading. Same single write/review pipeline and frozen saved result.
- Next pairing is fetched in the background but stays hidden until the button.

## Reliability
- Picks save immediately as today (retry-safe). A slow/failed checkpoint shows Retry plus a Continue option so picks are never stuck.
- Reload/resume returns to the right checkpoint or next choice without rewriting the Critic reply.

## Technical details
- One env flag `MUSICDNA_CRITIC_CHECKPOINTS=1` (default off), read server-side; session records which mode it started in so mid-interview flips don't break it.
- Vote response gains `checkpoint: null | {index:1|2, state:'pending'|'ready'|'failed', read?, actions}`; checkpoint read persisted and replayed via existing deferred-read cursor/event log so resume and retries return the same text.
- Reuse existing early-completion path for "Get my reading" (server `sessionCompletion` allows 4 answered when mode = checkpoints); restores the dropped four-choice option only under the flag.
- Web: `src/routes/onboarding.tsx` + `use-interview.ts` stage machine (quip-transition, checkpoint, choice); pushback component moved into checkpoint.
- Update `docs/musicdna/experience-contract-v1.md`, Flutter handoff with requests/fields/states, fixtures; tests for counts with skips, 4- and 6-choice paths, retry/resume, and model-call counts (only at 2, 4, final). Memory note: pick-4 exit returns only under this flag.
- Pushed to main as usual; Vercel needs the flag set to try it.
