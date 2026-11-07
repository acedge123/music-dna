BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT pg_catalog.jsonb_build_object(
  'observed_at', pg_catalog.now(),
  'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
  'statement_timeout', pg_catalog.current_setting('statement_timeout'),
  'jobs', (SELECT coalesce(pg_catalog.jsonb_agg(t), '[]'::jsonb) FROM (
    SELECT j.jobid, j.schedule, j.active,
      r.status AS last_status, r.start_time AS last_start, r.end_time AS last_end,
      (SELECT count(*) FROM cron.job_run_details d WHERE d.jobid=j.jobid
        AND d.start_time>=pg_catalog.now()-interval '1 hour' AND d.status='failed') AS failures_last_hour
    FROM cron.job j LEFT JOIN LATERAL (
      SELECT status, start_time, end_time FROM cron.job_run_details d
      WHERE d.jobid=j.jobid ORDER BY start_time DESC LIMIT 1
    ) r ON true ORDER BY j.jobid
  ) t)
) AS snapshot;
COMMIT;
