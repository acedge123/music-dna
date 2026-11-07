-- Operator numeric/metadata diagnostics only. Missing schema/grants are unavailable.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT public.musicdna_learning_dispatch_status('music-dna-staging','staging') AS staging,
       public.musicdna_learning_dispatch_status('music-dna','production') AS production;
SELECT json_build_object(
  'dispatch_enabled',(SELECT count(*) FROM public.musicdna_export_scopes WHERE dispatch_enabled),
  'rls_tables',(SELECT count(*) FROM pg_class WHERE oid IN ('public.musicdna_learning_dispatch_jobs'::regclass,'public.musicdna_learning_dispatch_rates'::regclass,'public.musicdna_learning_dispatch_halts'::regclass) AND relrowsecurity),
  'browser_rpc_grants',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('claim_musicdna_learning_dispatch','begin_musicdna_learning_send','finish_musicdna_learning_dispatch','musicdna_learning_dispatch_status','inspect_musicdna_learning_dispatch','purge_musicdna_learning_dispatch') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))),
  'service_can_clear_halts',has_table_privilege('service_role','public.musicdna_learning_dispatch_halts','UPDATE,DELETE'),
  'service_can_replay',has_column_privilege('service_role','public.musicdna_learning_dispatch_jobs','replay_count','UPDATE'),
  'unleased_finish_granted',has_function_privilege('service_role','public.finish_musicdna_learning_withdrawal(text,text,uuid,timestamptz,integer,text)','EXECUTE')
) AS controls;
COMMIT;
