# Listener song intake v1

## Shared capture

Future `profiles.opening_songs` saves containing exactly three ranked strings are captured atomically by `profiles_capture_opener_intake`. Web `commitOpeningThreeImpl` and REST `/api/v1/onboarding/opener` need no new request fields or Flutter changes. Supabase anonymous accounts have an authenticated identity and profile, so capture is identical for guests and registered accounts. No model call is added to the interview. Intake failure rolls back the profile save and follows the existing retryable opener-save path.

`staged_opener_submissions` stores raw input and position (1–3), linked to the owner profile. Identical three-song lists replay once per owner (including later identical resubmission); they do not inflate demand. A changed list records a new batch. Song identity deduplication is case-insensitive title+artist with whitespace normalization, not fuzzy artist/title merging. Ambiguous title-only entries remain separate for review. Inputs follow the existing title — artist convention; hyphenated titles without surrounding spaces are not split. Account/profile deletion cascades raw submissions and reduces counts; catalog proposals have no listener identity. No backfill, export, enrollment or sharing consent is inferred.

## Admin workflow

Admin → Song Intake lists demand with search, status filters and 50-row pagination. Registered admins alone can read submissions and drafts. Guests and ordinary users cannot read or mutate intake. No service key is needed for admin scoring or promotion.

AI score is an explicit, credit-consuming admin request, not a background/onboarding job. One claimed song produces one strict validated proposal using `openai/gpt-6-astra` through the SDK inside the sole LLM adapter. Calls never include raw owner/account IDs or other profile information. All ten current axes use their actual low/high poles, scored 0–100 within lane. Unknown recording/year blocks approval. Metadata is proposed, not verified; the approval dialog requires checking recording, release year, lane, and all scores.

Drafts/provenance are durable; concurrent scoring is denied. Failures show `scoring_failed` and do not automatically retry inference. A crashed request can remain `scoring`; operators must inspect request logs before resetting it, never assume no model work occurred.

Approve binds to the exact displayed draft and executes an atomic caller-scoped function. It links an existing exact title+artist without rescoring it, or inserts a **new inactive song** with model/version/reviewer provenance. Replayed promotion returns the same song. A simultaneous same-recording insert is rejected rather than duplicated. Rejected proposals remain reviewable. Intake does not add pairings, activate songs, rewrite frozen evidence or alter routing/claims.

## Deployment and acceptance

Applied migration files are in `supabase/migrations/20261115172219_*`, `20261115172619_*`, and subsequent intake hardening migration. Capture is database-side immediately for future saves from existing clients. Admin scoring requires the Lovable AI connection in preview; Vercel needs `LOVABLE_API_KEY` for this new SDK call (its existing direct OpenAI Critic key does not substitute). No flag or Critic provider change was made. Production web must deploy the new admin controls. Authenticated admin scoring→promotion and mobile readback require account access and deployed acceptance; never claim them from isolated tests.