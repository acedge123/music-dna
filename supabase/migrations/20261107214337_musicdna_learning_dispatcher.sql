-- AB-47: bounded, leased manual dispatch. No activation, source, key or schedule.
ALTER TABLE public.musicdna_export_scopes ADD COLUMN dispatch_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.musicdna_export_withdrawals ADD COLUMN receiver_tenant_id text;
REVOKE UPDATE ON public.musicdna_export_withdrawals FROM service_role;
GRANT UPDATE(attempts,last_failure,completed_at,purged_count,subject_ref) ON public.musicdna_export_withdrawals TO service_role;

CREATE FUNCTION musicdna_learning_private.bind_withdrawal_receiver() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tenant text; v_count integer;
BEGIN
  SELECT count(DISTINCT receiver_tenant_id),min(receiver_tenant_id) INTO v_count,v_tenant
    FROM public.musicdna_learning_enrollments WHERE source_key=NEW.source_key AND environment=NEW.environment AND subject_ref=NEW.subject_ref;
  IF v_count>1 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ambiguous_withdrawal_binding'; END IF;
  IF v_count=0 THEN SELECT receiver_tenant_id INTO v_tenant FROM public.musicdna_export_scopes WHERE source_key=NEW.source_key AND environment=NEW.environment; END IF;
  NEW.receiver_tenant_id:=v_tenant;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION musicdna_learning_private.bind_withdrawal_receiver() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER musicdna_learning_withdrawal_binding BEFORE INSERT ON public.musicdna_export_withdrawals
  FOR EACH ROW EXECUTE FUNCTION musicdna_learning_private.bind_withdrawal_receiver();

CREATE TABLE public.musicdna_learning_dispatch_jobs (
  source_key text NOT NULL,environment text NOT NULL,kind text NOT NULL CHECK(kind IN ('observation','deletion')),
  work_id uuid NOT NULL,receiver_tenant_id text,
  state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','leased','retry','delivered','quarantined','cancelled')),
  lease_token uuid,lease_until timestamptz,lease_started_at timestamptz,
  claims integer NOT NULL DEFAULT 0,attempts integer NOT NULL DEFAULT 0,replay_count integer NOT NULL DEFAULT 0 CHECK(replay_count BETWEEN 0 AND 1),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,completed_at timestamptz,receipt_id uuid,
  last_failure text CHECK(last_failure IN ('timeout','rate_limited','server_error','invalid_payload','observation_conflict','auth_rejected','source_disabled','invalid_receipt','configuration','binding_changed','missing_binding','retry_exhausted','max_age','withdrawn','lease_expired')),
  PRIMARY KEY(source_key,environment,kind,work_id),
  FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes,
  CHECK((state='leased' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (state<>'leased' AND lease_token IS NULL AND lease_until IS NULL AND lease_started_at IS NULL))
);
REVOKE ALL ON public.musicdna_learning_dispatch_jobs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,DELETE ON public.musicdna_learning_dispatch_jobs TO service_role;
GRANT UPDATE(state,lease_token,lease_until,lease_started_at,claims,attempts,next_attempt_at,last_attempt_at,completed_at,receipt_id,last_failure)
  ON public.musicdna_learning_dispatch_jobs TO service_role;
ALTER TABLE public.musicdna_learning_dispatch_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX musicdna_learning_dispatch_due_idx ON public.musicdna_learning_dispatch_jobs(source_key,environment,next_attempt_at,created_at) WHERE state IN ('ready','retry','leased');

CREATE TABLE public.musicdna_learning_dispatch_rates (
  source_key text NOT NULL,environment text NOT NULL,next_request_at timestamptz NOT NULL DEFAULT now(),
  failures integer NOT NULL DEFAULT 0,cooldown_until timestamptz,
  PRIMARY KEY(source_key,environment),FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes
);
REVOKE ALL ON public.musicdna_learning_dispatch_rates FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.musicdna_learning_dispatch_rates TO service_role;
GRANT UPDATE(next_request_at,failures,cooldown_until) ON public.musicdna_learning_dispatch_rates TO service_role;
ALTER TABLE public.musicdna_learning_dispatch_rates ENABLE ROW LEVEL SECURITY;

-- Worker can raise an attention record, never clear its own credential/binding halt.
CREATE TABLE public.musicdna_learning_dispatch_halts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_key text NOT NULL,environment text NOT NULL,
  reason text NOT NULL CHECK(reason IN ('auth_rejected','source_disabled','configuration','binding_changed')),
  raised_at timestamptz NOT NULL DEFAULT now(),cleared_at timestamptz,cleared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes
);
REVOKE ALL ON public.musicdna_learning_dispatch_halts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.musicdna_learning_dispatch_halts TO service_role;
ALTER TABLE public.musicdna_learning_dispatch_halts ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX musicdna_learning_dispatch_active_halt_idx ON public.musicdna_learning_dispatch_halts(source_key,environment) WHERE cleared_at IS NULL;

CREATE FUNCTION public.claim_musicdna_learning_dispatch(p_source text,p_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE s public.musicdna_export_scopes%ROWTYPE;j public.musicdna_learning_dispatch_jobs%ROWTYPE;v_wait timestamptz;v_reason text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:'||p_source||':'||p_environment,0));
  SELECT * INTO s FROM public.musicdna_export_scopes WHERE source_key=p_source AND environment=p_environment;
  IF NOT FOUND OR NOT s.dispatch_enabled THEN RETURN '{"state":"disabled"}'::jsonb; END IF;
  SELECT reason INTO v_reason FROM public.musicdna_learning_dispatch_halts WHERE source_key=p_source AND environment=p_environment AND cleared_at IS NULL;
  IF FOUND THEN RETURN jsonb_build_object('state','halted','reason',v_reason); END IF;
  SELECT greatest(next_request_at,cooldown_until) INTO v_wait FROM public.musicdna_learning_dispatch_rates WHERE source_key=p_source AND environment=p_environment;
  IF v_wait>clock_timestamp() THEN RETURN jsonb_build_object('state','rate_limited','retry_after_ms',ceil(extract(epoch FROM v_wait-clock_timestamp())*1000)::integer); END IF;
  -- No payload copies in the queue. Existing terminal jobs prevent automatic replay.
  INSERT INTO public.musicdna_learning_dispatch_jobs(source_key,environment,kind,work_id,receiver_tenant_id,created_at)
    SELECT w.source_key,w.environment,'deletion',w.deletion_id,w.receiver_tenant_id,w.requested_at
    FROM public.musicdna_export_withdrawals w WHERE w.source_key=p_source AND w.environment=p_environment AND w.completed_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.musicdna_learning_dispatch_jobs d WHERE d.source_key=w.source_key AND d.environment=w.environment AND d.kind='deletion' AND d.work_id=w.deletion_id)
    ORDER BY w.requested_at LIMIT 100 ON CONFLICT DO NOTHING;
  IF s.capture_enabled AND s.approved_by IS NOT NULL AND s.expires_at>clock_timestamp() THEN
    INSERT INTO public.musicdna_learning_dispatch_jobs(source_key,environment,kind,work_id,receiver_tenant_id,created_at)
      SELECT o.source_key,o.environment,'observation',o.observation_id,o.receiver_tenant_id,o.created_at
      FROM public.musicdna_learning_outbox o WHERE o.source_key=p_source AND o.environment=p_environment AND o.state='pending' AND NOT EXISTS(SELECT 1 FROM public.musicdna_learning_dispatch_jobs d WHERE d.source_key=o.source_key AND d.environment=o.environment AND d.kind='observation' AND d.work_id=o.observation_id)
      ORDER BY o.created_at LIMIT 100 ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.musicdna_learning_dispatch_jobs d SET state='cancelled',last_failure='withdrawn',lease_token=NULL,lease_until=NULL,lease_started_at=NULL
    WHERE d.source_key=p_source AND d.environment=p_environment AND d.kind='observation' AND d.state IN ('ready','retry','leased')
      AND NOT EXISTS(SELECT 1 FROM public.musicdna_learning_outbox o WHERE o.observation_id=d.work_id AND o.source_key=d.source_key AND o.environment=d.environment AND o.state='pending');
  UPDATE public.musicdna_learning_dispatch_jobs SET state='retry',last_failure='lease_expired',lease_token=NULL,lease_until=NULL,lease_started_at=NULL,next_attempt_at=clock_timestamp()
    WHERE source_key=p_source AND environment=p_environment AND state='leased' AND lease_until<=clock_timestamp();
  UPDATE public.musicdna_learning_dispatch_jobs SET state='quarantined',last_failure=CASE WHEN attempts>=8*(replay_count+1) THEN 'retry_exhausted' ELSE 'max_age' END,lease_token=NULL,lease_until=NULL,lease_started_at=NULL
    WHERE source_key=p_source AND environment=p_environment AND state IN ('ready','retry')
      AND (attempts>=8*(replay_count+1) OR created_at<clock_timestamp()-CASE WHEN kind='deletion' THEN interval '7 days' ELSE interval '24 hours' END);
  UPDATE public.musicdna_learning_dispatch_jobs SET state='quarantined',last_failure='missing_binding'
    WHERE source_key=p_source AND environment=p_environment AND state IN ('ready','retry') AND receiver_tenant_id IS NULL;
  SELECT * INTO j FROM public.musicdna_learning_dispatch_jobs
    WHERE source_key=p_source AND environment=p_environment AND state IN ('ready','retry') AND next_attempt_at<=clock_timestamp()
    ORDER BY CASE WHEN kind='deletion' THEN 0 ELSE 1 END,created_at,work_id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN '{"state":"idle"}'::jsonb; END IF;
  UPDATE public.musicdna_learning_dispatch_jobs SET state='leased',lease_started_at=NULL,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',claims=claims+1
    WHERE source_key=p_source AND environment=p_environment AND kind=j.kind AND work_id=j.work_id RETURNING * INTO j;
  RETURN jsonb_build_object('state','leased','kind',j.kind,'work_id',j.work_id,'lease_token',j.lease_token,'lease_until',j.lease_until);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_musicdna_learning_dispatch(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_musicdna_learning_dispatch(text,text) TO service_role;

CREATE FUNCTION public.begin_musicdna_learning_send(p_source text,p_environment text,p_kind text,p_work_id uuid,p_lease_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE s public.musicdna_export_scopes%ROWTYPE;j public.musicdna_learning_dispatch_jobs%ROWTYPE;o public.musicdna_learning_outbox%ROWTYPE;
  w public.musicdna_export_withdrawals%ROWTYPE;v_wait timestamptz;v_reason text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:'||p_source||':'||p_environment,0));
  SELECT * INTO s FROM public.musicdna_export_scopes WHERE source_key=p_source AND environment=p_environment;
  SELECT * INTO j FROM public.musicdna_learning_dispatch_jobs WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id FOR UPDATE;
  IF NOT FOUND OR j.state<>'leased' OR j.lease_token IS DISTINCT FROM p_lease_token OR j.lease_started_at IS NOT NULL OR j.lease_until<clock_timestamp()+interval '15 seconds' THEN RETURN '{"state":"stale"}'::jsonb; END IF;
  SELECT reason INTO v_reason FROM public.musicdna_learning_dispatch_halts WHERE source_key=p_source AND environment=p_environment AND cleared_at IS NULL;
  IF NOT s.dispatch_enabled OR v_reason IS NOT NULL THEN
    UPDATE public.musicdna_learning_dispatch_jobs SET state='retry',lease_token=NULL,lease_until=NULL,lease_started_at=NULL WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
    RETURN jsonb_build_object('state',CASE WHEN v_reason IS NULL THEN 'disabled' ELSE 'halted' END,'reason',v_reason);
  END IF;
  IF j.attempts>=8*(j.replay_count+1) OR j.created_at<clock_timestamp()-(CASE WHEN j.kind='deletion' THEN interval '7 days' ELSE interval '24 hours' END) THEN
    v_reason:=CASE WHEN j.attempts>=8*(j.replay_count+1) THEN 'retry_exhausted' ELSE 'max_age' END;
    UPDATE public.musicdna_learning_dispatch_jobs SET state='quarantined',last_failure=v_reason,lease_token=NULL,lease_until=NULL,lease_started_at=NULL WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
    RETURN jsonb_build_object('state','quarantined','reason',v_reason);
  END IF;
  IF s.receiver_tenant_id IS DISTINCT FROM j.receiver_tenant_id THEN
    INSERT INTO public.musicdna_learning_dispatch_halts(source_key,environment,reason) VALUES(p_source,p_environment,'binding_changed') ON CONFLICT DO NOTHING;
    UPDATE public.musicdna_learning_dispatch_jobs SET state='retry',lease_token=NULL,lease_until=NULL,lease_started_at=NULL,last_failure='binding_changed' WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
    RETURN '{"state":"halted","reason":"binding_changed"}'::jsonb;
  END IF;
  INSERT INTO public.musicdna_learning_dispatch_rates(source_key,environment) VALUES(p_source,p_environment) ON CONFLICT DO NOTHING;
  SELECT greatest(next_request_at,cooldown_until) INTO v_wait FROM public.musicdna_learning_dispatch_rates WHERE source_key=p_source AND environment=p_environment;
  IF v_wait>clock_timestamp() THEN
    UPDATE public.musicdna_learning_dispatch_jobs SET state='retry',next_attempt_at=v_wait,lease_token=NULL,lease_until=NULL,lease_started_at=NULL WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
    RETURN jsonb_build_object('state','rate_limited','retry_after_ms',ceil(extract(epoch FROM v_wait-clock_timestamp())*1000)::integer);
  END IF;
  IF p_kind='observation' THEN
    SELECT * INTO o FROM public.musicdna_learning_outbox WHERE observation_id=p_work_id AND source_key=p_source AND environment=p_environment;
    IF NOT FOUND OR o.state<>'pending' OR NOT s.capture_enabled OR s.approved_by IS NULL OR s.expires_at<=clock_timestamp()
      OR o.observed_at<s.observed_from OR o.observed_at>=s.expires_at OR o.receiver_tenant_id IS DISTINCT FROM s.receiver_tenant_id
      OR NOT EXISTS(SELECT 1 FROM public.musicdna_learning_enrollments e WHERE e.result_id=o.result_id AND e.approved_by IS NOT NULL)
      OR EXISTS(SELECT 1 FROM public.musicdna_export_withdrawals d WHERE d.source_key=p_source AND d.environment=p_environment AND d.subject_hash=o.subject_hash) THEN
      UPDATE public.musicdna_learning_dispatch_jobs SET state='cancelled',last_failure='withdrawn',lease_token=NULL,lease_until=NULL,lease_started_at=NULL WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
      RETURN '{"state":"cancelled"}'::jsonb;
    END IF;
  ELSE
    SELECT * INTO w FROM public.musicdna_export_withdrawals WHERE source_key=p_source AND environment=p_environment AND deletion_id=p_work_id;
    IF NOT FOUND OR w.completed_at IS NOT NULL THEN
      UPDATE public.musicdna_learning_dispatch_jobs SET state='cancelled',lease_token=NULL,lease_until=NULL,lease_started_at=NULL WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
      RETURN '{"state":"cancelled"}'::jsonb;
    END IF;
    IF w.receiver_tenant_id IS DISTINCT FROM j.receiver_tenant_id THEN RETURN '{"state":"stale"}'::jsonb; END IF;
  END IF;
  UPDATE public.musicdna_learning_dispatch_rates SET next_request_at=clock_timestamp()+interval '1 second' WHERE source_key=p_source AND environment=p_environment;
  UPDATE public.musicdna_learning_dispatch_jobs SET lease_started_at=clock_timestamp(),attempts=attempts+1,last_attempt_at=clock_timestamp() WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
  IF p_kind='observation' THEN RETURN jsonb_build_object('state','send','body',o.canonical_envelope,'fingerprint',o.payload_fingerprint); END IF;
  RETURN jsonb_build_object('state','send','body',jsonb_build_object('schema_version','learning-deletion.v1','source',w.source_key,'environment',w.environment,'subject_ref',w.subject_ref,'deletion_id',w.deletion_id,'reason',w.reason)::text);
END;
$$;
REVOKE ALL ON FUNCTION public.begin_musicdna_learning_send(text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_musicdna_learning_send(text,text,text,uuid,uuid) TO service_role;

CREATE FUNCTION public.finish_musicdna_learning_dispatch(p_source text,p_environment text,p_kind text,p_work_id uuid,p_lease_token uuid,
  p_outcome text,p_failure text DEFAULT NULL,p_retry_after_seconds integer DEFAULT 0,p_receipt jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE j public.musicdna_learning_dispatch_jobs%ROWTYPE;v_id uuid;v_delay integer;v_completed timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:'||p_source||':'||p_environment,0));
  SELECT * INTO j FROM public.musicdna_learning_dispatch_jobs WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id FOR UPDATE;
  IF NOT FOUND OR j.state<>'leased' OR j.lease_token IS DISTINCT FROM p_lease_token OR j.lease_started_at IS NULL OR j.lease_until<=clock_timestamp() THEN RETURN '{"state":"stale"}'::jsonb; END IF;
  IF (p_outcome IN ('delivered','retry','quarantined','halted') AND p_retry_after_seconds BETWEEN 0 AND 3600) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_dispatch_result';
  END IF;
  IF p_kind='observation' AND NOT EXISTS(SELECT 1 FROM public.musicdna_learning_outbox o WHERE o.observation_id=p_work_id AND o.source_key=p_source AND o.environment=p_environment AND o.state='pending') THEN
    UPDATE public.musicdna_learning_dispatch_jobs SET state='cancelled',lease_token=NULL,lease_until=NULL,lease_started_at=NULL,last_failure='withdrawn' WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
    RETURN '{"state":"cancelled"}'::jsonb;
  END IF;
  IF p_outcome='delivered' THEN
    IF p_kind='observation' THEN
      IF (p_receipt->'ok'='true'::jsonb AND p_receipt->>'observation_id'=p_work_id::text AND p_receipt->>'status'='received'
        AND p_receipt->>'route'='audit_only' AND p_receipt->'agent_job_id'='null'::jsonb AND p_receipt->'approval_id'='null'::jsonb
        AND jsonb_typeof(p_receipt->'duplicate')='boolean' AND p_receipt->>'event_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_receiver_receipt';
      END IF;
      v_id:=(p_receipt->>'event_id')::uuid;
    ELSE
      IF (p_receipt->'ok'='true'::jsonb AND p_receipt->>'deletion_id'=p_work_id::text AND p_receipt->>'status'='completed'
        AND jsonb_typeof(p_receipt->'duplicate')='boolean' AND (p_receipt->>'purged_count') ~ '^[0-9]+$') IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_receiver_receipt';
      END IF;
      v_completed:=(p_receipt->>'completed_at')::timestamptz;
      IF v_completed IS NULL OR v_completed>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_receiver_receipt'; END IF;
      UPDATE public.musicdna_export_withdrawals SET completed_at=v_completed,purged_count=(p_receipt->>'purged_count')::integer,
        subject_ref=NULL,attempts=attempts+1,last_failure=NULL WHERE source_key=p_source AND environment=p_environment AND deletion_id=p_work_id AND completed_at IS NULL;
      v_id:=p_work_id;
    END IF;
    UPDATE public.musicdna_learning_dispatch_jobs SET state='delivered',receipt_id=v_id,completed_at=clock_timestamp(),last_failure=NULL,lease_token=NULL,lease_until=NULL,lease_started_at=NULL
      WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
    UPDATE public.musicdna_learning_dispatch_rates SET failures=0,cooldown_until=NULL WHERE source_key=p_source AND environment=p_environment;
    RETURN jsonb_build_object('state','delivered','receipt_id',v_id);
  END IF;
  IF ((p_outcome='retry' AND p_failure IN ('timeout','rate_limited','server_error'))
    OR (p_outcome='quarantined' AND p_failure IN ('invalid_payload','observation_conflict','invalid_receipt'))
    OR (p_outcome='halted' AND p_failure IN ('auth_rejected','source_disabled','configuration'))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_dispatch_result';
  END IF;
  IF p_outcome='halted' THEN
    INSERT INTO public.musicdna_learning_dispatch_halts(source_key,environment,reason) VALUES(p_source,p_environment,p_failure) ON CONFLICT DO NOTHING;
  END IF;
  v_delay:=greatest(p_retry_after_seconds,least(3600,ceil(5*power(2,least(j.attempts-1,10))*(0.8+random()*0.4))::integer));
  UPDATE public.musicdna_learning_dispatch_jobs SET state=CASE WHEN p_outcome='quarantined' THEN 'quarantined' ELSE 'retry' END,
    last_failure=p_failure,next_attempt_at=clock_timestamp()+make_interval(secs=>v_delay),lease_token=NULL,lease_until=NULL,lease_started_at=NULL
    WHERE source_key=p_source AND environment=p_environment AND kind=p_kind AND work_id=p_work_id;
  IF p_outcome='retry' AND p_failure IN ('timeout','server_error') THEN
    UPDATE public.musicdna_learning_dispatch_rates SET failures=failures+1,
      cooldown_until=CASE WHEN failures+1>=5 THEN clock_timestamp()+interval '5 minutes' ELSE cooldown_until END WHERE source_key=p_source AND environment=p_environment;
  END IF;
  IF p_kind='deletion' THEN UPDATE public.musicdna_export_withdrawals SET attempts=attempts+1,last_failure=CASE WHEN p_outcome='retry' THEN 'unavailable' ELSE 'rejected' END
    WHERE source_key=p_source AND environment=p_environment AND deletion_id=p_work_id AND completed_at IS NULL; END IF;
  RETURN jsonb_build_object('state',CASE WHEN p_outcome='quarantined' THEN 'quarantined' WHEN p_outcome='halted' THEN 'halted' ELSE 'retry' END,'reason',p_failure,'retry_after_seconds',v_delay);
END;
$$;
REVOKE ALL ON FUNCTION public.finish_musicdna_learning_dispatch(text,text,text,uuid,uuid,text,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_musicdna_learning_dispatch(text,text,text,uuid,uuid,text,text,integer,jsonb) TO service_role;
-- AB-47 supersedes the unleased AB-49 acknowledgement path. SQL owners retain it
-- for reviewed reconciliation; ordinary application service cannot bypass leases.
REVOKE EXECUTE ON FUNCTION public.finish_musicdna_learning_withdrawal(text,text,uuid,timestamptz,integer,text) FROM service_role;

CREATE FUNCTION public.musicdna_learning_dispatch_status(p_source text,p_environment text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'scope_present',s.source_key IS NOT NULL,'dispatch_enabled',coalesce(s.dispatch_enabled,false),
    'capture_enabled',coalesce(s.capture_enabled,false),'scope_expired',coalesce(s.expires_at<=statement_timestamp(),true),
    'halt_reason',(SELECT reason FROM public.musicdna_learning_dispatch_halts WHERE source_key=p_source AND environment=p_environment AND cleared_at IS NULL),
    'job_counts',(SELECT coalesce(jsonb_object_agg(state,n),'{}'::jsonb) FROM (SELECT state,count(*) AS n FROM public.musicdna_learning_dispatch_jobs WHERE source_key=p_source AND environment=p_environment GROUP BY state) c),
    'oldest_observation_pending_seconds',(SELECT extract(epoch FROM statement_timestamp()-min(created_at)) FROM public.musicdna_learning_dispatch_jobs WHERE source_key=p_source AND environment=p_environment AND kind='observation' AND state IN ('ready','retry','leased')),
    'attempts_started',(SELECT coalesce(sum(attempts),0) FROM public.musicdna_learning_dispatch_jobs WHERE source_key=p_source AND environment=p_environment),
    'captured',(SELECT count(*) FROM public.musicdna_learning_outbox WHERE source_key=p_source AND environment=p_environment AND state='captured'),
    'pending_deletions',(SELECT count(*) FROM public.musicdna_export_withdrawals WHERE source_key=p_source AND environment=p_environment AND completed_at IS NULL),
    'oldest_pending_deletion_seconds',(SELECT extract(epoch FROM statement_timestamp()-min(requested_at)) FROM public.musicdna_export_withdrawals WHERE source_key=p_source AND environment=p_environment AND completed_at IS NULL),
    'cooldown_until',(SELECT cooldown_until FROM public.musicdna_learning_dispatch_rates WHERE source_key=p_source AND environment=p_environment)
  ) FROM (SELECT 1) stub LEFT JOIN public.musicdna_export_scopes s ON s.source_key=p_source AND s.environment=p_environment;
$$;
REVOKE ALL ON FUNCTION public.musicdna_learning_dispatch_status(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.musicdna_learning_dispatch_status(text,text) TO service_role;
CREATE FUNCTION public.purge_musicdna_learning_dispatch(p_limit integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_purge_limit'; END IF;
  WITH candidates AS MATERIALIZED(
    SELECT d.source_key,d.environment,d.kind,d.work_id FROM public.musicdna_learning_dispatch_jobs d
    JOIN public.musicdna_export_scopes s USING(source_key,environment)
    WHERE (s.expires_at+interval '7 days'<=statement_timestamp() OR d.created_at+interval '90 days'<=statement_timestamp())
      AND (d.kind='observation' OR NOT EXISTS(SELECT 1 FROM public.musicdna_export_withdrawals w WHERE w.source_key=d.source_key AND w.environment=d.environment AND w.deletion_id=d.work_id AND w.completed_at IS NULL))
    ORDER BY d.created_at LIMIT p_limit
  ), removed AS(DELETE FROM public.musicdna_learning_dispatch_jobs d USING candidates c
    WHERE (d.source_key,d.environment,d.kind,d.work_id)=(c.source_key,c.environment,c.kind,c.work_id) RETURNING d.work_id)
  SELECT count(*)::integer INTO v_count FROM removed;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_musicdna_learning_dispatch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_musicdna_learning_dispatch(integer) TO service_role;
CREATE FUNCTION public.inspect_musicdna_learning_dispatch(p_source text,p_environment text,p_work_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('kind',kind,'work_id',work_id,'state',state,'claims',claims,'attempts',attempts,
    'next_attempt_at',next_attempt_at,'last_attempt_at',last_attempt_at,'completed_at',completed_at,'lease_until',lease_until,'receipt_id',receipt_id,'last_failure',last_failure)),'[]'::jsonb)
  FROM public.musicdna_learning_dispatch_jobs WHERE source_key=p_source AND environment=p_environment AND work_id=p_work_id;
$$;
REVOKE ALL ON FUNCTION public.inspect_musicdna_learning_dispatch(text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inspect_musicdna_learning_dispatch(text,text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
