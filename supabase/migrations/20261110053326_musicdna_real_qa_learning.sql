-- AB-57: explicitly consented real QA. No scopes, enrollments, keys or flags seeded.
ALTER TABLE public.musicdna_export_scopes DROP CONSTRAINT musicdna_export_scopes_policy_version_check;
ALTER TABLE public.musicdna_export_scopes ADD CONSTRAINT musicdna_export_scopes_policy_version_check
 CHECK(policy_version='synthetic-lifecycle.v1' OR (policy_version='real-qa-lifecycle.v1' AND source_key='music-dna' AND environment='production'));
ALTER TABLE public.musicdna_learning_enrollments ADD COLUMN data_class text NOT NULL DEFAULT 'synthetic'
 CHECK(data_class='synthetic' OR (data_class='consented_qa' AND source_key='music-dna' AND environment='production'));
CREATE TABLE public.musicdna_real_qa_consents (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 consent_ref uuid NOT NULL UNIQUE,
 approved_by uuid NOT NULL REFERENCES auth.users(id),
 consented_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 source_key text NOT NULL DEFAULT 'music-dna' CHECK(source_key='music-dna'),
 environment text NOT NULL DEFAULT 'production' CHECK(environment='production'),
 receiver_tenant_id text NOT NULL,
 subject_ref text NOT NULL UNIQUE CHECK(subject_ref ~ '^s_[0-9a-f]{64}$'),
 policy_version text NOT NULL DEFAULT 'real-qa.v1' CHECK(policy_version='real-qa.v1'),
 CHECK(expires_at>consented_at AND expires_at-consented_at<=interval '31 days'),
 FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes
);
REVOKE ALL ON public.musicdna_real_qa_consents FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,DELETE ON public.musicdna_real_qa_consents TO service_role;
ALTER TABLE public.musicdna_real_qa_consents ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.musicdna_real_qa_consents IS 'Private explicit tester consent; future results only. No signup, role, sharing or user_metadata inference.';
-- A boolean-only private helper checks the managed auth schema without granting its records to service_role.
GRANT USAGE ON SCHEMA musicdna_learning_private TO service_role;
CREATE FUNCTION musicdna_learning_private.verified_real_qa_user(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false));
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.verified_real_qa_user(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION musicdna_learning_private.verified_real_qa_user(uuid) TO service_role;
CREATE FUNCTION public.enroll_musicdna_real_qa(p_user uuid,p_consent uuid,p_approved_by uuid,p_subject_ref text,p_consented_at timestamptz,p_expires_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.musicdna_export_scopes;
BEGIN
 SELECT * INTO s FROM public.musicdna_export_scopes WHERE source_key='music-dna' AND environment='production';
 IF p_user IS NULL OR p_consent IS NULL OR p_approved_by IS NULL OR s.policy_version IS DISTINCT FROM 'real-qa-lifecycle.v1'
  OR s.approved_by IS DISTINCT FROM p_approved_by OR s.receiver_tenant_id IS NULL OR p_consented_at IS NULL OR p_expires_at IS NULL
  OR p_consented_at>statement_timestamp() OR p_consented_at<s.observed_from OR p_expires_at>s.expires_at OR p_expires_at<=statement_timestamp()
  OR NOT musicdna_learning_private.verified_real_qa_user(p_user)
  OR EXISTS(SELECT 1 FROM public.musicdna_export_withdrawals WHERE source_key='music-dna' AND environment='production'
   AND subject_hash=encode(sha256(convert_to(p_subject_ref,'UTF8')),'hex')) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='real_qa_consent_forbidden';
 END IF;
 INSERT INTO public.musicdna_real_qa_consents(user_id,consent_ref,approved_by,consented_at,expires_at,receiver_tenant_id,subject_ref)
 VALUES(p_user,p_consent,p_approved_by,p_consented_at,p_expires_at,s.receiver_tenant_id,p_subject_ref);
END $$;
REVOKE ALL ON FUNCTION public.enroll_musicdna_real_qa(uuid,uuid,uuid,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_musicdna_real_qa(uuid,uuid,uuid,text,timestamptz,timestamptz) TO service_role;

-- Private trigger derives ownership from the saved row, never from client claims.
-- Fresh purpose-scoped opaque decision/result tokens are stored once, not user hashes.
CREATE FUNCTION musicdna_learning_private.enroll_real_qa_result() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE c public.musicdna_real_qa_consents;s public.musicdna_export_scopes;
BEGIN
 SELECT * INTO c FROM public.musicdna_real_qa_consents WHERE user_id=NEW.user_id FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF auth.uid() IS NOT NULL AND auth.uid()<>NEW.user_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='learning_owner_forbidden';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:music-dna:production',0));
 SELECT * INTO s FROM public.musicdna_export_scopes WHERE source_key='music-dna' AND environment='production' FOR SHARE;
 IF NOT s.capture_enabled OR s.policy_version<>'real-qa-lifecycle.v1' OR s.approved_by IS NULL OR c.expires_at<=clock_timestamp()
  OR c.receiver_tenant_id IS DISTINCT FROM s.receiver_tenant_id OR NEW.created_at<c.consented_at
  OR NOT public.musicdna_learning_export_allowed('music-dna','production',c.subject_ref,NEW.created_at)
  OR NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=NEW.session_id AND user_id=NEW.user_id AND created_at>=c.consented_at AND completed_at IS NOT NULL)
 THEN RETURN NULL;END IF;
 INSERT INTO public.musicdna_learning_enrollments(result_id,session_id,owner_user_id,source_key,environment,receiver_tenant_id,subject_ref,decision_ref,result_ref,result_fingerprint,approved_by,data_class)
 VALUES(NEW.id,NEW.session_id,NEW.user_id,'music-dna','production',c.receiver_tenant_id,c.subject_ref,
 'd_'||encode(sha256(convert_to('real-qa:decision:'||gen_random_uuid()::text,'UTF8')),'hex'),
 'r_'||encode(sha256(convert_to('real-qa:result:'||gen_random_uuid()::text,'UTF8')),'hex'),
 musicdna_learning_private.result_fingerprint(NEW),c.approved_by,'consented_qa');
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION musicdna_learning_private.enroll_real_qa_result() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER session_results_real_qa AFTER INSERT ON public.session_results FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.enroll_real_qa_result();
CREATE FUNCTION musicdna_learning_private.withdraw_real_qa_consent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.request_musicdna_learning_withdrawal(OLD.source_key,OLD.environment,OLD.subject_ref,gen_random_uuid(),'withdrawal');RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION musicdna_learning_private.withdraw_real_qa_consent() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER real_qa_consent_removed BEFORE DELETE ON public.musicdna_real_qa_consents FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.withdraw_real_qa_consent();

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
  IF e.data_class='consented_qa' AND (s.policy_version<>'real-qa-lifecycle.v1' OR NOT EXISTS(SELECT 1 FROM public.musicdna_real_qa_consents c WHERE c.user_id=NEW.user_id AND c.subject_ref=e.subject_ref AND c.receiver_tenant_id=e.receiver_tenant_id AND c.expires_at>clock_timestamp())) THEN RETURN NULL;END IF;
  IF v_reason IS NULL THEN
    -- Historical catalog provenance comes only from the frozen result ledger.
    -- Unknown/mixed/missing revisions stay null; never substitute today's catalog.
    SELECT CASE WHEN count(DISTINCT entry->>'catalog_revision')=1
      AND bool_and(coalesce(entry->>'catalog_revision' ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$',false))
      THEN min(entry->>'catalog_revision') ELSE NULL END INTO v_catalog
      FROM jsonb_array_elements(r.evidence->'entries') entry;
    v_projection:=jsonb_build_object(
      'schema_version',CASE WHEN e.data_class='consented_qa' THEN 'learning-observation.v2' ELSE 'learning-observation.v1' END,'observation_id',v_id,
      'observed_at',to_char(v_observed AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'subject_ref',e.subject_ref,
      'decision',jsonb_build_object('ref',e.decision_ref,'result_ref',e.result_ref,'result_version',r.version,'result_source',r.source,'answered_count',6),
      'versions',jsonb_build_object('evidence',r.ledger_version,'catalog',v_catalog),
      -- Attribution comes from the exact saved result, not session_results.policy_version (claim policy).
      'policy',CASE WHEN r.routing_context->>'state'='complete' THEN r.routing_context->'policy'
        ELSE jsonb_build_object('id',NULL,'version',NULL,'recommendation_event_id',NULL,'experiment_id',NULL,'variant',NULL) END,
      'feedback',jsonb_build_object('ref',NULL,'accuracy',NEW.accuracy,'rating',NEW.rating),
      'privacy',CASE WHEN e.data_class='consented_qa' THEN jsonb_build_object('data_class','consented_qa','purpose','musicdna_diagnostic_quality','consent_basis','explicit_tester_opt_in','policy_version','real-qa.v1') ELSE jsonb_build_object('data_class','synthetic','purpose','musicdna_diagnostic_quality','consent_basis','authorized_synthetic_test','policy_version','synthetic-pilot.v1') END);
  END IF;
  IF e.data_class='consented_qa' AND v_reason='empty_feedback' THEN RETURN NULL;END IF;
  INSERT INTO public.musicdna_learning_outbox(observation_id,feedback_id,result_id,source_key,environment,receiver_tenant_id,subject_hash,observed_at,state,reason,projection)
    VALUES(v_id,NEW.id,e.result_id,e.source_key,e.environment,e.receiver_tenant_id,
      encode(sha256(convert_to(e.subject_ref,'UTF8')),'hex'),v_observed,
      CASE WHEN v_reason IS NULL THEN 'captured' ELSE 'excluded' END,v_reason,v_projection);
  -- Failure is deliberately not swallowed: an enrolled feedback operation and
  -- its recovery record must commit or roll back together. No external I/O here.
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.materialize_musicdna_learning_observation(p_observation_id uuid,p_canonical_envelope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE o public.musicdna_learning_outbox%ROWTYPE; s public.musicdna_export_scopes%ROWTYPE; v_envelope jsonb; v_observation jsonb; v_expected jsonb;
BEGIN
  SELECT * INTO o FROM public.musicdna_learning_outbox WHERE observation_id=p_observation_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='observation_unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:'||o.source_key||':'||o.environment,0));
  SELECT * INTO s FROM public.musicdna_export_scopes WHERE source_key=o.source_key AND environment=o.environment;
  SELECT * INTO o FROM public.musicdna_learning_outbox WHERE observation_id=p_observation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='observation_unavailable'; END IF;
  IF o.state IN ('excluded','cancelled') THEN RETURN jsonb_build_object('observation_id',o.observation_id,'state',o.state,'reason',o.reason); END IF;
  IF NOT s.capture_enabled OR s.approved_by IS NULL OR s.receiver_tenant_id IS DISTINCT FROM o.receiver_tenant_id
    OR NOT EXISTS(SELECT 1 FROM public.musicdna_learning_enrollments e WHERE e.result_id=o.result_id AND e.approved_by IS NOT NULL)
    OR s.expires_at<=clock_timestamp() OR o.observed_at<s.observed_from OR o.observed_at>=s.expires_at
    OR EXISTS(SELECT 1 FROM public.musicdna_export_withdrawals w WHERE w.source_key=o.source_key AND w.environment=o.environment AND w.subject_hash=o.subject_hash) THEN
    UPDATE public.musicdna_learning_outbox SET state='cancelled',reason='scope_closed',projection=NULL,canonical_envelope=NULL,payload_fingerprint=NULL WHERE observation_id=o.observation_id;
    RETURN jsonb_build_object('observation_id',o.observation_id,'state','cancelled','reason','scope_closed');
  END IF;
  IF p_canonical_envelope IS NULL OR octet_length(p_canonical_envelope)>8192 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_learning_envelope'; END IF;
  IF o.state='pending' THEN
    IF o.canonical_envelope<>p_canonical_envelope THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='observation_conflict'; END IF;
    RETURN jsonb_build_object('observation_id',o.observation_id,'state','pending','duplicate',true);
  END IF;
  -- The server applies the portable validator/canonical JSON algorithm first.
  -- Exact projection equality independently rejects field/purpose/version changes.
  v_envelope:=p_canonical_envelope::jsonb; v_observation:=v_envelope#>'{metadata,observation}';
  IF (v_observation#>>'{feedback,ref}' ~ '^f_[0-9a-f]{64}$') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_learning_envelope';
  END IF;
  v_expected:=jsonb_build_object('type','workflow','source',o.source_key,'environment',o.environment,'severity','low',
    'summary','Music DNA learning observation','correlation_id','music-dna:learning:'||CASE WHEN o.projection->>'schema_version'='learning-observation.v2' THEN 'v2:' ELSE 'v1:' END||o.observation_id::text,
    'metadata',jsonb_build_object('purpose','learning_observation','observation',
      jsonb_set(o.projection,'{feedback,ref}',v_observation#>'{feedback,ref}')));
  IF v_envelope IS DISTINCT FROM v_expected THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_learning_envelope'; END IF;
  UPDATE public.musicdna_learning_outbox SET state='pending',projection=NULL,canonical_envelope=p_canonical_envelope,
    payload_fingerprint=encode(sha256(convert_to(p_canonical_envelope,'UTF8')),'hex') WHERE observation_id=o.observation_id;
  RETURN jsonb_build_object('observation_id',o.observation_id,'state','pending','duplicate',false);
END;
$$;

CREATE OR REPLACE FUNCTION musicdna_learning_private.prevent_pilot_export() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.projection#>>'{privacy,data_class}'='consented_qa' AND NEW.projection->>'schema_version'='learning-observation.v2' THEN RETURN NEW;END IF;
 IF EXISTS(SELECT 1 FROM public.session_results r JOIN public.sessions s ON s.id=r.session_id WHERE r.id=NEW.result_id
  AND (s.routing_assignment->>'data_class'='consented_pilot' OR r.routing_context#>>'{assignment,data_class}'='consented_pilot')) THEN RETURN NULL; END IF;
 RETURN NEW;
END;
$$;
