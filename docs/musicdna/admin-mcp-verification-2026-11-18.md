# AB-88 verification — 2026-11-18 Pacific / November 19 UTC

Source baseline: `030dc3b`. Production unchanged.

## Source/local checks

- Clean npm lock install succeeds; no previously locked dependency version changed. MCP SDK 0.22.2 and its transitive packages are added; npm/Bun locks synchronized.
- TypeScript no-emit passes; targeted ESLint passes.
- Vercel preset production build passes. Optional Workers import remains external on Node; no fake environment or key is introduced.
- Full Vitest: **759 passed, 109 skipped** in the final run, including standard discovery aliases.
- Focused MCP: **24 passed** (14 native database cases, 8 contract cases, 2 HTTP cases). The native full export has 1,006 records spanning approved/pending/rejected; both whole snapshot and authenticated 25-record page reconstruction are checked. A mock Data API traversal checks all 768 approved records without loss/truncation at adaptive page boundaries.
- Native checks include anon/ordinary/anonymous-Auth denial, separate reader/editor/reviewer access, direct writes/role escalation denial, stale score/version rejection, idempotent replay/conflicts, before/after history, exact evidence and unresolved-finding deduplication, cross-owner/expired exports and current role revocation. These are local PostgreSQL fixtures, not hosted end-to-end acceptance or concurrent multi-connection load tests.
- HTTP checks verify protected metadata and unauthenticated 401 challenge, origin and request-size rejection, including TanStack wrapped Request compatibility. The actual loopback Vite server also returned the pinned metadata and a 401 / WWW-Authenticate challenge for an anonymous POST. They do not establish a complete OAuth browser round trip.

The pre-existing deferred-read fixture intermittently treated two same-millisecond PGlite inserts as chronologically ordered. The test now assigns the second pick an explicit later timestamp; no production deferred-read code or migration changed. The first full reruns caught this fixture failure; isolated rerun passed, and the final complete suite is rerun after the deterministic fixture correction.

## Existing main checks remain red

`npm test` stops on the pre-existing pinned learning-contract hash mismatch. `check:routing-artifact` also reports existing source/artifact drift. Both failures reproduce on detached, unchanged `030dc3b`; affected scripts, validators, manifests and routing sources are unchanged in this branch. Their pins were not silently rewritten. `check:learning-migrations` passes. Do not describe the complete npm test gate as green.

## Read-only live evidence

All SQL used explicit `BEGIN READ ONLY` and local 10-second timeouts; only catalog text/metadata and the expressly named QA session's numeric diagnostics were inspected.

- Approved Song Whys **768**; pending **27**; total saved **795**.
- A limited regex screen over all approved text matched **27** recording/technique claims (close-mic/falsetto/steel-guitar/recording-location/double-track patterns). These are candidates requiring verification, not 27 proven errors or a complete musical accuracy audit.
- The narrow unsupported-intention regex matched **0** approved records; this does not establish that all psychological claims are absent or accurate.
- `Burn, Burn, Burn` — Zach Bryan (2022), song `0db45f64-84ee-12c0-4cf7-217b5bd98148`: **3 saved explanations, 0 currently approved**. The assignment's supplied wording is retained in a local regression fixture; it is not represented as a verified current approved row.

### Requested QA session

`fd7d5b61-1cdb-4a40-a027-ad6efd2e21d5` exists. Retained events: 6 choice_made, 6 choice_scored, 6 pairing_shown, 2 read_shown and 1 session_completed. **Saved reading versions: 0** at inspection. A completed-session event is not proof of a saved final report.

The only retained `llm_calls` entry is one deterministic analyst/ok record with 0 ms latency at `2026-11-19T00:52:16.787792Z`. Writer/reviewer calls, retries and a provider timeout cause cannot be established from that table. Do not invent them or label their latency healthy. No actual quip-display event type was returned for this session; exact displayed strings, timings and punchline completion cannot be reconstructed from the static filler pool.

Given the assignment's supplied years, 2012 is 13 years and 2014 is 15 years from the closest 1999 opening anchor: both fail a ±10 rule. This arithmetic does not prove which selector fallback or saved resolved year was actually used; AB-89 must trace the shared selection evidence.

## Not yet verified

- Full historical migration-chain replay, hosted RLS/PostgREST behavior and concurrency.
- Actual OAuth setup/consent, ChatGPT/Claude signed-in tool invocation.
- Production collection traversal/export counts through the deployed MCP.
- Production proposal/human approval flow and artifact retention cleanup.
- Phase 2 pairing simulations/interview traces; Phase 3 quality/learning tools.
