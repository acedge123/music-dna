# MusicDNA decade exploration: editorial catalog candidates

**Status: review-only, not scored or staged, never auto-activate.** Prepared 2026-11-11 for Lovable catalog gap analysis.

This folder contains **200 distinct song candidates** in **100 proposed head-to-head pairings**, across 1970s–2020s. Songs and pairings are listed in two UTF-8 CSVs with stable editorial IDs:

- [`song_candidates.csv`](./song_candidates.csv) — metadata, proposed decade/lane/sub-lane, and old-seed match flags.
- [`pairing_candidates.csv`](./pairing_candidates.csv) — songs referenced by `song_a_id` / `song_b_id`, a proposed primary *current* MusicDNA dimension, interpretive direction and rationale.

## Intent: user-chosen decade, dimension-led discovery

At the end of the initial MusicDNA reading, **the listener chooses which decade to explore**. MusicDNA uses their **existing preference dimensions** to recommend or present contrasts *inside that chosen decade*. Their original song choices **must not assign them to a decade**, and decade coverage should not be mistaken for their taste history.

Treat the six decade shelves as opt-in, not a forced new classification. Genres have historically bounded windows: disco is deliberately **1970s only**, rather than padded into subsequent decades. Other lanes may not exist in every decade and that is acceptable.

## Editorial coverage in this seed

| Decade | Country | Disco | R&B | Classic rock | Alternative | Pop | Hip-hop | Electronic | Metal | Pairings |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1970s | 4 | 4 | 4 | 3 | 1 | 0 | 0 | 0 | 0 | 16 |
| 1980s | 4 | 0 | 2 | 0 | 3 | 3 | 1 | 2 | 1 | 16 |
| 1990s | 4 | 0 | 2 | 0 | 3 | 2 | 2 | 2 | 1 | 16 |
| 2000s | 4 | 0 | 2 | 0 | 3 | 2 | 2 | 2 | 1 | 16 |
| 2010s | 4 | 0 | 2 | 0 | 3 | 2 | 2 | 2 | 1 | 16 |
| 2020s | 4 | 0 | 3 | 0 | 3 | 3 | 3 | 3 | 1 | 20 |
| **Total** | **24** | **4** | **15** | **3** | **16** | **12** | **10** | **11** | **5** | **100** |

Country is intentionally emphasized across all six decades (48 song candidates / 24 pairs). The 2020s receive the largest modern-era seed (40 songs / 20 pairs). This table counts **proposals, not new unique production inventory**.

## Ten scored dimensions, no invented axes

Use the current definitions in [`../catalog-expansion-spec.md`](../catalog-expansion-spec.md):

| Dimension | Low pole | High pole |
|---|---|---|
| `movement` | stillness | forward motion |
| `atmosphere` | statement | immersive mood |
| `immersion` | immediacy | slow reveal |
| `scale` | intimate | vast |
| `community` | solitary | communal |
| `perspective` | feeling | witness |
| `confidence` | vulnerability | command |
| `tension` | release | danger |
| `texture` | rawness | refinement |
| `transformation` | holds its shape | becomes something else |

The CSV's pole annotations are **hypotheses**. They are *not* numerical scores or verified claims about any listener. Never add a new dimension such as `groove`, `darkness`, `nostalgia` or `hope`.

## Instructions for Lovable / catalog curator

1. **Read-only inventory first.** Reconcile these candidates against the current **live song table**, aliases, historical batch JSONs, inactive proposals and pairings. Some songs are already cataloged, including 19 names from an older partial seed. Reuse canonical song IDs and existing vetted vectors; do not blindly create duplicate rows.
2. **Verify track identity and year.** Pin the particular original recording or version. Use `release_year` to assign its decade. Some candidates are crossover tracks; editorially review their proposed `primary_lane`. Country, disco and R&B may require specialist-lane mapping and runtime routing support, so **do not silently remap to `general`, `pop` or `electronic`**. See [`../specialist-lanes-yacht-disco-punk-reggae-2026-11-10.md`](../specialist-lanes-yacht-disco-punk-reggae-2026-11-10.md).
3. **Score only missing songs**, using the active 0–100 ten-axis rubric. Do not modify approved existing vectors just to make proposed pairs pass. Apply recognition, diagnostic-power, artist-concentration and release review gates in the expansion spec.
4. **Recalculate each proposed test** from the two actual vectors. Both tracks must be in the *same reviewed primary lane*, same chosen decade, different artists, and differ **by at least 20 numerical points** on each declared test. Discard or redesign pairs that fail; do not invent test scores or infer diagnostic quality from popularity. Review each hook for specificity and uniqueness before activation.
5. **Report actual gaps** as decade × lane × dimension (and song-count / valid-pair-count / skip-exhaustion risk). Only make more suggestions for genuine gaps. A historically absent lane (e.g. disco in 1990s) is not a coverage defect.
6. **Stage, never auto-activate.** Keep everything inactive pending Alan's editorial and product review. This docs-only proposal authorizes **no schema changes, production writes, migrations, routing changes or LLM critic edits**. Preserve all frozen listening evidence.

## Example contrasts to editorially test

- `1970s / disco / atmosphere`: Donna Summer — **I Feel Love** vs Chic — **Le Freak** (immersive machine-like atmosphere vs direct collective statement).
- `1970s / country / community`: Merle Haggard — **If We Make It Through December** vs John Denver — **Take Me Home, Country Roads** (private struggle vs communal singalong).
- `2020s / country / confidence`: Zach Bryan — **Something in the Orange** vs Morgan Wallen — **Last Night** (vulnerability vs command).
- `2020s / pop / movement`: Sabrina Carpenter — **Espresso** vs Billie Eilish — **What Was I Made For?** (forward motion vs stillness).
- `2020s / R&B / confidence`: SZA — **Snooze** vs Victoria Monét — **On My Mama** (vulnerability vs command).

These are critic/curation working hypotheses, not pre-written psychological conclusions. A user's pick is evidence about *that choice*, not a sweeping identity claim.

## Source status

- 200 distinct editorial song IDs / 100 unique proposed pairings; all marked `proposed_not_validated`.
- All pairs are constructed within a proposed decade and primary lane, using distinct credited artists.
- No identical pairs found against the **older local partial pairing seed**. **No live database dedupe has yet been run.**
- `actual_score_delta` intentionally blank until the reviewed catalog dimensions are compared.

This is a candidate intake folder, not a production import manifest or runtime config.
