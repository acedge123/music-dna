# Flutter handoff: six-pick pacing + Overtime

Updated 19 November 2026. Web reference: `src/components/musicdna/critic-stage.tsx`, `src/lib/critic-wait.ts`, `src/lib/quip-sequences.ts`; shared copy: `src/musicdna/engine/critic-fillers.ts`.

## Load and cache the shared copy

`GET /api/v1/critic-fillers` with `X-MusicDNA-Experience: 1` returns the existing `contract: 1`, `version: "fillers-v1"`, neutral, reaction, nested person, decade and skip fields unchanged, plus:

- `pacing_version: "six-pick-overtime-v1"`
- `interval_ms: 2500`
- `pick_patterns`: keys `"1"` through `"6"`, category arrays from the table below
- `overtime`: twelve ordered standalone lines (the two initial examples plus ten approved follow-ups)

Refresh once per app launch and keep a bundled fallback. Existing clients can ignore additive fields; they will keep their old pacing until their presentation is updated. This is not a new interview flow and does not enable any server flags. Flutter implementation is a separate client change, not included in this web repository.

## Exact category order (both saved interview flows)

| Answered pick | Category order | Maximum primary beats |
| --- | --- | --- |
| 1 | Neutral | 1 |
| 2 | Reaction → Person | 2–3 |
| 3 | Reaction | 1 |
| 4 | Neutral → Reaction → Person | 3–4 |
| 5 | Neutral | 1 |
| 6 | Neutral → Reaction → Person → Overtime **only while final writing** | 3–4 + 12 |

Person is one complete group: either a standalone or setup → punchline. Never flatten/shuffle the person library. Current indexed choices give three beats after pick 2 and three after picks 4/6; counts above accommodate other compatible groups. Do not insert decade lines or replace Person with era decoration. Decade fields remain available for older clients.

Use answered choices, never served rounds or skip counts. Opening (`wait = 0`) stays one neutral beat. Capture the pending pick number on tap (`answered + 1`), title and exposed-line set once, so saving the vote cannot increment/restart the wait. If final writing starts after saved entries update, keep that same pending pick number; restore/retry uses the actual saved answered count. Four-choice early finishes and skip/exhaustion finishes before six never use Overtime.

## Saving and selecting reactions

1. Hide the old matchup on tap. Show “You picked · {title}” and the first allowed category.
2. Save with `POST /api/v1/session/:id/choice` and `defer_read: true`. Keep the existing mutation/replay behavior.
3. Only the saved response supplies `hunch`: `against`, `with`, or `early`. A missing field on a successful old replay means `early`. Before that response, reaction-first picks **2/3 show an activity indicator, not an extra neutral line or an invented reaction**. Neutral-first picks can show their neutral while saving.
4. Index each pool by `wait % pool.length`, where `wait` is the captured answered pick number. Use actual lengths.
5. Preserve contradiction guards from `quip-sequences.ts`: if an earlier displayed reaction was `with`, downgrade a later `against` to `early` (and vice versa). “Taste. Actual taste.” / its surprise punchline cannot follow a confident `with` reaction. Otherwise Reaction → Person is allowed; do not suppress all person groups after confident reactions.
6. Track only actually displayed lines across the interview. Skip a complete group if either line was already displayed. Do not add a second reaction if the saved hunch arrives after a neutral has been visible; replace only the unseen tail.

## Timing and final waiting

- Each beat gets **2500 ms from actual display**. Late/doubled timers cannot cause catch-up bursts. Choice-save → read → final transitions never restart the opener.
- Category lists are ceilings, not mandatory delays. A ready read/report or next pairing normally replaces the wait immediately. **Exception: a started person setup must receive its punchline, and that punchline completes its 2500 ms beat before the ready screen replaces it.** Do not wait for any unstarted person group or Overtime line.
- Pick-six Overtime begins only after the primary Neutral → Reaction → Person sequence, and only when the final report is still pending. Play the twelve lines in source order, once each, at 2500 ms. Never recycle unrelated person, era or neutral pools to extend the final wait.
- Keep “Writing your full reading…” and an activity indicator active. After the finite Overtime pool, hold the last line with that indicator; never repeat or invent copy. These are jokes about waiting/the critic, not claims of extra analysis or unusual listener evidence.
- Existing retryable failures end the wait and show the saved-choice notice/Retry. No empty completed report, chat or sharing before a saved result exists. No new LLM calls, timeouts, scoring, routing, consent or result changes.

## Read delivery and saved flow (unchanged)

`per_pick`: request the current read and next offer as before; expose the read with the next pairing automatically, no extra “Next matchup” tap. Discard stale `answered`/`after_pairing_id` responses. Existing ~20-second read failure handling stays unchanged.

`checkpoints`: requests remain only at answered 2/4 plus final six. Picks 1/3/5 use their table category for the existing short between-checkpoint hold, then automatically expose the next offer. Checkpoint read and controls are exclusive; the next offer remains hidden until Continue. Optional four-choice finish remains server-owned.

Send `X-MusicDNA-Interview-Flow: checkpoints-v1` at creation only when the client supports checkpoints; trust the returned saved `flow`. On resume use owner-scoped `GET /api/v1/interview-flow?session=<id>`; retry failures, never substitute the current server setting. This pacing update does not change that opt-in or flag.

## Skips (unchanged)

One apology only; no Person, Reaction or Overtime. Both songs before 2000 → `skip_young`; both 2020 onward → `skip_old`; otherwise indexed `skip` with the shown artist substituted. No inferred age, retired “OK boomer” or “Music is in your blood.” Hide picked-song labels and don't increment answered picks.

## Acceptance checklist for Codex / Flutter

- [ ] Fresh six-choice run and resumed run use the table exactly, in both supported saved flows; no repeated displayed line.
- [ ] Delay `/choice` on picks 2/3: activity only until a saved hunch; no neutral flash and correct first reaction.
- [ ] Late hunch on 4/6: stable neutral, exactly one reaction, ordered person group; no clock reset.
- [ ] Ready result during a setup: punchline appears next and completes one beat; ready result during Neutral/Reaction/Overtime replaces it immediately.
- [ ] Delay pick-six final report: all twelve Overtime lines appear in order after the primary sequence, then hold with activity; no era/person recycling.
- [ ] Four-choice early finish, earlier exhaustion and skips never enter Overtime; retries do not restart already displayed copy in the same wait.
- [ ] Phone/desktop: fixed-height waiting area, no overlap with old matchup/checkpoint/report, no page errors.
- [ ] Confirm the deployed API includes `pacing_version`, `pick_patterns`, `interval_ms`, `overtime`; refresh bundled offline copy. Server API deployment alone does not update Flutter's sequence.
