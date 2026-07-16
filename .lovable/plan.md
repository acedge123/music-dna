
## My take on the plan

Solid direction, and the right sequencing: you need ground truth before you can defend or change the math. Two things I'd tighten before we build:

1. **Split "capture" from "derive."** Log a rich per-choice snapshot once; compute stability, order-sensitivity, contradiction load, etc. as read-only SQL views on top. That way you can iterate on definitions without re-running sessions.
2. **Piggyback on the existing `event_log.props` jsonb**, not a new table. `recordEvent` and the `event_log` table already exist; adding a new `choice_scored` event type keeps the ingestion path unchanged and avoids a migration surface.

## Scope (instrumentation only — engine math untouched)

### 1. Per-choice diagnostic snapshot

Extend `recordChoiceImpl` in `src/lib/musicdna.functions.ts` to emit a single `choice_scored` event alongside the existing `choice_made`. All fields go into `event_log.props` — no schema change:

- `round`, `pairing_id`, `chosen_song_id`, `rejected_song_id`
- `pairing_selection_reason` (from `selectPairing`: axes_needed, fork score, weight)
- `axes_tested` (dims where |delta| > 0)
- `vector_before`, `raw_delta`, `weighted_delta`, `vector_after`
- `diagnostic_weight`
- `archetype_rankings_after`: full sorted list `[{id, name, score}]`
- `winner_margin` (best − runner-up)
- `fit_tier`
- `supports` / `contradicts`: per-axis contribution of this choice to the current winner's cosine
- `flag_reason` (if any)

Requires exposing the pairing's `selection_reason` from `selectPairing` (already computed internally; just needs to be returned). No behavior change.

### 2. Round-level archetype trajectory

Emit `archetype_ranking_snapshot` at end of each round with the top-3 and margin. Cheap, makes stability queries trivial without replaying every choice.

### 3. Richer reveal feedback

Extend `submitFeedback` to accept (all optional, additive):

- `accuracy: "accurate" | "partly" | "wrong"` (add `"partly"` to the existing enum via migration)
- `most_accurate_sentence: string | null`
- `least_accurate_sentence: string | null`

Reveal UI: add two tap-to-mark actions on the commentary sentences plus the three-way accuracy control. Feedback is the ground-truth channel — without it, everything else is unfalsifiable.

### 4. Derived-measure SQL views (read-only)

One migration, no engine changes. Each maps directly to a question you asked:

| View | Question it answers |
|---|---|
| `v_session_stability` | Winner at rounds 8/10/12/14 per session; % of sessions where the round-8 winner survives to reveal |
| `v_axis_independence` | Per winning archetype, count of *distinct* axes contributing >X to the cosine (repeated-axis "supports" collapse to 1) |
| `v_contradiction_load` | Sum of negative contributions to the winner's cosine / sum of positive; a "how much did we ignore?" ratio |
| `v_residual_rate` | % of sessions where final `score < ARCHETYPE_SCORE_FLOOR` or `margin < 0.05` |
| `v_order_sensitivity` | Replay hook: sessions where swapping the last two pairings would flip the winner (computed offline from snapshots; view exposes the count) |
| `v_human_agreement` | Join `feedback.accuracy` against `fit_tier`, `margin`, residual flags |

### 5. Admin surface

Extend `src/routes/_authenticated/admin.tsx` with a "Diagnostics" tab that reads the six views. Read-only; gated by the existing admin role check. No public exposure.

## Explicitly out of scope

- No changes to `applyChoice`, `assignArchetype`, `selectPairing` math.
- No changes to fit-tier thresholds or the 0.35 seed multiplier.
- No new archetype flags or user-visible copy changes beyond the feedback controls.
- Order-sensitivity *simulation* (replaying alternate orders) is a follow-up; this plan only stores the data to make it possible.

## Deliverables

1. Migration: add `partly` to feedback accuracy enum; add `most_accurate_sentence` / `least_accurate_sentence` columns; add `choice_scored` and `archetype_ranking_snapshot` to `EVENT_TYPES`; create the six views with `GRANT SELECT ... TO authenticated` scoped via RLS to admins only.
2. `selectPairing` returns its `selection_reason` (pure refactor, no math change) + test.
3. `recordChoiceImpl` emits `choice_scored`; new round-end emits `archetype_ranking_snapshot`.
4. `submitFeedback` accepts the two sentence fields; reveal UI wires them.
5. Admin diagnostics tab reading the views.
6. Docs: `docs/musicdna/instrumentation.md` defining every field and every derived measure, so future changes can't quietly drift the definitions.

## What's next after this ships

Two weeks of real sessions with feedback. Then, before any scoring change:

- Read `v_human_agreement` — if fit_tier 80/95 doesn't correlate with "accurate," the tiers are miscalibrated (fix the labels, or the thresholds, or both).
- Read `v_axis_independence` — if winners routinely have ≤2 independent supporting axes, pairing selection needs to spread across axes more aggressively.
- Read `v_contradiction_load` — high load + high fit_tier means we're overclaiming; the Critic voice should hedge harder in that regime.

That's the point where synthetic personas become useful: you'll have real distributions to check them against.
