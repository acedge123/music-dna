# 1980s recognition sample (review only)

Unscored "do we recognize what you typed?" list. Not loaded into any table; no scoring, catalog writes or activation.

- 1,477 songs, 1980–1989, from 146 artists (102 already in our catalog + 44 proposed mainstream additions).
- Source: ListenBrainz artist popularity (most-played recordings, up to 12 per artist) + MusicBrainz release-group first release year.
- Year = earliest release of the album the popular recording sits on; songs whose album isn't 1980–89 are dropped.
- `lane_hint` = the artist's lane in our catalog (`catalog`) or a hand-guessed lane (`proposed`). Hints only.
- By year: 1980 122 · 81 85 · 82 113 · 83 149 · 84 180 · 85 138 · 86 192 · 87 165 · 88 199 · 89 134.

Known gaps: Run-DMC, The B-52's, Huey Lewis and the News, Grandmaster Flash were skipped by strict name matching. One-hit wonders and artists not in the seed list are missing — the next step would seed artists from ListenBrainz/MusicBrainz broadly instead of our list. Possible live/remaster duplicates need review.

Rebuild: `LISTENBRAINZ_TOKEN=... python3 build-sample.py` (needs `catalog_artists.json`).
