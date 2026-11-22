# Recognition expansion to 5,500

Owner authorized import of the 2010s sample and continued recognition collection/import toward 5,500 on 2026-11-22. The previous 2010s output was only temporary and disappeared before delivery; it is rebuilt here, not claimed as imported from missing files.

## Verified status — 2026-11-22 22:52 UTC

**2,759 distinct title/artist identities stored; 2,741 still needed.** This run inserted and read back 271 new records: 108 from the 2010s, 61 from the 2020s, 24 from the 1970s, 22 from the 1980s, 18 from the 1990s and 38 from the 2000s. The earlier 2,488 rows were not replaced. The rebuilt 2010s selection is partial, not the lost original completed list.

51 of 1,000 ranked artists were processed. MusicBrainz repeatedly returned busy responses, and the first bounded collection exceeded its ten-minute limit. A slower retry successfully imported the verified subset. Remaining provider gaps are recorded in artist checkpoints. Collection is **paused**, not running in the background; finished metadata is now durable. Resume with the command below, retrying gaps as appropriate. The 5,500 target has **not** been met.

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