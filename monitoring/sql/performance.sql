BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT pg_catalog.jsonb_build_object(
  'observed_at', pg_catalog.now(),
  'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
  'statement_timeout', pg_catalog.current_setting('statement_timeout'),
  'postmaster_start', pg_catalog.pg_postmaster_start_time(),
  'server_version_num', pg_catalog.current_setting('server_version_num'),
  'database_stats_reset', (SELECT stats_reset FROM pg_catalog.pg_stat_database WHERE datname=pg_catalog.current_database()),
  'sessions', (SELECT coalesce(pg_catalog.jsonb_agg(t), '[]'::jsonb) FROM (
    SELECT pid, state,
      extract(epoch FROM pg_catalog.now()-query_start) AS query_age_seconds,
      extract(epoch FROM pg_catalog.now()-xact_start) AS transaction_age_seconds,
      wait_event_type, pg_catalog.pg_blocking_pids(pid) AS blocking_pids
    FROM pg_catalog.pg_stat_activity
    WHERE datname=pg_catalog.current_database() AND backend_type='client backend'
      AND pid<>pg_catalog.pg_backend_pid()
      AND ((state='active' AND pg_catalog.now()-query_start>interval '30 seconds')
        OR (state LIKE 'idle in transaction%' AND pg_catalog.now()-xact_start>interval '30 seconds')
        OR cardinality(pg_catalog.pg_blocking_pids(pid))>0)
    ORDER BY query_start LIMIT 20
  ) t),
  'statements', (SELECT coalesce(pg_catalog.jsonb_agg(t), '[]'::jsonb) FROM (
    SELECT s.dbid::text, s.userid::text, s.queryid::text, s.toplevel, s.calls,
      s.total_exec_time, i.stats_reset, i.dealloc,
      s.stats_since AS statement_stats_since
    FROM extensions.pg_stat_statements s CROSS JOIN extensions.pg_stat_statements_info i
    WHERE s.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())
    ORDER BY s.total_exec_time DESC LIMIT 100
  ) t)
) AS snapshot;
COMMIT;
