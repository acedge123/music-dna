# Song confirmation — flow sweep

## Rule

When confirming a typed song, offer matches from both active scored songs and unscored recognition identities, tied to the current text. Never show an old song or claim a miss before the current search completes. Confirmation must not score or activate recognition songs.

## Surfaces checked

| Surface | Source inspected | Result |
| --- | --- | --- |
| Web opening song 1 | `src/routes/onboarding.tsx`, `OpeningSongInput` | Uses the repaired shared input. Real guest desktop and phone selection passed. |
| Web opening songs 2 and 3 | Same route, later-slot render | Both reuse that input; `key={phase}` resets state between slots. Checked by reading code, not a new three-song submission. |
| Guest and registered search requests | `src/routes/api/v1/songs.search.ts` | Same public identity-only RPC; neither path depends on login. Real guest API probes passed; no registered session was used. |
| Database candidate retrieval | Applied migration `20261123155104` and `public-song-search.sql` | Normalizes before retrieval; active scored songs plus recognition; bounded response, no listener data, no writes, recognition dates hidden. Isolated database tests pass. |
| Ranking and query state | `song-search.ts`, `song-search-state.ts`, shared input | Combined title/artist orders, bounded typo fallback, identity deduplication, recording-variant grouping, query-bound pending/empty/error and keyboard state. Focused tests pass. |
| Web reference tool | `tools/musicdna/web-reference.tsx` | Reuses repaired input. Inspected; not separately run. |
| Flutter shared server contract | `docs/musicdna/flutter-opener-song-search.md` | Same repaired endpoint and response shape; explicit current-query, cancellation, empty/error and acceptance guidance. |
| Bundled Flutter foundation | `apps/mobile/.../onboarding_stub_page.dart`, `onboarding_remote_data_source.dart`, README | Plain song entry only, no autocomplete request or dropdown. This is not evidence of the current external TestFlight implementation. Flutter adoption remains open with the Flutter team; this TanStack workspace does not support implementing native Flutter changes. |
| Admin song table | `src/routes/_authenticated/admin.tsx`, `src/lib/admin.functions.ts` | Scored-catalog editing/filtering, not listener confirmation. Query keys contain search text; no previous-query placeholder results. Must not mix unscored recognition rows into scored editing controls. Left unchanged. |
| MCP catalog search/list/get and standard search/fetch aliases | `src/lib/mcp/catalog.ts`, `tools.ts`, migration `20261119040256` | Explicitly scored-catalog review tools, with stable IDs and cursor pagination; search/fetch lead to scores and explanations. Not a listener dropdown. Recognition remains absent here as previously disclosed; unifying this connector needs a separate identity/source contract, not silently substituting recognition IDs into scored fetches. Left unchanged. Hosted connector was not run. |
| Hidden opener enrichment | Four scored-song lookup sites in `src/lib/musicdna.functions.ts` | Scored lane/year enrichment, not displayed confirmation. Recognition intentionally cannot supply scoring or lane evidence. No lane/era policy changes made. |
| Opener intake database capture | `capture_musicdna_opener_intake` migration and later identity hardening | Receives submitted strings, records demand rather than autocomplete results. Does not serve suggestions; confirmation still submits plain title/artist text. Existing rows untouched. |
| Recognition collection/import | `tools/musicdna/expand-recognition.py` read/import functions | Explicit operator collection, not live dropdown or background search. Reads/deduplicates identities and imports without scoring. No collection or import run. |
| Profile and saved readings | `src/routes/_authenticated/profile.tsx` | No song-entry autocomplete; displays saved evidence. Not rewritten. |

No further web confirmation implementation was found outside the shared input and endpoint. The other catalog lookups have different purposes and were not repurposed or granted additional access.

## Verification limits carried forward

- 21 search tests, touched-file lint and preview compilation passed; real guest search and desktop/390px confirmation, stale-result clearing and error feedback passed.
- The last production `Dreams` probe still omitted Fleetwood Mac. Updated Vercel deployment and subsequent live acceptance remain required.
- Current external Flutter build, registered-user interaction and hosted MCP behavior are not verified.
- Existing security findings are outside this repair; intentional public identity projection warnings are documented in the Flutter handoff.
- No saved readings, catalog rows, permissions outside the approved search interface, selection settings, flags or example data changed.