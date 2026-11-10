# AB-57 current status — 2026-11-10

Hosted delivery/retry/retention and automatic draft requests are active for the one explicitly consenting owner. Railway uses only two narrow API caller keys; no Supabase backend or ingest key was read or exported to Railway. Source delivery runs inside Music DNA’s Supabase Edge Function. Global app-signal LLMs and automatic app changes remain off. $5/day is a combined ceiling; existing stricter source limits remain.

Both implementation PRs are merged: Music DNA35 and Echelon26. The first hosted execution finished2026-11-10 15:15 UTC: source completed/idle, receiver idle, attention=false, delivery0 and model calls0. This is an empty-window operational receipt, not positive evidence of a completed draft. At last count, four owner readings were enrolled but none had exportable accuracy feedback. The owner has been asked to submit their own rating.

**AB-57 remains In Progress** until an actual owner rating produces an Echelon receipt and completed saved draft with usage/cost/trace evidence. No rating is fabricated, pre-consent history backfilled or live synthetic test substituted. Downstream promotion/approval and perceived-accuracy comparison remain AB-30/53 and AB-52.

Detailed provider IDs, SQL hashes, key-denial checks and honest inventory limits are in `ab57-activation-receipt.json`; runbook and metadata-only SQL are in `ab57-automation.md` and `ab57-diagnostics.sql`. Source migrations were applied once and renamed to match verified native history, leaving one executable copy each. Echelon’s applied SQL failed the byte-exact requirement by one extra leading space on line70; Codex independently verified that single difference, and no history was rewritten or migration rerun.

Railway’s legacy config file was ignored for the new service. Incorrect disabled web builds were superseded/stopped, and explicit service API settings now select the small Docker image, hourly UTC cron and NEVER restart policy. Existing services were not reconfigured. The next cadence and runtime status must be checked in provider metadata; cron start times are not guaranteed minute-exact.
