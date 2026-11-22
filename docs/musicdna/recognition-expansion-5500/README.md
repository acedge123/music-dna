# Recognition expansion to 5,500

Owner authorized import of the 2010s sample and continued recognition collection/import toward 5,500 on 2026-11-22. The previous 2010s output was only temporary and disappeared before delivery; it is rebuilt here, not claimed as imported from missing files.

## Verified status — 2026-11-22 23:28 UTC

**3,293 distinct title/artist identities stored; 2,207 still needed.** The modern-decade retry added and read back **534 new records: 335 from the 2010s and 199 from the 2020s**. Stored recognition totals are now **443 for the 2010s and 260 for the 2020s**. No older-era records were imported during this retry, and all existing rows remained unchanged. The earlier bounded run had added 271 records across all decades; the rebuilt 2010s selection remains partial, not the lost original completed list.

181 of 1,000 ranked artists have now been processed, up from 51. Interrupted lookups were retried, followed by two sixty-artist collection steps; some missing indexed identities and provider gaps remain recorded in artist checkpoints. Each insert was read back, with unchanged-existing-row checks and a verified maximum of three stored expansion songs per artist/decade. Six operator regression tests pass. Collection is **paused**, not running in the background; finished metadata is durable. The 5,500 target has **not** been met; further bounded collection and unresolved identity lookups remain open.

For this retry, the existing operator module was invoked with an in-process import filter accepting only years 2010–2029. The first five-gap pass also restricted candidate selection to those decades; earlier older-era selected metadata for the two affected completed artists was retained when saving the final checkpoints. Later passes collected all supported decades for future review but imported only the two requested modern decades. No application or operator source code changed. `import-status.json` records the last bounded run (244 additions), not the whole request's cumulative 534 additions.

## Method and safeguards

- ListenBrainz sitewide all-time ranked artists, not the scored MusicDNA artist list; up to three recordings per canonical artist **per decade** in this expansion.
- First 100 distinct original-looking popular recording titles per artist. Exact recording IDs are looked up in paced MusicBrainz batch search; only returned matching IDs with a usable recording first-release-date count. Known live/remix/remaster/demo/instrumental/karaoke versions and dates after the current year are excluded.
- Unlike the prior sample, this does not require an album-group match, allowing singles. Dates remain community-maintained and provisional; indexed metadata can lag. Missing IDs/dates are skipped, not invented or declared verified. Genre tags are provenance hints, not assigned lanes.
- Search continues to hide provisional years. No scoring, activation, pairings, demand counts, routing, experiments, learning exports, settings or saved reading changes.
- Existing IDs are never overwritten. Counts toward 5,500 use normalized title/artist identities, not just recording IDs; alternate punctuation or case does not inflate the target. Existing historical duplicates are left untouched.
- Import priority: 2010s, then the partial 2020s through the current year, then broader 1970s–2000s coverage. This target is breadth, not an equal decade quota or proof listeners know each song.

## Durable artifacts

`selected-artists/` stores only selected public candidate metadata and explicit gaps after each artist, not raw provider responses or credentials. The public artist ranking is pinned. Decade CSVs and summaries refresh every 25 artists. `import-status.json` reports verified database readback and remaining count after each bounded run. Provider interruption can resume without losing finished artists; gap rows remain inspectable.

Operator command (credentials only in environment):

```sh
python3 tools/musicdna/expand-recognition.py --output docs/musicdna/recognition-expansion-5500 --artists 1000 --steps 100 --target 5500 --execute
```

`--execute` is required for inserts. Re-run bounded steps until `complete` is true; no unattended schedule or paid AI calls are created. If the ranked seed is exhausted before the target, report the gap rather than padding with duplicate recordings or lowering identity checks.

Use `--retry-gaps --steps 25` for a bounded gap retry. Imports also enforce the three-per-artist/decade cap against already stored expansion records, so a later successful lookup cannot inflate coverage through retries.