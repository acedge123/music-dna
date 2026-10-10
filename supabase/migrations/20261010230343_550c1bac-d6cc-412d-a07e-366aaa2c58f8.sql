ALTER TABLE public.choices ADD COLUMN IF NOT EXISTS evidence jsonb;

DROP FUNCTION IF EXISTS public.record_choice_atomic(uuid, uuid, uuid, uuid, integer, text, jsonb, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.record_choice_atomic(p_session_id uuid, p_pairing_id uuid, p_chosen_song_id uuid, p_rejected_song_id uuid, p_ms_to_decide integer, p_mutation_id text, p_prior_vector jsonb, p_update jsonb, p_response jsonb, p_evidence jsonb DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.choices (session_id, pairing_id, chosen_song_id, rejected_song_id, ms_to_decide, mutation_id, response, evidence)
  VALUES (p_session_id, p_pairing_id, p_chosen_song_id, p_rejected_song_id, p_ms_to_decide, p_mutation_id, p_response, p_evidence);

  UPDATE public.sessions SET
    vector = p_update->'vector',
    lane = COALESCE(p_update->>'lane', lane),
    lane_confidence = COALESCE((p_update->>'lane_confidence')::numeric, lane_confidence),
    probe_state = COALESCE(p_update->'probe_state', probe_state),
    bootstrap_choices_json = COALESCE(p_update->'bootstrap_choices_json', bootstrap_choices_json)
  WHERE id = p_session_id AND user_id = auth.uid() AND vector = p_prior_vector;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'stale_session_vector' USING ERRCODE = '40001';
  END IF;
  RETURN 'ok';
END;
$function$;

-- Evidence snapshots are written once, at pick time, and never edited.
CREATE OR REPLACE FUNCTION public.choices_freeze_evidence()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.evidence IS NOT NULL AND NEW.evidence IS DISTINCT FROM OLD.evidence THEN
    RAISE EXCEPTION 'choice evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER choices_freeze_evidence_trg BEFORE UPDATE ON public.choices
  FOR EACH ROW EXECUTE FUNCTION public.choices_freeze_evidence();

-- Reactions: one durable record per tap, shared by web and mobile.
CREATE TABLE public.session_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pairing_id uuid REFERENCES public.pairings(id),
  kind text NOT NULL,
  client text NOT NULL,
  mutation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, mutation_id)
);
GRANT SELECT ON public.session_reactions TO authenticated;
GRANT ALL ON public.session_reactions TO service_role;
ALTER TABLE public.session_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read their reactions" ON public.session_reactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);