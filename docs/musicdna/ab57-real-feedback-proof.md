# AB-57 completed real-QA feedback trace — November 10, 2026

**Passed:** the signed-in, consented owner's version-1 **Mixed** rating reached
Echelon and produced one persisted learning-review draft. Completion was
**10:46:59 AM Pacific / 18:46:59 UTC**. This closes AB-57's capture → delivery →
completed draft acceptance. It does not establish better readings or apply a
policy change. Exact metadata is in
[the linked receipt](ab57-real-feedback-receipt.json).

| Boundary                | Verified receipt                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Music DNA feedback      | `b48c2c97-55c0-47dc-871f-e9c39549fe81`, version 1, `mixed`, saved 18:45:21.818239 UTC.                                                                                             |
| Consent/enrollment      | `consented_qa`, existing owner-approved production scope; no synthetic relabeling or retrospective enrollment.                                                                     |
| Outbox observation      | `7fcfde3c-6f18-43a0-b095-c5ff15974bd2`; delivered once, claims 1, attempts 1, no last failure.                                                                                     |
| Echelon durable receipt | `dd12c807-fcb1-4e7b-9dc2-dceb41fea275`, `learning-observation.v2` / `real-qa.v1`; received 18:46:52.566777 UTC. Observation UUID and payload SHA-256 exactly match the source.     |
| Hosted EdgeBot review   | `3b41b47e-ba61-446f-9c00-f497fbf18f10`, claimed by `railway-echelon-worker`; status `done`. Its receipt list contains the exact receipt above; one review exists for that receipt. |
| Agent Brain correlation | `155a5f9c-3b08-4d78-9e2d-a98bc6c7dc3d`. Worker validates the Brain response/trace before requesting the model.                                                                     |
| OpenAI                  | `gpt-4o-mini-2024-07-18`, request `chatcmpl-Eil9t1yG2bAVzbvj03maqKKCXJNcj`; 261 prompt + 122 completion = **383 tokens**; provider latency 3,293 ms.                               |
| Saved Echelon draft     | `review_completed`, non-null result/hash, nonempty hypothesis/limitations, policy `real-qa-review.v1`; completed 18:46:59.113825 UTC.                                              |
| Decision                | `hold`, next step `ab52_human_review`. No approval, application, training, merge or deployment.                                                                                    |

Estimated model cost is **113 micro-US dollars = $0.000113 USD**; this is the saved
usage/price estimate, not an invoiced provider charge.

## What ran and what stayed unchanged

Codex ran one existing, already-approved source-bound delivery/review tick using
the two narrow caller credentials. It delivered one receipt and queued one review;
the existing hosted worker then completed that review. Hourly Railway scheduling,
owner-only consent, existing stricter source limits, the combined $5/day ceiling,
global app-signal LLM settings and automatic-application restrictions were left
unchanged. No backend credential was read or exported. No new reading, accuracy
vote, scope, key, account, migration, runtime patch or deployment was performed by
Codex in this verification.

The first local script launch exited before its guarded CLI entry point because
of the `/tmp` versus resolved `/private/tmp` path. It emitted no run event and sent
no work. The resolved-path launch returned `delivery_receipts=1`,
`review_queue_state=queued`, `attention_required=false`. This was not a blind
network/model retry; the persisted source attempt count and receiver review count
are both one.

The earlier guest **Mixed** rating remained a separate anonymous QA record. It
was not tied to the owner's consent, enrolled, reassigned or backfilled. The later
signed-in rating is the sole basis of this successful trace. Consent was already
valid; using the matching account resolved the submission boundary.

## Evidence limits and next work

All database verification was explicit **READ ONLY**, with a local **10-second
statement timeout**, selecting linkage IDs, numeric usage, enums, timestamps,
booleans and digests. No listening history, free-text feedback, hypothesis prose,
raw query text, model prompt, secret or token was returned. No new authenticated
Echelon reviewer login was required merely to verify persisted completion.

The choices may be agent-assisted owner QA and do not establish personal music
preferences or an independent experimental cohort. A draft hypothesis plus one
Mixed rating cannot demonstrate improved readings. Agent Brain supplied guidance;
OpenAI drafted the hypothesis; no model output trained Agent Brain.

- **AB-52:** freeze and evaluate a baseline/candidate comparison with honest sample,
  uncertainty and guardrails. The current evidence can legitimately mean hold.
- **AB-30:** deploy the already-merged approval capability only after authorization,
  then review an exact-version candidate and a separate Music DNA release.
- **AB-53 / AB-31:** final reviewed-change → actually applied version → new outcome
  proof and reporting; retain existing provider/HTTP/retention coverage limits.

The original [activation receipt](ab57-activation-receipt.json) remains immutable
historical evidence of the first empty-window run; this successful trace supersedes
its old outstanding owner-feedback item.
