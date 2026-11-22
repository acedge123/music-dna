# Recognition list — data source research (proposal, nothing built)

Goal: a large, unscored "do we recognize this song?" list (title, artist, year,
genre hint) separate from the scored catalog and the opener review queue.

## Recommended combo (free, commercial use allowed)
1. **ListenBrainz "popular recordings by listen count"** (MLHD+ derived) —
   https://datasets.listenbrainz.org/popular-recordings-by-listen-count .
   Gives songs people actually play, with MusicBrainz IDs. Use it to pick the
   top ~25–50k recordings, so the list is "songs people know", not every
   obscure track. Live per-artist popularity API also exists.
2. **MusicBrainz canonical data dump** (CC0 core data) — clean title, artist,
   first-release year per recording; community genre tags (tags are
   CC BY-NC-SA supplementary data — use only as an internal hint, don't
   republish). https://metabrainz.org/datasets/download
3. **Discogs monthly dumps** (CC0) — genre + style per release (e.g. Rock /
   Punk, Electronic / House). Best free source for mapping to our lanes.
   Several GB XML; match by artist + title + year.

MetaBrainz asks commercial users for a supporter subscription (small, voluntary
but expected) — that is the "small fee".

## Not recommended
- Spotify/Apple APIs: no bulk export; terms restrict building catalogs.
- Kaggle "Spotify songs" CSVs: unclear licensing.
- Year-end chart scrapes: pop-heavy and unreliable (seen earlier).

## Lane mapping
Discogs genre/style → our lanes via a small reviewed lookup table (e.g.
Hip Hop→Hip-hop, Rock+Heavy Metal→Metal, Rock+Punk→Punk, Electronic+Disco→Disco).
Lane on the recognition list is a hint only — never used for scoring/routing.

## Next step (pending approval)
Offline sample: one decade, top 2,000 by listens, joined to MusicBrainz +
Discogs, reported with match rate and lane spread for owner review. No DB
writes until approved.
