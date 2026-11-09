-- AB-50 receiver closeout: no member records, payloads, keys or raw log text.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT jsonb_build_object(
 'captured_at_utc',statement_timestamp(),
 'read_only',current_setting('transaction_read_only'),
 'source_count',(SELECT count(*) FROM public.app_signal_sources),
 'learning_enabled',(SELECT count(*) FROM public.app_signal_sources WHERE learning_enabled),
 'acceptance_source_count',(SELECT count(*) FROM public.app_signal_sources WHERE id='197da0c2-8e93-4c90-ab93-1945398a474d' AND source_key='music-dna-staging' AND tenant_id='musicdna-acceptance' AND environment='staging' AND purpose='musicdna_learning'),
 'acceptance_enabled',(SELECT count(*) FROM public.app_signal_sources WHERE id='197da0c2-8e93-4c90-ab93-1945398a474d' AND (enabled OR learning_enabled)),
 'original_window_matches',(SELECT coalesce(bool_and(observed_from='2026-11-08T01:09:06.666Z'::timestamptz AND expires_at='2026-11-09T01:10:06.666Z'::timestamptz),false) FROM public.musicdna_learning_lifecycle_scopes WHERE source_id='197da0c2-8e93-4c90-ab93-1945398a474d'),
 'expired_acceptance_scopes',(SELECT count(*) FROM public.musicdna_learning_lifecycle_scopes WHERE source_id='197da0c2-8e93-4c90-ab93-1945398a474d' AND expires_at<=statement_timestamp()),
 'acceptance_receipts',(SELECT count(*) FROM public.musicdna_learning_receipts WHERE source_id='197da0c2-8e93-4c90-ab93-1945398a474d'),
 'receipt_count',(SELECT count(*) FROM public.musicdna_learning_receipts),
 'suppression_count',(SELECT count(*) FROM public.musicdna_learning_suppressions),
 'suppression_forget_after',(SELECT min(forget_after) FROM public.musicdna_learning_suppressions WHERE source_id='197da0c2-8e93-4c90-ab93-1945398a474d'),
 'suppressions_due_for_forgetting',(SELECT count(*) FROM public.musicdna_learning_suppressions WHERE forget_after<=statement_timestamp()),
 'active_read_grants',(SELECT count(*) FROM public.musicdna_learning_read_grants WHERE revoked_at IS NULL AND expires_at>statement_timestamp()),
 'enabled_review_scopes',(SELECT count(*) FROM public.musicdna_learning_review_scopes WHERE enabled),
 'queued_or_running_acceptance_jobs',(SELECT count(*) FROM public.agent_jobs WHERE tenant_id='musicdna-acceptance' AND status IN ('queued','running')),
 'cron_extension_present',EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron'),
 'browser_table_privileges',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('musicdna_learning_receipts','musicdna_learning_lifecycle_scopes','musicdna_learning_suppressions','musicdna_learning_read_grants') AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE') OR has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE'))),
 'rls_table_count',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('musicdna_learning_receipts','musicdna_learning_lifecycle_scopes','musicdna_learning_suppressions','musicdna_learning_read_grants') AND c.relrowsecurity)
) AS status;
COMMIT;

