# MusicDNA Admin MCP deployment receipt — 2026-11-19 UTC

Alan authorized deployment after merging PRs #52 and #53. Inspection found #53 had merged into its stacked feature branch, so PR #54 brought exactly those reviewed changes onto main. Alan merged #54; main/live source is `829556b31fb0a75b59732bc7e952cb900bf27be0`.

## Applied once

Project: `udycgnhvaanemhrchbuj` (Music DNA, ACTIVE_HEALTHY). Preflight found neither MCP migration/table set. Only the two reviewed migrations were applied through the native migration tool; prior migrations were not rerun.

| Native history version | Name                         | Exact SQL SHA-256                                                  |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------ |
| `20261119040256`       | `musicdna_admin_mcp_catalog` | `40817d1e2c36c34fc6b56474e45659a72e9963c9823e2ee9a9f6bfac26ae2a6b` |
| `20261119040307`       | `musicdna_admin_mcp_qa`      | `5759dc7210df0249c04362f516836b474561e16bebb77546b03e4f247d6c8572` |

Native history stores each complete submitted SQL file as one statement; its SHA-256 equals the reviewed file bytes. Files were renamed to these actual native versions, with SQL unchanged and test references updated. Exactly one executable file per migration remains. This reconciliation is repository-only: do not repair/rewrite live history or reapply SQL.

## Live access checks

All eight new public tables have RLS, no anonymous SELECT, and no direct authenticated INSERT/UPDATE/DELETE grants. All nine public MCP RPCs deny anonymous execution. The nine owner-executed diagnostic views are security barriers with current capability plus caller ownership/approved session scope predicates, and deny anonymous SELECT. Base diagnostic-table permissions remain unchanged.

A READ ONLY transaction as authenticated with no subject returned all four capabilities false and zero QA sessions, attempts, quips and learning receipts. This is a database role check, not a full hosted JWT/other-listener acceptance test. No new grants/scopes were created.

Counts after migration: 795 existing Song Whys; 795 honest baseline history snapshots; zero grants, scopes, proposals and paint observations. Baselines preserve current catalog records and do not invent prior drafts. No content approved/rewritten, songs rescored, users created, learning/model flags changed or model calls made.

Diagnostics used explicit READ ONLY transactions with local 10-second statement timeouts. Application writes were limited to the reviewed migration baseline/schema changes.

## Hosting and OAuth evidence

- Vercel reports successful production deployment of merged revision `829556b`.
- The public `/api/public/version` endpoint independently returned the full matching serving SHA.
- Production protected-resource metadata advertises MusicDNA Catalog & QA and the correct Supabase issuer.
- Anonymous GET `/mcp` displays `unauthorized`; local POST denial/metadata tests pass. Hosted authenticated tool invocation is not established by this denial.
- Alan configured Supabase OAuth himself: enabled, site URL `https://www.musicdna.fm`, authorization path `/oauth/consent`, dynamic registration on. Public authorization-server discovery now returns authorization/token/registration endpoints and S256 support. No OAuth settings or clients were changed by Codex.

## Canonical MCP URL

Use `https://www.musicdna.fm/mcp`, matching the existing www host pattern used by Mom Walk. The deployed resource metadata already advertises this exact URL. Alan's clarification keeps this working configuration. No canonical-resource change, apex routing exception or Vercel operator sign-in is needed. The existing apex-to-www website redirect is left in place.

## Advisor findings and remaining acceptance

The advisor adds one `auth_users_exposed` finding for the scoped QA session view, nine `security_definer_view` findings and seven authenticated SECURITY DEFINER RPC findings. These are **not reported as a clean advisor result**. The view projects only an `is_guest` boolean from Auth; no Auth identifiers, email, token or row is exposed. Its listed columns and fresh scope predicate were verified. The owner-executed views and narrowly guarded mutation RPCs are deliberate reviewed access boundaries over private diagnostics; local native fixtures test privacy, cross-owner denial and expiry. Authenticated hosted denial testing remains required before broader use.

Relevant advisor documentation: [Auth view exposure](https://supabase.com/docs/guides/database/database-linter?lint=0002_auth_users_exposed), [owner-executed views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [privileged RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Pre-existing anonymous-sign-in policies, privileged legacy RPC findings, thirteen private tables without policies and leaked-password-protection notice were not altered. Some new role/self-scope policies are also flagged by the anonymous-sign-in heuristic; no registered QA/catalog capability is granted to anonymous Auth users.

Still pending: actual ChatGPT OAuth consent/tool round trip, complete hosted approved-Why traversal/export count equality, ordinary/revoked/cross-owner/expired access checks, one explicitly approved draft/human decision, host request limits and agreed physical export retention cleanup. No schedule was created. Full isolated model-driven synthetic QA and independent remote learning completion remain unavailable as documented. AB-88/89/90 stay open for this acceptance. AB-91 final-report validation defect is unrelated and unfixed by deployment.

## Follow-up validation

36 focused MCP tests, TypeScript and Vercel preset build passed after timestamp reconciliation. Both SQL hashes remain unchanged. Canonical MCP resource, generated manifest, HTTP tests and Vercel configuration remain identical to deployed revision `829556b`. Existing main learning-contract and routing-pin drift is unchanged; no stale pin was silently accepted.
