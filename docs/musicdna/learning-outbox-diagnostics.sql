-- Operator metadata/numeric diagnostics only. Missing checks are unavailable.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT json_build_object(
  'captured_at_utc',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'capture_enabled_scopes',(SELECT count(*) FROM public.musicdna_export_scopes WHERE capture_enabled),
  'enrollment_count',(SELECT count(*) FROM public.musicdna_learning_enrollments),
  'outbox_counts',(SELECT coalesce(json_object_agg(state,n),'{}'::json) FROM (SELECT state,count(*) AS n FROM public.musicdna_learning_outbox GROUP BY state) counts),
  'exclusion_counts',(SELECT coalesce(json_object_agg(reason,n),'{}'::json) FROM (SELECT reason,count(*) AS n FROM public.musicdna_learning_outbox WHERE reason IS NOT NULL GROUP BY reason) counts),
  'oldest_capture_age_seconds',(SELECT extract(epoch FROM statement_timestamp()-min(created_at)) FROM public.musicdna_learning_outbox WHERE state='captured'),
  'pending_deletions',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE completed_at IS NULL),
  'pending_deletions_over_seven_days',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE completed_at IS NULL AND requested_at<statement_timestamp()-interval '7 days'),
  'rls_tables',(SELECT count(*) FROM pg_class WHERE oid IN ('public.musicdna_learning_enrollments'::regclass,'public.musicdna_learning_outbox'::regclass) AND relrowsecurity),
  'browser_table_grants',(SELECT count(*) FROM (VALUES('anon'),('authenticated')) r(role_name) CROSS JOIN (VALUES('public.musicdna_learning_enrollments'),('public.musicdna_learning_outbox')) t(table_name) WHERE has_table_privilege(r.role_name,t.table_name,'SELECT,INSERT,UPDATE,DELETE')),
  'browser_rpc_grants',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('materialize_musicdna_learning_observation','exclude_musicdna_learning_capture','purge_musicdna_learning_outbox') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))),
  'private_trigger_client_grants',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='musicdna_learning_private' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE')))
) AS status;
COMMIT;
