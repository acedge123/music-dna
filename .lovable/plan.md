# Lane Confidence: Weighted Openers + 2-Pairing Bootstrap

Two independent changes to reduce how often sessions get stuck on `general`.

## 1. Weighted opener scoring

Slot position matters. Users list their most-defining song first.

Weights: **slot 1 = 3, slot 2 = 2, slot 3 = 2, slot 4 = 1, slot 5 = 1** (total 9).

Changes in `src/lib/musicdna.functions.ts`:

- Tell the LLM classifier in `CLASSIFIER_VOICE` that "song 1 is 3× more diagnostic than song 5; weight your lane call accordingly."
- Rewrite `dominantPerSongLane` (the low-confidence fallback) as a weighted vote — sum the slot weights per lane instead of counting entries.
- After both LLM and canon enrichment, compute a **weighted lane share** across `per_song` (using catalog-source rows when present, LLM rows otherwise). If the top lane's share ≥ 0.5 (i.e. weighted votes ≥ 4.5 of 9), floor `confidence` to `max(confidence, 0.6)` so we route to that lane instead of falling to `general`.
- Persist `opening_analysis_json.weighting = { scheme: "3-2-2-1-1", top_lane_share }` for admin auditing.

## 2. 2-pairing bootstrap (N=2)

When `sessions.lane_confidence < 0.6` (i.e. lane is `general`), serve **exactly 2** high-recognition pairings first. Try to promote to a real lane from those 2 winners. If we can't, stay `general` for the remaining 4 pairings.

### Data changes

Migration:
- `pairings.is_bootstrap boolean not null default false` + partial index.
- `sessions.bootstrap_choices_json jsonb not null default '[]'::jsonb`.

Curation: separate follow-up (not this ticket). Migration ships the column; I'll surface a "Bootstrap" filter/toggle in the admin Pairings tab so you can mark ~15-25 pairings by hand. Until any are marked, low-confidence sessions behave exactly as today (bootstrap branch finds nothing → normal general-pool selection).

### Selection logic (`src/musicdna/engine/pairing.ts` + `nextPairingImpl`)

New `selectBootstrapPairing()` alongside `selectPairing()`:
- Called when `session.lane === "general"` AND `session.round < 2` AND `bootstrap_choices_json.length < 2`.
- Pool: `pairings.is_bootstrap = true AND active = true`, excluding used ids.
- Prefer pairings whose two songs' `primary_lane` values differ (so the choice actually reveals a lane).
- Empty pool → fall through to normal `selectPairing` (no regression).

### Promotion check (`recordChoiceImpl`)

After a bootstrap choice is recorded:
- Append `{ pairing_id, winner_primary_lane, loser_primary_lane }` to `sessions.bootstrap_choices_json`.
- After 2 bootstrap choices: if both winners share the same `primary_lane`, **promote** the session:
  - Update `sessions.lane = <that lane>`, `sessions.lane_confidence = 0.65`.
  - Emit `event_log` row with `event_type = 'lane_promoted'`, props containing before/after lane and the 2 winners.
- If they disagree, no promotion — session stays `general` for the remaining 4 pairings. Log `event_type = 'lane_promotion_failed'` with the two winners so admin can see why.

### What this does NOT touch

- Archetype scoring, cosine math, `fit_tier`.
- Reveal/critic voice.
- Cross-lane probes (still quarantined).
- The 15 active dimensions.
- Any web/mobile UI (both consume the same session and see the promoted lane automatically on the next `next` call).

## Sequencing

1. Migration: `pairings.is_bootstrap`, `sessions.bootstrap_choices_json`.
2. Weighted opener classification + confidence floor.
3. Engine: `selectBootstrapPairing`, update `selectPairing` entrypoint to branch on session state, promotion logic in `applyChoice`/`recordChoiceImpl`.
4. Admin: `is_bootstrap` filter + toggle on Pairings tab; show promotion events on session diagnostics rows.
5. Tests: unit tests for weighted tally, confidence floor, bootstrap selection, promote-on-agree, no-promote-on-disagree, exhausted-pool fallthrough.

Anything you want to cut before I build?
