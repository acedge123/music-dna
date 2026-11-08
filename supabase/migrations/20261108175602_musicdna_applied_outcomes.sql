-- AB-29: optional attribution on existing records; no flags, assignments or exports seeded.
-- Requires AB-45/47. The application emitter remains default-off until this is reviewed/applied.
ALTER TABLE public.sessions ADD COLUMN routing_assignment jsonb;
ALTER TABLE public.choices ADD COLUMN routing_context jsonb;
ALTER TABLE public.session_results ADD COLUMN routing_context jsonb;

CREATE FUNCTION musicdna_learning_private.freeze_routing_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.routing_assignment IS NOT NULL AND
    ROW(NEW.routing_assignment,NEW.id,NEW.user_id) IS DISTINCT FROM ROW(OLD.routing_assignment,OLD.id,OLD.user_id) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='routing_assignment_immutable';
  END IF;
  IF NEW.routing_assignment IS NOT NULL AND (TG_OP='INSERT' OR OLD.routing_assignment IS NULL)
    AND current_user NOT IN ('service_role','postgres') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='routing_assignment_forbidden';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.freeze_routing_assignment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER sessions_routing_assignment BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.freeze_routing_assignment();

-- An operator freezes eligibility/design BEFORE the session's first recorded decision.
-- Session-scoped; intentionally ignores the old, listener-writable experiment_assignments table.
CREATE FUNCTION public.assign_musicdna_routing_experiment(p_session_id uuid,p_owner_id uuid,p_design jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE s public.sessions%ROWTYPE; a jsonb;
BEGIN
  IF jsonb_typeof(p_design) IS DISTINCT FROM 'object' OR
    NOT p_design ?& ARRAY['experiment_id','variant','policy_id','policy_version','strategy_version','routing_mode','eligibility_version','measurement_window_seconds','data_class'] OR
    p_design - ARRAY['experiment_id','variant','policy_id','policy_version','strategy_version','routing_mode','eligibility_version','measurement_window_seconds','data_class'] <> '{}'::jsonb OR
    EXISTS(SELECT 1 FROM unnest(ARRAY['experiment_id','policy_id','policy_version','strategy_version','eligibility_version']) k
      WHERE jsonb_typeof(p_design->k) IS DISTINCT FROM 'string' OR coalesce(p_design->>k,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$') OR
    coalesce(p_design->>'variant','') NOT IN ('control','treatment') OR
    coalesce(p_design->>'routing_mode','') NOT IN ('legacy','shadow','live') OR
    p_design->>'data_class' IS DISTINCT FROM 'synthetic' OR
    jsonb_typeof(p_design->'measurement_window_seconds') IS DISTINCT FROM 'number' OR
    coalesce(p_design->>'measurement_window_seconds','') !~ '^[0-9]{1,7}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_routing_design';
  END IF;
  IF (p_design->>'measurement_window_seconds')::integer NOT BETWEEN 60 AND 2592000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_measurement_window';
  END IF;
  SELECT * INTO s FROM public.sessions WHERE id=p_session_id AND user_id=p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='routing_session_unavailable'; END IF;
  IF s.routing_assignment IS NOT NULL THEN
    IF s.routing_assignment - ARRAY['assignment_id','assigned_at'] IS DISTINCT FROM p_design THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='routing_assignment_conflict';
    END IF;
    RETURN s.routing_assignment;
  END IF;
  IF s.completed_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.choices WHERE session_id=s.id)
    OR EXISTS(SELECT 1 FROM public.event_log WHERE session_id=s.id AND event_type='regime_recommended') THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='routing_assignment_too_late';
  END IF;
  a:=p_design||jsonb_build_object('assignment_id',gen_random_uuid(),'assigned_at',clock_timestamp());
  UPDATE public.sessions SET routing_assignment=a WHERE id=s.id;
  RETURN a;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_musicdna_routing_experiment(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_musicdna_routing_experiment(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION musicdna_learning_private.bind_routing_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE s public.sessions%ROWTYPE; n integer;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.props ? 'applied_routing' AND ROW(NEW.props,NEW.user_id,NEW.session_id,NEW.event_type,NEW.client,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.props,OLD.user_id,OLD.session_id,OLD.event_type,OLD.client,OLD.created_at) THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='routing_event_immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT NEW.props ? 'applied_routing' THEN RETURN NEW; END IF;
  IF current_user NOT IN ('service_role','postgres') OR NEW.event_type<>'regime_recommended' OR NEW.client<>'server' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='routing_event_forbidden';
  END IF;
  SELECT * INTO s FROM public.sessions WHERE id=NEW.session_id AND user_id=NEW.user_id FOR UPDATE;
  SELECT count(*) INTO n FROM public.choices WHERE session_id=NEW.session_id;
  IF s.id IS NULL OR s.routing_assignment IS NULL OR s.routing_assignment->>'data_class' IS DISTINCT FROM 'synthetic'
    OR NEW.props#>>'{applied_routing,schema_version}' IS DISTINCT FROM 'applied-routing.v1'
    OR NEW.props#>'{applied_routing,prior_vector}' IS DISTINCT FROM s.vector
    OR NEW.props#>'{applied_routing,answered_before}' IS DISTINCT FROM to_jsonb(n) THEN
    -- Unassigned sessions are outside this synthetic pilot. A raced request may
    -- still serve its pairing; never pretend its stale state was applied.
    NEW.props:=NEW.props-'applied_routing';
    RETURN NEW;
  END IF;
  NEW.props:=jsonb_set(NEW.props,'{applied_routing,assignment}',coalesce(s.routing_assignment,'null'::jsonb));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.bind_routing_event() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER event_log_routing_context BEFORE INSERT OR UPDATE ON public.event_log
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.bind_routing_event();
CREATE INDEX event_log_applied_routing_idx ON public.event_log(session_id,pairing_id)
  WHERE event_type='regime_recommended' AND props ? 'applied_routing';

CREATE FUNCTION musicdna_learning_private.freeze_choice_routing() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE s public.sessions%ROWTYPE; n integer; contexts integer; e record;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.routing_context IS DISTINCT FROM OLD.routing_context THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='choice_routing_immutable';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO s FROM public.sessions WHERE id=NEW.session_id FOR UPDATE;
  SELECT count(*) INTO n FROM public.choices WHERE session_id=NEW.session_id;
  -- Repeated identical serving is safe. Conflicting serving contexts are ambiguous;
  -- never take a convenient "latest" recommendation and attach it to a vote.
  SELECT count(DISTINCT props->'applied_routing') INTO contexts FROM public.event_log
    WHERE session_id=NEW.session_id AND user_id=s.user_id AND pairing_id=NEW.pairing_id
      AND event_type='regime_recommended' AND client='server'
      AND props#>'{applied_routing,prior_vector}'=s.vector
      AND props#>'{applied_routing,answered_before}'=to_jsonb(n);
  NEW.routing_context:=jsonb_build_object('state',CASE WHEN contexts=0 THEN 'missing' ELSE 'ambiguous' END);
  IF contexts=1 THEN
    SELECT id,props->'applied_routing' AS context INTO e FROM public.event_log
      WHERE session_id=NEW.session_id AND user_id=s.user_id AND pairing_id=NEW.pairing_id
        AND event_type='regime_recommended' AND client='server'
        AND props#>'{applied_routing,prior_vector}'=s.vector
        AND props#>'{applied_routing,answered_before}'=to_jsonb(n)
      ORDER BY created_at,id LIMIT 1;
    NEW.routing_context:=jsonb_build_object('state','recorded','event_id',e.id,'decision',e.context);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.freeze_choice_routing() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER choices_routing_context BEFORE INSERT OR UPDATE ON public.choices
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.freeze_choice_routing();

CREATE FUNCTION musicdna_learning_private.freeze_result_routing() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE contexts jsonb; a jsonb; v_policy jsonb; n integer; distinct_choices integer; matched integer; variants integer;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.routing_context IS NOT NULL AND ROW(NEW.routing_context,NEW.id,NEW.session_id,NEW.user_id,NEW.version,NEW.source,NEW.evidence,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.routing_context,OLD.id,OLD.session_id,OLD.user_id,OLD.version,OLD.source,OLD.evidence,OLD.created_at) THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='result_routing_immutable';
    END IF;
    RETURN NEW;
  END IF;
  SELECT routing_assignment INTO a FROM public.sessions WHERE id=NEW.session_id AND user_id=NEW.user_id;
  -- Preserve a known deadline even when routing evidence is incomplete.
  NEW.routing_context:=jsonb_build_object('state','unknown','reason','incomplete_choice_join',
    'assignment',a,'assignment_match',false,'window_start',NEW.created_at,
    'window_end',CASE WHEN a IS NOT NULL THEN NEW.created_at+make_interval(secs=>(a->>'measurement_window_seconds')::integer) ELSE NULL END);
  IF NEW.source<>'pairings' THEN
    NEW.routing_context:=NEW.routing_context||jsonb_build_object('state','unknown','reason','non_pairing_revision'); RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.evidence->'entries') IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
  SELECT count(*),count(DISTINCT entry->>'choice_id') INTO n,distinct_choices FROM jsonb_array_elements(NEW.evidence->'entries') entry;
  IF n<6 OR distinct_choices<>6 OR NEW.evidence->'answered' IS DISTINCT FROM '6'::jsonb THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.evidence->'entries') entry WHERE NOT EXISTS(
    SELECT 1 FROM public.choices c JOIN public.sessions s ON s.id=c.session_id
      WHERE c.id::text=entry->>'choice_id' AND c.pairing_id::text=entry->>'pairing_id'
        AND c.session_id=NEW.session_id AND s.user_id=NEW.user_id)) THEN RETURN NEW; END IF;
  SELECT jsonb_agg(c.routing_context||jsonb_build_object('choice_id',c.id,'pairing_id',c.pairing_id) ORDER BY c.created_at,c.id),count(*),count(DISTINCT jsonb_build_array(
    c.routing_context#>'{decision,policy_id}',c.routing_context#>'{decision,policy_version}',c.routing_context#>'{decision,strategy_version}',c.routing_context#>'{decision,assignment}'))
    INTO contexts,matched,variants FROM public.choices c JOIN public.sessions s ON s.id=c.session_id
    WHERE c.session_id=NEW.session_id AND s.user_id=NEW.user_id
      AND c.routing_context->>'state'='recorded'
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.evidence->'entries') entry
        WHERE entry->>'choice_id'=c.id::text AND entry->>'pairing_id'=c.pairing_id::text);
  IF matched<>6 OR variants<>1 THEN
    NEW.routing_context:=NEW.routing_context||jsonb_build_object('state','unknown','reason',
      CASE WHEN matched<>6 THEN 'missing_or_ambiguous_routing' ELSE 'mixed_policy_or_assignment' END);
    RETURN NEW;
  END IF;
  a:=contexts#>'{0,decision,assignment}';
  v_policy:=jsonb_build_object('id',contexts#>'{0,decision,policy_id}','version',contexts#>'{0,decision,policy_version}',
    'recommendation_event_id',NULL,'experiment_id',NULL,'variant',NULL);
  IF a IS NOT NULL AND a<>'null'::jsonb AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(contexts) c
    WHERE c#>'{decision,policy_id}' IS DISTINCT FROM a->'policy_id'
      OR c#>'{decision,policy_version}' IS DISTINCT FROM a->'policy_version'
      OR c#>'{decision,strategy_version}' IS DISTINCT FROM a->'strategy_version'
      OR c#>'{decision,routing_mode}' IS DISTINCT FROM a->'routing_mode'
      OR (a->>'routing_mode'='live' AND c#>'{decision,bootstrap}' IS DISTINCT FROM 'true'::jsonb
        AND c#>'{decision,router_knobs_used}' IS DISTINCT FROM 'true'::jsonb)) THEN
    v_policy:=v_policy||jsonb_build_object('experiment_id',a->'experiment_id','variant',a->'variant');
  END IF;
  NEW.routing_context:=jsonb_build_object('state','complete','choices',contexts,'policy',v_policy,
    'assignment',a,'assignment_match',v_policy->>'experiment_id' IS NOT NULL,
    'window_start',NEW.created_at,
    'window_end',CASE WHEN a IS NOT NULL AND a<>'null'::jsonb THEN NEW.created_at+make_interval(secs=>(a->>'measurement_window_seconds')::integer) ELSE NULL END);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.freeze_result_routing() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER session_results_routing_context BEFORE INSERT OR UPDATE ON public.session_results
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.freeze_result_routing();

-- Numeric/ID-only operator read. Missing feedback is an outcome state, never a fabricated event.
-- Each result version keeps its own deadline; late observations retain their real timestamps.
CREATE FUNCTION public.read_musicdna_routing_outcome(p_result_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('result_id',r.id,'result_version',r.version,'session_id',r.session_id,
    'routing',r.routing_context,'feedback',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'feedback_id',f.id,'observed_at',f.created_at,'accuracy',f.accuracy,'rating',f.rating,
      'timing',CASE WHEN r.routing_context->>'window_end' IS NULL THEN 'unknown'
        WHEN f.created_at<r.created_at THEN 'before_result'
        WHEN f.created_at<(r.routing_context->>'window_end')::timestamptz THEN 'on_time' ELSE 'late' END,
      'observation_id',o.observation_id,'capture_state',o.state,
      'dispatch_state',j.state,'receiver_receipt_id',j.receipt_id) ORDER BY f.created_at,f.id)
      FROM public.result_feedback f LEFT JOIN public.musicdna_learning_outbox o ON o.feedback_id=f.id
      LEFT JOIN public.musicdna_learning_dispatch_jobs j ON j.work_id=o.observation_id AND j.kind='observation'
        AND j.source_key=o.source_key AND j.environment=o.environment
      WHERE f.session_id=r.session_id AND f.user_id=r.user_id AND f.result_version=r.version
        AND (f.accuracy IS NOT NULL OR f.rating IS NOT NULL)),'[]'::jsonb),
    'window_state',CASE WHEN r.routing_context->>'window_end' IS NULL THEN 'unknown'
      WHEN statement_timestamp()<(r.routing_context->>'window_end')::timestamptz THEN 'open' ELSE 'closed' END,
    'outcome_state',CASE WHEN EXISTS(SELECT 1 FROM public.result_feedback f WHERE f.session_id=r.session_id
      AND f.user_id=r.user_id AND f.result_version=r.version AND (f.accuracy IS NOT NULL OR f.rating IS NOT NULL)) THEN 'observed'
      WHEN r.routing_context->>'window_end' IS NULL THEN 'unknown'
      WHEN statement_timestamp()<(r.routing_context->>'window_end')::timestamptz THEN 'awaiting_feedback' ELSE 'missing' END)
  FROM public.session_results r WHERE r.id=p_result_id;
$$;
REVOKE ALL ON FUNCTION public.read_musicdna_routing_outcome(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_musicdna_routing_outcome(uuid) TO service_role;

-- Keep fingerprints for pre-migration results unchanged. New snapshots are included.
CREATE OR REPLACE FUNCTION musicdna_learning_private.result_fingerprint(r public.session_results) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT encode(sha256(convert_to((jsonb_build_object('id',r.id,'session_id',r.session_id,'owner',r.user_id,
    'version',r.version,'source',r.source,'evidence',r.evidence,'ledger_version',r.ledger_version,
    'policy_version',r.policy_version,'engine_version',r.engine_version)
    || CASE WHEN r.routing_context IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('routing_context',r.routing_context) END)::text,'UTF8')),'hex');
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.result_fingerprint(public.session_results) FROM PUBLIC,anon,authenticated,service_role;


-- Preserve the existing transactional capture, lifecycle locks and privacy exclusions.
CREATE OR REPLACE FUNCTION musicdna_learning_private.capture_feedback() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE
  e public.musicdna_learning_enrollments%ROWTYPE;
  s public.musicdna_export_scopes%ROWTYPE;
  r public.session_results%ROWTYPE;
  v_id uuid:=gen_random_uuid();
  v_observed timestamptz:=date_trunc('milliseconds',NEW.created_at);
  v_reason text;
  v_catalog text;
  v_projection jsonb;
BEGIN
  SELECT enrollment.* INTO e FROM public.musicdna_learning_enrollments enrollment
    JOIN public.musicdna_export_scopes scope USING(source_key,environment)
    WHERE enrollment.session_id=NEW.session_id AND enrollment.owner_user_id=NEW.user_id
      AND enrollment.approved_by IS NOT NULL AND scope.capture_enabled
      AND enrollment.receiver_tenant_id=scope.receiver_tenant_id
      AND EXISTS(SELECT 1 FROM public.session_results sr WHERE sr.id=enrollment.result_id AND sr.version=NEW.result_version)
    FOR SHARE OF enrollment;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid()<>NEW.user_id THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='learning_owner_forbidden';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:'||e.source_key||':'||e.environment,0));
  SELECT * INTO s FROM public.musicdna_export_scopes WHERE source_key=e.source_key AND environment=e.environment FOR SHARE;
  IF NOT s.capture_enabled OR s.approved_by IS NULL OR s.expires_at<=clock_timestamp() OR s.receiver_tenant_id IS DISTINCT FROM e.receiver_tenant_id
    OR NOT public.musicdna_learning_export_allowed(e.source_key,e.environment,e.subject_ref,v_observed)
    OR NEW.created_at<e.enrolled_at THEN RETURN NULL; END IF;
  SELECT * INTO r FROM public.session_results WHERE id=e.result_id AND session_id=NEW.session_id AND user_id=NEW.user_id AND version=NEW.result_version;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=NEW.session_id AND user_id=NEW.user_id AND completed_at IS NOT NULL) THEN
    v_reason:='missing_provenance';
  ELSIF NEW.mutation_id IS NULL OR NEW.mutation_id='' OR r.ledger_version IS NULL OR r.evidence IS NULL
    OR r.evidence->>'version' IS NULL OR r.evidence->>'answered' IS NULL THEN
    v_reason:='missing_provenance';
  ELSIF musicdna_learning_private.result_fingerprint(r)<>e.result_fingerprint
    OR r.version<1 OR r.source NOT IN ('pairings','chat_self_report')
    OR r.ledger_version !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
    OR r.evidence->>'version' IS DISTINCT FROM r.ledger_version
    OR r.evidence->'answered' IS DISTINCT FROM '6'::jsonb
    OR r.evidence->'unavailable' IS DISTINCT FROM '0'::jsonb
    OR jsonb_typeof(r.evidence->'entries') IS DISTINCT FROM 'array' THEN
    v_reason:='invalid_provenance';
  ELSIF jsonb_array_length(r.evidence->'entries')=0 THEN
    v_reason:='missing_provenance';
  ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(r.evidence->'entries') entry
    WHERE jsonb_typeof(entry) IS DISTINCT FROM 'object' OR (entry->>'choice_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE)
    OR NEW.created_at>clock_timestamp()+interval '5 minutes' THEN
    v_reason:='invalid_provenance';
  ELSIF (NEW.accuracy IS NOT NULL AND NEW.accuracy NOT IN ('accurate','mixed','not_accurate'))
    OR (NEW.rating IS NOT NULL AND NEW.rating NOT IN (-1,0,1)) THEN
    v_reason:='invalid_provenance';
  ELSIF NEW.accuracy IS NULL AND NEW.rating IS NULL THEN
    v_reason:='empty_feedback';
  END IF;
  IF v_reason IS NULL THEN
    -- Historical catalog provenance comes only from the frozen result ledger.
    -- Unknown/mixed/missing revisions stay null; never substitute today's catalog.
    SELECT CASE WHEN count(DISTINCT entry->>'catalog_revision')=1
      AND bool_and(coalesce(entry->>'catalog_revision' ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$',false))
      THEN min(entry->>'catalog_revision') ELSE NULL END INTO v_catalog
      FROM jsonb_array_elements(r.evidence->'entries') entry;
    v_projection:=jsonb_build_object(
      'schema_version','learning-observation.v1','observation_id',v_id,
      'observed_at',to_char(v_observed AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'subject_ref',e.subject_ref,
      'decision',jsonb_build_object('ref',e.decision_ref,'result_ref',e.result_ref,'result_version',r.version,'result_source',r.source,'answered_count',6),
      'versions',jsonb_build_object('evidence',r.ledger_version,'catalog',v_catalog),
      -- Attribution comes from the exact saved result, not session_results.policy_version (claim policy).
      'policy',CASE WHEN r.routing_context->>'state'='complete' THEN r.routing_context->'policy'
        ELSE jsonb_build_object('id',NULL,'version',NULL,'recommendation_event_id',NULL,'experiment_id',NULL,'variant',NULL) END,
      'feedback',jsonb_build_object('ref',NULL,'accuracy',NEW.accuracy,'rating',NEW.rating),
      'privacy',jsonb_build_object('data_class','synthetic','purpose','musicdna_diagnostic_quality','consent_basis','authorized_synthetic_test','policy_version','synthetic-pilot.v1'));
  END IF;
  INSERT INTO public.musicdna_learning_outbox(observation_id,feedback_id,result_id,source_key,environment,receiver_tenant_id,subject_hash,observed_at,state,reason,projection)
    VALUES(v_id,NEW.id,e.result_id,e.source_key,e.environment,e.receiver_tenant_id,
      encode(sha256(convert_to(e.subject_ref,'UTF8')),'hex'),v_observed,
      CASE WHEN v_reason IS NULL THEN 'captured' ELSE 'excluded' END,v_reason,v_projection);
  -- Failure is deliberately not swallowed: an enrolled feedback operation and
  -- its recovery record must commit or roll back together. No external I/O here.
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.capture_feedback() FROM PUBLIC,anon,authenticated,service_role;
