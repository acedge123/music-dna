# Evaluate ChatGPT's 200-song decade pack

The pack isn't in this project yet. `docs/musicdna/decade-curation-2026-11-11/` doesn't exist here, so please merge the branch on GitHub first. It syncs over automatically.

## Once it's merged
1. **Read the README** and follow its instructions, unless they would break one of the safeguards below.
2. **Check every song** for:
   - title and artist already in the catalog (including the General-lane duplicates we hit last time)
   - plausible year
   - genre-era rules: no pre-1980 Electronic or Hip-hop; Classic Rock pre-1990, then Metal; Disco 1970s; Punk 1970s–90s
   - missing or placeholder trait scores
3. **Check every pairing** for:
   - both songs in the same genre and the same decade (neighboring genre and about one year of leeway are allowed)
   - at least one declared test with a 20-point contrast
   - a specific, unique saying
   - no repeats of existing matchups
4. **Report before loading.** Totals ready / needs-fix / reject, plus how each decade's playable matchups by trait would change. That's the coverage measure for decade runs.
5. **On your go-ahead:** load the ready songs and pairings in one database update and switch them on. Anything flagged stays off. Existing songs, scores and saved readings stay untouched.

## Safeguards (unchanged)
- New scores are marked editorial, not listener-tested.
- Historical evidence is never rewritten.
- The normal interview's matchup picking is unaffected; the new matchups mostly feed decade runs and their own genres.
