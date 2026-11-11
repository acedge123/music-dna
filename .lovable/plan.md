# Rescue the final reveal: let approved Sol writing reach the listener

Agree with the diagnosis: Sol's reveal was good; it was discarded by a formatting rule before the accuracy reviewer (Terra) saw it, and a generic backup was shown instead. Keep evidence checks, Terra review and the emergency backup. Fix the plumbing, not the voice.

## Changes

1. **Citation limit matches reality**
   - Let a reveal claim cite every supporting choice it uses (up to the six answered picks), not a hard cap of three.
   - Make the format sent to the AI provider declare the same limit as the app's own checker, so the two can never disagree again.
   - Still reject citations to picks, songs or traits that don't exist.

2. **Format problems get repaired, not discarded**
   - Mechanical issues (too many citations, a missing optional field, extra whitespace, malformed wrapper) are fixed automatically when the meaning is unaffected — e.g. trim duplicate citations, keep valid ones.
   - Only unrecoverable format failures (invented IDs, missing core text) trigger a rewrite.
   - The repaired draft then goes to Terra as normal. Terra's accuracy rules are unchanged.

3. **Final reading uses approved writing**
   - If an approved Sol narrative exists, the finished reading must include it.
   - The backup is used only when no approved writing exists, and is labelled as backup in the trace so we can count it.
   - A prepared backup is never reused as if it were approved writing.

4. **Trace clarity**
   - Background Draft Timeline shows, per reveal: approved / repaired-then-approved / Terra-rejected / backup, plus the reason.

## Not changing
- Sol / Terra models, voice prompts, Terra's accuracy rules, counts in receipts, frozen saved readings (old readings stay as saved).

## Verification
- Tests: a four-citation draft passes; an invented-ID draft is still rejected; approved narrative always appears in the assembled reading; backup only when nothing is approved.
- Replay session `38bfec2b…`'s saved Sol draft through the new checks offline and confirm it reaches Terra.
- Then one live ChatGPT run with a normal (~10–20s) pause on pick 6, checking both voice and wait time.

## Technical notes
- Align `maxItems` on reveal citation arrays in the provider JSON schema with the local validator in the critic output checker.
- Add a deterministic normalize step before the reference/schema check; record `repaired: true` on the quality attempt.
- In reveal assembly, prefer the approved narrative from the prepared/live attempt; mark `prepared_reads` outcome `fallback` distinctly from `approved`.
