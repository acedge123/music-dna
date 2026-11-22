# 2000s recognition review sample

Completed and saved on 2026-11-22. **Review only — not imported, not scored.** This is a proposed unscored recognition batch, not a scored-catalog addition.

- **598 recordings across 200 canonical artists**, at most three recordings per artist.
- Artist seed: the first 400 ListenBrainz sitewide all-time ranked artists, not MusicDNA's catalog artist list.
- Selection: popular recordings attached to original-looking 2000s album groups, checked against MusicBrainz recording first-release-date; known live/remix/demo disambiguations excluded.
- `sample-2000s.csv`: title, artist, provisional year, release, recording/artist IDs, source genre tags, popularity and provenance.
- `summary.json`: totals and provisional year distribution (48–78 recordings per year, 2000–2009).
- `gaps.json`: 200 skipped artists. Most had no eligible 2000s original album/recording match in the first 100 album groups (expected for artists whose peak sits outside the decade, e.g. The Beatles, Pink Floyd, Kendrick Lamar, The Weeknd). At least one provider/lookup gap (Gorillaz) may deserve a retry before import.

## Review cautions

MusicBrainz dates are community metadata, not independent release verification. A recording-ID check does not prove the exact original version or correct date; review precise identity/date before scoring or promotion.

This is a current ListenBrainz audience sample, not a historical chart or guarantee of recognition. Only the first 100 album groups per artist were browsed, and singles-only hits may be missed. Genre tags are hints, not assigned MusicDNA lanes. Provider gaps mean the sample is not exhaustive.

If approved, import follows the same path as the ’80s/’90s batches: unscored `song_recognition` records keyed by MusicBrainz recording ID, recognition-only dates hidden under the existing API contract, and no demand counts, scores, pairings, routing, saved readings or deployment changes.

Generator: `tools/musicdna/build-recognition-sample.py`. Source/API details and Flutter behavior: `../recognition-catalog.md`.
