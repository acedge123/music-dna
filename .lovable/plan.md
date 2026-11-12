# Let opener years steer the first matchups

## What happens today
- In a normal reading, matchups are chosen from the opener songs' genre lane and from what each matchup can test. Song years are loaded but never used to pick a matchup. Only "Explore your DNA" decade runs filter by year.
- So Dreams (1977), New Order (1980s) and U2 (1980s) put her in Alternative/General. Any song in that lane could come up, including recent ones. Newer Alternative songs were added recently, so they now make up a bigger share of that lane.

## Proposed change
1. Work out the listener's era from the three opener songs, weighted 3-2-1 the same way as the lane (for example, "mostly 1975–1990").
2. For the first two or three matchups, prefer matchups whose songs fall within about one decade of that era. Neighboring decades and a year or so of slack are fine.
3. This is a soft preference, not a filter. If too few in-era matchups can still test something, we fall back to the current pool, so no one gets stuck.
4. After the opening matchups, the preference fades so the rest of the interview can still test across eras. This keeps her readings from turning into a nostalgia test.
5. Skips stay as they are: they find a replacement and never count as picks.
6. Web and Flutter share this automatically because selection happens on the server.

## Checks
- Test: when the openers are 1977/1983/1987, the first matchup has songs from about 1967–1997 whenever such matchups exist.
- Test: when no in-era matchups exist, a matchup is still offered.
- Re-run her openers in the preview and look at the first three matchups.

## Open question
- The TestFlight session with New Order didn't show up in my lookup (her account's opener list now shows other songs). If you can share the time or her email, I'll confirm exactly which songs she was shown.
