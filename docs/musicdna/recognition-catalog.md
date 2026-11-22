# Unscored recognition catalog

## Approved import — 2026-11-22

All 1,477 rows in `recognition-sample-1980s/sample-1980s.csv` were imported into the shared Supabase `song_recognition` table. Import keys are MusicBrainz recording UUIDs; repeating the import ignores existing keys. Original source rows remain intact. The batch is `listenbrainz-1980s-2026-11-22`.

This is **identity confirmation only**, not 1,477 additions to the scored catalog. No dimension scoring, song activation, pairing creation, experiment enrollment or export is performed. Importing a row does not invent listener demand.

The source contains 146 credited artist strings but 129 canonical artist MBIDs; alternate credits account for the difference. The original sample favors the old catalog's artists and up to twelve tracks per artist. Future samples instead use ListenBrainz sitewide artist rankings, capped at three tracks per artist.

## Date and version caution

The original sample assigned album release-group years, which are not reliable original recording years: for example, the selected Prince “When Doves Cry” MBID is a live version despite its short title. Preserve that source provenance, but **do not display these dates as confirmed facts**. The search API returns null years for recognition-only matches. Scoring/promotion still requires precise original-recording identity and year review; recognition IDs are never scored song IDs.

The new ’90s sampler checks MusicBrainz recording first-release-date and excludes known live/remix/demo disambiguations. These remain community metadata, not independent factual verification. Artist popularity is a ListenBrainz-user signal, not a census of recognition or a guarantee that a track was a hit.

## Web and Flutter

`GET /api/v1/songs/search?q=…` combines active scored songs and recognition rows with the existing identity-only response. Title/artist duplicates prefer the scored song. Public reads use a publishable client and narrow public read policies, not a service key. Recognition writes are operator-only.

The same three plain text opener strings are submitted. The existing transactional intake captures actual demand whether a submitted song is recognized or unknown; recognized-but-unscored songs still await AI scoring and human review. No recognition ID or lane hint changes lane/era routing. See `flutter-opener-song-search.md`.

Database import is applied; Vercel must deploy the expanded search before production web/Flutter receive it. Flutter must hide a null year and keep result IDs opaque. Authenticated opener submission has not been newly verified in this change; existing capture behavior is unchanged.

## Offline ’90s generation

Run `python3 tools/musicdna/build-recognition-sample.py --decade 1990 --artists 400 --per-artist 3 --output /tmp/recognition-1990s` with the already stored `LISTENBRAINZ_TOKEN` available. Do not print or commit the token. MusicBrainz calls are globally paced above one second apart; bounded retries and per-artist gaps remain explicit. Provider caches stay under `/tmp`, not in source deliveries.

The artist ranking is retrieved from ListenBrainz `stats/sitewide/artists?range=all_time`. Recordings use authenticated ListenBrainz artist popularity. MusicBrainz browse/lookup verifies album and recording dates. This is current all-time audience popularity, **not a historical 1990s chart**, and browsing only the first 100 album groups can miss large discographies. Genre tags are source hints; no manually assigned lane labels or automatic lane mapping.

The ’90s CSV was imported after explicit owner approval on 2026-11-22: 413 new records and two existing recording-ID duplicates, for 1,890 recognition records total. All 415 source IDs were read back and newly inserted values matched the source. Existing records were not overwritten. Batch: `listenbrainz-1990s-2026-11-22`; source recording years remain provisional and hidden in recognition-only search. Full release details and genre tags remain in the versioned CSV; identity, source year/basis, popularity and batch are stored in recognition. No scoring or activation occurred.

## Approved 2000s import — 2026-11-22

The completed sample in `recognition-sample-2000s/` contains 598 recordings across 200 canonical artists, maximum three per artist. Owner approved import on 2026-11-22. All 598 were new and every stored identity/source value was verified against the CSV; replay ignored existing IDs without changing values. Batch: `listenbrainz-2000s-2026-11-22`. Recognition total: **2,488 records**. No scoring, activation, demand counts, routing or saved-reading changes. Provisional recognition dates remain hidden; source genre tags remain in the CSV, not assigned lanes.

## 2010s collection and 5,500 expansion — 2026-11-22

Owner requested the next review sample. The same 400-artist ListenBrainz ranking snapshot is reused for comparability; no MusicDNA artist seed list. Maximum three recordings per canonical artist, with the same provisional MusicBrainz date/version checks. Command: `python3 tools/musicdna/build-recognition-sample.py --decade 2010 --artists 400 --per-artist 3 --output /tmp/recognition-2010s`.

That temporary collection disappeared before delivery and was never imported. Owner authorized rebuilding/importing the 2010s and continuing toward 5,500 on 2026-11-22. Durable replacement artifacts now live in `recognition-expansion-5500/`, with a broader 1,000-artist seed and exact-ID batched MusicBrainz date/disambiguation checks. The replacement also permits singles rather than requiring album-group matches; dates remain provisional and hidden.

Verified partial additions: **108 2010s, 61 2020s, 24 1970s, 22 1980s, 18 1990s, 38 2000s**; 271 new identities, **2,759 total distinct title/artist identities**. The target still needs **2,741**. Provider busy errors interrupted the paced collection; it is paused, with 51 ranked artists checkpointed and explicit gaps. No background job remains running. Resume instructions, receipts and method limitations are in `recognition-expansion-5500/README.md`. No scoring, activation, demand counts, routing, saved readings or settings changed.