# Song Whys: optional recording color

## Flag and rollout

`MUSICDNA_SONG_WHYS_V1=1` enables capture and hypothetical preparation for future picks; unset or `0` is off. Apply `docs/musicdna/song-whys-capture-review.sql` as a forward migration only with owner approval before enabling. No historical backfill. Existing recordings without reviewed descriptions remain usable.

Lovable preview can have its own server environment flag, set through Lovable secrets/settings; this does not change Vercel. Production at musicdna.fm requires the same flag in Vercel and redeployment. An admin-managed shared flag system is possible, but is not added in this change. Existing safety/learning/release flags are untouched.

Turning the flag off stops future capture and preparation enrichment. Already frozen descriptions continue replaying with their saved readings. This avoids changing historical receipts. An interview spanning a flag change can have some annotated and some unannotated choices; each choice is explicit. A changed annotation or flag-dependent draft payload invalidates exact-match reuse.

## Frozen contract

Optional `choices.evidence.song_whys` contains `version: "song-whys-v1"`, plus `chosen` and `rejected` arrays of `{id, song_id, axis, score_at_write, audible_evidence, scoring_version}`. The vote trigger selects approved rows whose score exactly matches the frozen song value and whose axis was declared by the pairing. It never trusts supplied explanation text. Individual approval alone is insufficient if a row is stale. Stored scoring_version is provenance, not an additional freshness gate in this version.

Ledger scoring and claim thresholds do not read these annotations. The writer and reviewer receive at most two tested traits per cited matchup, one explanation per side per trait, as recording descriptions only—not motives, interpretations or additional votes. Same existing Sol/Terra pass; no additional model call. Actual latency needs measurement.

## Web and Flutter

`dna_summary.receipts[]` gains optional `song_whys: {chosen: [...], rejected: [...]}` carrying the frozen descriptions for that receipt's tested axis. Existing fields and receipt-selection rules are unchanged. Web displays the song name and audible sentence below the receipt. Flutter may render these optional fields identically; absent means omit, never fetch today's catalog or infer a reason the listener chose the song. No new request or client capability header is needed. Existing V1 access gates remain unchanged.

Historical saved prose is never regenerated. New descriptions also travel through the existing shared Critic facts; they must never expose upcoming matchup tests. Waiting quips are unchanged.