# 1990s recognition review sample

Completed and saved on 2026-11-22. Owner-approved recognition import applied on the same date: **413 new records, two recording IDs already present**. All 415 source IDs were read back; all newly inserted title/artist/artist-ID/year/popularity values match the source. This is **unscored recognition only**, not a scored-catalog addition.

- **415 recordings across 140 canonical artists**, at most three recordings per artist.
- Artist seed: the first 400 ListenBrainz sitewide all-time ranked artists, not MusicDNA's catalog artist list.
- Selection: popular recordings attached to original-looking 1990s album groups, checked against MusicBrainz recording first-release-date; known live/remix/demo disambiguations excluded.
- `sample-1990s.csv`: title, artist, provisional year, release, recording/artist IDs, source genre tags, popularity and provenance.
- `summary.json`: totals and provisional year distribution.
- `gaps.json`: skipped artists, including **25 provider/lookup gaps**. Other artists had no eligible match or artist identity.

## Review cautions

MusicBrainz dates are community metadata, not independent release verification. Apparent anomalies remain in the sample: Metallica's “Enter Sandman,” “Nothing Else Matters” and “The Unforgiven” are returned with 1990 dates and need original-release verification before any date display or promotion. A recording-ID check does not prove the exact original version or correct date.

This is a current ListenBrainz audience sample, not a historical chart or guarantee of recognition. Only the first 100 album groups per artist were browsed, and singles-only hits may be missed. Genre tags are hints, not assigned MusicDNA lanes. Provider gaps mean the sample is not exhaustive.

The recognition catalog now contains **1,890 records** across the approved ’80s/’90s imports. Existing duplicate records were not overwritten. Batch: `listenbrainz-1990s-2026-11-22`. Recording dates remain provisional; full release details and source tags remain in this CSV, while the recognition import retains identity, source year/basis, popularity and batch. Recognition-only dates remain hidden under the existing API contract. Review precise identity/date before scoring or promotion. No demand counts, scores, pairings, routing, saved readings or deployment settings changed.

Generator: `tools/musicdna/build-recognition-sample.py`. Source/API details and Flutter behavior: `../recognition-catalog.md`.