# Guest reading save contract — 14 November 2026

## Shipped web path: verified in-place upgrade

Guest readings already live in Supabase, owned by the anonymous Auth UID. Navigation/new interviews do not delete them. The guest bearer, not the session UUID, grants access. Clearing auth storage or signing into another UID loses access; a return URL is not an authorization token.

After a completed, saved result, web offers a dismissible “Keep this reading” sheet once per reading/browser session. A persistent button remains. The prompt never publishes or changes the frozen reading. Unsaved final failures do not trigger it.

Flutter should keep `source_user_id` and `session_id` in its origin/device-local pending-save state (no tokens in URLs). Offer “Not now” and preserve the guest session and return reading ID.

1. Under the current guest bearer, read the source session and confirm ownership.
2. Use Supabase Auth `updateUser({email}, {emailRedirectTo})` / equivalent Dart updateUser with the configured confirmation deep link. **Not `signUp`**: that can create a different UID.
3. Wait for confirmation. Revalidate with Auth `getUser`; require the original UID, `is_anonymous === false`, and non-null `email_confirmed_at`. Email submission is **not Saved**.
4. Only after verification, collect/set the password through `updateUser({password})`. Do not retain passwords in pending state.
5. Revalidate the same confirmed UID, then owner-read `GET /api/v1/session/:id` (normal bearer + the client's existing Experience header). Require the same completed reading; retrieve its saved report/version through the existing report contract. Only then show **Saved to your account**.
6. Return to that exact reading. Retries update the same identity, never create/duplicate/overwrite results. Keep pending source metadata until confirmation/readback succeeds.

Web callback: `/save-reading?session=<uuid>` (or `/save-reading` for account-wide upgrade). Add the exact same-origin URL to Supabase redirect allowlists for each deployed origin. Configure the corresponding Flutter Auth deep link separately. Confirmation opened without the original local source state fails closed; return to the original browser/device, never infer ownership by email.

## Existing account: NOT IMPLEMENTED / do not promise transfer

There is no safe shared guest→existing-account transfer endpoint in main. Web explicitly says this option is unavailable. Ordinary sign-in replaces the identity and is not a save operation. No new endpoint, migration, retention jobs or publication changes were made in this follow-up.

A later, separately approved atomic migration/API must verify both the guest source and registered destination, explicit consent, operation-key replay, full session-family ownership and dependent private rows, lifecycle locks, and a destination owner/version readback. Preserve frozen content, separate existing readings, and publication consent. Never transfer by email or a caller-supplied owner ID. Coordinate this implementation with Codex before enabling an “existing account” save button on either client.

## Acceptance

- New guest completed reading: prompt appears, dismiss retains the read and allows reopening.
- Email request alone never says Saved; pending confirmation keeps the guest reading accessible.
- Confirmed same UID + password + owner/version readback succeeds; reload and cross-device sign-in recover it.
- Different UID, duplicate existing email, missing local source or missing reading: fail visibly, never claim Saved.
- “Not now”/fresh interview/navigation do not delete the guest reading or publish it.
- Existing-account transfer remains disabled until the shared atomic contract ships.

Verification: four concrete identity/confirmation rules tested locally. Hosted email delivery, confirmation settings, authenticated upgrade and cross-device acceptance remain unverified for this external-managed Supabase project.