# 1990s recognition review sample

Completed and saved on 2026-11-22. This is an unscored review sample, **not imported into the recognition database or scored catalog**.

- **415 recordings across 140 canonical artists**, at most three recordings per artist.
- Artist seed: the first 400 ListenBrainz sitewide all-time ranked artists, not MusicDNA's catalog artist list.
- Selection: popular recordings attached to original-looking 1990s album groups, checked against MusicBrainz recording first-release-date; known live/remix/demo disambiguations excluded.
- `sample-1990s.csv`: title, artist, provisional year, release, recording/artist IDs, source genre tags, popularity and provenance.
- `summary.json`: totals and provisional year distribution.
- `gaps.json`: skipped artists, including **25 provider/lookup gaps**. Other artists had no eligible match or artist identity.

## Review cautions

MusicBrainz dates are community metadata, not independent release verification. Apparent anomalies remain in the sample: Metallica's “Enter Sandman,” “Nothing Else Matters” and “The Unforgiven” are returned with 1990 dates and need original-release verification before any date display or promotion. A recording-ID check does not prove the exact original version or correct date.

This is a current ListenBrainz audience sample, not a historical chart or guarantee of recognition. Only the first 100 album groups per artist were browsed, and singles-only hits may be missed. Genre tags are hints, not assigned MusicDNA lanes. Provider gaps mean the sample is not exhaustive.

Review familiarity, missing artists, versions and dates before a separate import decision. Recognition-only dates should remain hidden under the existing API contract. No demand counts, scores, pairings, routing, saved readings or deployment settings changed.

Generator: `tools/musicdna/build-recognition-sample.py`. Source/API details and Flutter behavior: `../recognition-catalog.md`.