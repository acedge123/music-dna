# AB-52: perceived-accuracy pilot and owner QA

## Owner decisions — November 8, 2026

Alan chose himself plus invited TestFlight testers and the existing accurate/mixed/not-accurate feedback as the first measure. He then authorized switching from live synthetic checks to real QA, noting that he is currently the only human TestFlight tester. The initial activation is therefore **owner QA on the candidate**, limited to Alan's verified Music DNA account. Codex is an operator, not an independent human rater. No comparison, statistical benefit or efficacy claim can come from one person's QA reading.

This document defines the same small mechanism for a later invited comparison. The owner-QA mode and random allocation mode have different explicit labels and must never be pooled or silently substituted for each other.

## What “better” means

The chosen experience measure is the fraction of people whose **first on-time non-null accuracy response on their original saved reading (version 1, source pairings)** is `accurate`. Report `mixed` and `not_accurate` separately; ignore thumbs-up/down as substitutes. Later chat revisions do not replace the original result. Repeated identical feedback is one response; conflicting reused IDs are invalid. Later edits cannot cherry-pick a more favorable primary response.

Proposed comparison defaults: one eligible new reading per consenting adult participant; random 50/50 allocation per participant, persisted once; seven-day recruitment/exposure period, 24-hour feedback deadline from original result persistence. A small invited cohort is exploratory. Ten responses per arm is a reporting floor, not a powered sample-size or a promise of evidence. Random allocation may produce unequal arm sizes. Keep allocation labels out of the normal UI; technically sophisticated testers may still infer policy differences.

Report all assigned/started/completed/withdrawn people, response coverage and unknown/late outcomes. Missing feedback stays unknown. Give respondent rates, approximate Wilson/Newcombe uncertainty and worst/best missing-outcome bounds; unequal response coverage can bias the comparison. No repeated peeking to declare a winner. Candidate signal requires a closed window, sufficient observations, valid assignment/provenance, measured guardrails and positive conservative evidence, and still means human review of **perceived accuracy**, never objective diagnostic truth or automatic promotion. AB-30 owns any later release decision.

Guardrails: six-answer completion, same lane/evidence rules, skips, assignment/version mismatches and invalid feedback joins. Report application errors, latency and cost only when verified numeric counters exist. The existing producer lacks complete counters for those three, so they are **unavailable**, never zero/healthy. Tester-reported bugs are an immediate manual stop condition. Unknown guardrails prevent an automated positive signal. This release adds no model calls or per-pairing remote Brain dependency; only the existing local deterministic selector changes.

## Mechanism and scope

Reuse `experiment_assignments`, `sessions.routing_assignment`, trusted events and frozen choice/result context. No new table or service. Only operator RPCs can invite an account with a consent receipt and frozen design, bind its first eligible new session, or withdraw it. The reserved `ab52.*` namespace and pilot metadata cannot be forged/read through listener Data API access; ordinary experiments retain their existing behavior.

- Control: current legacy selection with shadow recommendation diagnostics.
- Candidate: existing Music DNA local domain regime/knob selection (`live`), including the unchanged bootstrap, fallback and reaction behavior. No generic hosted Brain scorer is substituted.
- Pin the same reviewed selector/strategy artifact for both arms. The explicit arm/mode selects behavior inside those source bytes. A pin change invalidates pilot routing; it never silently upgrades an enrolled experiment.
- Set `MUSICDNA_ROUTING_MODE=shadow` for the normal baseline. Pilot routing additionally needs **both** `MUSICDNA_AB52_PILOT_ENABLED=1` and `MUSICDNA_APPLIED_OUTCOMES_V1=1`.
- Only a private, consented invitation can override that baseline. Other accounts and later readings retain normal routing. Existing in-progress readings are not enrolled retrospectively. Retry/resume uses the same assignment.
- Withdrawal is monotonic. It stops pilot routing/capture, hides detailed withdrawn records from cohort export, and does not relabel an old treatment as control. Account deletion follows existing cascade rules. Disable both pilot/instrumentation flags to stop the pilot globally; existing frozen assignments remain audit history.

**Real pilot data stays in Music DNA.** The current cross-repository wire contract permits synthetic evidence only. A database trigger blocks human-pilot results from the synthetic outbox even if an operator mistakenly enrolls one for export. Do not enable capture/dispatch, Echelon/EdgeBot reviews, global signal LLMs or other learning controls for this QA. No secrets or raw names/emails/comments/songs/transcripts are in the local cohort projection or aggregate report.

## Invitation/consent copy for later volunteers

“We're testing two ways Music DNA chooses its six matchups. Your first new reading may use either version. Please finish it normally and mark the original reading accurate, mixed or not accurate within 24 hours. We will use the assignment, matchup metadata and feedback for a small internal comparison. For this pilot the feedback stays in Music DNA; it is not sent to the cross-app learning/model pipeline. Participation is optional. Tell Alan to stop pilot collection for you; normal app/account-deletion controls remain available. This is a product experience test, not a claim of validated personality measurement.”

The operator must record an explicit consent receipt/version/time and owner approval reference before inviting each adult. Signup, sharing, an account role or user_metadata is not consent. Alan's explicit owner-QA authorization in this conversation supplies his own pilot decision; it does not enroll other people.

## Release and activation

1. Review/merge the Music DNA pilot implementation and Agent Brain offline report PRs. Default flags are off, so code deployment before the migration does not access new columns/RPCs.
2. Apply the single forward `*_musicdna_invited_pilot.sql` migration once and verify its history/hash and intended operator-only grants. Existing AB-29/45/47 migration bytes and gates remain unchanged.
3. From the deployed `routing-artifact.json`, freeze design JSON with experiment ID `ab52.owner-qa.v1`, `allocation=owner_qa_treatment`, 24-hour measurement window, seven-day exposure cutoff and maximum 2 invitations. The actual first cohort contains only Alan. Record new UUIDs referring to his consent and owner authorization; do not put email/password/token text in those fields. Operator enrollment selects/records treatment explicitly for QA; later random allocation uses a separate approved experiment.
4. Verify the exact authorized account, no conflicting active pilot, baseline shadow, and the deployed source pin. Enroll via `enroll_musicdna_pilot_participant`, then enable only the two Music DNA pilot flags in the serving production environment and redeploy. Production activation is authorized by Alan once reviewed code/checks are ready; no unrelated feature/learning switch is authorized.
5. Alan starts a **new** reading in his existing TestFlight build, finishes six matchups and rates original result v1. No new native API shape or TestFlight binary is required by this server-only change. Codex may verify operator metadata and reports but must not invent Alan's choices or accuracy ratings.
6. Read local input with `tools/musicdna/sql/pilot-report.sql`: explicit READ ONLY transaction and local 10-second timeout. Run Agent Brain's `scripts/musicdna-experiment.mjs --input <private-cohort.json> --output <new-private-directory>`. It makes no network/model/database call, outputs only aggregates and never overwrites an earlier report. Use `--fixture` only for development input; do not label real QA as synthetic or a randomized comparison.

Rollback: withdraw the participant with `withdraw_musicdna_pilot_participant`, disable the two pilot flags, redeploy, verify ordinary shadow selection and zero new pilot bindings. Preserve the old assignment/consent record and already saved app reading. The private report excludes withdrawn detail and shows its unknown/withdrawn denominator. Do not reopen enrollment, change a pin or clear withdrawal to get a more favorable result.

## Verification and remaining acceptance

Native tests cover actual roles, hidden invitations, immutable consent/design, concurrent first-session binding, retry/resume, wrong owner, pre-invitation sessions, explicit owner-QA labeling, withdrawal and real feedback excluded from synthetic export. Unit tests verify default-off/no-new-RPC behavior and normal-mode fallback on unavailable/mismatched pilot configuration. CI also runs existing atomic-choice, outbox/dispatcher and application checks.

Release readiness and real owner-QA outcomes are separate receipts. No live synthetic model run is required. AB-52 stays open until the actual authorized QA reading/report is recorded and any later comparison is reported honestly as positive/null/negative/insufficient evidence. AB-31 consumes approved reporting outputs after that; no extra dashboard is needed.
