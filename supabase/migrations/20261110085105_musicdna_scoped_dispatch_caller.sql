-- Narrow API caller; no backend credential leaves Supabase.
CREATE TABLE public.musicdna_learning_worker_callers (
 source_key text NOT NULL, environment text NOT NULL,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 enabled boolean NOT NULL DEFAULT false, valid_until timestamptz NOT NULL,
 last_claim_at timestamptz,
 PRIMARY KEY(source_key,environment),
 FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes,
 CHECK(source_key='music-dna' AND environment='production')
);
REVOKE ALL ON public.musicdna_learning_worker_callers FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.musicdna_learning_worker_callers TO service_role;
ALTER TABLE public.musicdna_learning_worker_callers ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_musicdna_learning_worker(p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='10s' SET lock_timeout='5s' AS $$
DECLARE c public.musicdna_learning_worker_callers; s public.musicdna_learning_worker_status; v_id uuid;
BEGIN
 SELECT * INTO c FROM public.musicdna_learning_worker_callers WHERE source_key='music-dna' AND environment='production' AND token_hash=p_token_hash AND valid_until>statement_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='unauthorized';END IF;
 IF NOT c.enabled THEN RETURN '{"state":"disabled"}'::jsonb;END IF;
 SELECT * INTO s FROM public.musicdna_learning_worker_status WHERE source_key=c.source_key AND environment=c.environment;
 IF s.state='started' AND s.started_at>statement_timestamp()-interval '2 minutes' THEN RETURN '{"state":"busy"}'::jsonb;END IF;
 IF c.last_claim_at>statement_timestamp()-interval '5 minutes' THEN RETURN '{"state":"rate_limited"}'::jsonb;END IF;
 v_id:=gen_random_uuid();
 PERFORM public.record_musicdna_learning_worker_run(v_id,'started',0,false);
 UPDATE public.musicdna_learning_worker_callers SET last_claim_at=clock_timestamp() WHERE source_key=c.source_key AND environment=c.environment;
 RETURN jsonb_build_object('state','leased','run_id',v_id);
END $$;
REVOKE ALL ON FUNCTION public.claim_musicdna_learning_worker(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_musicdna_learning_worker(text) TO service_role;
