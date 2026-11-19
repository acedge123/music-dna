# MusicDNA Admin MCP — Phase 1 (AB-87 / AB-88)

Status: **source implementation for review; not deployed or connected to ChatGPT.**

The original assignment is preserved in `admin-mcp-spec.md`. Phase 1 deliberately ships before pairing/interview diagnostics (AB-89) and model/learning monitoring (AB-90). AB-84's Flutter pacing work remains a separate branch/PR.

## Architecture

This is an authenticated, tool-only operator integration in the existing **acedge123/music-dna web repo**, hosted by the existing TanStack/Vercel application. It is not part of Flutter and does not require an Apple release. The starting pattern is the existing Mom Walk Lovable MCP SDK integration, adapted to MusicDNA's TanStack server and normal caller JWT/RLS. There is no MCP widget or second catalog/scoring engine.

- MCP: `https://www.musicdna.fm/mcp` (Streamable HTTP).
- Resource metadata: `/.well-known/oauth-protected-resource`.
- OAuth consent: `/oauth/consent`.
- Operator citation record: `/admin-mcp/song/:songId`.
- Export download: `/admin-mcp/export/:jobId`.
- Canonical records: existing `songs`, `axes`, `pairings`, `song_artwork`, `song_trait_explanations`.
- Extensions: explicit operator grants, future Why history, evidence-bound findings, draft revision proposals, expiring export artifacts and append-only application audit events.
- No model calls, learning activation, listener changes, catalog rescoring, automatic approvals or synthetic production writes.

The source entry is `src/lib/mcp/index.ts`. `.lovable/mcp/manifest.json` is the generated complete tool/schema inventory. Regenerate with `npx lovable-mcp-extract-manifest .`; do not hand-edit schemas. The SDK generates route files. The bounded-body/origin guard lives in the app's existing `src/server.ts`, so regeneration preserves it. Vercel leaves the SDK's guarded optional `cloudflare:workers` metrics import external; telemetry is disabled.

## Tools

Custom tools have versioned structured output (`musicdna-admin.v1`, or `musicdna-admin-export.v1` for export artifacts) plus JSON text, except standard `search`/`fetch`, which use the standard one-text-content JSON shapes. Schemas and defaults are in the generated manifest.

| Tools                                                      | Access                                | Behavior                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_profile`                                              | Catalog read                          | Own ID and current capabilities; never enumerates accounts                                                                                          |
| `search`, `fetch`                                          | Catalog read                          | Standard discovery/citation shapes; search returns up to 20 matches, domain search has full pagination                                              |
| `catalog_get_summary`                                      | Catalog read                          | Numeric coverage, decade/genre, completeness, artwork and saved Why status counts                                                                   |
| `catalog_list_songs`                                       | Catalog read                          | Artist/title/lane/year/active/Why-status/completeness/update filters; ID cursor                                                                     |
| `catalog_search_songs`                                     | Catalog read                          | Normalized punctuation/diacritics, substring and trigram identity matching; confidence is text similarity, not a recording-verification probability |
| `catalog_get_song`, `catalog_get_song_attributes`          | Catalog read                          | Current authoritative record, ten axes, evidence and approved artwork release metadata                                                              |
| `catalog_get_attribute_ontology`                           | Catalog read                          | Live axes/poles, shared numeric range; absent ontology versions/confidence thresholds explicitly unavailable                                        |
| `song_whys_get_summary`, `song_whys_list`, `song_whys_get` | Catalog read                          | Full saved Hear/Means/reviewer note, exact score/axis, status and version fingerprint                                                               |
| `song_whys_export`                                         | Catalog read; writes export artifacts | Explicit start/status calls; full immutable JSON snapshot, authenticated JSON/CSV download                                                          |
| `song_whys_get_review_history`                             | Catalog read                          | Paginated baseline and subsequent before/after snapshots; never invents older drafts                                                                |
| `song_whys_run_audit`, `song_whys_find_conflicts`          | Catalog read                          | Read-only deterministic screening and quoted conflict candidates; assistant/listener must independently verify                                      |
| `song_whys_list_audit_findings`                            | Catalog read                          | Paginated severity/status/auditor/song/axis/date filters                                                                                            |
| `song_whys_record_audit_findings`                          | Catalog editor                        | Explicit confirmation, mutation UUID and base version; exact saved excerpts required; unresolved findings deduplicate                               |
| `song_whys_submit_revision`                                | Catalog editor                        | Explicit confirmation and version-bound, idempotent draft submission; approved record unchanged                                                     |

Limits: list pages 1–50 (default 20), adaptively reduced at whole-record boundaries to bound responses; audits max 20 explanation IDs; inputs max 64 KiB; inline results max 60 KiB. Use smaller batches or exports when told a record/result needs export. Cursors bind owner, filters and a one-hour creation cutoff; they are positions, not bearer capabilities or a frozen cross-page database snapshot. RLS is rechecked. Page totals describe the initial page; mutable records can change during traversal. Exports provide the consistent complete snapshot.

`catalog_get_song` embeds at most 20 Whys and 20 pairings, with exact participation count and explicit completeness flags. Continue Whys via `song_whys_list`; complete pairing browsing belongs to AB-89. There is no hidden 1,000-row export cap.

## Authentication and authorization

OAuth issuer: `https://udycgnhvaanemhrchbuj.supabase.co/auth/v1`. Audience: `authenticated`. Canonical resource is pinned to the production MCP URL. Asymmetric JWT verification uses project JWKS; OAuth client binding (`client_id`/`azp`) remains required. Copied password/browser-session tokens are not an MCP authentication workaround.

Each tool also validates the current user with Supabase Auth, denies anonymous Auth users, and reads fresh database capabilities. A publishable client forwards the caller's JWT. **No service-role credential or provider key is needed by this MCP.** No caller-controlled user metadata determines privilege.

| Existing/admin or grant | Capabilities                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Existing MusicDNA admin | Catalog read/propose/review and future QA capability                                         |
| Catalog Reader          | Catalog read only                                                                            |
| QA Auditor              | Catalog read and separate future QA read capability                                          |
| Catalog Editor          | Catalog read and draft proposals/findings                                                    |
| Reviewer                | Catalog read/review RPC; initial browser review surface stays within the existing admin page |

The migration creates **zero grants**. Grant administration is an explicitly approved operator action, not an MCP tool. Initial human approvers use existing admins; a delegated non-admin reviewer page is not included. Login/OAuth consent does not grant a role. Revocation is checked on subsequent calls, export pages and downloads. Normal listener access and existing catalog UI remain in place.

No arbitrary SQL, role management, production flag, provider execution, approval, deletion or bulk update tool is exposed. Proposed text is displayed as untrusted text, not HTML/instructions.

## Draft corrections and audit trail

1. Read an explanation and its `why-v1:<sha256>` fingerprint.
2. Have the assistant propose evidence-qualified wording. Recording claims require listening/source verification; a model's confidence is not proof.
3. With explicit operator intent, call `song_whys_submit_revision` with that fingerprint, a fresh `mutation_id`, Hear/Means, reason, evidence and `confirm_submit: true`.
4. Open existing **Admin → Song Whys → Proposed Song Why corrections → Load draft corrections**.
5. A human reviews original/proposed text and evidence, then explicitly approves or rejects one draft. Approval fails if the original, proposal version or song score/scoring version changed. No bulk proposal approval exists.

Submission, decision and finding writes are atomic and audited. Same key/same payload replays; reused key/different payload conflicts. The existing canonical explanation is changed only by the human decision path. A human-approved correction replaces the current model-review note with an explicit human-correction receipt; prior model attribution is preserved only in its old snapshot. Operator account deletion nulls author/reviewer/audit identities and removes owned grants/exports without deleting the canonical catalog. A trigger captures future edits from both this path and the legacy UI; the initial baseline is not represented as the original draft. Existing legacy admin bulk-review controls are not newly exposed through MCP.

## Full collection export

1. `song_whys_export {"action":"start","format":"json","filters":{},"mutation_id":"<fresh uuid>"}`.
2. `song_whys_export {"action":"status","job_id":"<id>"}` advances the queued snapshot without a model call or scheduled worker.
3. When ready, open `download_url` and sign in as the **same** MusicDNA account if necessary. Click Download export.
4. The browser collects authenticated 25-record snapshot pages, checks the counts, and only then creates the complete JSON/CSV file. Role and ten-minute expiry are checked on every page.

Start is asynchronous from the caller's perspective; explicit status processing performs a bounded database snapshot, not a separate hosted export worker. Timeout is a failed export, not an empty healthy result. JSON is lossless; CSV preserves complete nested fields as JSON cells, escapes quotes/newlines and prefixes spreadsheet formulas. Count/generation/schema metadata are included. Cross-account/admin ownership override is denied. Expiry removes download access; **physical export retention cleanup is not scheduled** and needs a separately approved retention policy/job before broad rollout. No automatic bulk deletion was added.

## Known data limits / scope gaps

- `drafted_by=sol` is a role label, not an exact model ID. Exact historical writer/reviewer IDs, numeric reviewer confidence, failed model drafts and full pre-baseline edits were not recorded. They are returned as unavailable, never reconstructed.
- Current saved `rejected` status is not a model rejection-rate denominator.
- Optional verified artwork release titles are not a unique song/album identity. Unknown dates, confidence and audio verification stay unknown.
- Textual audits are aids, not a full independent auditory or model review. They flag targeted unsupported intention/recording claims, stale scores and potential conflicts. Genericity, identity, score direction and reviewer reasoning still need the assistant's documented independent assessment; no automatic corrected facts are invented.
- Live usage/popularity sorting, reviewer-model filtering and computed conflict filtering are not fabricated. Complete pairing analysis, session traces/actual quip telemetry, model metrics and learning receipts remain AB-89 / AB-90.
- No production migration replay, OAuth consent round trip, signed-in hosted export or actual ChatGPT/Claude invocation has occurred. Hosted acceptance remains required.

## Local validation and setup

```sh
npm ci --ignore-scripts
npx lovable-mcp-extract-manifest .
npx tsc --noEmit
npx vitest run src/lib/mcp
VERCEL=1 npm run build
npm run dev -- --host 127.0.0.1 --port 5197
```

Check local `/.well-known/oauth-protected-resource` returns the configured issuer/resource; unauthenticated `POST /mcp` must return 401 with a metadata challenge. Native tests use PGlite, never production. An authenticated host test additionally requires the reviewed migration and an enabled/configured OAuth server; a successful anonymous 401 does not establish authenticated acceptance.

For ChatGPT development testing, expose the local server with an HTTPS tunnel, then create an app in ChatGPT Developer Mode using `<https-tunnel>/mcp`. The resource is intentionally pinned to production, so use a separate explicitly configured development resource/client for a tunnel; do not repurpose production OAuth credentials. For the eventual private production app, use `https://www.musicdna.fm/mcp`. Refresh descriptors after tool changes. Claude can use the same remote Streamable HTTP URL and OAuth connection; client configuration/registration must be verified for that host. Do not paste account tokens into either assistant.

This is a private operator app; no public app-directory submission or Flutter build is involved.

## Activation gates — Alan approves production separately

Read-only checks on 2026-11-19 UTC found:

- Production MCP resource metadata: **404**.
- Supabase OpenID discovery: 200 and asymmetric public key available.
- OAuth authorization-server discovery: **404 `feature_disabled`: “OAuth server is disabled”**. OpenID discovery alone is not readiness.

After source review/merge authorization:

1. Apply only `supabase/migrations/20261119011822_musicdna_admin_mcp_catalog.sql` through the approved native migration workflow; return exact hash/history/access receipts. Do not replay unrelated migrations. Test full project replay separately: focused fixtures are not proof that every historical migration replays cleanly.
2. Deploy the merged web commit to the existing Vercel project, confirming Node/Vercel `/mcp` and metadata responses.
3. With explicit authorization, enable Supabase OAuth server; set authorization/consent UI to `https://www.musicdna.fm/oauth/consent`. Register the specific ChatGPT/Claude callback URLs from those hosts, with PKCE S256. Prefer reviewed static clients; enabling dynamic client registration is a separate decision, not implicit authorization.
4. Configure host request limits for `/mcp` (shared proxy/IP behavior considered); no pretend per-instance in-memory rate limiter is claimed. Verify logging excludes authorization headers and raw payloads. Leave metrics telemetry disabled.
5. Verify Alan's existing admin access or explicitly approve narrow operator grants. Never grant every listener catalog/QA access.
6. Connect the private app, allow consent directly in the browser, enumerate all approved Whys, export JSON/CSV and compare exact counts. Exercise a read-only account, ordinary listener, revoked account, cross-owner export, stale draft, reused-ID conflict, and expiry. Check role/client revocation at each boundary.
7. Human-review a disposable draft in the existing admin queue. No automatic rewrite, rescore or production QA interview.
8. Decide artifact retention cleanup before wider use; leave AB-89/90 open until their genuine data access/instrumentation is built.

No production deployment, migration, grants, OAuth setting, key, source or model call was changed by this implementation.

## References

- [OpenAI MCP server guide](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI app authentication](https://developers.openai.com/plugins/build/auth)
- [Supabase MCP OAuth authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- Installed `@lovable.dev/mcp-js` 0.22.2 README and Mom Walk's existing operator MCP implementation.

## Scoped QA add-on

The separately reviewed AB-89/AB-90 add-on is documented in `admin-mcp-qa.md`; the cumulative service inventory is 41 tools at version 0.2.0. Phase 1 remains the initial catalog/Why deliverable. Neither source review nor an empty/unavailable diagnostic constitutes hosted acceptance. The new evidence for the supplied final-report failure is in `admin-mcp-regression-2026-11-18.md` and tracked as AB-91.
