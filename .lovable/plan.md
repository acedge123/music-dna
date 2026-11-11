# Decade Readings — "Does your taste hold up in another era?"

## The idea
After a listener finishes their main reading, offer links like "Take it to the '70s / '80s / '90s / 2000s / 2010s / 2020s". Each decade run is a normal six-pick Critic interview, with every matchup taken from that decade. The payoff compares it to the original reading: "Your taste for slow reveals survives in the '80s — but the crowd finally wins."

## Honest answer: the idea is easy, the catalog is not ready yet
- Matchups have to stay inside one genre lane (a project rule). A decade run therefore needs enough songs and matchups in **one lane and one decade**, not across the whole catalog.
- Active songs by decade today: pre-1980 140, 1980s 133, 1990s 228, 2000s 70, 2010s 88, 2020s 36. Split across about 12 lanes, most lane-and-decade combinations will have only a few songs. That is far short of the 6+ fresh matchups a run needs.
- There is already an older, separate '80s page (a song-naming flow, not matchups). The plan replaces it with the new decade runs rather than keeping both.

## Plan
1. **Coverage check (no changes).** Count live matchups for each lane and decade, and list which combinations can support a six-pick run (target 10+ matchups each, so it can still adapt to the listener).
2. **Only show decades that are ready.** The end-of-reading links appear only for decades with enough matchups in the listener's lane. Others say "coming soon" or stay hidden.
3. **Accounts.** Guests see the decade links with "Sign in to save and compare readings". Signing in keeps the original reading. (This depends on safe guest-to-account linking, which is still open future work.)
4. **Decade run.** Same interview, Critic, review checks and frozen-evidence rules as now. Matchup selection is limited to that lane and decade. It is saved as its own reading, tagged with the decade and linked to the original reading.
5. **Comparison payoff.** At the end, the Critic compares the two saved readings: which traits held, which flipped and which were not tested. Claims still need the usual evidence thresholds, and anything not tested gets no claim.
6. **Fill the gaps.** Add songs and matchups lane by lane, starting with the decades and lanes listeners pick most, using the same scoring process as recent catalog batches.
7. **Account page.** A simple list of your readings: the original plus each decade.

## Open questions
- Decade by song release year only (a 1979 song counts as the '70s)?
- If your lane is thin in a decade, should we use a neighboring lane, or simply not offer that decade? Not offering it fits the within-lane rule.
- Should the original reading change when decade readings exist? Recommendation: no. Saved readings stay frozen, and the comparison is a separate piece.

## Technical notes
- Add a decade tag to sessions plus a link to the parent session. Filter the pairing selector by both songs' release decade. Add a ready-coverage check for each lane and decade.
- Comparison reads two frozen ledgers (`buildLedger` for each) and never mixes their evidence.
- Shared server contract so Flutter can use the same flow later.
