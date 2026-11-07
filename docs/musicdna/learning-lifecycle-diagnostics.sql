-- Operator diagnostics only: metadata/numeric aggregates, never identities/references.
-- Missing tables/RPC/permissions are unavailable, not a healthy zero.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT json_build_object(
  'captured_at_utc',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'scope_count',(SELECT count(*) FROM public.musicdna_export_scopes),
  'active_scope_count',(SELECT count(*) FROM public.musicdna_export_scopes WHERE approved_by IS NOT NULL AND expires_at>statement_timestamp()),
  'pending_deletions',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE completed_at IS NULL),
  'pending_over_seven_days',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE completed_at IS NULL AND requested_at<statement_timestamp()-interval '7 days'),
  'completed_markers',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE completed_at IS NOT NULL),
  'rls_tables',(SELECT count(*) FROM pg_class WHERE oid IN ('public.musicdna_export_scopes'::regclass,'public.musicdna_export_withdrawals'::regclass) AND relrowsecurity),
  'browser_rpc_grants',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('musicdna_learning_export_allowed','request_musicdna_learning_withdrawal','finish_musicdna_learning_withdrawal','purge_completed_musicdna_learning_withdrawals')
      AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')))
) AS status;
COMMIT;
