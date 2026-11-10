-- Operator metadata only. Run the two project sections separately.
-- No member records, evidence content, credentials, raw SQL definitions or writes.
-- Source: udycgnhvaanemhrchbuj
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT capture_enabled,dispatch_enabled,expires_at<statement_timestamp() AS scope_expired
FROM public.musicdna_export_scopes
WHERE source_key='music-dna-staging' AND environment='staging';
SELECT count(*) AS retained_payloads FROM public.musicdna_learning_outbox
WHERE source_key='music-dna-staging' AND environment='staging'
AND (projection IS NOT NULL OR canonical_envelope IS NOT NULL);
SELECT count(*) AS pending_withdrawals FROM public.musicdna_export_withdrawals
WHERE source_key='music-dna-staging' AND environment='staging' AND completed_at IS NULL;
COMMIT;

-- Echelon: yczomejrvihbmydyraqg (Lovable Cloud)
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT enabled,learning_enabled FROM public.app_signal_sources
WHERE id='197da0c2-8e93-4c90-ab93-1945398a474d';
SELECT count(*) AS receipts FROM public.musicdna_learning_receipts
WHERE source_id='197da0c2-8e93-4c90-ab93-1945398a474d';
SELECT count(*) FILTER(WHERE result IS NOT NULL) AS retained_drafts,
 count(*) FILTER(WHERE state IN ('queued','preparing','calling_model')) AS in_progress
FROM public.musicdna_learning_reviews
WHERE source_id='197da0c2-8e93-4c90-ab93-1945398a474d';
SELECT count(*) AS suppression_hashes,
 count(*) FILTER(WHERE forget_after<=statement_timestamp()) AS due,
 min(forget_after) AS next_due
FROM public.musicdna_learning_suppressions
WHERE source_id='197da0c2-8e93-4c90-ab93-1945398a474d';
SELECT p.proname,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('read_musicdna_learning_window','delete_musicdna_learning_subject','purge_expired_musicdna_learning');
COMMIT;
