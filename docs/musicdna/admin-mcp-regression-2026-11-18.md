# AB-89 regression inspection / AB-91 backend defect

Authorized example: `fd7d5b61-1cdb-4a40-a027-ad6efd2e21d5`. Read-only metadata inspection, November 19 UTC. No model call, session write, private raw output export or production setting change.

The Phase 1 receipt correctly described the `llm_calls` table as insufficient. The additional authoritative measurement source is **critic_quality_attempts**: 16 attempts were found, including successful read-stage writer/reviewer calls and four failed reveal attempts. Thus the lack of writer rows in `llm_calls` does not mean the provider was never called.

| Reveal attempt (UTC) | Writer call durations (ms) | Saved status       | Reason                       |
| -------------------- | -------------------------- | ------------------ | ---------------------------- |
| 00:52:41.718         | 19,439 + 15,093            | invalid_generation | invalid_references_or_schema |
| 00:52:41.857         | 18,862 + 15,978            | invalid_generation | invalid_references_or_schema |
| 00:53:13.180         | 13,817 + 20,439            | invalid_generation | invalid_references_or_schema |
| 00:53:41.209         | 17,635 + 15,659            | invalid_generation | invalid_references_or_schema |

Every listed writer call recorded `status=ok`, model `gpt-6.1-sol`, with measured token counts. No reveal reviewer call was recorded. The shared `authorCritic` source validates decoded output before invoking its independent reviewer and retries when `validateCriticBeat` returns null. This supports a **local structural/reference validation failure**, not a missing key or proven provider transport failure. Parallel timestamps do not prove which browser request caused which attempt; correlation/phase wall-clock start is unavailable.

There are still zero saved `session_results` versions despite a session-completed event. Exact rejected fields cannot be established from sanitized metadata; this non-owner-QA session did not provide an exportable raw response. Do not relax claim/reference checks or invent a particular bad claim. AB-91 tracks a safe owner-QA/isolated reproduction, granular non-private reason codes and generation/contract alignment, with successful immutable-save/retry verification.

For the supplied opening years 1972, 1988, 1999, the nearest anchor to 2012/2014 is 1999, at 13/15 years: both fail a strict +/-10 diagnostic. Production's actual `preferEra` policy is soft (minimum pool 3, opening three answers only) and uses the broader opener era envelope; existing historical events do not establish the exact era-pool count or fallback receipt. No unrecorded fallback is asserted as fact.

Historical actual quip display strings/timings remain unavailable for this session. Prospective owner-QA paint receipts cannot retroactively repair that history.
