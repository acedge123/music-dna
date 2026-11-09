-- AB-50 source closeout: metadata and numeric aggregates only.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT jsonb_build_object(
 'captured_at_utc',statement_timestamp(),
 'read_only',current_setting('transaction_read_only'),
 'scope_count',(SELECT count(*) FROM public.musicdna_export_scopes),
 'capture_enabled',(SELECT count(*) FROM public.musicdna_export_scopes WHERE capture_enabled),
 'dispatch_enabled',(SELECT count(*) FROM public.musicdna_export_scopes WHERE dispatch_enabled),
 'acceptance_scope_count',(SELECT count(*) FROM public.musicdna_export_scopes WHERE source_key='music-dna-staging' AND environment='staging' AND receiver_tenant_id='musicdna-acceptance'),
 'original_window_matches',(SELECT coalesce(bool_and(observed_from='2026-11-08T01:09:06.666Z'::timestamptz AND expires_at='2026-11-09T01:10:06.666Z'::timestamptz),false) FROM public.musicdna_export_scopes WHERE source_key='music-dna-staging' AND environment='staging'),
 'expired_acceptance_scopes',(SELECT count(*) FROM public.musicdna_export_scopes WHERE source_key='music-dna-staging' AND environment='staging' AND expires_at<=statement_timestamp()),
 'expired_scope_allows_export',public.musicdna_learning_export_allowed('music-dna-staging','staging','s_'||repeat('a',64),'2026-11-08T01:20:00Z'::timestamptz),
 'outbox_rows',(SELECT count(*) FROM public.musicdna_learning_outbox),
 'outbox_payloads',(SELECT count(*) FROM public.musicdna_learning_outbox WHERE projection IS NOT NULL OR canonical_envelope IS NOT NULL),
 'pending_deletions',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE completed_at IS NULL),
 'completed_markers',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE completed_at IS NOT NULL),
 'completed_markers_with_subject_ref',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE completed_at IS NOT NULL AND subject_ref IS NOT NULL),
 'markers_due_for_forgetting',(SELECT count(*) FROM public.musicdna_export_withdrawals w JOIN public.musicdna_export_scopes s USING(source_key,environment) WHERE completed_at IS NOT NULL AND s.expires_at+interval '7 days'<=statement_timestamp()),
 'marker_forgetting_due_at',(SELECT min(expires_at+interval '7 days') FROM public.musicdna_export_scopes WHERE source_key='music-dna-staging' AND environment='staging'),
 'jobs_by_state',(SELECT coalesce(jsonb_object_agg(state,n),'{}'::jsonb) FROM (SELECT state,count(*) n FROM public.musicdna_learning_dispatch_jobs GROUP BY state) x),
 'cron_extension_present',EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron'),
 'browser_table_privileges',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('musicdna_export_scopes','musicdna_export_withdrawals','musicdna_learning_enrollments','musicdna_learning_outbox','musicdna_learning_dispatch_jobs') AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE') OR has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE'))),
 'rls_table_count',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('musicdna_export_scopes','musicdna_export_withdrawals','musicdna_learning_enrollments','musicdna_learning_outbox','musicdna_learning_dispatch_jobs') AND c.relrowsecurity)
) AS status;
COMMIT;
