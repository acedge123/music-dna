# AB-88 production handoff — requires Alan's separate approval

This is prepared deployment text, not permission to execute it. No agent message has been sent.

Apply/deploy only after Alan approves the specific merged source and production step. Full catalog/QA spec is in `admin-mcp-spec.md`; Phase 1 limits and acceptance are in `admin-mcp.md`.

## Native migration request

Inspect MusicDNA project `udycgnhvaanemhrchbuj` and its native migration history first. If not yet applied, apply **only** `supabase/migrations/20261119011822_musicdna_admin_mcp_catalog.sql` from the reviewed merged source, unchanged.

Candidate SQL SHA-256: `40817d1e2c36c34fc6b56474e45659a72e9963c9823e2ee9a9f6bfac26ae2a6b`.

Return the native history version/time, exact applied hash and access-check receipts. If native tooling chooses a different history timestamp, reconcile to one executable file and receipt; never leave duplicate creator migrations or rerun earlier migrations. If already applied, compare stored SQL/hash and return the receipt without rerunning.

Verify: six new public tables have RLS; only intended SELECT grants remain for authenticated callers; unauthenticated/ordinary/anonymous-Auth callers cannot use the operator RPCs; catalog readers cannot propose/review; editors cannot review; direct writes to grants/history/proposals/findings/exports/audit are denied. `musicdna_mcp_whys` is security-invoker and catalog-gated. Existing admin roles are reused; **create no operator grants**. Check history baseline vs future snapshots honestly.

Do not rescore songs, approve/reject explanations, rewrite existing content, create users/keys/schedules, modify learning flags, rotate credentials or enable OAuth during migration. Do not run paid model calls or synthetic interviews. The fixture tests are local; do not execute their data creation against production.

## Hosting/OAuth follow-through (separate approval)

Confirm the merged web source auto-deploy on the existing Vercel project. Verify `/mcp` returns anonymous 401 plus its metadata challenge, resource metadata matches production and unrelated app routes still work.

The currently disabled Supabase OAuth server needs explicit authorization to enable/configure, including consent URL `https://www.musicdna.fm/oauth/consent`, reviewed ChatGPT/Claude client registration/callbacks and PKCE S256. No service-role key is needed by the MCP. Configure host request limits and artifact retention before broad rollout. Do not silently enable dynamic registration or use copied browser JWTs instead of OAuth.

Then run the signed-in acceptance checklist in `admin-mcp.md`: complete approved collection traversal and JSON/CSV count equality; role/ownership/revocation/expiry denial checks; exact-version/idempotency conflicts; one explicitly approved disposable draft/human decision, preserving canonical/history receipts. Keep AB-88 open until hosted acceptance passes.

## Separately reviewed QA add-on (AB-89 / AB-90)

After the Phase 1 migration and separate source/production approval, the QA add-on applies only `supabase/migrations/20261119020120_musicdna_admin_mcp_qa.sql`. Candidate SHA-256: `5759dc7210df0249c04362f516836b474561e16bebb77546b03e4f247d6c8572`. Return the same exact native history/hash/access receipts; never replay either migration. Native fixtures apply both new migrations together against representative base tables using the real Phase 1 grants/capability function. This is not full historical project-chain replay or hosted PostgREST acceptance.

Verify the new QA scope table and paint-receipt table have RLS and no direct authenticated writes; all diagnostic views enforce current QA permission plus ownership/approved scope. Create no scope grants, QA users, sessions or model tests as part of migration. Preserve raw local-only critic trace restrictions. No service key, learning/model flag, catalog score, paid model call or schedule changes. Ordinary/guest callers must not gain private diagnostics or receipt-write access.

The web owner-QA path adds optional paint receipts only after explicit Admin → New QA interview and fresh server eligibility. Normal interview flow is unchanged. The Flutter API is additive, with no mobile build/instrumentation in this add-on. Hosted OAuth, real paint behavior, role/scope expiry and receipt replay need separate acceptance after deployment. See `admin-mcp-qa.md`; AB-91 tracks the discovered final-report validation failure, which this MCP PR does not fix.
