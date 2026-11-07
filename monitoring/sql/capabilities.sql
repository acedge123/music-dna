BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT pg_catalog.jsonb_build_object(
  'observed_at', pg_catalog.now(),
  'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
  'statement_timeout', pg_catalog.current_setting('statement_timeout'),
  'server_version_num', pg_catalog.current_setting('server_version_num'),
  'postmaster_start', pg_catalog.pg_postmaster_start_time(),
  'can_read_all_stats', pg_catalog.pg_has_role(current_user, 'pg_read_all_stats', 'USAGE'),
  'has_statements', pg_catalog.to_regclass('extensions.pg_stat_statements') IS NOT NULL,
  'has_cron', pg_catalog.to_regclass('cron.job') IS NOT NULL,
  'has_cron_history', pg_catalog.to_regclass('cron.job_run_details') IS NOT NULL,
  'has_chat_leases', pg_catalog.to_regclass('public.chat_turns') IS NOT NULL
) AS snapshot;
COMMIT;
