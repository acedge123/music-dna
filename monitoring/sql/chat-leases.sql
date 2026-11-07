BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT pg_catalog.jsonb_build_object(
  'observed_at', pg_catalog.now(),
  'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
  'statement_timeout', pg_catalog.current_setting('statement_timeout'),
  'pending', count(*) FILTER (WHERE assistant_message_id IS NULL),
  'expired_leases', count(*) FILTER (WHERE assistant_message_id IS NULL AND lease_until<pg_catalog.now()),
  'oldest_expired_seconds', max(extract(epoch FROM pg_catalog.now()-lease_until)) FILTER (
    WHERE assistant_message_id IS NULL AND lease_until<pg_catalog.now())
) AS snapshot FROM public.chat_turns;
COMMIT;
