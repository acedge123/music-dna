## Goal

When a session is stuck in `general` (or in the bootstrap phase), prefer pairings the user is likely to **recognize** — familiar era, familiar genre neighborhood, high popularity — instead of serving deep cuts that only true fans of a lane would know.

This is a *selection* change. No new taxonomies, no new LLM calls.

## What we already have on `songs`

- `year` (int) → era
- `primary_lane` + `subculture text[]` → genre neighborhood
- `canon_score` (0–100) → recognition / cultural footprint
- `longevity`, `identity_signaling` → supporting recognition signals
- `diagnostic_power` → separate axis (kept for tie-breaking)

We do **not** need a new "popularity" column. `canon_score` is our recognition proxy; if it's stale for some rows, that's a curation fix, not a schema change.

## What we add

### 1. A `pairing_recognition` derived view

```text
pairing_recognition(pairing_id, avg_canon, min_canon, era_bucket, era_span_years,
                    shared_subcultures int, cross_subculture bool)
```

- `avg_canon` / `min_canon` — how recognizable the *less* famous song is (min matters more than avg).
- `era_bucket` — `1960s | 1970s | 1980s | 1990s | 2000s | 2010s | 2020s | mixed` based on the two songs' years.
- `era_span_years` — abs(year_a - year_b). Small span = cohesive era pairing.
- `shared_subcultures` / `cross_subculture` — do the two songs share any subculture tag? Useful for general-lane pairings that still feel coherent.

Read-only view, `security_invoker = true`, joined to `pairings_with_songs` so admin can sort/filter.

### 2. A "recognition score" in `selectPairing`

New scalar computed at selection time (no DB write):

```text
recognition = 0.6 * min_canon + 0.4 * avg_canon
              - 10 * (era_span_years > 15 ? 1 : 0)   // penalize wildly split eras
```

Range roughly 0–100.

### 3. New selection modes

Selection already branches on session state. Extend it:

| Session state | Pool + ordering |
|---|---|
| bootstrap (round < 2, lane = general) | `is_bootstrap = true`, then order by `recognition desc, diagnostic_weight desc` |
| lane = general, round >= 2 | any active pairing, filtered `min_canon >= 55`, order by `recognition * 0.6 + diagnostic_weight * 0.4` |
| lane = <specific>, low `lane_confidence` (<0.7) | lane pool, filtered `min_canon >= 45`, same blended order |
| lane = <specific>, high confidence | current behavior — pure `diagnostic_weight` priority |

Thresholds are tunable constants in one place (`engine/pairing.ts`).

### 4. Optional: opener-informed era hint

Openers already tell us the user's dominant era (avg `year` across the 3 songs). When present, add a soft bonus:

```text
+ 8 if pairing.era_bucket === user.era_bucket
+ 4 if abs(pairing.avg_year - user.avg_year) <= 10
```

Persisted on `sessions.opening_analysis_json.era_hint` so mobile + web see it identically. Off by default behind a flag until we validate it doesn't over-narrow.

## What this does NOT change

- Archetype scoring, cosine math, fit tiers.
- Reveal / critic voice.
- The 15 active dimensions.
- Curated `is_bootstrap` pairings still win in rounds 0–1.
- Lane-confident sessions are untouched — recognition weighting only kicks in when we're uncertain.

## Admin surfacing

- Add `avg_canon`, `min_canon`, `era_bucket`, `era_span_years`, `cross_subculture` columns to the Pairings tab (sortable, exportable).
- Add a "Recognition preview" filter: show only pairings that would qualify for the `general`-lane pool (`min_canon >= 55`).

## Sequencing

1. Migration: create `pairing_recognition` view.
2. Engine: add `computeRecognitionScore()` + extend `selectPairing()` branches; unit tests for each branch.
3. Admin: extend Pairings tab columns + filter.
4. (Optional, flagged) opener era hint in `classifyLane` output + selection bonus.
5. Backfill audit: query for songs with `canon_score IS NULL` or `< 20` that appear in >3 pairings — flag for curator review (this is where "unrecognizable pairings" actually come from).

## Open question for you

Do you want cross-subculture pairings **allowed but demoted** in general-lane mode (my default above), or **excluded** until confidence rises? Excluding is safer for recognition but reduces diagnostic variety early.