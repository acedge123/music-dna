-- AB-45: synthetic-only transaction capture and recoverable materialization.
-- Default off. No scope, enrollment, key, schedule or flag activation is seeded.
DO $$ BEGIN
  IF to_regprocedure('public.save_result_feedback(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'AB-45 requires the reviewed V2 feedback persistence boundary';
  END IF;
END $$;
ALTER TABLE public.musicdna_export_scopes
  ADD COLUMN capture_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN receiver_tenant_id text CHECK(receiver_tenant_id IS NULL OR receiver_tenant_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$');

-- Preserve AB-49's source/subject checks while making its public precondition
-- honor the new default-off producer gate too; a worker must not omit this flag.
CREATE OR REPLACE FUNCTION public.musicdna_learning_export_allowed(p_source text,p_environment text,p_subject_ref text,p_observed_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(p_subject_ref ~ '^s_[0-9a-f]{64}$',false) AND EXISTS(
    SELECT 1 FROM public.musicdna_export_scopes s
    WHERE s.source_key=p_source AND s.environment=p_environment AND s.approved_by IS NOT NULL
      AND s.capture_enabled AND s.receiver_tenant_id IS NOT NULL
      AND statement_timestamp()<s.expires_at AND p_observed_at>=s.observed_from AND p_observed_at<s.expires_at
  ) AND NOT EXISTS(
    SELECT 1 FROM public.musicdna_export_withdrawals w
    WHERE w.source_key=p_source AND w.environment=p_environment
      AND w.subject_hash=encode(sha256(convert_to(p_subject_ref,'UTF8')),'hex')
  );
$$;
REVOKE ALL ON FUNCTION public.musicdna_learning_export_allowed(text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.musicdna_learning_export_allowed(text,text,text,timestamptz) TO service_role;

CREATE SCHEMA musicdna_learning_private;
REVOKE ALL ON SCHEMA musicdna_learning_private FROM PUBLIC,anon,authenticated,service_role;

-- Operator attests one exact synthetic result, not an account/share or a client label.
-- References are generated once with purpose/tenant/environment-separated HMAC keys.
CREATE TABLE public.musicdna_learning_enrollments (
  result_id uuid PRIMARY KEY REFERENCES public.session_results(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  source_key text NOT NULL,
  environment text NOT NULL,
  receiver_tenant_id text NOT NULL,
  subject_ref text NOT NULL CHECK(subject_ref ~ '^s_[0-9a-f]{64}$'),
  decision_ref text NOT NULL CHECK(decision_ref ~ '^d_[0-9a-f]{64}$'),
  result_ref text NOT NULL CHECK(result_ref ~ '^r_[0-9a-f]{64}$'),
  result_fingerprint text NOT NULL CHECK(result_fingerprint ~ '^[0-9a-f]{64}$'),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes
);
ALTER TABLE public.musicdna_learning_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.musicdna_learning_enrollments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,DELETE ON public.musicdna_learning_enrollments TO service_role;

CREATE TABLE public.musicdna_learning_outbox (
  observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL UNIQUE REFERENCES public.result_feedback(id) ON DELETE CASCADE,
  result_id uuid NOT NULL REFERENCES public.musicdna_learning_enrollments(result_id) ON DELETE CASCADE,
  source_key text NOT NULL,
  environment text NOT NULL,
  receiver_tenant_id text NOT NULL,
  subject_hash text NOT NULL CHECK(subject_hash ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz NOT NULL,
  state text NOT NULL CHECK(state IN ('captured','pending','excluded','cancelled')),
  reason text CHECK(reason IN ('missing_provenance','invalid_provenance','empty_feedback','scope_closed','withdrawn')),
  projection jsonb,
  canonical_envelope text CHECK(octet_length(canonical_envelope)<=8192),
  payload_fingerprint text CHECK(payload_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes,
  CHECK((state='captured' AND projection IS NOT NULL AND canonical_envelope IS NULL AND payload_fingerprint IS NULL AND reason IS NULL)
    OR (state='pending' AND projection IS NULL AND canonical_envelope IS NOT NULL AND payload_fingerprint IS NOT NULL AND reason IS NULL)
    OR (state IN ('excluded','cancelled') AND projection IS NULL AND canonical_envelope IS NULL AND payload_fingerprint IS NULL AND reason IS NOT NULL))
);
ALTER TABLE public.musicdna_learning_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.musicdna_learning_outbox FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,DELETE ON public.musicdna_learning_outbox TO service_role;
GRANT UPDATE(state,reason,projection,canonical_envelope,payload_fingerprint) ON public.musicdna_learning_outbox TO service_role;
CREATE INDEX musicdna_learning_outbox_recovery_idx ON public.musicdna_learning_outbox(created_at,observation_id) WHERE state='captured';
CREATE INDEX musicdna_learning_outbox_subject_idx ON public.musicdna_learning_outbox(source_key,environment,subject_hash);
CREATE INDEX musicdna_learning_enrollments_session_idx ON public.musicdna_learning_enrollments(session_id,owner_user_id);
CREATE INDEX musicdna_learning_enrollments_subject_idx ON public.musicdna_learning_enrollments(source_key,environment,subject_ref);

CREATE FUNCTION musicdna_learning_private.result_fingerprint(r public.session_results) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object('id',r.id,'session_id',r.session_id,'owner',r.user_id,
    'version',r.version,'source',r.source,'evidence',r.evidence,'ledger_version',r.ledger_version,
    'policy_version',r.policy_version,'engine_version',r.engine_version)::text,'UTF8')),'hex');
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.result_fingerprint(public.session_results) FROM PUBLIC,anon,authenticated,service_role;

-- Definer is confined to a non-exposed schema and has no directly callable grants.
-- It is required for an authenticated feedback transaction to write a private
-- capture without giving listeners INSERT/SELECT access to that capture table.
CREATE FUNCTION musicdna_learning_private.capture_feedback() RETURNS trigger
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
      'policy',jsonb_build_object('id',NULL,'version',NULL,'recommendation_event_id',NULL,'experiment_id',NULL,'variant',NULL),
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
CREATE TRIGGER musicdna_learning_capture AFTER INSERT ON public.result_feedback
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.capture_feedback();

CREATE FUNCTION musicdna_learning_private.freeze_captured_feedback() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD AND EXISTS(SELECT 1 FROM public.musicdna_learning_outbox WHERE feedback_id=OLD.id) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='LEARNING_FEEDBACK_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.freeze_captured_feedback() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER musicdna_learning_feedback_immutable BEFORE UPDATE ON public.result_feedback
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.freeze_captured_feedback();

-- Existing AB-49 withdrawal owns the same scope lock before inserting a marker.
CREATE FUNCTION musicdna_learning_private.cancel_subject_outbox() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.musicdna_learning_outbox SET state='cancelled',reason='withdrawn',projection=NULL,canonical_envelope=NULL,payload_fingerprint=NULL
    WHERE source_key=NEW.source_key AND environment=NEW.environment AND subject_hash=NEW.subject_hash;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.cancel_subject_outbox() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER musicdna_learning_withdrawal_cancel AFTER INSERT ON public.musicdna_export_withdrawals
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.cancel_subject_outbox();

-- Removing the enrolled result/session also queues downstream deletion before
-- cascading local detail removal. Definer prevents auth-admin cascades from
-- blocking account deletion merely because private tables are not exposed.
CREATE FUNCTION musicdna_learning_private.withdraw_removed_enrollment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.request_musicdna_learning_withdrawal(OLD.source_key,OLD.environment,OLD.subject_ref,gen_random_uuid(),'deletion');
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.withdraw_removed_enrollment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER musicdna_learning_enrollment_delete BEFORE DELETE ON public.musicdna_learning_enrollments
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.withdraw_removed_enrollment();

CREATE FUNCTION public.materialize_musicdna_learning_observation(p_observation_id uuid,p_canonical_envelope text)
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
    'summary','Music DNA learning observation','correlation_id','music-dna:learning:v1:'||o.observation_id::text,
    'metadata',jsonb_build_object('purpose','learning_observation','observation',
      jsonb_set(o.projection,'{feedback,ref}',v_observation#>'{feedback,ref}')));
  IF v_envelope IS DISTINCT FROM v_expected THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_learning_envelope'; END IF;
  UPDATE public.musicdna_learning_outbox SET state='pending',projection=NULL,canonical_envelope=p_canonical_envelope,
    payload_fingerprint=encode(sha256(convert_to(p_canonical_envelope,'UTF8')),'hex') WHERE observation_id=o.observation_id;
  RETURN jsonb_build_object('observation_id',o.observation_id,'state','pending','duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.materialize_musicdna_learning_observation(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_musicdna_learning_observation(uuid,text) TO service_role;

CREATE FUNCTION public.exclude_musicdna_learning_capture(p_observation_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE o public.musicdna_learning_outbox%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.musicdna_learning_outbox WHERE observation_id=p_observation_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='observation_unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:'||o.source_key||':'||o.environment,0));
  SELECT * INTO o FROM public.musicdna_learning_outbox WHERE observation_id=p_observation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='observation_unavailable'; END IF;
  IF o.state='captured' THEN
    UPDATE public.musicdna_learning_outbox SET state='excluded',reason='invalid_provenance',projection=NULL,canonical_envelope=NULL,payload_fingerprint=NULL
      WHERE observation_id=o.observation_id RETURNING * INTO o;
  END IF;
  RETURN jsonb_build_object('observation_id',o.observation_id,'state',o.state,'reason',o.reason);
END;
$$;
REVOKE ALL ON FUNCTION public.exclude_musicdna_learning_capture(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.exclude_musicdna_learning_capture(uuid) TO service_role;

CREATE FUNCTION musicdna_learning_private.withdraw_removed_feedback() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.musicdna_learning_enrollments%ROWTYPE;
BEGIN
  SELECT enrollment.* INTO e FROM public.musicdna_learning_enrollments enrollment
    JOIN public.session_results r ON r.id=enrollment.result_id
    WHERE enrollment.session_id=OLD.session_id AND enrollment.owner_user_id=OLD.user_id AND r.version=OLD.result_version;
  IF FOUND THEN
    PERFORM public.request_musicdna_learning_withdrawal(e.source_key,e.environment,e.subject_ref,gen_random_uuid(),'deletion');
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.withdraw_removed_feedback() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER musicdna_learning_feedback_delete BEFORE DELETE ON public.result_feedback
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.withdraw_removed_feedback();

-- Capture holds the scope row FOR SHARE; materialization takes only a plain read.
-- Scope edits cancel outbox rows transactionally, serializing with materialization
-- on those rows without granting the service UPDATE privileges on scope policy.
-- Do not acquire an advisory lock after a scope UPDATE: that would invert order.
CREATE FUNCTION musicdna_learning_private.close_changed_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.musicdna_learning_outbox SET state='cancelled',reason='scope_closed',projection=NULL,canonical_envelope=NULL,payload_fingerprint=NULL
    WHERE source_key=NEW.source_key AND environment=NEW.environment AND state IN ('captured','pending')
      AND (NOT NEW.capture_enabled OR NEW.approved_by IS NULL OR receiver_tenant_id IS DISTINCT FROM NEW.receiver_tenant_id
        OR observed_at<NEW.observed_from OR observed_at>=NEW.expires_at OR NEW.expires_at<=clock_timestamp());
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.close_changed_scope() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER musicdna_learning_scope_close AFTER UPDATE OF capture_enabled,approved_by,receiver_tenant_id,observed_from,expires_at
  ON public.musicdna_export_scopes FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.close_changed_scope();

CREATE FUNCTION musicdna_learning_private.cancel_changed_enrollment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    -- Changing/revoking a synthetic attestation also withdraws previously sent
    -- subject evidence; local cancellation alone cannot revoke receiver readback.
    PERFORM public.request_musicdna_learning_withdrawal(OLD.source_key,OLD.environment,OLD.subject_ref,gen_random_uuid(),'withdrawal');
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.cancel_changed_enrollment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER musicdna_learning_enrollment_change AFTER UPDATE ON public.musicdna_learning_enrollments
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.cancel_changed_enrollment();

CREATE FUNCTION public.purge_musicdna_learning_outbox(p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_scope record; v_count integer:=0; v_events integer:=0; v_enrollments integer:=0; v_batch integer;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_purge_limit'; END IF;
  -- Lock order: scope advisory, then outbox rows. Never invert it with a worker.
  FOR v_scope IN SELECT source_key,environment FROM public.musicdna_export_scopes ORDER BY source_key,environment LOOP
    EXIT WHEN v_count>=p_limit;
    PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:'||v_scope.source_key||':'||v_scope.environment,0));
    WITH candidates AS MATERIALIZED(
      SELECT o.observation_id FROM public.musicdna_learning_outbox o JOIN public.musicdna_export_scopes s USING(source_key,environment)
      WHERE o.source_key=v_scope.source_key AND o.environment=v_scope.environment
        AND (s.expires_at<=statement_timestamp() OR (o.state='cancelled' AND o.created_at<statement_timestamp()-interval '7 days'))
      ORDER BY o.created_at,o.observation_id LIMIT p_limit-v_count
    ), removed AS(DELETE FROM public.musicdna_learning_outbox o USING candidates c WHERE o.observation_id=c.observation_id RETURNING o.observation_id)
    SELECT count(*)::integer INTO v_batch FROM removed;
    v_count:=v_count+v_batch; v_events:=v_events+v_batch;
    -- Remove derived owner/session/ref mappings once no outbox detail remains.
    -- The deletion trigger queues a minimal downstream obligation; it does not
    -- pretend the receiver completed deletion while offline.
    WITH candidates AS MATERIALIZED(
      SELECT e.result_id FROM public.musicdna_learning_enrollments e
      JOIN public.musicdna_export_scopes s USING(source_key,environment)
      WHERE e.source_key=v_scope.source_key AND e.environment=v_scope.environment
        AND (s.expires_at<=statement_timestamp() OR e.approved_by IS NULL OR EXISTS(
          SELECT 1 FROM public.musicdna_export_withdrawals w WHERE w.source_key=e.source_key AND w.environment=e.environment
            AND w.subject_hash=encode(sha256(convert_to(e.subject_ref,'UTF8')),'hex')))
        AND NOT EXISTS(SELECT 1 FROM public.musicdna_learning_outbox o WHERE o.result_id=e.result_id)
      ORDER BY e.enrolled_at,e.result_id LIMIT p_limit-v_count
    ), removed AS(DELETE FROM public.musicdna_learning_enrollments e USING candidates c WHERE e.result_id=c.result_id RETURNING e.result_id)
    SELECT count(*)::integer INTO v_batch FROM removed;
    v_count:=v_count+v_batch; v_enrollments:=v_enrollments+v_batch;
  END LOOP;
  RETURN jsonb_build_object('purged_outbox',v_events,'purged_enrollments',v_enrollments);
END;
$$;
REVOKE ALL ON FUNCTION public.purge_musicdna_learning_outbox(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_musicdna_learning_outbox(integer) TO service_role;
NOTIFY pgrst,'reload schema';
