# Future add-ons: Archetype song suggestions and prediction rounds

Status: proposed, not scheduled. Owner priority: idea 2 is the preferred learning path, but only after the learning plumbing (consent, outbox, dispatch, Agent Brain ingest) is proven solid end to end.

## 1. "Songs a <Archetype> would like" (profile)

- Placement: profile, below the dimension radar, above past readings.
- Ranking: deterministic fit between approved `archetype_profiles` (frozen version from the reading) and song scores. No model calls, no rescoring.
- Scope within the listener's lanes only (no cross-lane equivalence). Exclude songs already shown; spread across decades.
- Reason line uses approved, score-matched Song Whys; otherwise a templated score-based line. Framed as "worth a listen", never a promise.
- Ship behind a default-off flag.

## 2. Prediction rounds (learning loop)

- Optional post-reading child run (like Explore/Refine); Discover routing and saved readings untouched.
- Each matchup: predicted song (high fit on the tested trait) vs same-lane, same-era song low on that trait, so the choice tests the trait, not familiarity.
- Prediction is pre-registered and frozen server-side before the pick; never shown before the choice (pairings stay mysterious).
- Outcomes: hit / miss / skip. Skip = unfamiliar, never "dislike"; excluded from accuracy.
- Results only create new result versions; frozen readings never change.
- Metric: prediction hit rate per Archetype profile version, excluding owner-QA; misses flag profiles that are too broad.

### Plumbing prerequisites before any signal reaches Agent Brain

- Prediction + outcome written only by trusted server events inside the vote transaction.
- Consent: only AB-57 consented accounts export; never infer enrollment.
- Outbox/dispatch: existing frozen-projection outbox and operator worker; no new export path.
- Verified idempotency, replay safety and withdrawal/deletion propagation in production before enabling.
- Default-off flag; separate approval to enable capture and dispatch.

## Open risks
- Thin catalog in some lane×era cells; four Archetype profiles still drafts; discovery songs need audio previews.
