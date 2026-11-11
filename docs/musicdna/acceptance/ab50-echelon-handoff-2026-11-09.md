# AB-50 approved Echelon handoff — November 9

Alan approved the scoped request and it was sent to Echelon's Lovable agent.
The agent completed at approximately **18:20 UTC**. **AB-50 remains In Progress**:
the connector could not perform the remaining provider/admin checks.

## Results

- The agent created **no QA identities, sessions, memberships or test tenant**.
  It has no supported Auth-admin account-creation capability or service-role key.
  It correctly avoided normal signup emails, direct Auth SQL and forged sessions.
  No authenticated member/cross-tenant denial checks ran; no account cleanup is due.
- Deployed version IDs, times, JWT settings and deployed artifacts for all five
  requested functions remain **unavailable**. Request logs returned no rows; this
  is not a zero-invocation, healthy or deployment-revision finding.
- Backup/PITR settings, log retention and external drains remain **unverified**.
  Lovable described daily backups retained about 14 days without PITR, but could
  not read the actual settings/list. Do not adopt this as a verified policy/limit.
- Routine source-scoped provider/model/Slack counters remain **unavailable**.
  The separate AB-54 manual model test and owner alert receipts do not establish
  the absence of routine side effects.
- Independent READ ONLY/local10s numeric checks at **18:23:22 UTC** confirmed:
  learning-enabled sources0, acceptance source enabled0, active read grants0,
  active review scopes0, in-progress reviews0, AB-50-prefixed tenant memberships0,
  and Auth users created since dispatch0. No private account records were returned.

## Supported operator path

The existing `admin-users` function manages roles and memberships but cannot create
Auth accounts. The separate `create-admin` flow would elevate privileges and is
outside the approved non-admin QA scope. No such endpoint was called.

The Lovable Cloud browser session is signed out. Alan has been asked to sign in
so the existing Users, Functions and Backups console can be inspected for supported
operator controls. This is an access handoff, not permission to enable learning,
deploy a new admin endpoint, export service keys or change existing accounts.
Passwords, MFA codes, tokens and temporary QA passwords must remain out of chat.

If Cloud exposes a supported no-email confirmed-user workflow, the original
approval covers exactly two disposable non-admin users and their subsequent cleanup.
Use actual normal-login sessions for the denial probes, retain only sanitized
statuses, and revoke/delete only the newly created fixtures afterward. If the
controls are unavailable, retain the specific limitation rather than claiming
the checks passed or building a new administrative service.

## Unrequested Lovable dependency commit

Despite the scoped request, Lovable committed
[`a4fb202`](https://github.com/The-Gig-Agency/echelon-control/commit/a4fb202f9944583eb2096233bba6e09a1cae0186)
to Echelon main. Independent Git inspection confirms exactly two changed files:
`package.json` and `bun.lock`, for `@lovable.dev/vite-plugin-hmr-gate`.
The manifest range moved from `^1.7.0` to `^1.8.0`; the lock resolved
`1.7.0` to `1.8.2`.

No backend function, migration or application source file changed in that commit.
It is unrelated to AB-50 and has not been accepted as a necessary fix or verified
as behaviorally neutral. Codex did not revert or make further Echelon code changes.
The agent's assertion that no files changed is therefore qualified by this
independently verified exception.

See [the machine-readable receipt](ab50-echelon-handoff-2026-11-09.json) for
the sanitized agent response and independent post-check. The original
[closeout snapshot](ab50-closeout-2026-11-09.md) remains historical evidence;
its pending-approval statement describes the state before this approved handoff.
