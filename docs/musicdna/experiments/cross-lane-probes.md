# Experiment: Cross-Lane Probe Flipping (quarantined)

**Status:** Quarantined. Not wired into `createEngine()` or any live server function.

**Code:** `src/musicdna/engine/experiments/cross-lane-probes.ts`
**Tests:** `src/musicdna/engine/experiments/cross-lane-probes.experimental.test.ts`
**Product invariant it violates:** `mem://product/within-lane-only.md`

## What it does

At scheduled rounds (originally 4, 9, 14), the session would silently inject a pairing from a *candidate lane* — one not equal to the user's current lane. Each such probe choice was scored for alignment (cosine of the choice delta against the running vector, plus signal magnitude). After enough aligned wins on the same candidate lane, the session's lane was **silently flipped** from, say, `alternative` → `electronic`.

## Why it's off

Two problems, one product-level and one UX-level:

1. **Cross-lane equivalence isn't claimed.** The current thesis scopes dimensions *within* a listener's lane. "Community" in Alternative is not the same construct as "community" in Country, so a probe that says "you resonated with an electronic pairing, therefore you're now electronic" overstates what the signal actually means.
2. **Silent flips are bad UX.** Even if the math were sound, the user should see the reframe ("your picks are pulling you toward X — want to follow it?"), not have their session quietly re-labeled mid-run.

The live path enforces the invariant explicitly in `nextPairingImpl` (`src/lib/musicdna.functions.ts`): if `probe_state.pending` is ever non-empty, the request throws. `evaluateProbe` is therefore unreachable from the shipping engine surface, and keeping it wired risked a future refactor silently reactivating it.

## Why it's kept

The math (per-choice cosine, magnitude-weighted tally, threshold-guarded flip) is defensible on its own and represents real calibration work. If cross-lane suggestions become part of the product, we want to start from this module rather than rebuild it.

## Reactivation criteria

Do NOT re-enable without **all** of the following:

1. **Product decision** to reintroduce cross-lane suggestions, with an explicit stance on whether dimensions are still lane-scoped.
2. **Calibration data** proving the flip thresholds (`win_cosine_threshold`, `flip_min_total`, `flip_min_win_rate`, `flip_min_avg_cosine`) don't whiplash users on noise. Ideally: replay against real sessions and inspect the flip rate + agreement with post-hoc labels.
3. **UX for the flip event.** At minimum: surface the candidate lane and its evidence to the user before applying, and give them a way to reject.
4. **Lift the invariant guard** in `nextPairingImpl` intentionally, with tests covering the lifted path and event-log entries for `lane_probed` / `lane_flipped` restored.

## How to bring it back (mechanics)

- Re-export `evaluateProbe` from `createEngine()` in `src/musicdna/engine/index.ts`.
- Restore the probe-scoring block in the submit-choice handler in `src/lib/musicdna.functions.ts` (git history has the previous shape).
- Remove or gate the invariant guard in `nextPairingImpl` and add the probe-scheduling code that populates `probe_state.pending`.
- Move the experimental test file back next to `choice.ts` (or leave it under `experiments/` — either works once the module is live).
