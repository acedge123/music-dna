-- Metadata only. Never add evidence, prose, member records, credentials or raw query text.
-- Run against Music DNA:
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT source_key,environment,state,started_at,finished_at,last_success_at,delivered,attention,
 started_at < now()-interval '2 hours' AS missed_execution
FROM public.musicdna_learning_worker_status;
SELECT enabled,valid_until,last_claim_at FROM public.musicdna_learning_worker_callers;
COMMIT;

-- Run separately against Echelon:
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT enabled,valid_until,last_tick,last_state,last_job_id,
 last_tick IS NULL OR last_tick < now()-interval '2 hours' AS missed_execution
FROM public.musicdna_learning_automation;
SELECT state,count(*) AS jobs,sum(actual_cost_micro) AS measured_cost_micro,
 sum(CASE WHEN actual_cost_micro IS NULL THEN reserved_cost_micro ELSE 0 END) AS unknown_cost_reserved_micro
FROM public.musicdna_learning_reviews
WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
GROUP BY state;
COMMIT;
