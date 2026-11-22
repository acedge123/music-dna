# Final report speed + listener conclusions — proposal for discussion

Status: **proposal only, nothing implemented.** For owner, web and Flutter review.
Trigger: Flutter final report reported at 90–120 s; readings feel like dimension
reports with too few conclusions about the listener.

## 1. Have we already tried "start writing at pick five"?

No. History checked (`git log`, `prepareReadsImpl`, `prepared_reads`):

- What exists: **post-pick read pre-drafting**. While a pairing is on screen the
  server can draft the short Critic read for *each* of the two possible picks
  (`POST /session/:id/prepare`), reused only on an exact `readFingerprint`
  match. Commit `e0fdaa6` ("Prepared second reading ahead") extended this to the
  second read.
- On pick six we deliberately **skip** the interim read (commit `541959b`).
- The **final reading** (`finalizeSessionImpl`, result v1) is written only after
  pick six is saved: Sol writer (`reasoning_effort: medium` for reveal) → Terra
  reviewer → on rejection one automatic rewrite (`db29313`). Nothing is drafted
  earlier.

## 2. Where the time likely goes (to be measured, not yet measured)

| Step | Rough cost | Notes |
|---|---|---|
| Sol writer, medium reasoning, full structured reading | 30–60 s | Largest single cost |
| Terra reviewer | 10–25 s | Sequential |
| Rejection → rewrite → review | +40–80 s | Doubles the wait when it happens |
| Flutter waiting/polling | unknown | Report may be saved before the app notices |

First step before building anything: time 5 real Flutter runs per stage
(writer, reviewer, retries, saved-at vs shown-at). The 90–120 s pattern smells
like "one rejection + slow poll".

## 3. Speed options

### A. Pre-write the final for both pick-six outcomes (recommended, biggest win)
When pairing six is **shown**, only two picks are possible (plus skip). Like
`prepared_reads`, draft and review *both* final readings in the background while
the listener deliberates (typically 10–30 s, plus four quip beats after).
- On pick: if the frozen ledger fingerprint matches a reviewed draft, save it as
  result v1 instantly (same atomic save, same evidence, same reviewer gate).
- On mismatch, skip, or draft not ready: fall back to today's path — no worse
  than now.
- Cost: two writer+review passes per finished session (~2× final-report spend);
  the unused one is discarded, never shown.
- Does not change routing, scoring, frozen evidence or claims.

This is the "start at five, update at six" idea, made safe: rather than
*editing* a draft after pick six (which risks stale claims), we pre-write the
complete answer for each possible pick six.

### B. Cheaper/faster generation
- Reveal `reasoning_effort` medium → low (A/B the voice first; owner judges).
- Tighten output length; fewer, sharper sections.
- Keep reviewer but on low effort (already) and capped output.

### C. Fewer rejections
Log rejection reasons per field for 2 weeks; fix the top prompt/schema causes.
Each avoided rewrite saves ~40 s.

### D. Flutter waiting
Poll the saved report every 2–3 s (or GET reveal after each Overtime beat)
instead of holding one long request; display as soon as v1 exists.

### E. Hard ceiling
Set a 45 s product deadline for the write-up. If not reviewed by then, show the
deterministic sections plus a clear "the full verdict is still being written —
it'll be here, and saved to your profile" state, and keep the job running
server-side. Never leave the listener on an endless spinner.

## 4. Chunked report — the owner's concern

Concern: showing Archetype + receipts first, then the write-up still takes two
minutes, and listeners leave before the part that matters.

Position: **don't chunk as the primary fix.** Chunking hides latency; it does not
remove it, and it front-loads the least interesting parts. Recommended order:
1. Ship A (+C, D) so the full reading is usually ready at, or seconds after, the
   pick-six quips.
2. Only then consider staged display, and only with a guarantee: the write-up
   arrives within the E deadline or the screen says plainly it's coming and is
   saved. Staged display must never be the default experience of a slow report.
3. If staged, lead with the **verdict line** (one sentence, the hook), not the
   Archetype card or receipts — the Critic's opinion is the product.

## 5. More conclusions about the listener (content)

Readings currently describe preferred dimensions. Proposed additions, all
derived from `buildLedger` / `evaluateClaim` (no new unsupported claims):

1. **"What this says about you"** — 2–3 short conclusions phrased as a critic's
   hunch, extending a trait into life ("Witness over Experience: you trust people
   who show up over people who explain"). Guardrails: hunch language, tied to
   cited picks, no health/relationships/politics/sensitive inferences, not
   horoscope-generic.
2. **"If you like that, try…"** — 1–2 catalog songs strong on the listener's top
   supported trait, in lane, soft era fit, not already shown. Chosen
   deterministically (no model time, always real songs), with one line why.
   Ties to the parked Archetype-recommendations idea.
3. **One provocation** — a single "tell me I'm wrong" line to start chat
   (supports the keep-talking metric).

Frozen readings stay unchanged; new fields appear only in new versions. Flutter
gets them via the same reveal contract (additive, behind the experience header).

## 6. Flutter questions

1. How does the app wait today — single request, polling interval, timeout?
2. Can it render a "still writing, saved to your profile" state and recover on
   next open?
3. Any objection to additive reveal fields (`conclusions[]`, `try_next[]`,
   `provocation`)?

## 7. Proposed sequence (pending discussion)

1. Measure 5 Flutter runs (no code changes).
2. A + D (+C from logs).
3. Content additions (§5), reviewed with real readings.
4. Revisit chunking only if p90 is still > 20 s.
