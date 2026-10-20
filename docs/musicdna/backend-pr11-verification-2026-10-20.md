# Backend acceptance audit against merged Flutter PR #11

> Historical initial audit. Later authenticated production functional checks passed after the approved sharing correction. See [the production follow-up](backend-parity-implementation-review.md#production-verification-follow-up--october-19-2026-pacific) for current evidence and remaining release limits.

## Initial verdict

**None of the five backend items is accepted.** All five have identifiable source gaps. Authenticated production persistence, recovery, and cross-user denial are **UNVERIFIED**, not passing.

No application code, production data, migrations, deployment, or shadow-routing settings were changed during this audit.

## Source and deployment identity

- The merged PR is **[acedge123/idea-builder #11](https://github.com/acedge123/idea-builder/pull/11)**, not music-dna #11. GitHub confirms merged at `2026-10-20T03:29:19Z`, merge SHA **`d477c9faa6b26d2dcf9cfcd6feddc56934210b5f`**, PR head SHA **`91c16ce5c5f429d5fe24009526a61fe764ceb0db`**.
- The PR explicitly says it contains Flutter work, **no backend runtime edits**, and leaves these five Lovable acceptance items open. Flutter v1 remains disabled by default.
- Audited checkout source SHA: **`e0727b5eb2565acca915cd35f28fc0f886ad2e84`**. Backend files were unchanged throughout the audit; internally generated checkout commits afterward do not represent backend fixes.
- Latest returned MusicDNA **Production deployment record**: SHA **`1015b28fe965b15f77f13e3b199c9f0e0145831b`**, deployment `6990047261`, Vercel status **success**, recorded `2026-10-11T02:45:43Z`; target `https://idea-builder-pfkj846z9-alan-edgetts-projects.vercel.app`.
- Comparing that production SHA with the audited checkout yields **no differences in the feedback/chat/share backend files** reviewed here.
- **Current custom-domain serving SHA remains unverified.** `https://www.musicdna.fm` returned a typed 404 for a nonexistent share, with Vercel headers but no commit SHA. A successful GitHub deployment record alone does not establish the custom domain's current alias target.

## Five-item findings

| Item | Source result | Source evidence | Authenticated production persistence |
| --- | --- | --- | --- |
| Feedback retry recovery | **Fail**: GET omits `mutation_id`, despite POST storing it. Flutter cannot reconcile a lost response by the exact submitted mutation identity. | `src/routes/api/v1/session.$id.feedback.ts:80–89` | **UNVERIFIED**: no successful write/retry/readback executed. |
| Feedback version isolation, atomicity, conflicts | **Fail**: existing-row lookup is owner/session/target only, not result version; a later version updates the earlier row. `result_version` is optional and not checked against an existing saved version. Replay looks up only the mutation ID and does not compare payload/version/target. The lookup then insert/update workflow is not one atomic save/replay operation. | `src/lib/musicdna.functions.ts:2105–2187`; `supabase/migrations/20261011023802_4701d621-ea2a-43cc-99dd-f61beae8c38c.sql:1–4` | **UNVERIFIED**: version preservation, concurrent saves, replay, conflict rejection, and cross-user denial not exercised. Source RLS does require owner/session ownership, but this is not live denial proof. |
| Chat recovery and complete history | **Fail**: finding a committed user message without its reply returns pending again; no recovery lease/resume path exists. Assistant insert errors are ignored before success is returned. GET has a latest-200 limit with no cursor/page mechanism. | `src/lib/musicdna.functions.ts:3483–3510,3543–3578,3750–3762`; `src/routes/api/v1/session.$id.chat.ts:54–62,92–103` | **UNVERIFIED**: successful durable turn/replay, interrupted-turn recovery, >200 history restoration, and cross-user denial not exercised. |
| Actual revised reading content | **Fail**: new `chat_self_report` versions copy the original pairing content rather than persist a revised interpretation. Self-report deltas/source/base version are separate, but revision insert errors are unchecked and revision/reply writes are separate. | `src/lib/musicdna.functions.ts:3645–3687`, especially `content: (base.data?.content ?? {})` at line 3680 | **UNVERIFIED**: changed content and provenance readback, exact retry, failure rollback, and original-result preservation not exercised. |
| Public share version consistency | **Fail**: publish sets consent/token, then reports the latest result version separately. It stores no publication-bound version/content. Public lookup builds from the live session and ledger instead of the reported saved result. Further chat can therefore make the reported latest version diverge from what lookup represents. | `src/musicdna/adapters/share-publication.ts:20–38`; `src/routes/api/v1/session.$id.share.ts:31–46`; `src/routes/api/v1/share.$token.ts:36–64` | **UNVERIFIED**: publish exact-version readback, continued-chat stability, republish/revoke, and non-owner publication denial not exercised. |

## Tests actually run

`bunx vitest run src/musicdna/engine src/musicdna/adapters src/lib/current-read.test.ts`

**25 test files passed; 194 tests passed.** These are existing regression/unit tests, **not authenticated production persistence acceptance** for the five items. No focused existing suite proves all requested behaviors. No skipped suite is counted as a pass.

Live diagnostic probes:

- Nonexistent public share: typed **404**. Establishes endpoint availability only.
- Existing dedicated test-harness key against `POST https://www.musicdna.fm/api/public/test/status`: **401**, `invalid or missing x-test-harness-secret`. This was an access probe; no test persona or production reading was created.
- Preview authentication is `external_unmanaged`; no requesting-user account session can be minted through Lovable. No user passwords or access tokens were requested or exposed.

## Required acceptance runs after implementation

Use two dedicated authenticated test identities and the deployed API, not service-role bypasses for the requests under test. Read saved state back through owner endpoints; use tightly scoped test-only failure injection for interrupted transactions/turns.

1. **Feedback recovery:** POST a keyed submission, discard its response, then GET and match `mutation_id`, row ID, owner session, exact version, and saved values. Retry the original ID and confirm one committed operation. Non-owner GET/POST must not expose/change it.
2. **Feedback isolation:** save feedback on v1 and v2 for the same target; prove both persist. Run concurrent identical saves; verify deterministic replay and no duplicates. Reuse a mutation ID with changed content, target, or version; require conflict with unchanged persisted state. Reject nonexistent/foreign result versions and foreign sessions. Force a save failure and prove no partial mutation commit.
3. **Chat recovery/history:** interrupt after the user turn commits, retry its exact key after the recovery interval, and prove one durable reply rather than permanent pending. Retry after losing a successful response and recover the identical reply IDs/content. Reject a changed message under a reused key. Restore >200 messages through deterministic cursor pages, including equal timestamps, with no gaps/duplicates; repeat as non-owner and verify denial.
4. **Revised readings:** submit meaningful self-report; prove the new reading content actually changes and persists with base version, originating turn/mutation, and self-report provenance. Reopen it through GET. Retry without creating another revision. Prove original version content, pairing evidence, and session vector remain unchanged; check concurrent turns/failure handling and non-owner access.
5. **Frozen sharing:** publish a specific saved version; compare reported version and exact frozen public content. Add another chat version and prove the existing link still serves the published version/content. Explicitly republish and verify intentional version change; revoke and confirm old token 404. A non-owner cannot publish/revoke.

## Blockers and next action

- Implementation gaps above must be closed before these can pass; merged Flutter PR #11 does not close them.
- Production authenticated test access is blocked by the rejected harness key. The production `AGENT_TEST_HARNESS_KEY` must match an approved test configuration before dedicated registered-user tests can run. Do not put credentials in chat or code.
- The live custom-domain deployment SHA/alias must be established through Vercel deployment metadata before attributing the final results to a production commit.
- **No production migrations are authorized by this verification request.** Any required migration deployment needs separate approval.