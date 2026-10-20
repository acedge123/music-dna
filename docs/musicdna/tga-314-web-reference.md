# TGA-314 web reference review

Status: **ready for review; ACE approval pending**. This is a candidate reference, not an approved Flutter target or production acceptance.

- Review date: October 19–20, 2026 (America/Los_Angeles).
- Repository: `acedge123/music-dna`; branch: `codex/tga-314-web-reference`.
- Implementation SHA: `27803164bc3e514a31950c8431213fda7427d30c`.
- Base: merged backend correction `92d6795b5429fe941796d065a4aac6ccc51073ca`.
- Local review URL: http://127.0.0.1:4314/reference (run `npm run dev -- --host 127.0.0.1 --port 4314`). The review book is dev-only; a production build rejects `/reference`.
- Primary viewport: 390 × 844 CSS pixels. Additional checks: 320 × 844 and 320-pixel width with root text resized to 200%.
- Approved reference SHA / approver / approval date: **pending**.

## Changed behavior

The web interview, saved result, continuation and public page share presentation components. Earlier rounds remain available in order; genuine revision content exposes the prior claim, the changing choice and the new interpretation. Choice cards retain the selected state while saving and offer a same-choice retry. The next purpose comes from the server-selected pairing. Completion remains server-controlled and saved narration errors offer a retry.

Results lead with stored synthesis, at most two distinct supporting examples and honest counterevidence, with expandable full details. Missing support produces an insufficient-evidence hint rather than a flattering invented headline. The original saved reading and its version are preserved when opening Push back or returning. Continuation renders stored messages, restores an owner/session-scoped unsent draft after refresh and reconciles retries by mutation identity. Self-report revisions appear separately from the original. Sharing explicitly publishes the selected saved version and uses the canonical returned token URL.

Opening and metadata describe three songs and up to six answered choices. Forced-choice cards omit lane priming. Phone layouts, associated input labels, selected/busy semantics, minimum touch targets and reduced-motion behavior are included. Existing engine scoring, routing policy, catalog and database migrations are unchanged.

## Eight-state capture set

These use the production UI components with frozen shared fixtures. The theory/revision views are produced by the shared deterministic evidence engine from fixture choices. The pushback transcript is illustrative fixture content. They demonstrate layout and evidence presentation, not a live model-quality result.

| State | 390-pixel capture |
| --- | --- |
| Three-song opener | [Opener](tga-314-captures/390-opener.jpg) |
| Selected choice | [Selected](tga-314-captures/390-selected.jpg) |
| Feedback | [Feedback](tga-314-captures/390-feedback.jpg) |
| Earned theory | [Theory](tga-314-captures/390-theory.jpg) |
| Genuine revision | [Revision](tga-314-captures/390-revision.jpg) |
| Result | [Result](tga-314-captures/390-result.jpg) |
| Pushback | [Pushback](tga-314-captures/390-pushback.jpg) |
| Frozen public share | [Public share](tga-314-captures/390-public-share.jpg) |

Additional captures: [320-pixel long title](tga-314-captures/320-selected-long-title.jpg), 200% text [opener](tga-314-captures/320-200pct-text-opener.jpg), [selected](tga-314-captures/320-200pct-text-selected.jpg), [result](tga-314-captures/320-200pct-text-result.jpg), [pushback](tga-314-captures/320-200pct-text-pushback.jpg). The inspected states had no horizontal overflow. Text resizing is not a true browser zoom test.

## Verification

- `npm test`: **259 passed, 3 skipped**; 37 files passed and one skipped. Existing credential-gated live harness tests are skipped in this local run.
- `npx tsc --noEmit`: passed.
- ESLint on all changed/new source files: passed.
- `VERCEL=1 VERCEL_ENV=preview npm run build`: passed and produced `.vercel/output`.
- `git diff --check`: passed.
- New coverage checks evidence/example bounds, insufficient evidence, selected/busy semantics, revision presentation, saved-only conversation/replay identities, draft isolation, exact reading-version selection and ownership denial.
- Authenticated local browser against the configured backend: restored an existing synthetic listener's original completed reading; Push back retained its session/version, loaded saved messages and exposed a later self-report version separately; an unsent draft survived refresh; back navigation restored the same original reading. [Result](tga-314-captures/320-authenticated-result.jpg) and [continuation](tga-314-captures/320-authenticated-pushback.jpg). The test listener was signed out and its temporary credential file removed.
- That real saved reading was inconclusive due to unavailable/invalid diagnostic evidence. The UI honored that result. This check does not certify supported-headline quality in production.
- Browser sign-in and back restoration were slow; no performance budget is certified here.

The committed lockfile was already out of sync with package declarations: `npm ci` fails. Verification used `npm install --ignore-scripts --package-lock=false --no-audit --no-fund`; package declarations and lockfile were left unchanged. Existing TanStack deprecation/build warnings remain.

## Remaining acceptance

1. ACE reviews the eight states and records approval or changes against an exact SHA. Until then TGA-315 must not treat this as an approved visual reference.
2. **TGA-312** still owns same-choice challenges. The public page currently offers an honestly labeled independent reading. The challenge action in TGA-314's overall criteria is not accepted yet.
3. Physical iPhone, VoiceOver, real keyboard interaction and true browser 200% zoom remain for device/accessibility review (TGA-321).
4. A new authenticated chat send and explicit publication from this changed UI were not exercised against production. Unit/service coverage and earlier backend persistence acceptance are separate evidence; neither replaces a deployed UI check. A retry whose saved reply has fallen outside the newest 200-message page also needs a long-conversation client acceptance check.
5. No production deployment, public V1 activation, model-quality acceptance or full parity release is part of this review. Backend operational evidence is recorded separately in `backend-parity-implementation-review.md`.
