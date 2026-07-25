# MusicDNA Instrumentation

**Status:** live. Instrumentation-only — no scoring changes.

The engine's math (pairing selection, `applyChoice`, `assignArchetype`, fit
tiers, the 0.35 seed multiplier) is untouched by this system. This document
defines what we capture, where we store it, and how the six derived measures
are computed.

## Storage

Everything lands in `public.event_log.props` (JSONB). No new tables. Two new
event types (server-emitted from `recordChoiceImpl` → `emitChoiceDiagnostics`):

- `choice_scored` — one per user choice.
- `archetype_ranking_snapshot` — round-level trajectory. Emitted at
  stability checkpoints (rounds 8, 10, 12, 14) and when the session ends
  (`is_final=true`).

The listener-facing `pairing_shown` event (client-emitted) additionally
carries `selection_reason` from `selectPairing` in its `props`.

Feedback lives in `public.result_feedback`, extended with two nullable text
columns: `most_accurate_sentence`, `least_accurate_sentence`.

## Field contract

### `pairing_shown.props.selection_reason`
```
{
  leaning_axes: string[]   // axes the running vector already leans hardest on
  fork_matched: boolean    // did we pick from the leaning-axis fork pool?
  tests: string[]          // dims this pairing tests
  axes_needed: string[]    // subset of tests where |v| < 15 (weak axes)
  axis_need_score: number  // mean of 1/(1+|v|) across tests, 0..1
  challenge_boost: boolean // 1.5x boost applied?
  diagnostic_weight: number // 0..100
  pool_size: number        // eligible pool after filters
  weight: number           // final selection weight for the winner
}
```

### `choice_scored.props`
```
{
  round, chosen_song_id, rejected_song_id,
  axes_tested: string[],
  vector_before, raw_delta, vector_after,   // Record<dim, number>
  diagnostic_weight,
  winner_id, winner_name, winner_score, margin, fit_tier,
  supports:   Record<dim, positive_delta>,  // per-axis push toward winner
  contradicts: Record<dim, negative_delta>, // per-axis push away
  positive_contribution, negative_contribution, // sums of the above
  flagged, flag_reason,
  archetype_rankings: Array<{id, name, score}> // full ranked list
}
```

`supports`/`contradicts` measure how this pairing shifted the *raw dot
product* between the running vector and the current winner's signature axes,
per axis. Sign convention: positive = pushed toward the winner.

### `archetype_ranking_snapshot.props`
```
{ round, top3: [{id,name,score}], margin, fit_tier, flagged, flag_reason, is_final }
```

### `result_feedback` (new columns)
- `most_accurate_sentence text` — listener quotes the line that landed.
- `least_accurate_sentence text` — the line that missed.

The submit handler also accepts `"partly"` / `"wrong"` for the `accuracy`
field and normalizes them to the existing `"mixed"` / `"not_accurate"` values.

## Derived measures (SQL views)

All views run with `security_invoker=on`. The `adminDiagnostics` server fn
uses the service-role client, so an admin sees every session; individual
listeners see only their own rows (RLS on the underlying tables).

| View | Question |
|---|---|
| `v_session_stability` | Winner at rounds 8/10/12/14 per session — did the round-8 winner survive to reveal? |
| `v_axis_independence` | Per session, count of *distinct* axes that ever appeared in `choice_scored.supports`. Repeated-axis "supports" collapse to one. |
| `v_contradiction_load` | Sum of `positive_contribution` vs. `negative_contribution` per session, plus their ratio. "How much did we ignore?" |
| `v_residual_rate` | Sessions where the final snapshot's `winner_score < 0.5` or `margin < 0.05`. |
| `v_human_agreement` | Joins listener feedback (`accuracy`, sentence-level) against final fit and residual flag. |

Not shipped in this pass:

- **Order sensitivity** requires replaying alternate pairing orders offline.
  The event log now contains everything needed (`vector_before` on each
  `choice_scored` reconstructs the state, and `selection_reason` narrows the
  swap candidates), but the simulation itself is a follow-up.

## Admin surface

`/_authenticated/admin` → **Diagnostics** tab renders the four headline
numbers (sessions final, residual rate, feedback captured, human agreement)
plus the raw first-50 rows of every view. Gated by the same `has_role`
check as the rest of the admin.

## Explicit non-goals

- No changes to `applyChoice`, `selectPairing`, `assignArchetype` math.
- No fit-tier recalibration.
- No new user-visible copy beyond the two feedback textareas.
- No synthetic persona generation. Ground truth first.

## What to read next

After two weeks of real sessions with feedback:

- If `v_human_agreement` shows fit-tier 80/95 rows land on `"not_accurate"`
  more than chance, the tiers are miscalibrated. Fix the labels (in
  `docs/musicdna/archetype-bible.md`) or the thresholds in
  `src/musicdna/engine/scoring.ts#fitTier`.
- If `v_axis_independence.independent_support_axes` clusters at ≤ 2 for
  winning archetypes, `selectPairing` needs to spread across axes more
  aggressively.
- If `v_contradiction_load.contradiction_ratio > 0.3` correlates with
  fit_tier ≥ 80, the Critic voice should hedge harder in that regime.

## `regime_recommended` (shadow router, 2026-07-25)

Emitted by `nextPairingImpl` on every successful pairing selection, including
bootstrap picks. **Shadow-only** — the recommendation never influences which
pairing is served. See `docs/musicdna/agent-brain-integration-plan.md` for the
mapper/scorer contract and the nine refinements this event exists to validate.

- `event_type`: `regime_recommended`
- `session_id`, `pairing_id`, `user_id`: as usual
- `client`: `"server"`
- `props`:
  - `regime`: `"explore" | "prune" | "compound" | "coordinate"`
  - `confidence`: 0..1 (margin over runner-up, normalized)
  - `margin`: raw score gap (winner minus runner-up)
  - `scores`: `{ explore, prune, compound, coordinate }` — full table
  - `archetype_margin`: null in Step 0 (populated once the caller wires
    ranking output — refinement #9)
  - `features_summary`: flattened `TerrainFeatures.derived` plus the four
    trinary axes and the winning `mode_pressure` for offline slicing

Analysis queries live alongside the other diagnostics views; a follow-up
migration adds `v_regime_distribution` and `v_regime_vs_fit_tier` once we
have ~1k events to slice.
