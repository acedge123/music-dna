-- AB-52: reuse existing assignments for an invited, consented, LOCAL-only pilot.
-- No enrollment, feature flag, key, policy promotion or migration execution is seeded.
ALTER TABLE public.experiment_assignments ADD COLUMN pilot jsonb;

CREATE FUNCTION musicdna_learning_private.protect_pilot_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.pilot IS NOT NULL OR NEW.experiment_key LIKE 'ab52.%' OR (TG_OP='UPDATE' AND OLD.pilot IS NOT NULL) THEN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='pilot_assignment_forbidden'; END IF;
  IF TG_OP='UPDATE' AND OLD.pilot IS NOT NULL THEN
   IF ROW(NEW.id,NEW.user_id,NEW.experiment_key,NEW.variant,NEW.assigned_at,NEW.pilot-ARRAY['bound_session_id','withdrawn_at']) IS DISTINCT FROM
      ROW(OLD.id,OLD.user_id,OLD.experiment_key,OLD.variant,OLD.assigned_at,OLD.pilot-ARRAY['bound_session_id','withdrawn_at'])
     OR (OLD.pilot->>'bound_session_id' IS NOT NULL AND NEW.pilot->'bound_session_id' IS DISTINCT FROM OLD.pilot->'bound_session_id')
     OR (OLD.pilot->>'withdrawn_at' IS NOT NULL AND NEW.pilot->'withdrawn_at' IS DISTINCT FROM OLD.pilot->'withdrawn_at') THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='pilot_assignment_immutable';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.protect_pilot_assignment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER experiment_assignments_pilot BEFORE INSERT OR UPDATE ON public.experiment_assignments
 FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.protect_pilot_assignment();
DROP POLICY "users read their own assignments" ON public.experiment_assignments;
CREATE POLICY "users read their own assignments" ON public.experiment_assignments FOR SELECT TO authenticated
 USING(user_id=auth.uid() AND pilot IS NULL AND experiment_key NOT LIKE 'ab52.%');

-- Operator must first obtain explicit adult volunteer consent using the versioned invitation.
-- p_consent_ref is a private receipt reference, never an email, transcript or inferred consent.
CREATE FUNCTION public.enroll_musicdna_pilot_participant(p_owner_id uuid,p_design jsonb,p_consent_ref uuid,p_consented_at timestamptz,p_approval_ref uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE e public.experiment_assignments%ROWTYPE; arm text; n integer;
BEGIN
 IF jsonb_typeof(p_design) IS DISTINCT FROM 'object' OR NOT p_design ?& ARRAY['experiment_id','policy_id','policy_version','strategy_version','eligibility_version','measurement_window_seconds','enrollment_closes_at','max_participants','metric_version','allocation']
  OR p_design-ARRAY['experiment_id','policy_id','policy_version','strategy_version','eligibility_version','measurement_window_seconds','enrollment_closes_at','max_participants','metric_version','allocation']<>'{}'::jsonb
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['experiment_id','policy_id','policy_version','strategy_version','eligibility_version','metric_version']) k WHERE jsonb_typeof(p_design->k) IS DISTINCT FROM 'string' OR coalesce(p_design->>k,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$')
  OR coalesce(p_design->>'experiment_id','') NOT LIKE 'ab52.%' OR p_design->>'policy_id' IS DISTINCT FROM 'musicdna-selector'
  OR p_design->>'policy_version' IS DISTINCT FROM p_design->>'strategy_version'
  OR coalesce(p_design->>'policy_version','') !~ '^sha256:[0-9a-f]{64}$'
  OR p_design->>'eligibility_version' IS DISTINCT FROM 'invited-adult-testflight.v1'
  OR p_design->>'metric_version' IS DISTINCT FROM 'first-result-perceived-accuracy.v1'
  OR coalesce(p_design->>'allocation','') NOT IN ('random_50_50','owner_qa_control','owner_qa_treatment')
  OR jsonb_typeof(p_design->'measurement_window_seconds') IS DISTINCT FROM 'number'
  OR coalesce(p_design->>'measurement_window_seconds','') !~ '^[0-9]{1,6}$'
  OR jsonb_typeof(p_design->'max_participants') IS DISTINCT FROM 'number' OR coalesce(p_design->>'max_participants','') !~ '^[0-9]{1,2}$'
  OR jsonb_typeof(p_design->'enrollment_closes_at') IS DISTINCT FROM 'string'
  OR p_owner_id IS NULL OR p_consent_ref IS NULL OR p_approval_ref IS NULL OR p_consented_at IS NULL OR p_consented_at>clock_timestamp()
  OR p_consented_at<clock_timestamp()-interval '31 days' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_pilot_design'; END IF;
 IF (p_design->>'measurement_window_seconds')::integer NOT BETWEEN 3600 AND 604800
  OR (p_design->>'max_participants')::integer NOT BETWEEN 2 AND 60
  OR (p_design->>'enrollment_closes_at')::timestamptz<=clock_timestamp()
  OR (p_design->>'enrollment_closes_at')::timestamptz>clock_timestamp()+interval '14 days' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_pilot_window'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-pilot:'||(p_design->>'experiment_id'),52));
 SELECT * INTO e FROM public.experiment_assignments WHERE user_id=p_owner_id AND experiment_key=p_design->>'experiment_id' FOR UPDATE;
 IF FOUND THEN
  IF e.pilot->'design' IS DISTINCT FROM p_design OR e.pilot->>'consent_ref' IS DISTINCT FROM p_consent_ref::text
   OR (e.pilot->>'consented_at')::timestamptz IS DISTINCT FROM p_consented_at OR e.pilot->>'approval_ref' IS DISTINCT FROM p_approval_ref::text THEN
   RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='pilot_enrollment_conflict'; END IF;
  RETURN jsonb_build_object('enrollment_id',e.id,'variant',e.variant,'duplicate',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.experiment_assignments WHERE experiment_key=p_design->>'experiment_id'
   AND (pilot->'design' IS DISTINCT FROM p_design OR pilot->>'approval_ref' IS DISTINCT FROM p_approval_ref::text)) THEN
  RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='pilot_design_frozen'; END IF;
 IF EXISTS(SELECT 1 FROM public.experiment_assignments WHERE user_id=p_owner_id AND pilot IS NOT NULL AND pilot->>'withdrawn_at' IS NULL
   AND (pilot#>>'{design,enrollment_closes_at}')::timestamptz+interval '7 days'>clock_timestamp()) THEN
  RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='pilot_participant_already_enrolled'; END IF;
 SELECT count(*) INTO n FROM public.experiment_assignments WHERE experiment_key=p_design->>'experiment_id';
 IF n>=(p_design->>'max_participants')::integer THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='pilot_cohort_full'; END IF;
 -- Independent cryptographically random 50/50 allocation, persisted once per participant.
 arm:=CASE WHEN p_design->>'allocation'='owner_qa_control' THEN 'control' WHEN p_design->>'allocation'='owner_qa_treatment' THEN 'treatment' WHEN get_byte(decode(substr(replace(gen_random_uuid()::text,'-',''),1,2),'hex'),0)%2=0 THEN 'control' ELSE 'treatment' END;
 INSERT INTO public.experiment_assignments(user_id,experiment_key,variant,pilot) VALUES(p_owner_id,p_design->>'experiment_id',arm,
  jsonb_build_object('schema_version','musicdna-pilot.v1','data_class','consented_pilot','design',p_design,
   'consent_ref',p_consent_ref,'consent_version','ab52-invitation.v1','consented_at',p_consented_at,'approval_ref',p_approval_ref,
   'bound_session_id',NULL,'withdrawn_at',NULL)) RETURNING * INTO e;
 RETURN jsonb_build_object('enrollment_id',e.id,'variant',e.variant,'duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.enroll_musicdna_pilot_participant(uuid,jsonb,uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_musicdna_pilot_participant(uuid,jsonb,uuid,timestamptz,uuid) TO service_role;

CREATE FUNCTION public.prepare_musicdna_pilot_session(p_session_id uuid,p_owner_id uuid,p_policy_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE e public.experiment_assignments%ROWTYPE; s public.sessions%ROWTYPE; d jsonb; a jsonb;
BEGIN
 SELECT * INTO e FROM public.experiment_assignments WHERE user_id=p_owner_id AND pilot IS NOT NULL
  AND pilot->>'withdrawn_at' IS NULL AND pilot#>>'{design,policy_version}'=p_policy_version
  AND (pilot#>>'{design,enrollment_closes_at}')::timestamptz>clock_timestamp()
  ORDER BY assigned_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO s FROM public.sessions WHERE id=p_session_id AND user_id=p_owner_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='pilot_session_unavailable'; END IF;
 d:=e.pilot->'design';
 IF e.pilot->>'bound_session_id' IS NOT NULL AND e.pilot->>'bound_session_id'<>s.id::text THEN RETURN NULL; END IF;
 IF s.routing_assignment IS NOT NULL THEN
  IF s.routing_assignment->>'experiment_id'=e.experiment_key AND s.routing_assignment->>'assignment_id'=e.id::text
   AND s.routing_assignment->>'policy_version'=p_policy_version THEN RETURN s.routing_assignment; END IF;
  RETURN NULL;
 END IF;
 IF s.completed_at IS NOT NULL OR s.created_at<e.assigned_at OR clock_timestamp()>=(d->>'enrollment_closes_at')::timestamptz
  OR EXISTS(SELECT 1 FROM public.choices WHERE session_id=s.id)
  OR EXISTS(SELECT 1 FROM public.event_log WHERE session_id=s.id AND event_type='regime_recommended') THEN RETURN NULL; END IF;
 a:=jsonb_build_object('assignment_id',e.id,'assigned_at',e.assigned_at,'experiment_id',e.experiment_key,'variant',e.variant,
  'policy_id',d->'policy_id','policy_version',d->'policy_version','strategy_version',d->'strategy_version',
  'routing_mode',CASE WHEN e.variant='treatment' THEN 'live' ELSE 'shadow' END,
  'eligibility_version',d->'eligibility_version','measurement_window_seconds',d->'measurement_window_seconds',
  'data_class','consented_pilot','consent_ref',e.pilot->'consent_ref','consent_version',e.pilot->'consent_version');
 UPDATE public.experiment_assignments SET pilot=jsonb_set(pilot,'{bound_session_id}',to_jsonb(s.id)) WHERE id=e.id;
 UPDATE public.sessions SET routing_assignment=a WHERE id=s.id;
 RETURN a;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_musicdna_pilot_session(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_musicdna_pilot_session(uuid,uuid,text) TO service_role;

CREATE FUNCTION musicdna_learning_private.protect_pilot_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.event_type='ab52_pilot_withdrawn' OR (TG_OP='UPDATE' AND OLD.event_type='ab52_pilot_withdrawn') THEN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='pilot_event_forbidden'; END IF;
  IF TG_OP='UPDATE' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='pilot_event_immutable'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.protect_pilot_event() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER event_log_pilot BEFORE INSERT OR UPDATE ON public.event_log FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.protect_pilot_event();

CREATE FUNCTION public.withdraw_musicdna_pilot_participant(p_owner_id uuid,p_experiment_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE e public.experiment_assignments%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.experiment_assignments WHERE user_id=p_owner_id AND experiment_key=p_experiment_id AND pilot IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('withdrawn',false); END IF;
 IF e.pilot->>'withdrawn_at' IS NULL THEN
  UPDATE public.experiment_assignments SET pilot=jsonb_set(pilot,'{withdrawn_at}',to_jsonb(clock_timestamp())) WHERE id=e.id;
  INSERT INTO public.event_log(user_id,event_type,client,props) VALUES(p_owner_id,'ab52_pilot_withdrawn','server',jsonb_build_object('experiment_id',p_experiment_id));
 END IF;
 RETURN jsonb_build_object('withdrawn',true);
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_musicdna_pilot_participant(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_musicdna_pilot_participant(uuid,text) TO service_role;

CREATE FUNCTION musicdna_learning_private.stop_withdrawn_choice_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sessions s JOIN public.event_log e ON e.user_id=s.user_id
  WHERE s.id=NEW.session_id AND s.routing_assignment->>'data_class'='consented_pilot' AND e.event_type='ab52_pilot_withdrawn'
  AND e.props->>'experiment_id'=s.routing_assignment->>'experiment_id') THEN NEW.routing_context:=jsonb_build_object('state','withdrawn'); END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.stop_withdrawn_choice_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER choices_z_pilot_consent BEFORE INSERT ON public.choices FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.stop_withdrawn_choice_capture();

-- The existing wire contract is synthetic-only. A human pilot can NEVER enter it.
CREATE FUNCTION musicdna_learning_private.prevent_pilot_export() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.session_results r JOIN public.sessions s ON s.id=r.session_id WHERE r.id=NEW.result_id
  AND (s.routing_assignment->>'data_class'='consented_pilot' OR r.routing_context#>>'{assignment,data_class}'='consented_pilot')) THEN RETURN NULL; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.prevent_pilot_export() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER musicdna_learning_outbox_pilot BEFORE INSERT ON public.musicdna_learning_outbox FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.prevent_pilot_export();

-- Extend only the local serving snapshot; synthetic capture semantics are unchanged.
CREATE OR REPLACE FUNCTION musicdna_learning_private.bind_routing_event() RETURNS trigger
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
  IF s.id IS NULL OR s.routing_assignment IS NULL OR (s.routing_assignment->>'data_class' IS DISTINCT FROM 'synthetic' AND NOT EXISTS(
      SELECT 1 FROM public.experiment_assignments e WHERE e.user_id=s.user_id AND e.id::text=s.routing_assignment->>'assignment_id'
        AND e.experiment_key=s.routing_assignment->>'experiment_id' AND e.pilot->>'data_class'='consented_pilot'
        AND e.pilot->>'withdrawn_at' IS NULL AND e.pilot->>'bound_session_id'=s.id::text
        AND (e.pilot#>>'{design,enrollment_closes_at}')::timestamptz>clock_timestamp()))
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

-- Operator-only, local analysis projection. No names, accounts, comments, songs or transcripts.
-- Run inside the explicit READ ONLY/10s diagnostic template supplied with the report command.
CREATE FUNCTION public.read_musicdna_pilot_cohort(p_experiment_id text,p_as_of timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE output jsonb;
BEGIN
 IF p_as_of IS NULL OR p_as_of>statement_timestamp() OR p_experiment_id NOT LIKE 'ab52.%' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_pilot_read'; END IF;
 SELECT jsonb_build_object('schema_version','musicdna-pilot-cohort.v1','data_class','consented_pilot',
  'experiment_id',p_experiment_id,'as_of',to_char(date_trunc('milliseconds',p_as_of) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'design',(SELECT pilot->'design' FROM public.experiment_assignments WHERE experiment_key=p_experiment_id AND pilot IS NOT NULL LIMIT 1),
  'participants',coalesce(jsonb_agg(jsonb_build_object(
    'participant_ref','p_'||encode(sha256(convert_to(e.id::text||':'||p_experiment_id,'UTF8')),'hex'),
    'variant',e.variant,'enrolled_at',e.assigned_at,'withdrawn',e.pilot->>'withdrawn_at' IS NOT NULL,
    'session_id',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN s.id ELSE NULL END,
    'session_started_at',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN s.created_at ELSE NULL END,
    'answered',CASE WHEN e.pilot->>'withdrawn_at' IS NULL AND s.id IS NOT NULL THEN (SELECT count(DISTINCT pairing_id) FROM public.choices WHERE session_id=s.id AND created_at<=p_as_of) ELSE NULL END,
    'skips',CASE WHEN e.pilot->>'withdrawn_at' IS NULL AND s.id IS NOT NULL THEN (SELECT count(*) FROM public.event_log WHERE session_id=s.id AND event_type='pairing_skipped' AND created_at<=p_as_of) ELSE NULL END,
    'result_id',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN r.id ELSE NULL END,
    'result_version',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN r.version ELSE NULL END,
    'result_created_at',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN r.created_at ELSE NULL END,
    'assignment_match',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN r.routing_context->'assignment_match' ELSE NULL END,
    'policy_version',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN r.routing_context#>'{policy,version}' ELSE NULL END,
    'window_end',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN r.routing_context->'window_end' ELSE NULL END,
    'feedback',CASE WHEN e.pilot->>'withdrawn_at' IS NULL THEN coalesce((SELECT jsonb_agg(jsonb_build_object('feedback_id',f.id,'result_id',r.id,'result_version',f.result_version,'observed_at',f.created_at,'accuracy',f.accuracy) ORDER BY f.created_at,f.id)
      FROM public.result_feedback f WHERE f.session_id=s.id AND f.user_id=e.user_id AND f.result_version=1 AND f.created_at<=p_as_of),'[]'::jsonb) ELSE '[]'::jsonb END,
    'latency_ms',NULL,'application_errors',NULL,'cost_micro',NULL
  ) ORDER BY e.assigned_at,e.id),'[]'::jsonb)) INTO output
 FROM public.experiment_assignments e
 LEFT JOIN public.sessions s ON s.id::text=e.pilot->>'bound_session_id' AND s.user_id=e.user_id AND s.created_at<=p_as_of
 LEFT JOIN public.session_results r ON r.session_id=s.id AND r.user_id=e.user_id AND r.version=1 AND r.source='pairings' AND r.created_at<=p_as_of
 WHERE e.experiment_key=p_experiment_id AND e.pilot IS NOT NULL AND e.assigned_at<=p_as_of;
 RETURN output;
END;
$$;
REVOKE ALL ON FUNCTION public.read_musicdna_pilot_cohort(text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_musicdna_pilot_cohort(text,timestamptz) TO service_role;
