# MusicDNA — R&B + Electronic Catalog Expansion

**Status:** Inserted and verified in live MusicDNA Supabase, November 2026.  
**Project:** `udycgnhvaanemhrchbuj`  
**Type:** Non-destructive, idempotent catalog data additions. No existing songs or pairings were updated or removed.

## Results

| Lane | Added songs | Added active pairings | Active songs after | Active pairings after |
|---|---:|---:|---:|---:|
| R&B (`r_and_b`) | 36 | 54 | 50 | 61 |
| Electronic (`electronic`) | 37 | 52 | 76 | 72 |
| **Total added** | **73** | **106** | | |

All new song rows have the current ten axis scores (0–100). All new pairings have one to three declared tests, each with a **minimum 20-point difference** between the linked songs' pinned scores. Local validation, rollback-only SQL rehearsal and live post-insertion SQL checks passed; new invalid tested-axis differences: **zero**. No new active pairing has an empty tests array.

## Canonical source files

- `data/musicdna/r-and-b-expansion-2026-11-10.json` — 36 songs, 54 pairings, ten axis scores, curator rationale, post-pick tradeoff phrase and test declarations.
- `data/musicdna/electronic-expansion-2026-11-10.json` — 37 songs, 52 pairings, same contract.
- `tools/musicdna/compile-catalog-expansion.mjs` — pure validator / SQL compiler.

## Verify and recompile

```bash
node tools/musicdna/compile-catalog-expansion.mjs --validate data/musicdna/r-and-b-expansion-2026-11-10.json
node tools/musicdna/compile-catalog-expansion.mjs --validate data/musicdna/electronic-expansion-2026-11-10.json
```

The `--sql` option emits a complete transactional, idempotent SQL import to stdout. The compiler does **not** connect to a database or write to disk. Deterministic UUIDs are namespaced by lane, batch and song/pair key; repeated imports do not duplicate entries. Existing catalog songs are addressed by stable live UUIDs, and the SQL refuses to complete if the expected set cannot be resolved or its tested-axis contrasts are invalid.

## A few editorial highlights

### R&B

| Pairing | Matchup phrase | Core test |
|---|---|---|
| Aretha Franklin — Respect / Sam Cooke — A Change Is Gonna Come | Take the room by force, or let a plea grow into history? | Movement, immersion, perspective |
| SWV — Weak / TLC — Creep | Admit you're undone, or keep the secret moving? | Confidence, perspective, movement |
| Marvin Gaye — Let's Get It On / Al Green — Tired of Being Alone | Make desire sound certain, or let the need show? | Confidence, tension, texture |
| SZA — Saturn / Marvin Gaye — What's Going On | Save this world, or wish yourself to a different one? | Community, tension, transformation |

### Electronic

| Pairing | Matchup phrase | Core test |
|---|---|---|
| Brian Eno — An Ending (Ascent) / Fred again.. — Marea | A room for nobody, or a room we have to rebuild together? | Movement, community, perspective |
| Stardust — Music Sounds Better with You / Fatboy Slim — Praise You | Perfect mirrorball, or crate-digging grin? | Texture |
| Jon Hopkins — Emerald Rush / Skrillex + Fred again.. + Flowdan — Rumble | Watch the machine evolve, or release the beast in ten seconds? | Immersion, transformation, texture |
| RÜFÜS DU SOL — Innerbloom / John Summit — Where You Are | Six minutes of private confession, or hands-up certainty? | Immersion, community, confidence |

## Design and evaluation cautions

1. **The scores are provisional editorial estimates, not empirically validated song psychometrics.** Neither popularity, canon score nor an evocative curator phrase is independent evidence for a listener tendency. These are candidate contrasts for real listener testing.
2. **Treat `user_facing_tradeoff` as after-choice creative context.** It is a matchup-level phrase, not a scored direction, and must not become a listener claim without the actual signed song contrasts and evidence ledger.
3. **Avoid era shortcuts.** Both batches deliberately span decades, and select pairings use legacy anchors. When evaluating whether a pattern is real, monitor era/artist concentration and individual song recognition. Do not interpret a 1990s preference as an identity.
4. **Keep the evidence snapshot contract.** Existing choices and published readings are frozen; modifying catalog metadata later must not rewrite them.
5. **Catalog quality after activation.** Track per-pair skip rate, unfamiliarity, preferred-song balance and controversial classifications. Review the ambiguous R&B/hip-hop/pop and electronic/alternative crossovers if routing is noisy.
6. **Old electronic anchor scores can be sparse.** Several pre-existing electronic rows contain neutral 50s and empty `primary_dimensions`; no older score was rewritten by this expansion. They deserve separate editorial review rather than being silently changed by an import.

## Operational rollback

The additions have stable version markers:

- R&B song `scoring_version = 'r_and_b_editorial_v1'`
- Electronic song `scoring_version = 'electronic_editorial_v1'`
- Pairing `why_good` ends with `Editorial contrast only; listener split not yet measured.`

If a particular row performs poorly, **deactivate** it after checking references instead of deleting or mutating historical results. Retain these JSON snapshots for review and reproducibility.
