-- Durable operational heartbeat only; no evidence, identity or credential content.
CREATE TABLE public.musicdna_learning_worker_status (
 source_key text NOT NULL, environment text NOT NULL,
 run_id uuid NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 state text NOT NULL CHECK(state IN ('started','completed','failed')),
 last_success_at timestamptz, delivered integer NOT NULL DEFAULT 0 CHECK(delivered>=0),
 attention boolean NOT NULL DEFAULT false,
 PRIMARY KEY(source_key,environment), FOREIGN KEY(source_key,environment) REFERENCES public.musicdna_export_scopes
);
REVOKE ALL ON public.musicdna_learning_worker_status FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.musicdna_learning_worker_status TO service_role;
ALTER TABLE public.musicdna_learning_worker_status ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.record_musicdna_learning_worker_run(p_run_id uuid,p_state text,p_delivered integer DEFAULT 0,p_attention boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='10s' AS $$
BEGIN
 IF p_run_id IS NULL OR p_state NOT IN ('started','completed','failed') OR p_delivered IS NULL OR p_delivered NOT BETWEEN 0 AND 100 OR p_attention IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_run_receipt';END IF;
 IF p_state='started' THEN
  INSERT INTO public.musicdna_learning_worker_status(source_key,environment,run_id,state) VALUES('music-dna','production',p_run_id,'started')
  ON CONFLICT(source_key,environment) DO UPDATE SET run_id=p_run_id,started_at=now(),finished_at=NULL,state='started',delivered=0,attention=false;
 ELSE
  UPDATE public.musicdna_learning_worker_status SET state=p_state,finished_at=now(),delivered=p_delivered,attention=p_attention,
   last_success_at=CASE WHEN p_state='completed' THEN now() ELSE last_success_at END WHERE source_key='music-dna' AND environment='production' AND run_id=p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='stale_run_receipt';END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_musicdna_learning_worker_run(uuid,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_musicdna_learning_worker_run(uuid,text,integer,boolean) TO service_role;
