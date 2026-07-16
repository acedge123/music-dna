# Prior Weighting: Opener as Directional Seed

## Intuition

The 3-song opener should give the archetype signal a nudge in the right
direction, not decide it. The pairings are the evidence the user actually
sweat over; the opener is a hint.

**Framing:** opening-song analysis provides a moderate initial directional
seed designed to be overridden by pairing evidence.

## Implementation

`session.vector` is seeded at session creation from the opener's
`candidate_dimensions` (range −100..+100), scaled by a **seed multiplier**:

```ts
// src/lib/musicdna.functions.ts
export const PRIOR_SEED_WEIGHT = 0.35; // seed multiplier, not a mix ratio

seed_vector[dim] = round(candidate_dimensions[dim] * 0.35)
```

Then each pairing choice adds `(winner[dim] − loser[dim]) * (diagnostic_weight/100)`
to the running vector (typically ±15–35 per pairing on tested axes).

### Why 0.35 (illustrative, not a guaranteed mix)

| Source                     | Typical magnitude on dominant axis |
|----------------------------|------------------------------------|
| Raw prior (×1.0)           | 60–90                              |
| **Seeded prior (×0.35)**   | **20–32**                          |
| 6 pairings accumulated     | 90–200                             |

In the illustrative case above the seed ends up small relative to the
accumulated pairing signal, so the opener acts as a nudge and gets
overridden when the choices contradict it.

**Do not read `0.35` as "the opener contributes 30% of the final result."**
The seed's actual contribution depends on:

- how many pairings were completed
- each pairing's `diagnostic_weight`
- axis coverage (a seed on axis X only competes with pairings that test X)
- the magnitude of each pairing's `(winner − loser)` delta
- whether pairings reinforce or contradict the seed

Bump toward ~0.5 if the seed should anchor harder; drop toward ~0.2 if
pairings should dominate more.

## Where it's applied

- `startSessionImpl` — the quiz / test-harness path (`/api/public/test/next`
  creates the session via this function).
- `ensureChatSessionForUser` — the chat path that lazily creates a session
  from the opener.

Both go through `seedVectorFromPriors(candidate_dimensions)` so the
weighting stays in one place.

## What this does NOT touch

- Lane routing — still driven by `opening_lane` / `opening_lane_confidence`.
- Probe lanes — still seeded from `secondary_lanes`.
- Archetype matching itself — still cosine over `session.vector`
  (`finalizeSessionImpl`). Only the *starting point* of that vector changed.

## Related truth-in-labeling note

The engine's per-archetype `fit_tier` (20/50/80/95) is a bucketed
strength-of-fit label from cosine similarity, not a calibrated probability
that the archetype is correct. See `src/musicdna/engine/scoring.ts#fitTier`.
