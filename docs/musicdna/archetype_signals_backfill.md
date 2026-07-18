# Archetype Signal Backfill

Some lanes were imported without `archetype_signals` tags. This tool proposes
signals for those songs using the Lovable AI Gateway, matching the vocabulary
already used across the seeded lanes.

## Coverage as of last check

| Lane          | Songs | Tagged |
| ------------- | ----- | ------ |
| classic_rock  | 40    | 0      |
| electronic    | 39    | 0      |
| hip_hop       | 39    | 0      |
| pop           | 53    | 0      |

All other active lanes are fully tagged.

## Controlled vocabulary

The tool restricts proposals to the 9 signals that appear widely across
seeded lanes:

- `open_signal`, `bassline_mystic`, `melody_maximalist`, `catharsis_engine`,
  `texture_astronaut`, `communal_lift_seeker`, `cinematic_romantic`,
  `forward_motion_romantic`, `beautiful_doom_seeker`.

Rare per-song signals (e.g. `piano_ache`, `swagger`) are intentionally excluded
here — those are hand-curated overrides, not batch output.

## Run

```bash
# All four untagged lanes
node tools/musicdna/backfill_archetype_signals.mjs

# Narrow to a subset while iterating
node tools/musicdna/backfill_archetype_signals.mjs --lanes=classic_rock --limit=10
```

Required env: `SUPABASE_URL`, `SB_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`),
`LOVABLE_API_KEY`.

## Outputs

- `data/musicdna/archetype_signals_backfill_proposals.csv` — one row per song
  with `proposed_signals` (pipe-separated) and the model's one-line rationale.
- `data/musicdna/archetype_signals_backfill.sql` — `UPDATE` statements for
  every song that got ≥1 signal.

Nothing is written to the database. Review the CSV, edit the SQL if needed,
then apply via a Supabase migration.
