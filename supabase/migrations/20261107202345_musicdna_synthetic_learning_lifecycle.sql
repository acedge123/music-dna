-- AB-49 synthetic lifecycle control plane. No sender, schedule, sources, grants,
-- identities or synthetic authorizations are provisioned by this migration.
CREATE TABLE public.musicdna_export_scopes (
  source_key text NOT NULL,
  environment text NOT NULL,
  observed_from timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  policy_version text NOT NULL DEFAULT 'synthetic-lifecycle.v1' CHECK(policy_version='synthetic-lifecycle.v1'),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY(source_key,environment),
  CHECK((source_key='music-dna-staging' AND environment='staging') OR (source_key='music-dna' AND environment='production')),
  CHECK(expires_at>observed_from AND expires_at-observed_from<=interval '31 days')
);
CREATE TABLE public.musicdna_export_withdrawals (
  source_key text NOT NULL,
  environment text NOT NULL,
  subject_hash text NOT NULL CHECK(subject_hash ~ '^[0-9a-f]{64}$'),
  subject_ref text CHECK(subject_ref ~ '^s_[0-9a-f]{64}$'),
  deletion_id uuid NOT NULL,
  reason text NOT NULL CHECK(reason IN ('withdrawal','deletion','retention')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_failure text CHECK(last_failure IN ('unavailable','rejected')),
  purged_count integer CHECK(purged_count>=0),
  PRIMARY KEY(source_key,environment,subject_hash),
  UNIQUE(source_key,environment,deletion_id),
  FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes,
  CHECK((completed_at IS NULL AND subject_ref IS NOT NULL) OR (completed_at IS NOT NULL AND subject_ref IS NULL))
);
ALTER TABLE public.musicdna_export_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.musicdna_export_withdrawals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.musicdna_export_scopes,public.musicdna_export_withdrawals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.musicdna_export_scopes TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.musicdna_export_withdrawals TO service_role;
CREATE INDEX musicdna_export_withdrawals_pending_idx ON public.musicdna_export_withdrawals(requested_at) WHERE completed_at IS NULL;

CREATE FUNCTION public.musicdna_learning_export_allowed(p_source text,p_environment text,p_subject_ref text,p_observed_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(p_subject_ref ~ '^s_[0-9a-f]{64}$',false) AND EXISTS(
    SELECT 1 FROM public.musicdna_export_scopes s
    WHERE s.source_key=p_source AND s.environment=p_environment AND s.approved_by IS NOT NULL
      AND statement_timestamp()<s.expires_at AND p_observed_at>=s.observed_from AND p_observed_at<s.expires_at
  ) AND NOT EXISTS(
    SELECT 1 FROM public.musicdna_export_withdrawals w
    WHERE w.source_key=p_source AND w.environment=p_environment
      AND w.subject_hash=encode(sha256(convert_to(p_subject_ref,'UTF8')),'hex')
  );
$$;
REVOKE ALL ON FUNCTION public.musicdna_learning_export_allowed(text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.musicdna_learning_export_allowed(text,text,text,timestamptz) TO service_role;

CREATE FUNCTION public.request_musicdna_learning_withdrawal(
  p_source text,p_environment text,p_subject_ref text,p_deletion_id uuid,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_row public.musicdna_export_withdrawals%ROWTYPE; v_hash text;
BEGIN
  IF (p_subject_ref ~ '^s_[0-9a-f]{64}$' AND p_deletion_id IS NOT NULL AND p_reason IN ('withdrawal','deletion','retention')) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_learning_deletion';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.musicdna_export_scopes WHERE source_key=p_source AND environment=p_environment) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic_scope_required';
  END IF;
  -- AB-45 enqueue and AB-47 claim must acquire this same scope lock inside
  -- their write transaction and recheck eligibility. A preflight alone is unsafe.
  PERFORM pg_advisory_xact_lock(hashtextextended('musicdna-export-lifecycle:'||p_source||':'||p_environment,0));
  v_hash:=encode(sha256(convert_to(p_subject_ref,'UTF8')),'hex');
  IF EXISTS(SELECT 1 FROM public.musicdna_export_withdrawals WHERE source_key=p_source AND environment=p_environment
    AND deletion_id=p_deletion_id AND (subject_hash<>v_hash OR reason<>p_reason)) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='deletion_conflict';
  END IF;
  INSERT INTO public.musicdna_export_withdrawals(source_key,environment,subject_hash,subject_ref,deletion_id,reason)
    VALUES(p_source,p_environment,v_hash,p_subject_ref,p_deletion_id,p_reason)
    ON CONFLICT(source_key,environment,subject_hash) DO NOTHING;
  SELECT * INTO v_row FROM public.musicdna_export_withdrawals WHERE source_key=p_source AND environment=p_environment AND subject_hash=v_hash;
  RETURN jsonb_build_object('deletion_id',v_row.deletion_id,'status',CASE WHEN v_row.completed_at IS NULL THEN 'pending' ELSE 'completed' END,
    'requested_at',v_row.requested_at,'completed_at',v_row.completed_at);
END;
$$;
REVOKE ALL ON FUNCTION public.request_musicdna_learning_withdrawal(text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_musicdna_learning_withdrawal(text,text,text,uuid,text) TO service_role;

CREATE FUNCTION public.finish_musicdna_learning_withdrawal(
  p_source text,p_environment text,p_deletion_id uuid,p_completed_at timestamptz,p_purged_count integer,p_failure text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF (p_failure IS NOT NULL AND p_failure NOT IN ('unavailable','rejected')) OR
    (p_failure IS NULL AND (p_completed_at IS NULL OR p_completed_at>now()+interval '5 minutes' OR p_purged_count IS NULL OR p_purged_count<0)) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_deletion_receipt';
  END IF;
  UPDATE public.musicdna_export_withdrawals SET attempts=attempts+1,
    last_failure=p_failure,
    completed_at=CASE WHEN p_failure IS NULL THEN p_completed_at ELSE NULL END,
    purged_count=CASE WHEN p_failure IS NULL THEN p_purged_count ELSE NULL END,
    subject_ref=CASE WHEN p_failure IS NULL THEN NULL ELSE subject_ref END
    WHERE source_key=p_source AND environment=p_environment AND deletion_id=p_deletion_id AND completed_at IS NULL;
  IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.musicdna_export_withdrawals WHERE source_key=p_source AND environment=p_environment AND deletion_id=p_deletion_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='withdrawal_not_found';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_musicdna_learning_withdrawal(text,text,uuid,timestamptz,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_musicdna_learning_withdrawal(text,text,uuid,timestamptz,integer,text) TO service_role;

-- Completed markers expire only once the scope is irreversibly closed. Pending
-- delivery records are retained for operator attention, never silently called done.
CREATE FUNCTION public.purge_completed_musicdna_learning_withdrawals(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_purge_limit'; END IF;
  WITH candidates AS MATERIALIZED(
    SELECT w.source_key,w.environment,w.subject_hash FROM public.musicdna_export_withdrawals w
    JOIN public.musicdna_export_scopes s USING(source_key,environment)
    WHERE w.completed_at IS NOT NULL AND s.expires_at+interval '7 days'<=statement_timestamp()
    ORDER BY w.requested_at LIMIT p_limit
  ), removed AS(
    DELETE FROM public.musicdna_export_withdrawals w USING candidates c
    WHERE (w.source_key,w.environment,w.subject_hash)=(c.source_key,c.environment,c.subject_hash) RETURNING w.subject_hash
  ) SELECT count(*)::integer INTO v_count FROM removed;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_completed_musicdna_learning_withdrawals(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_completed_musicdna_learning_withdrawals(integer) TO service_role;
NOTIFY pgrst,'reload schema';
