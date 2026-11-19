ALTER TABLE public.song_trait_explanations DROP CONSTRAINT song_trait_explanations_model_review_verdict_check;
ALTER TABLE public.song_trait_explanations ADD CONSTRAINT song_trait_explanations_model_review_verdict_check CHECK (model_review_verdict IN ('pass','fail','uncertain'));
CREATE FUNCTION public.musicdna_mcp_request_why_ai_review_v2(p_id uuid,p_version text,p_context text,p_mutation uuid,p_confirm_paid boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE reservation jsonb; r public.musicdna_song_why_ai_reviews;
BEGIN
 reservation:=public.musicdna_mcp_request_why_ai_review(p_id,p_version,p_context,p_mutation,p_confirm_paid);
 SELECT * INTO r FROM public.musicdna_song_why_ai_reviews WHERE id=(reservation->>'request_id')::uuid FOR UPDATE;
 IF (reservation->>'replayed')::boolean THEN
  IF r.policy_version<>'saved-song-why-review-v2' THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
 ELSE UPDATE public.musicdna_song_why_ai_reviews SET policy_version='saved-song-why-review-v2' WHERE id=r.id AND state='requested'; END IF;
 RETURN reservation;
END; $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_request_why_ai_review_v2(uuid,text,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_request_why_ai_review_v2(uuid,text,text,uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.musicdna_server_finish_why_ai_review(p_request uuid,p_state text,p_result jsonb,p_measurement jsonb,p_error text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE r public.musicdna_song_why_ai_reviews; s jsonb; n numeric;
BEGIN
 SELECT * INTO r FROM public.musicdna_song_why_ai_reviews WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR r.state<>'running' THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
 IF p_state NOT IN ('completed','failed','ambiguous') THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 IF p_state='completed' THEN
 IF p_result IS NULL OR jsonb_typeof(p_result)<>'object' OR p_result->>'axis' IS DISTINCT FROM r.snapshot#>>'{explanation,axis}' OR p_result->>'verdict' IS NULL OR p_result->>'verdict' NOT IN ('pass','fail','uncertain') OR (r.policy_version='saved-song-why-review-v1' AND p_result->>'verdict'='uncertain') OR jsonb_typeof(p_result->'score_disputed') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_result->'note') IS DISTINCT FROM 'string' OR length(btrim(p_result->>'note')) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(p_result->'reason') IS DISTINCT FROM 'string' OR length(btrim(p_result->>'reason')) NOT BETWEEN 1 AND 2000 OR NOT (p_result ? 'suggested_score') THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 IF p_result->'suggested_score'<>'null'::jsonb THEN
 IF jsonb_typeof(p_result->'suggested_score')<>'number' THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 n:=(p_result->>'suggested_score')::numeric;
 IF n<>trunc(n) OR n NOT BETWEEN 0 AND 100 OR NOT (p_result->>'score_disputed')::boolean THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 END IF;
 ELSIF p_result IS NOT NULL OR p_error IS NULL OR p_error NOT IN ('PROVIDER_FAILED','PROVIDER_TIMEOUT_OR_UNKNOWN','INVALID_REVIEW','REVIEW_UNAVAILABLE') THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 s:=musicdna_admin_mcp.why_ai_snapshot(r.explanation_id);
 UPDATE public.musicdna_song_why_ai_reviews SET state=p_state,result=p_result,measurement=p_measurement,error_code=p_error,completed_at=now(),stale_at_completion=(s IS NULL OR musicdna_admin_mcp.why_version(s)<>r.context_version) WHERE id=r.id;
END; $$;
REVOKE ALL ON FUNCTION public.musicdna_server_finish_why_ai_review(uuid,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.musicdna_server_finish_why_ai_review(uuid,text,jsonb,jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.musicdna_mcp_bulk_approve_whys(p_lane text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE approved integer; stale integer; challenged integer;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_review') OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO stale FROM public.song_trait_explanations w JOIN public.songs s ON s.id=w.song_id WHERE w.status='pending_review' AND (p_lane IS NULL OR s.primary_lane=p_lane) AND w.score_at_write IS DISTINCT FROM (to_jsonb(s)->>w.axis)::numeric;
 SELECT count(*) INTO challenged FROM public.song_trait_explanations w JOIN public.songs s ON s.id=w.song_id WHERE w.status='pending_review' AND (p_lane IS NULL OR s.primary_lane=p_lane) AND (w.score_disputed OR w.model_review_verdict IN ('fail','uncertain') OR EXISTS(SELECT 1 FROM public.musicdna_song_why_ai_reviews r WHERE r.explanation_id=w.id AND r.explanation_version=musicdna_admin_mcp.why_version(to_jsonb(w)) AND (r.state<>'completed' OR r.result->>'verdict' IN ('fail','uncertain') OR (r.result->>'score_disputed')::boolean)));
 WITH changed AS (UPDATE public.song_trait_explanations w SET status='approved',confidence='reviewed',reviewed_by=auth.uid(),reviewed_at=now() FROM public.songs s WHERE w.song_id=s.id AND w.status='pending_review' AND (p_lane IS NULL OR s.primary_lane=p_lane) AND w.score_at_write=(to_jsonb(s)->>w.axis)::numeric AND NOT w.score_disputed AND (w.model_review_verdict IS NULL OR w.model_review_verdict='pass') AND NOT EXISTS(SELECT 1 FROM public.musicdna_song_why_ai_reviews r WHERE r.explanation_id=w.id AND r.explanation_version=musicdna_admin_mcp.why_version(to_jsonb(w)) AND (r.state<>'completed' OR r.result->>'verdict' IN ('fail','uncertain') OR (r.result->>'score_disputed')::boolean)) RETURNING w.id) SELECT count(*) INTO approved FROM changed;
 RETURN jsonb_build_object('approved',approved,'skipped_stale',stale,'skipped_challenged',challenged);
END; $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_bulk_approve_whys(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_bulk_approve_whys(text) TO authenticated;
CREATE FUNCTION public.musicdna_mcp_why_ai_review_rates(p_policy text,p_ids uuid[] DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 WITH selected AS (SELECT DISTINCT ON (explanation_id) * FROM public.musicdna_song_why_ai_reviews WHERE policy_version=p_policy AND (p_ids IS NULL OR explanation_id=ANY(p_ids)) ORDER BY explanation_id,created_at DESC,id DESC), counts AS (SELECT count(*) AS requested,count(*) FILTER(WHERE state='completed') AS completed,count(*) FILTER(WHERE state='completed' AND result->>'verdict'='pass') AS passed,count(*) FILTER(WHERE state='completed' AND result->>'verdict'='fail') AS failed,count(*) FILTER(WHERE state='completed' AND result->>'verdict'='uncertain') AS uncertain,count(*) FILTER(WHERE state<>'completed') AS unavailable FROM selected)
 SELECT jsonb_build_object('policy_version',p_policy,'scope','latest attempt per explanation within policy; all saved contexts, not current-catalog certification','requested',requested,'completed',completed,'pass',passed,'fail',failed,'uncertain',uncertain,'unavailable',unavailable,'failure_rate',failed::numeric/NULLIF(completed,0),'uncertainty_rate',uncertain::numeric/NULLIF(completed,0),'denominator','completed reviews only; unavailable attempts excluded') FROM counts;
$$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_why_ai_review_rates(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_why_ai_review_rates(text,uuid[]) TO authenticated;