# Three-verdict reviewer: exact ten-item retest

New policy: `saved-song-why-review-v2`. The original ten reviews remain v1, unchanged (9 Fail, 1 Pass). That 90% figure is the original two-verdict reviewer outcome, not a verified catalog-error rate.

## Criteria

- Fail: identifiable substantive contradiction, unsupported interpretation, axis confusion or meaningful score mismatch.
- Uncertain: a recording-specific claim needs independent verification, without a substantive problem warranting failure.
- Pass: coherent explanation and score, no identifiable substantive problem; never proof of listening.

Score disputes remain independent; lack of audio alone must not dispute a score. New results are appended, never substituted for historical verdicts or approvals.

## Exact cohort from the saved 2026-11-19 16:24–16:26 UTC run

| Song | Attribute | Explanation ID | Original |
|---|---|---|---|
| Burn, Burn, Burn | confidence | 472f9cc2-027a-473d-a498-eb2450842f68 | Fail |
| Schism | scale | 4e1f4198-80f6-449b-8492-1e5803404471 | Fail |
| Strawberry Wine | atmosphere | 0e54aed9-82dc-4540-8695-3ab096017133 | Fail |
| Smalltown Boy | community | 232807e5-5d60-4c53-aa39-8cdda3b530a1 | Fail |
| Angel | confidence | f6c4ce01-0c0b-42ac-8eae-207003d00307 | Fail |
| Alright | immersion | 9121e58b-ffe9-4c25-916f-f036c84a6b92 | Fail |
| Porcelain | texture | 025faadc-d2bf-44d8-9d7d-d45922dc3165 | Fail |
| Wagon Wheel | community | 06fa40ed-d02a-4c91-b6d7-038690add2eb | Pass |
| Ace of Spades | movement | 05e70aab-a2cb-4531-908a-3f7e36bad265 | Fail |
| Birds of a Feather | community | 04d145d5-7496-4ac6-84d1-1c4977a8f5b6 | Fail |

## Execution gate and comparison

After Vercel deploys v2, the authorized reviewer uses `song_whys_get` to read each exact source/context version, then `song_whys_request_ai_review` once per selected explanation with a fresh mutation ID and paid confirmation. Preserve that mutation ID for lost-response replay. Verify returned `policy_version` is v2. Do not repeat old mutation IDs to create a new review, bypass the existing hourly cap, or review the remaining 785.

Important correction: the saved-review request RPC DOES enforce ten new requests per caller per rolling hour, in addition to one explanation per call. The previous explanation overlooked that database safeguard. Keep it unchanged for this bounded retest.

Compare v1 and v2 with `song_whys_get_ai_review_rates`, passing these same ten `explanation_ids`. Rates use latest attempt per explanation within the named policy, completed reviews only; failed/ambiguous requests are unavailable attempts, not failed explanations. Empty denominators return null, not healthy zero. Review all captured source contexts and any staleness before interpreting the comparison.

The admin saved-review panel separates policies and displays Fail and Uncertain rates separately. No catalog scores, explanation text, approval status, historical results, routing or export changes occur.

Retest status: cohort identified; paid execution requires deployed v2 and an authorized app/MCP caller. Externally managed auth cannot be restored in this sandbox. No paid retest or remaining-catalog run has been executed here.