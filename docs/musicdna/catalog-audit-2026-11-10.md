# Specialist activation and full catalog audit — 2026-11-10

## Approved additions

Alan approved loading and activating the merged specialist proposal. The connected Supabase catalog now contains all **69 active songs and 46 active pairings**:

| Lane | Active songs | Active pairings |
|---|---:|---:|
| Yacht Rock | 15 | 10 |
| Disco | 18 | 12 |
| Punk | 18 | 12 |
| Reggae | 18 | 12 |

Import receipt: `20261110041728_a227f014-681f-470a-8782-ac16a96eb42e.sql`. Original song rationale receipt: `20261110042852_0549719e-fbd2-43df-9c0e-391e90f465f8.sql`.

All submitted ten-axis scores, years, titles, artist names, sub-lanes, declared tests, hypotheses and phrases are retained. Scores remain provisional editorial estimates, **not listener-validated predictions**. The first two import attempts rolled back on an audit alias collision; the corrected atomic import passed all tests and the existing activation trigger. No existing songs, pairings, evidence, results or feature flags were altered.

The four genres have explicit support in every shared opener/classifier prompt and both lane lists, plus admin catalog/session filters. Exact catalog `punk` stays Punk; legacy `punk_noise_edge` and post-punk families stay Alternative. Web and REST share the same implementation. Production still needs the updated classifier code to be deployed; active database rows alone do not establish production routing acceptance.

## Whole-catalog review

Read-only audit covered **721 songs / 487 pairings**, including **695 active songs / 446 active pairings**.

### Passing safety checks

- Every live pairing has at least one valid declared test with a 20-point contrast.
- Every new specialist declared test passes; all 46 specialist phrases are unique.
- No live matchup uses an inactive song. No self-pairings.
- No missing live phrase or diagnostic hypothesis. No duplicate live phrase.
- Every catalog song has all ten score columns populated.
- All 324 choices present at baseline retained non-null frozen evidence; catalog activation did not modify them. Non-null does not establish historical snapshot-contract validity.

### Findings — review only, not silently repaired

1. **50 weak declared tests across 35 live pairings:** Classic Rock 20 tests / 16 pairings; Country 16 / 11; R&B 8 / 5; Metal 6 / 3. Each affected pairing still has another valid test, so it passes the existing minimum-one activation rule. This is weaker than “every declared test passes.” Remove unsupported tags after editorial review, rather than inflating song scores. Frozen choice evidence must remain untouched.
2. **19 duplicate normalized title/artist groups**, predating the specialist import. Eighteen are Electronic/Alternative-family overlaps (including Blue Monday, Angel, Teardrop, Hyperballad, Pacific State and Underworld/Prodigy/Orbital/Moby entries); Paranoid exists in Metal and Classic Rock. These may be intentional lane-local representations, not safe automatic deletes. Confirm recording identity and lane ownership before deduplication; retain all historical references.
3. **One repeated live unordered song pair:** Alternative IDs `df3bc0b2-79cf-432e-8318-d3fa59f166c7` and `b788a34b-7948-4460-900f-c8b4397620d4`. Different sayings do not make the underlying song pair distinct. Review usage before retiring one; do not delete history.
4. **167 active songs have no live matchup.** Alternative-family gaps dominate: Sophistipop 25, Punk/noise 24, Artrock 22, Electronic crossover 16, Shoegaze 15, Post-punk 13, Goth 13, Grunge 13, Britpop 12, Manchester 11. R&B has two and Reggae has one. The new Reggae orphan is **Java — Augustus Pablo**, which appears in the proposed songs but none of its 12 pairings.
5. **457 active songs have no song-level rationale.** All 69 specialist rationales are present; missing rationale is historical. Hypotheses in all active pairings are present, but metadata completeness is not editorial calibration.
6. **Legacy placeholder warning:** 103 active songs have movement, atmosphere, transformation and community all set to 50 (Hip-hop 38, Pop 32, Electronic 29, plus four old aliases). This is a narrow sentinel, not proof all their remaining axes are placeholders. Independently audit/rescore them before claiming high diagnostic quality. The 20 new Hip-hop songs / 24 matchups remain inactive; this request did not authorize their activation.

## Editorial assessment of new lanes

- **Yacht Rock:** clean propulsion, solitude and command contrasts; no texture tests because most tracks are uniformly polished. Focus coverage is appropriate, not an excuse to infer refinement preference from every pick.
- **Disco:** good immediate-band versus synthetic/slow-burn contrasts. Community has only one declared test; perspective two. Neither can independently satisfy a three-distinct-pairing claim threshold from this pool. Avoid treating every dance record as diagnostic movement evidence.
- **Punk:** contrasts vulnerability, satire, command and exploratory structure, not “punk means angry.” Several political lyric contrasts share perspective/confidence/tension and may confound attribution. Specific track context matters.
- **Reggae:** roots, dub and dancehall are represented, but this is still a broad lane. Instrumental dub perspective scores need musical/editorial review; absence of lyrics is not automatically social witness. Java lacks a matchup. Do not infer ethnicity, politics or personality from reggae selections.
- Track years/mix identities remain unverified externally. Examples needing master/year reconciliation include Sailing (album 1979 versus single 1980), Money in My Pocket (original versus later hit recording) and King Tubby Meets Rockers Uptown (single versus album dating).

## Verification and limits

- Preview guest browser: three actual Yacht Rock openers → same-lane first pairing → committed choice → Round 2 with another Yacht Rock pairing and a bounded critic read. New covers use the approved branded fallback, not unverified album art.
- Regression tests cover exact specialist assignment, mixed three-song weighting, legacy family preservation, every new declared contrast, phrase uniqueness and six-round pool capacity.
- Production version endpoint reported `f0f67397b342aa85846494def5ce573f1727e56e`, persistence V2 true. This does not establish that the new classifier edits are served. No production feature flags were changed; no full production specialist interview was verified.
- Authenticated admin browser acceptance is unavailable for external unmanaged Supabase; source/filter updates and data readback are verified, not the signed-in dashboard flow.
- Database checks found 43 pre-existing security/lint findings: seven RLS-without-policy notices, three public and eight signed-in security-definer execution warnings, 24 anonymous-policy warnings, and disabled leaked-password protection. Not introduced by these data-only imports; review separately, distinguishing intentional deny-all/service-only tables from real exposure.
- This is a structural/data/editorial review, not a listening study or exhaustive release-metadata verification. Existing gaps are recorded, not claimed repaired.