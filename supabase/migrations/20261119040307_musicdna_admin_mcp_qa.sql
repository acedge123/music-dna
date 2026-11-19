-- Read-only operator projections; no sessions, votes, QA accounts or model jobs created.
-- Depends on the reviewed Phase 1 catalog migration. Zero scope grants are seeded.
CREATE TABLE public.musicdna_mcp_qa_scopes (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 approved_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 revoked_at timestamptz, PRIMARY KEY(user_id,session_id)
);
REVOKE ALL ON public.musicdna_mcp_qa_scopes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.musicdna_mcp_qa_scopes TO authenticated;
GRANT ALL ON public.musicdna_mcp_qa_scopes TO service_role;
ALTER TABLE public.musicdna_mcp_qa_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_qa_scope_self ON public.musicdna_mcp_qa_scopes FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE FUNCTION musicdna_admin_mcp.qa_allowed(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
 SELECT musicdna_admin_mcp.can('qa_read') AND EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=sid AND
  (s.user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.interview_qa_sessions q WHERE q.session_id=s.id AND q.created_by=auth.uid())
   OR EXISTS(SELECT 1 FROM public.musicdna_mcp_qa_scopes g WHERE g.session_id=s.id AND g.user_id=auth.uid() AND g.revoked_at IS NULL AND g.expires_at>now())));
$$;
REVOKE ALL ON FUNCTION musicdna_admin_mcp.qa_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION musicdna_admin_mcp.qa_allowed(uuid) TO authenticated;

-- These security-barrier views are deliberately owner-executed to project narrow scoped
-- metadata across existing admin-only diagnostic RLS. Every row is filtered by the
-- caller's fresh QA permission AND ownership/explicit scope. Base-table grants are unchanged.
CREATE VIEW public.musicdna_mcp_qa_sessions WITH(security_barrier=true) AS
 SELECT s.id,s.started_at,s.completed_at,s.created_at,s.mode,s.decade,s.lane,s.parent_session_id,
 (SELECT coalesce(u.is_anonymous,false) FROM auth.users u WHERE u.id=s.user_id) AS is_guest,
 EXISTS(SELECT 1 FROM public.interview_qa_sessions q WHERE q.session_id=s.id) AS owner_qa,
 (SELECT count(*) FROM public.choices c WHERE c.session_id=s.id) AS choices,
 (SELECT count(*) FROM public.event_log e WHERE e.session_id=s.id AND e.event_type='pairing_skipped') AS skips,
 (SELECT count(*) FROM public.session_results r WHERE r.session_id=s.id) AS saved_versions,
 (SELECT count(*) FROM public.critic_quality_attempts a WHERE a.session_id=s.id) AS measured_attempts
 FROM public.sessions s WHERE musicdna_admin_mcp.qa_allowed(s.id);
CREATE VIEW public.musicdna_mcp_qa_choices WITH(security_barrier=true) AS
 SELECT c.id,c.session_id,c.pairing_id,c.chosen_song_id,c.rejected_song_id,c.created_at,c.ms_to_decide,c.evidence
 FROM public.choices c WHERE musicdna_admin_mcp.qa_allowed(c.session_id);
CREATE VIEW public.musicdna_mcp_qa_events WITH(security_barrier=true) AS
 SELECT e.id,e.session_id,e.event_type,e.pairing_id,e.choice_id,e.created_at,e.response_time_ms,e.client,
 CASE WHEN e.event_type='read_shown' THEN coalesce(CASE WHEN jsonb_typeof(e.props->'result'->'thesis')='string' THEN e.props->'result'->>'thesis' END,CASE WHEN jsonb_typeof(e.props->'thesis')='string' THEN e.props->>'thesis' END) END AS approved_read,
 CASE WHEN e.event_type='read_shown' THEN encode(sha256(convert_to(coalesce(CASE WHEN jsonb_typeof(e.props->'result'->'thesis')='string' THEN e.props->'result'->>'thesis' END,CASE WHEN jsonb_typeof(e.props->'thesis')='string' THEN e.props->>'thesis' END),'UTF8')),'hex') END AS approved_read_hash,
 jsonb_build_object('answered',e.props->'answered','flow',e.props->'flow',
  'selection_reason',e.props->'selection_reason','regime',e.props->'regime',
  'quip_id',e.props->'quip_id','category',e.props->'category','displayed_at',e.props->'displayed_at',
  'duration_ms',e.props->'duration_ms','sequence',e.props->'sequence','phase',e.props->'phase') AS diagnostics
 FROM public.event_log e WHERE musicdna_admin_mcp.qa_allowed(e.session_id)
 AND e.event_type IN ('choice_made','choice_scored','pairing_shown','pairing_skipped','read_shown','session_completed','interview_flow_assigned','regime_recommended','critic_quip_displayed');
CREATE VIEW public.musicdna_mcp_qa_readings WITH(security_barrier=true) AS
 SELECT r.id,r.session_id,r.version,r.source,r.base_version,r.ledger_version,r.policy_version,r.engine_version,r.created_at,
 jsonb_build_object('synthesis',r.content->'synthesis','signature',r.content->'signature','voice_version',r.content->'voice_version',
  'narration_status',r.content->'narration_status','reveal',r.content->'reveal','archetype_v2',r.content->'archetype_v2') AS frozen_content
 FROM public.session_results r WHERE musicdna_admin_mcp.qa_allowed(r.session_id);
CREATE VIEW public.musicdna_mcp_qa_attempts WITH(security_barrier=true) AS
 SELECT a.id,a.session_id,a.stage,a.result_version,a.writer_version,a.reviewer_version,a.status,a.created_at,a.output_fingerprint,
 coalesce((SELECT jsonb_agg(jsonb_build_object('choice_id',ref->'choice_id','pairing_id',ref->'pairing_id','trait',ref->'trait','delta',ref->'delta')) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.evidence_context->'references')='array' THEN a.evidence_context->'references' ELSE '[]'::jsonb END)ref),'[]') AS evidence_references,
 CASE WHEN a.rejection_reason ~ '^[a-z][a-z0-9_]{0,79}$' THEN a.rejection_reason ELSE NULL END AS reason_code,
 coalesce((SELECT jsonb_agg(jsonb_build_object('phase',c->'phase','status',c->'status','latency_ms',c->'latency_ms',
 'model',c->'model','provider',c->'provider','input_tokens',c->'input_tokens','output_tokens',c->'output_tokens',
 'cost_usd',NULL,'cost_status','unavailable')) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.calls)='array' THEN a.calls ELSE '[]'::jsonb END)c),'[]') AS calls,
 (SELECT coalesce(jsonb_object_agg(key,value),'{}') FROM jsonb_each(CASE WHEN jsonb_typeof(a.review_checks)='object' THEN a.review_checks ELSE '{}'::jsonb END) WHERE jsonb_typeof(value) IN ('boolean','number')) AS numeric_review_checks
 -- Intentionally no output_text, evidence_context, raw decision_trace, prompts or self reports.
 FROM public.critic_quality_attempts a WHERE musicdna_admin_mcp.qa_allowed(a.session_id);
CREATE VIEW public.musicdna_mcp_qa_reviews WITH(security_barrier=true) AS
 SELECT r.id,a.session_id,r.attempt_id,r.rubric_version,r.evaluator_type,r.inference_accuracy,r.musical_specificity,
 r.prose_originality,r.conversational_relevance,r.entertainment,r.created_at,a.stage,a.status,a.writer_version,a.reviewer_version
 FROM public.critic_quality_reviews r JOIN public.critic_quality_attempts a ON a.id=r.attempt_id
 WHERE musicdna_admin_mcp.qa_allowed(a.session_id);
CREATE VIEW public.musicdna_mcp_qa_calls WITH(security_barrier=true) AS
 SELECT c.id,c.session_id,c.role,c.model,c.prompt_version,c.status,c.latency_ms,c.created_at
 FROM public.llm_calls c WHERE musicdna_admin_mcp.qa_allowed(c.session_id);
CREATE VIEW public.musicdna_mcp_learning_receipts WITH(security_barrier=true) AS
 SELECT o.observation_id AS id,e.session_id,o.result_id,o.environment,e.data_class,o.state,o.created_at,
 j.state AS dispatch_state,j.attempts,j.replay_count,j.completed_at,j.receipt_id
 -- No subject hashes, receiver identifiers, source credentials, leases, payloads or envelopes.
 FROM public.musicdna_learning_outbox o JOIN public.musicdna_learning_enrollments e ON e.result_id=o.result_id
 LEFT JOIN public.musicdna_learning_dispatch_jobs j ON j.work_id=o.observation_id AND j.kind='observation' AND j.source_key=o.source_key AND j.environment=o.environment
 WHERE musicdna_admin_mcp.qa_allowed(e.session_id);
DO $$DECLARE v text;BEGIN
 FOREACH v IN ARRAY ARRAY['musicdna_mcp_qa_sessions','musicdna_mcp_qa_choices','musicdna_mcp_qa_events','musicdna_mcp_qa_readings','musicdna_mcp_qa_attempts','musicdna_mcp_qa_reviews','musicdna_mcp_qa_calls','musicdna_mcp_learning_receipts'] LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',v);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v);
 END LOOP;
END $$;

-- Prospective owner-QA paint receipts. No prose, song titles or private messages.
CREATE TABLE public.musicdna_qa_quip_observations(
 id uuid PRIMARY KEY,session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,wait_id uuid NOT NULL,
 line_hash text NOT NULL CHECK(line_hash~'^[0-9a-f]{64}$'),pacing_version text NOT NULL,
 sequence integer NOT NULL CHECK(sequence BETWEEN 0 AND 1000),answered integer NOT NULL CHECK(answered BETWEEN 0 AND 6),
 phase text NOT NULL CHECK(phase IN ('post_pick_wait','final_writing')),
 shown_at timestamptz NOT NULL,duration_ms integer NOT NULL CHECK(duration_ms BETWEEN 0 AND 3600000),
 since_wait_ms integer NOT NULL CHECK(since_wait_ms BETWEEN 0 AND 3600000),
 ended_reason text NOT NULL CHECK(ended_reason IN ('changed_or_unmounted','document_hidden')),
 request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.musicdna_qa_quip_observations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.musicdna_qa_quip_observations TO authenticated;
GRANT ALL ON public.musicdna_qa_quip_observations TO service_role;
ALTER TABLE public.musicdna_qa_quip_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_quip_read ON public.musicdna_qa_quip_observations FOR SELECT TO authenticated USING(musicdna_admin_mcp.qa_allowed(session_id));
CREATE FUNCTION public.musicdna_mcp_quip_telemetry_allowed(p_session uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT musicdna_admin_mcp.can('qa_read') AND EXISTS(SELECT 1 FROM public.sessions s JOIN public.interview_qa_sessions q ON q.session_id=s.id WHERE s.id=p_session AND s.user_id=auth.uid() AND q.created_by=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_quip_telemetry_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_quip_telemetry_allowed(uuid) TO authenticated;
CREATE FUNCTION public.musicdna_mcp_record_quip(p_observation uuid,p_session uuid,p_wait uuid,p_line_hash text,p_pacing_version text,p_sequence integer,p_answered integer,p_phase text,p_shown_at timestamptz,p_duration_ms integer,p_since_wait_ms integer,p_ended_reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE prior public.musicdna_qa_quip_observations; req text;
BEGIN
 IF NOT public.musicdna_mcp_quip_telemetry_allowed(p_session) THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_observation IS NULL OR p_wait IS NULL OR p_line_hash IS NULL OR p_line_hash!~'^[0-9a-f]{64}$' OR p_pacing_version IS DISTINCT FROM 'six-pick-overtime-v1' OR p_sequence IS NULL OR p_sequence NOT BETWEEN 0 AND 1000 OR p_answered IS NULL OR p_answered NOT BETWEEN 0 AND 6 OR p_phase IS NULL OR p_phase NOT IN ('post_pick_wait','final_writing') OR p_shown_at IS NULL OR abs(extract(epoch FROM (now()-p_shown_at)))>86400 OR p_duration_ms IS NULL OR p_duration_ms NOT BETWEEN 0 AND 3600000 OR p_since_wait_ms IS NULL OR p_since_wait_ms NOT BETWEEN 0 AND 3600000 OR p_ended_reason IS NULL OR p_ended_reason NOT IN ('changed_or_unmounted','document_hidden') THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 req:=musicdna_admin_mcp.why_version(jsonb_build_array(p_session,p_wait,p_line_hash,p_pacing_version,p_sequence,p_answered,p_phase,p_shown_at,p_duration_ms,p_since_wait_ms,p_ended_reason));
 PERFORM pg_advisory_xact_lock(hashtextextended('quip-session:'||p_session::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_observation::text,0));
 SELECT * INTO prior FROM public.musicdna_qa_quip_observations WHERE id=p_observation;
 IF FOUND THEN
  IF prior.owner_id<>auth.uid() OR prior.request_hash<>req THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('recorded',true,'replayed',true);
 END IF;
 IF (SELECT count(*) FROM public.musicdna_qa_quip_observations WHERE session_id=p_session)>=1000 THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 INSERT INTO public.musicdna_qa_quip_observations(id,session_id,owner_id,wait_id,line_hash,pacing_version,sequence,answered,phase,shown_at,duration_ms,since_wait_ms,ended_reason,request_hash)
 VALUES(p_observation,p_session,auth.uid(),p_wait,p_line_hash,p_pacing_version,p_sequence,p_answered,p_phase,p_shown_at,p_duration_ms,p_since_wait_ms,p_ended_reason,req);
 INSERT INTO public.musicdna_catalog_audit_events(actor_id,action,object_id,mutation_id,request_hash) VALUES(auth.uid(),'qa_quip_observed',p_observation,p_observation,req);
 RETURN jsonb_build_object('recorded',true,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_record_quip(uuid,uuid,uuid,text,text,integer,integer,text,timestamptz,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_record_quip(uuid,uuid,uuid,text,text,integer,integer,text,timestamptz,integer,integer,text) TO authenticated;
CREATE VIEW public.musicdna_mcp_qa_quips WITH(security_barrier=true) AS
 SELECT id,session_id,wait_id,line_hash,pacing_version,sequence,answered,phase,shown_at,duration_ms,since_wait_ms,ended_reason,created_at
 FROM public.musicdna_qa_quip_observations WHERE musicdna_admin_mcp.qa_allowed(session_id);
REVOKE ALL ON public.musicdna_mcp_qa_quips FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.musicdna_mcp_qa_quips TO authenticated;

CREATE INDEX musicdna_qa_quip_session ON public.musicdna_qa_quip_observations(session_id,id);
