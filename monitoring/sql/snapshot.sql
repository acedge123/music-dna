BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT pg_catalog.jsonb_build_object(
  'observed_at', pg_catalog.now(),
  'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
  'statement_timeout', pg_catalog.current_setting('statement_timeout'),
  'database_bytes', pg_catalog.pg_database_size(pg_catalog.current_database()),
  'max_connections', pg_catalog.current_setting('max_connections')::integer,
  'client_connections', (SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE backend_type='client backend'),
  'active_connections', (SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE backend_type='client backend' AND state='active'),
  'largest_tables', (SELECT coalesce(pg_catalog.jsonb_agg(t), '[]'::jsonb) FROM (
    SELECT schemaname, relname, pg_catalog.pg_total_relation_size(relid) AS total_bytes
    FROM pg_catalog.pg_stat_user_tables
    ORDER BY pg_catalog.pg_total_relation_size(relid) DESC LIMIT 20
  ) t)
) AS snapshot;
COMMIT;
