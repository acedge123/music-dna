# TGA-328 beta API readiness — October 20, 2026

Status: **in progress; beta environment requires explicit approval**. This is automated technical preparation; ACE owns hands-on QA and acceptance after TestFlight installation.

## Verified source and current deployment

- Backend base and observed serving SHA: `31adee7753eb6a54a3ea8c2a5ed3baf2e65620d7` in `acedge123/music-dna`.
- Mobile base: `idea-builder@4b7597c6e808eb9eaf0582781715435dc668199d`.
- Production `https://www.musicdna.fm/api/public/version` reports persistence V2 enabled. Ordinary opted-in V1 remains disabled (503 `EXPERIENCE_DISABLED`).
- The existing Vercel project is `alan-edgetts-projects/idea-builder` (`prj_xXtAp85f1cFGox23XyxRG7RCuIyP`). Its single included custom-environment slot is unused.
- Preview/generated URLs require Vercel SSO under current project settings. A mobile app must not carry a Vercel bypass secret.

## Prepared changes requiring approval

1. Create custom environment `musicdna-beta` within the existing Vercel project, importing the existing Production environment variables server-side. The source currently holds Supabase URL/public client key, Supabase server secret, OpenAI API key, harness key and persistence/acceptance flags. No credential value needs to be pasted into chat or downloaded into the mobile client.
2. Set only beta-scoped flags: `MUSICDNA_EXPERIENCE_V1=1`, `MUSICDNA_BACKEND_PERSISTENCE_V2=1`, `MUSICDNA_BACKEND_ACCEPTANCE=0`, `MUSICDNA_ROUTING_MODE=shadow`. Remove the imported harness key from the beta environment once imported; the app uses ordinary Supabase authentication.
3. Deploy the reviewed branch containing the session-access fix below to beta. Do not move musicdna.fm/www production aliases or enable production V1.
4. Assign proposed stable alias `musicdna-beta-alan-edgetts-projects.vercel.app` to the beta deployment (currently no existing alias is found). If Vercel SSO applies, create a deployment-protection exception for this exact beta alias, retaining normal application bearer/ownership checks and existing protection on other deployments. No bypass key goes in the binary. This alias approach avoids changing the externally managed musicdna.fm DNS zone.
5. Verify ordinary unauthenticated denial, authenticated owned-session behavior, foreign-session denial, and Flutter mappings on the actual beta origin, then record the final deployment ID/SHA/alias and configuration handoff to TGA-330.

The beta initially uses the **existing MusicDNA Supabase project and accounts** (`udycgnhvaanemhrchbuj`); API deployment/configuration is separate, data is shared. Automated probes use existing dedicated synthetic listeners. No database/schema/catalog mutation or paid environment pack is proposed.

Automatic approval review rejected the environment-copy/V1 operation because the general beta-preparation request did not explicitly authorize copying production server credentials or this exact access/configuration change. The command did not run; custom-environment inventory remains empty. No indirect workaround was attempted. Approval must precede the environment/protection changes.

## Read-only deployed-response evidence

Using existing approved synthetic listeners and private acceptance access on production:

| Probe | Owner | Other listener |
| --- | --- | --- |
| Session snapshot | 200, contract 1 | 404 |
| Next on completed session | 200, contract 1 | **200: defect, source correction prepared** |
| Chat history/result versions | 200, contract 1 | 404 |
| Result feedback | 200, contract 1 | 403 |
| Legacy session snapshot, no V1 header | 200, legacy shape | — |
| Ordinary V1 without private key | 503, release gate intact | — |

The unexpected foreign-session `next` response was a pairing response; this probe does not establish access to another listener's vector/chat. The implementation ignored a hidden/missing session and fell back to an empty vector. `requireVisibleSession` now rejects missing/RLS-hidden rows before selection or telemetry, and the REST transport maps absence to 404. Other DB failures remain distinct. Existing owner behavior and all scoring policy are preserved. Shared service protection covers web callers as well as REST. **This correction is not yet deployed.** TGA-306/TGA-317 retain broader contract/ownership acceptance.

`tools/musicdna/probe-client-contracts.mjs` is an explicitly configured, repeatable GET-response/ownership probe with owner/other tokens supplied through environment variables. It writes synthetic reading responses to a mode-0600 local file, prints no tokens or response content, and reports foreign-denial failures. Use an approved completed session to avoid starting a new diagnostic. It performs no choice/chat/feedback/share writes; bearer provisioning is separate. Do not commit capture files.

Flutter's actual session/history/continuation/feedback repositories successfully decoded the captured production responses. This is automated DTO evidence under private access, not normal beta access, a first-session write loop or physical-device acceptance.

## Source fixes and checks

- Backend session-access regression: 4 focused tests; full suite **263 passed / 3 credential-gated skipped**. TypeScript, changed-source ESLint and Vercel preview build pass.
- Mobile compatibility follow-up: restore the newest immutable feedback operation by server timestamp, retain its real mutation ID, fail closed on ambiguous ordering/duplicate identity, and reject mismatched mutation acknowledgment. Historical single-row payloads remain readable.
- Flutter: **125 tests passed**, including the optional captured-response test when supplied `MUSICDNA_CONTRACT_CAPTURE`; analysis clean. Default offline runs skip that one optional deployed-response test.
- Normal iOS release entry compiled successfully with proposed beta client configuration and no signing/upload. This confirms compilation only; the proposed beta origin is not live.

## Handoff and rollback

Do not mark TGA-328 Done until the actual beta origin works with ordinary user authentication and the remaining route/config matrix is recorded. TGA-330 then owns unique Apple build selection, signed archive/upload, processing and installation availability. TGA-329/TGA-321 belong to ACE after installation.

Rollback: disable the beta alias exception/remove its alias, stop beta deployments or set beta V1 off; restore the last known beta configuration if needed. Do not modify production aliases/flags or delete shared listener data. Beta API rollback does not remove choices/results.
