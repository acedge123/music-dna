# Flutter Backend Parity Requirements

October 10, 2026 | Lovable implementation handoff | documentation only

## Status And Scope

Reviewed web/backend: `acedge123/music-dna@877d7b0`. Flutter baseline:
`acedge123/idea-builder@0aa6e16` (merged PR #12). Continuation draft PR #11
is at `d86cacd`; feedback foundation draft PR #13 is at `c13ff73`.

This document describes observed integration gaps and the behavior required to
close them. It is not a claim that the whole backend is broken, a complete audit
of every PRD item, or deployment certification. Recheck these findings after
subsequent Lovable changes; close each with evidence, not a completion message.

Authoritative product requirements remain [PRD](product-requirements.md),
[decisions D01-D06](parity-decisions-v1.md), and the accepted
[experience contract](experience-contract-v1.md). Existing accepted wire shapes
remain valid until explicitly revised. **Suggested endpoint/field names below
are proposals, not already-deployed APIs.** Flutter must not call them until the
contract is agreed, implemented, and verified.

Ownership: Lovable implements web/backend, persistence, and migrations. Codex
implements native Flutter presentation and REST adapters. Both consume shared
fixtures. Do not move inference into Dart, call Railway per pairing, enable live
routing, or change the shipped Apple 0.1.1 (3) contract to close these gaps.

## Gap Matrix

| Area | Verified Source State | Required Outcome | Tickets |
| --- | --- | --- | --- |
| Chat transport | GET/POST `/api/v1/session/:id/chat` exist and call shared `chatTurnImpl` | Keep the transport; fix durable replay and restoration below | TGA-310, TGA-316 |
| Chat replay | Prior user mutation finds the first assistant message with a later timestamp; an absent reply becomes `reply: "", replayed: true` | Replay only the exact completed turn; pending/failed is not successful empty content | TGA-305, TGA-310 |
| Chat persistence | User and assistant inserts do not inspect returned errors; only the user row carries the mutation ID | Durable turn identity, checked writes, concurrent-key reservation, and no acknowledged unsaved reply | TGA-305, TGA-310 |
| Recent history | GET returns earliest 200 messages; generation context queries earliest 40; no cursor or stable message ID in the response | Recent context and complete, deterministically paged restoration | TGA-310, TGA-316 |
| Revised reading | GET exposes version/source/base/date only. Self-report versions copy base content and store deltas separately | Expose actual versioned interpretation and provenance, or explicitly label self-report metadata as not a revised reading | TGA-307, TGA-310, TGA-316 |
| Result feedback | `submitFeedback`/`getMyFeedback` are web server functions only; submit accepts neither result version nor mutation ID | Shared owner/version-bound REST read/write service with durable replay | TGA-313 |
| Feedback learning | First feedback insert invokes `nudgeCriticFromFeedback`; chat can persist tone signals per turn | Separate collection from learning; approve/document cadence and avoid treating every click as policy evidence | TGA-313, TGA-324 |
| Publication metadata | Explicit publish/revoke and private-link checks exist. Response contains public flag/token, but not canonical URL or published version | Return canonical URL and identify the frozen public result; prove it remains unchanged after chat | TGA-311, TGA-276 |
| Spec consistency | Reveal example depicts a usable share token, while AGENTS and route intent prohibit it | Update example to explicit null and state that publication is a separate action | TGA-306, TGA-311 |
| Requirement trace | PRD is v1.2; shared trace still declares v1.1 and omits CAT06/CAT07/CAT08 | Refresh trace in both repositories without converting pending requirements into accepted work | TGA-302, TGA-324 |

Source locations: `src/lib/musicdna.functions.ts` (`chatTurnImpl`,
`submitFeedback`, `getMyFeedback`), `src/routes/api/v1/session.$id.chat.ts`,
`src/routes/api/v1/session.$id.share.ts`, `src/routes/api/v1/share.$token.ts`,
and `src/musicdna/adapters/share-publication.ts`.

Existing strengths to preserve: opt-in experience v1, shared chat entry point,
choice evidence snapshots, frozen pairing-based results, separate self-report
storage, explicit publication/revocation, and local shadow routing. Source
presence alone does not prove concurrent or deployed behavior.

## 1. Durable Chat Turns

Required invariants:

1. Check authentication and session ownership before mutation lookup, model
   work, or persistence. Apply the documented not-found/forbidden policy
   consistently to GET and POST; missing sessions must not become generic 500s.
2. Give a logical turn a stable identity linking its user message, assistant
   reply, mutation key, and any self-report/result versions. Timestamp proximity
   is not linkage. A unique user-message index alone is insufficient.
3. Reserve a mutation atomically before model work. Concurrent requests for the
   same key must not generate two committed replies, versions, or learning
   updates. Same key/different normalized message is a conflict, not a replay.
4. Completed replay returns the exact saved reply and original turn identity.
   Check database errors for user message, assistant message, revision, and
   status writes. A 2xx completed acknowledgment requires durable nonempty reply
   content. Do not acknowledge success and hope persistence happened.
5. Represent pending/failed states explicitly. Define crash recovery between
   reservation, user persistence, model completion, reply persistence, and
   acknowledgment. Do not hold a database transaction open during a model call.
6. Allow a client to reconcile an uncertain POST through a read by exact turn
   or mutation identity. No blind resubmit under a new key after a timeout.
7. Preserve the original pairing vector/result/public snapshot. Extracted
   self-report must not count as another observed pairing or support vote.

Proposed additive completed POST fields: `mutation_id`, `turn_id`,
`assistant_message_id`, and IDs/versions of any committed revisions, alongside
the current `contract`, `session_id`, `reply`, and `replayed`. Define a typed
pending response and read/recovery procedure in the accepted spec before use.
Do not invent success text when a turn is pending.

Generation can be outside the atomic persistence transaction. If a crash causes
model work to repeat, document that limitation and bound cost; persisted outcome
and downstream learning effects must still be committed once per mutation.

## 2. Restorable History And Revised Readings

- History returns stable message IDs, turn linkage, and deterministic ordering
  (timestamp plus stable tie-breaker). Specify pagination direction, cursor,
  page size, and `has_more`; never silently truncate the transcript.
- Initial continuation loads the most recent page in chronological display
  order. Older pages remain retrievable without duplicates or lost messages.
  Generation uses recent context, not the oldest messages after the limit.
- A read after a successful POST includes the committed turn, or reports an
  explicit pending consistency state. Define read-after-write guarantees.
- Each displayed result version includes source, base version, creation time,
  actual approved interpretation content, and a safe explanation of what
  changed. Link the change to the originating self-report turn. Validate all
  references within the owned session.
- Do not call a copied version-1 payload a revised interpretation merely because
  its version number increased. If only self-report deltas were captured, expose
  them as distinct provenance metadata, not a fabricated changed reading.
- Keep previous versions retrievable. Native back navigation returns to the
  original version from which continuation was opened; no implicit replacement
  or publication of the latest chat version.
- Return a deliberate private DTO, not raw rows/prompts. No new raw vectors,
  private internal metadata, or another session's records in revision responses.

The current Flutter draft renders version metadata without inventing revised
content and treats incomplete acknowledgments conservatively. It still needs
the above contract for full restoration and visible interpretation revisions.

## 3. Version-Bound Result Feedback

Minimum service behavior:

1. Read feedback for the authenticated owner, exact session, and exact existing
   result version. Distinguish no saved feedback from failure to load it.
2. Write accurate / partly accurate / missed plus optional useful sentence,
   inaccurate sentence, and comment. Specify the wire vocabulary and alias
   mapping: web currently normalizes `partly` to `mixed` and `wrong` to
   `not_accurate`; Flutter labels are not a new API enum by themselves.
3. Sentence limits are 1000 characters each and comment limit is 2000. Agree
   trimming, omitted-vs-null, clearing, and replacement semantics. Validate
   result version and ownership server-side; do not trust an owner ID from a
   client or overload arbitrary `target` text as undocumented version identity.
4. Atomically maintain one current feedback record per owner/session/version.
   Same mutation and content replays the committed outcome without duplicate
   rows or learning events; same key with changed content conflicts. Different
   edits have new mutation identities. Define concurrent-edit conflict policy.
5. Return saved content, session/version identity, mutation identity, and
   completion/replay status. Provide an authoritative read that can prove the
   exact uncertain mutation completed. A null read alone does not prove failure.
6. Feedback must not alter scored choices, the diagnostic vector, frozen result,
   consent, or public snapshot. Interview reactions are a separate service.

**Proposed routes, pending agreement:**

- `GET /api/v1/session/:id/feedback?result_version=N`
- `POST /api/v1/session/:id/feedback` with `result_version`, `mutation_id`,
  `accuracy`, `most_accurate_sentence`, `least_accurate_sentence`, and `comment`.

Proposed read body: `{ contract: 1, session_id, result_version, feedback: null
| { mutation_id, accuracy, most_accurate_sentence, least_accurate_sentence,
comment } }`. Proposed completed write returns that saved object plus `replayed`.
These examples describe required identity/content, not finalized serialization.

Web and REST must call one service. No direct Flutter writes to Supabase tables,
undocumented TanStack server-function calls, or speculative REST adapter.
Flutter PR #13 stays capability gated until the real adapter is verified.

## 4. Publication Contract Completion

- Keep explicit owner publish/revoke. Reveal must return no usable token;
  `share_token: null` is acceptable and must match the documented example.
- Publish returns canonical HTTPS `share_url`, opaque token, and
  `published_result_version`; specify which version can be published in V1.
  Defaulting deliberately to frozen version 1 is preferable to implicit latest.
- The returned URL must resolve to the same approved frozen public projection
  on both REST and web. Do not expose private chat, self-report deltas, raw
  vectors/prompts, emails, or unrelated sessions.
- Revoke/deletion immediately invalidates access, including legacy UUID routes
  and cache behavior. Republish must not reactivate a previously revoked token.
- Resume exposes publication state and published version without automatically
  publishing. Clients never treat token existence as consent.

Flutter's current configured-origin URL fallback and public lookup verification
support today's response, but do not satisfy the PRD's canonical-URL and
published-version requirements by themselves.

## 5. Gradual Learning And Latency

Separate three concerns: interaction persistence, recommendation/scoring, and
calibration/learning. Persist meaningful choices and explicit feedback promptly;
do not perform a permanent learning update for every click. Deduplicate, retain
provenance, and aggregate enough evidence before a reviewed batch update.

Agent Brain is a periodically consulted recommendation/calibration engine, not
a mandatory remote real-time decision hop for every matchup. Cache versioned
recommendations/knobs locally and use safe local fallback when stale or offline.
Keep `MUSICDNA_ROUTING_MODE=shadow` until golden parity and real-session diffs
are accepted. This document does not authorize an Agent Brain network call.

Existing critic voice adaptation is not necessarily a diagnostic-vector update.
Inventory it separately. Document and approve whether it is immediate UX-only
adaptation or learning subject to batching; do not silently broaden policy.
No batch size, interval, confidence threshold, or promotion policy is approved
by this handoff. Those choices need measured evidence and explicit ownership.

Use D05 targets: local selection response <=100 ms; next usable round median
<=2 s/p95 <=5 s; cached result reopen <=2 s. Measure end-to-end on representative
devices/networks, with cold/warm runs, sample counts, failures and model cost.
No invented final-narration or chat latency target. Show honest waiting and
bounded recovery states; avoid extra model calls on replay/history reads.

## 6. Verification And Release Gate

### Shared Trace Repair

PRD v1.2 contains 79 requirement IDs; `requirement-trace-v1.json` still maps
76 from v1.1. CAT06 (2000-2026 coverage), CAT07 (familiarity/era confounds), and
CAT08 (modern-catalog acceptance) are missing. This is stale requirement
traceability, not evidence of missing commits or a reason to weaken the test.

Codex should coordinate a focused TGA-302 follow-up: refresh the PRD version and
all changed requirement text/priorities, add the three mappings with TGA-324 as
the primary catalog ticket and applicable mobile/release acceptance links,
retain pending acceptance status, and document scenario-specific verification.
Do not invent fixture IDs or call catalog expansion accepted because the IDs
are mapped. Keep the stable trace schema identifier unless the schema changes;
the PRD version is separate metadata.

Mirror the resulting JSON byte-for-byte into idea-builder, compare with `cmp`,
and run the actual trace readers in both repositories. Tests should match the
PRD's ID set and reject missing/duplicate/stale entries; do not simply bump a
hardcoded count to 79. Coordinate the two PRs so consumers do not unknowingly
use different fixture revisions. This documentation change does not modify
the shared fixture files.

Lovable should deliver the following in a reviewable change:

- Updated `experience-contract-v1.md` with exact routes, DTOs, limits, identity,
  pagination, completed/pending/conflict semantics, compatibility, and examples.
- Shared fixtures consumed by web and Flutter. Extend F06 (replay), F16
  (restoration), F18/F19 (publication), F21 (continuation), and F25 (feedback)
  with actual agreed wire responses; keep both repos' shared files identical.
- Route/persistence tests with authenticated test owners, not only mocked
  helpers or anonymous 401/preflight probes. Use an authorized staging/harness
  environment; production test writes require separate authorization.
- Duplicate and simultaneous submissions, changed-payload key reuse, lost
  acknowledgment, model failure, write failure, pending recovery, and late
  response after logout/account switch. Assert persisted row/version/event
  counts and exact reply identity, not just HTTP 200.
- More than 200 chat messages, identical timestamps, recent context, and all
  history pages restored in order. Two owners/two sessions/multiple result
  versions must never cross-contaminate content or feedback.
- Public snapshot unchanged by chat/feedback; valid publish URL; revoke/delete
  unavailable across REST/web/legacy links and caches.
- Compatibility checks for existing v0 routes without the experience header.
  Use additive fields where safe; version genuinely incompatible changes rather
  than silently redefining a deployed response. Document new-route opt-in rules.
- Database migration replay and remote-history reconciliation. The obsolete
  metal-seed no-op fix is already present; a remote-version mismatch is a
  different issue. Inventory actual missing versions before any repair; never
  erase migration history or remove indexes merely to make a check green.
- Sanitized deployment evidence identifying API SHA, migrations, environment,
  contract/header, requests/responses, and acceptance reviewer. Code merged,
  Vercel build green, database ready, and end-to-end accepted are separate states.

Then Codex integrates the actual adapters, verifies both clients against the
same persisted sessions/fixtures, and performs native keyboard, scroll,
large-text, screen-reader and navigation checks. Keep mobile capability gates
off until contract/persistence checks pass. Ticket implementation is not device
or release acceptance; do not close parent tickets based on fixture counts.

Suggested sequence: chat durability/restoration (TGA-305/310), versioned feedback
(TGA-313), revision content (TGA-307/310), publication metadata (TGA-311), then
cross-client/device and release acceptance (TGA-321/326). These can be separate
small PRs; no rewrite of already-working foundations is required.
