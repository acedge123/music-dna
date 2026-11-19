-- AB-92: append-only advisory reviews of SAVED explanations. No scheduler,
-- catalog edits, grants, model calls or historical reviewer rewrites.
CREATE TABLE public.musicdna_song_why_ai_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 explanation_id uuid NOT NULL, -- deliberately retained if the source is later removed
 requested_by uuid NOT NULL, mutation_id uuid NOT NULL,
 explanation_version text NOT NULL, context_version text NOT NULL,
 snapshot jsonb NOT NULL,
 policy_version text NOT NULL DEFAULT 'saved-song-why-review-v1',
 state text NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','running','completed','failed','ambiguous')),
 configured_routing jsonb, result jsonb, measurement jsonb,
 error_code text, stale_at_completion boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz,
 UNIQUE(requested_by,mutation_id),
 CHECK((state='completed')=(result IS NOT NULL))
);
-- Service may ONLY use the scoped RPCs, not directly edit audit records.
REVOKE ALL ON public.musicdna_song_why_ai_reviews FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.musicdna_song_why_ai_reviews TO authenticated;
ALTER TABLE public.musicdna_song_why_ai_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY why_ai_read ON public.musicdna_song_why_ai_reviews FOR SELECT TO authenticated
 USING(musicdna_admin_mcp.can('catalog_read'));
CREATE INDEX why_ai_source ON public.musicdna_song_why_ai_reviews(explanation_id,created_at);

-- Authoritative catalog snapshot, also used by the gated audit view. Fresh permission checks apply even to direct SQL calls.
CREATE FUNCTION musicdna_admin_mcp.why_ai_snapshot(p_id uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_read') AND current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object(
  'explanation',to_jsonb(w),'version',musicdna_admin_mcp.why_version(to_jsonb(w)),
  'song',jsonb_build_object('id',s.id,'title',s.title,'artist',s.artist,'year',s.year,
    'genre',s.primary_lane,'subgenre',s.sub_lane,'active',s.active,'scoring_version',s.scoring_version),
  'attribute',jsonb_build_object('key',a.key,'low_pole',a.low_pole,'high_pole',a.high_pole,
    'definition',a.tradeoff_sentence,'label',a.analyst_label,'min',0,'max',100,
    'current_score',(to_jsonb(s)->>w.axis)::numeric,'score_at_write',w.score_at_write),
  'recording_identity',jsonb_build_object('catalog_song_id',s.id,'title',s.title,'artist',s.artist,'year',s.year,
    'lane',s.primary_lane,'unique_recording_id',NULL,'verification','Catalog identity only; ISRC/edition/audio not recorded. Do not assume a live/remastered/alternate recording.'),
  'stale_explanation',w.score_at_write IS DISTINCT FROM (to_jsonb(s)->>w.axis)::numeric,
  'availability',jsonb_build_object('audio_verification','requires_listening',
    'writer_model_id','not_recorded','reviewer_model_id','not_recorded',
    'reviewer_confidence_numeric','not_recorded','historical_edits_before_baseline','not_recorded',
    'historical_reviewer_model','not_recorded','ontology_version','not_recorded')
 ) FROM public.song_trait_explanations w JOIN public.songs s ON s.id=w.song_id
 LEFT JOIN public.axes a ON a.key=w.axis WHERE w.id=p_id);
END; $$;
REVOKE ALL ON FUNCTION musicdna_admin_mcp.why_ai_snapshot(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION musicdna_admin_mcp.why_ai_snapshot(uuid) TO authenticated;

CREATE FUNCTION public.musicdna_mcp_why_review_context(p_id uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE s jsonb;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_read') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 s:=musicdna_admin_mcp.why_ai_snapshot(p_id);
 IF s IS NULL THEN RAISE EXCEPTION 'MCP_NOT_FOUND'; END IF;
 RETURN s||jsonb_build_object('review_context_version',musicdna_admin_mcp.why_version(s));
END; $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_why_review_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_why_review_context(uuid) TO authenticated;

CREATE FUNCTION public.musicdna_mcp_request_why_ai_review(
 p_id uuid,p_version text,p_context text,p_mutation uuid,p_confirm_paid boolean) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE s jsonb; r public.musicdna_song_why_ai_reviews; v text;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_review') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_confirm_paid IS DISTINCT FROM true OR p_mutation IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 -- Serializes same caller mutation before any external call. Replay never claims work.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,0));
 SELECT * INTO r FROM public.musicdna_song_why_ai_reviews WHERE requested_by=auth.uid() AND mutation_id=p_mutation;
 IF FOUND THEN
  IF r.explanation_id<>p_id OR r.explanation_version IS DISTINCT FROM p_version OR r.context_version IS DISTINCT FROM p_context THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('request_id',r.id,'replayed',true);
 END IF;
 s:=musicdna_admin_mcp.why_ai_snapshot(p_id);
 IF s IS NULL THEN RAISE EXCEPTION 'MCP_NOT_FOUND'; END IF;
 IF octet_length(s::text)>20000 THEN RAISE EXCEPTION 'MCP_REVIEW_CONTEXT_UNAVAILABLE'; END IF;
 v:=musicdna_admin_mcp.why_version(s);
 IF s->>'version' IS DISTINCT FROM p_version OR v IS DISTINCT FROM p_context THEN RAISE EXCEPTION 'MCP_STALE_VERSION'; END IF;
 IF s#>>'{attribute,key}' IS NULL OR s#>>'{attribute,definition}' IS NULL OR s#>>'{attribute,current_score}' IS NULL THEN RAISE EXCEPTION 'MCP_REVIEW_CONTEXT_UNAVAILABLE'; END IF;
 -- Small explicit requests only; no batch/automatic retries. Rate limit does not grant a spending entitlement.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 IF (SELECT count(*) FROM public.musicdna_song_why_ai_reviews WHERE requested_by=auth.uid() AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'MCP_REVIEW_RATE_LIMIT'; END IF;
 INSERT INTO public.musicdna_song_why_ai_reviews(explanation_id,requested_by,mutation_id,explanation_version,context_version,snapshot)
 VALUES(p_id,auth.uid(),p_mutation,p_version,v,s) RETURNING * INTO r;
 RETURN jsonb_build_object('request_id',r.id,'replayed',false);
END; $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_request_why_ai_review(uuid,text,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_request_why_ai_review(uuid,text,text,uuid,boolean) TO authenticated;

-- Server-only single-use claim. Browser/OAuth callers cannot forge a model verdict.
CREATE FUNCTION public.musicdna_server_claim_why_ai_review(p_request uuid,p_actor uuid,p_routing jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE r public.musicdna_song_why_ai_reviews; s jsonb;
BEGIN
 SELECT * INTO r FROM public.musicdna_song_why_ai_reviews WHERE id=p_request AND requested_by=p_actor FOR UPDATE;
 IF NOT FOUND OR r.state<>'requested' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND NOT coalesce(is_anonymous,false))
  OR NOT (public.has_role(p_actor,'admin') OR EXISTS(SELECT 1 FROM public.musicdna_mcp_grants WHERE user_id=p_actor AND role='reviewer' AND revoked_at IS NULL)) THEN
  UPDATE public.musicdna_song_why_ai_reviews SET state='failed',error_code='PERMISSION_REVOKED',completed_at=now() WHERE id=r.id; RETURN NULL;
 END IF;
 s:=musicdna_admin_mcp.why_ai_snapshot(r.explanation_id);
 IF s IS NULL OR musicdna_admin_mcp.why_version(s)<>r.context_version THEN
  UPDATE public.musicdna_song_why_ai_reviews SET state='failed',error_code='STALE_BEFORE_CALL',stale_at_completion=true,completed_at=now() WHERE id=r.id; RETURN NULL;
 END IF;
 IF p_routing->>'configured' IS DISTINCT FROM 'true' OR p_routing->>'critic_reviewer' IS NULL THEN RAISE EXCEPTION 'MCP_REVIEW_CONTEXT_UNAVAILABLE'; END IF;
 UPDATE public.musicdna_song_why_ai_reviews SET state='running',started_at=now(),configured_routing=p_routing WHERE id=r.id;
 RETURN jsonb_build_object('snapshot',r.snapshot,'policy_version',r.policy_version);
END; $$;
REVOKE ALL ON FUNCTION public.musicdna_server_claim_why_ai_review(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.musicdna_server_claim_why_ai_review(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.musicdna_server_finish_why_ai_review(p_request uuid,p_state text,p_result jsonb,p_measurement jsonb,p_error text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE r public.musicdna_song_why_ai_reviews; s jsonb; n numeric;
BEGIN
 SELECT * INTO r FROM public.musicdna_song_why_ai_reviews WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR r.state<>'running' THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
 IF p_state NOT IN ('completed','failed','ambiguous') THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 IF p_state='completed' THEN
  IF p_result IS NULL OR jsonb_typeof(p_result)<>'object' OR p_result->>'axis' IS DISTINCT FROM r.snapshot#>>'{explanation,axis}'
   OR p_result->>'verdict' IS NULL OR p_result->>'verdict' NOT IN ('pass','fail')
   OR jsonb_typeof(p_result->'score_disputed') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(p_result->'note') IS DISTINCT FROM 'string' OR length(btrim(p_result->>'note')) NOT BETWEEN 1 AND 2000
   OR jsonb_typeof(p_result->'reason') IS DISTINCT FROM 'string' OR length(btrim(p_result->>'reason')) NOT BETWEEN 1 AND 2000
   OR NOT (p_result ? 'suggested_score') THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
  IF p_result->'suggested_score'<>'null'::jsonb THEN
   IF jsonb_typeof(p_result->'suggested_score')<>'number' THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
   n:=(p_result->>'suggested_score')::numeric;
   IF n<>trunc(n) OR n NOT BETWEEN 0 AND 100 OR NOT (p_result->>'score_disputed')::boolean THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
  END IF;
 ELSIF p_result IS NOT NULL OR p_error IS NULL OR p_error NOT IN ('PROVIDER_FAILED','PROVIDER_TIMEOUT_OR_UNKNOWN','INVALID_REVIEW','REVIEW_UNAVAILABLE') THEN RAISE EXCEPTION 'MCP_INVALID_INPUT';
 END IF;
 s:=musicdna_admin_mcp.why_ai_snapshot(r.explanation_id);
 UPDATE public.musicdna_song_why_ai_reviews SET state=p_state,result=p_result,measurement=p_measurement,
  error_code=p_error,completed_at=now(),stale_at_completion=(s IS NULL OR musicdna_admin_mcp.why_version(s)<>r.context_version)
 WHERE id=r.id;
END; $$;
REVOKE ALL ON FUNCTION public.musicdna_server_finish_why_ai_review(uuid,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.musicdna_server_finish_why_ai_review(uuid,text,jsonb,jsonb,text) TO service_role;

-- Read-time freshness is independent from the immutable completion-time evidence.
CREATE VIEW public.musicdna_mcp_why_ai_reviews WITH(security_barrier=true) AS
 SELECT r.*, r.snapshot->>'stale_explanation'='true' AS stale_explanation,
 r.stale_at_completion OR s.value IS NULL OR musicdna_admin_mcp.why_version(s.value)<>r.context_version AS stale_result,
 CASE WHEN r.state IN ('requested','running') AND r.created_at<now()-interval '90 seconds'
  THEN 'expired_or_ambiguous' ELSE r.state END AS display_state,
 r.snapshot#>>'{song,genre}' AS lane,
 (r.result->>'score_disputed')::boolean AS score_disputed,
 r.state='completed' AND r.result->'suggested_score'='null'::jsonb AS suggestion_unavailable
 FROM public.musicdna_song_why_ai_reviews r
 LEFT JOIN LATERAL (SELECT musicdna_admin_mcp.why_ai_snapshot(r.explanation_id) AS value) s ON true
 WHERE musicdna_admin_mcp.can('catalog_read');
REVOKE ALL ON public.musicdna_mcp_why_ai_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.musicdna_mcp_why_ai_reviews TO authenticated;
-- Deliberate owner-executed view; the fresh capability gate above precedes any disclosure.

-- Bulk human approval stays in its existing path, with an atomic exclusion of
-- unresolved/failed/disputed reviews of THIS explanation version. No approved row is revoked.
CREATE FUNCTION public.musicdna_mcp_bulk_approve_whys(p_lane text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE approved integer; stale integer; challenged integer;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_review') OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO stale FROM public.song_trait_explanations w JOIN public.songs s ON s.id=w.song_id
 WHERE w.status='pending_review' AND (p_lane IS NULL OR s.primary_lane=p_lane) AND w.score_at_write IS DISTINCT FROM (to_jsonb(s)->>w.axis)::numeric;
 SELECT count(*) INTO challenged FROM public.song_trait_explanations w JOIN public.songs s ON s.id=w.song_id
 WHERE w.status='pending_review' AND (p_lane IS NULL OR s.primary_lane=p_lane) AND (w.score_disputed OR w.model_review_verdict='fail'
 OR EXISTS(SELECT 1 FROM public.musicdna_song_why_ai_reviews r WHERE r.explanation_id=w.id AND r.explanation_version=musicdna_admin_mcp.why_version(to_jsonb(w))
 AND (r.state<>'completed' OR r.result->>'verdict'='fail' OR (r.result->>'score_disputed')::boolean)));
 WITH changed AS (
 UPDATE public.song_trait_explanations w SET status='approved',confidence='reviewed',reviewed_by=auth.uid(),reviewed_at=now()
 FROM public.songs s WHERE w.song_id=s.id AND w.status='pending_review' AND (p_lane IS NULL OR s.primary_lane=p_lane)
 AND w.score_at_write=(to_jsonb(s)->>w.axis)::numeric AND NOT w.score_disputed AND w.model_review_verdict IS DISTINCT FROM 'fail'
 AND NOT EXISTS(SELECT 1 FROM public.musicdna_song_why_ai_reviews r WHERE r.explanation_id=w.id AND r.explanation_version=musicdna_admin_mcp.why_version(to_jsonb(w))
 AND (r.state<>'completed' OR r.result->>'verdict'='fail' OR (r.result->>'score_disputed')::boolean)) RETURNING w.id)
 SELECT count(*) INTO approved FROM changed;
 RETURN jsonb_build_object('approved',approved,'skipped_stale',stale,'skipped_challenged',challenged);
END; $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_bulk_approve_whys(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_bulk_approve_whys(text) TO authenticated;
