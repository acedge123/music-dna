CREATE OR REPLACE FUNCTION public.record_choice_atomic(
  p_session_id uuid,
  p_pairing_id uuid,
  p_chosen_song_id uuid,
  p_rejected_song_id uuid,
  p_ms_to_decide integer,
  p_mutation_id text,
  p_prior_vector jsonb,
  p_update jsonb,
  p_response jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.choices (session_id, pairing_id, chosen_song_id, rejected_song_id, ms_to_decide, mutation_id, response)
  VALUES (p_session_id, p_pairing_id, p_chosen_song_id, p_rejected_song_id, p_ms_to_decide, p_mutation_id, p_response);

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
$$;
REVOKE ALL ON FUNCTION public.record_choice_atomic(uuid, uuid, uuid, uuid, integer, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_choice_atomic(uuid, uuid, uuid, uuid, integer, text, jsonb, jsonb, jsonb) TO authenticated, service_role;