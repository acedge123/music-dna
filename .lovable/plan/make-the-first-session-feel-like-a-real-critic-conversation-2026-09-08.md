# Make the first session feel like a real critic conversation

## My read on the brief

Most of it is right and buildable in one pass. Three things I'd push back on:

1. **"Six answered matchups" and the backend stop rule disagree.** The web screen hard-stops at 6 rounds; the engine only stops when round >= 6 **and** 60% of axes are confident. On a wishy-washy session the engine wants to keep going forever. One policy, owned by the engine: stop at 6 answered, or earlier if the read is already strong — and stop honestly if skips pile up.
2. **The "arc" should be earned, not scheduled.** I'll shape pacing by round (opening → tradeoff → counterexample → resolution) but the claim thresholds stay: no trait talk without evidence, and a weak session gets told it was weak.
3. **Skip the full friend-comparison and streaming work**, as the brief says. Sharing stays a polished card plus "try these same choices".

## What changes for the person using it

- After each pick, the winner lights up instantly and the loser dims — then a short, specific line about *that* choice, and a nudge toward the next one.
- No more "Still listening. Too early to call." for the first four rounds. Early rounds get a concrete observation or an open question instead of filler.
- The critic visibly changes its mind: a small marker for a theory forming, holding, or being revised, tied to actual evidence changes.
- Optional reactions at the right moments: "That's me", "Not quite", "Give me a harder one". Disagreeing changes what comes next; it never counts as a song vote.
- Unknown song? Skipping is free and never scored. Skip a lot and you get an honest short result instead of an endless hunt.
- The result leads with one sharp sentence, two real choices that back it up, and one loose end. Then: Push back · Share this read · Try these choices.
- Motion is short and skippable, and respects reduced-motion settings.

## Technical plan

**1. One completion policy (`src/musicdna/engine/pairing.ts`, `src/lib/musicdna.functions.ts`)**
- Extend `shouldStop` to a single `sessionCompletion({ round, answered, skipped, vector, dims })` returning `{ done, reason: "confident" | "budget" | "skip_bound", confidence }`.
- Rules: `answered >= 6` → done; `answered >= 4 && confidence >= 0.6` → done (early strong read); `skipped >= 3 && answered <= 2` → done with `reason: "skip_bound"`.
- `nextPairingImpl` returns `round`, `answered`, `max_rounds`, `done`, `stop_reason`. Web deletes its local `MAX_ROUNDS` gate and trusts the server.

**2. Ungate the running read (`currentRead` in `src/lib/musicdna.functions.ts`)**
- Replace the `round < 5` bail-out with tiered output: rounds 1–2 return a per-choice observation derived from the just-scored pairing's tradeoff (no trait claim); rounds 3–4 return a tentative thread plus a competing explanation; round 5+ returns the current thesis as today.
- Return `direction: "forming" | "holding" | "revising"` and `evidence: { supporting: number, contradicting: number, examples: string[] }` computed server-side from choices, so `revising` means the evidence moved — not that a different axis happened to top the list. Web stops inferring direction from `prevTopDim`.
- Never include `why_good`, axis names, or expected answers in any payload the client sees pre-choice (audit the `nextPairing` select — currently `why_good` is fetched; drop it from the response shape).

**3. Onboarding screen (`src/routes/onboarding.tsx`)**
- Optimistic pick state already dims the loser; add the two-step reveal (mark → observation → hook) with a single skippable timing pass and a `prefers-reduced-motion` short-circuit.
- Render `hook` (currently stored, never shown) as the transition prompt, replacing the `ROUND_PROMPTS` rotation. Render `direction` as a small eyebrow chip.
- Add a reaction row (`That's me` / `Not quite` / `Give me a harder one`) shown from round 2 on. Each records an event and sets a `steer` hint sent with the next `nextPairing` call: `not_quite` → prefer a pairing that tests the same axis from the other side; `harder` → raise the difficulty/lower recognition floor. Never writes to the vector.
- Keep the active exchange in view with prior rounds collapsed into a compact history list.

**4. Result surface (`src/routes/onboarding.tsx` done phase, `src/routes/me.tsx`)**
- Restructure `finalSynthesis` output into `{ headline, evidence: [two choices], tension, confidence_note }`; when evidence is thin, `headline` says so plainly instead of reaching for "eclectic".
- Primary actions: Push back · Share this read · Try these choices yourself (share link carries the pairing set, not the conversation). Full analysis moves behind a secondary disclosure.

**5. Shared contract for the mobile handoff (`src/routes/api/v1/`, `docs/musicdna/`)**
- Add `x-musicdna-experience: 1` opt-in versioning. Without the header, `/next`, `/choice`, `/reveal` return today's shapes (shipped Flutter keeps working). With it, they return the enriched fields: progress (`answered`, `max_rounds`, `stop_reason`), choice feedback, running theory + evidence, next prompt, final synthesis, disagreement, share payload.
- New: `POST /api/v1/session/:id/react` for the disagreement/harder signals, mirroring the web steer hint.
- Write `docs/musicdna/experience-contract-v1.md` — field-by-field, with which screen consumes what — and record fixtures under `fixtures/musicdna/` for a stable pattern, a contradiction, and an insufficient-evidence session.

**6. Verification**
- Unit tests for `sessionCompletion` (budget, early-confident, skip-bound) and for `currentRead` tiering/direction.
- Extend `src/routes/api/v1/e2e.test.ts` to drive both contract versions, plus retry-after-timeout and double-submit to prove no duplicate votes.
- Playwright pass at small-phone width capturing key states (opening, post-pick reveal, revision, skip-bound result, strong result).

## Out of scope this pass

Flutter changes, streaming, catalog expansion, scoring redesign, friend comparison.
