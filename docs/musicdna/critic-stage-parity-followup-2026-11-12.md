# Critic stage parity follow-up — 12 November 2026

AB-73 / AB-67 / AB-76. Reviewed web baseline: `9da9a7137bf7c612b47ba5269fff948b22326e03`.

The review found that current web still interrupted after four choices, and its optional Q3 feedback was guarded by `holdNext`, a flag never set true. This branch removes the dead held-stage/checkpoint code and renders the existing `HalftimePushback` as an optional link below the normal pairing after the third answered choice. There is no new Next button, acknowledgement step, scoring rule, prompt, model or API. Normal final completion remains server-owned.

The existing recovery form can now be opened directly at `/auth?mode=forgot`, including when the browser already holds another signed-in session. Only the literal `forgot` mode is accepted; the query supplies no email, token, user identity or return URL. All actual email requests and password changes still use Supabase's existing client authorization. Flutter uses this entry rather than starting native recovery tokens in a different browser. No reset emails or password changes were sent in this review.

The shared quip list, 2.5-second line timing, setup/punchline ordering, era/skip selection, Critic model behavior and saved evidence are unchanged. The contract now describes the nested person groups used by executable code. The companion Flutter branch is `codex/musicdna-critic-stage-build13` in idea-builder; its detailed parity/acceptance report is `apps/mobile/docs/critic-stage-parity-2026-11-12.md`.

## Checks

- 636 Vitest tests passed; 109 database/environment-dependent tests skipped.
- TypeScript and targeted ESLint passed.
- Vercel production build passed.
- Local browser navigation to `/auth?mode=forgot` displayed Reset your password / Email / Send reset link without a password field. No form was submitted.
- The full `npm test` command remains blocked before Vitest by the pre-existing learning-validator manifest mismatch (AB-75): actual `2fb2ce35eb61a5f9a2238af660ec2de88366b215328e47c8dfc19e4ac3555d8c`, expected `1744309ae65b6490a651d33351bf2b869eb09d282c2434b362c04a418f5c9ec4`. This branch changes neither that validator nor its pin.

## Database follow-up — AB-75

Two executable migrations create the same `public.save_musicdna_deferred_read` function:

- `20261112183759_musicdna_deferred_read_cursor.sql` — SHA-256 `1e25907f2323c6a8744315f2a459f1c6692b0552c0c82df923c903718fee1799`.
- `20261112192158_b34486e3-76fd-4d86-90fe-2550382ec0ea.sql` — SHA-256 `4e7f2f1425e311da399f95ebe288c082a85719a25f8bc5e785f3808f0b879f13`.

The only byte difference is the final newline. Both use `CREATE FUNCTION`, so clean replay will encounter an existing function on the second file. Reconcile one canonical executable with the actual applied history/receipt before migration acceptance. This source review did not inspect live history, rerun SQL, rewrite history or change either file. Database acceptance is not implied by the successful application build.

All changes remain on a separate feature branch. Alan retains merge and production-promotion approval.
