-- The model runs outside a transaction. Only this short compare-and-save takes
-- the session row lock also acquired by record_choice_atomic's UPDATE.
-- Existing choice scoring/evidence, result versions and RLS are unchanged.
CREATE FUNCTION public.save_musicdna_deferred_read(
  p_session_id uuid,
  p_owner_id uuid,
  p_pairing_id uuid,
  p_answered integer,
  p_props jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '2s'
AS $$
DECLARE
  s record;
  latest_pairing uuid;
  answered integer;
  existing jsonb;
BEGIN
  IF p_owner_id IS NULL OR p_answered IS NULL OR p_answered < 1 OR p_pairing_id IS NULL
    OR p_props IS NULL OR jsonb_typeof(p_props) <> 'object'
    OR p_props->>'answered' IS DISTINCT FROM p_answered::text
    OR jsonb_typeof(p_props->'result') IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'invalid_read_cursor' USING ERRCODE = '22023'; END IF;

  SELECT user_id, completed_at INTO s FROM public.sessions
    WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.user_id IS DISTINCT FROM p_owner_id OR s.completed_at IS NOT NULL
    THEN RETURN NULL; END IF;
  SELECT count(*) INTO answered FROM public.choices WHERE session_id = p_session_id;
  SELECT pairing_id INTO latest_pairing FROM public.choices WHERE session_id = p_session_id
    ORDER BY created_at DESC, id DESC LIMIT 1;
  IF answered <> p_answered OR latest_pairing IS DISTINCT FROM p_pairing_id
    THEN RETURN NULL; END IF;

  -- Concurrent follow-ups replay the first saved result, not a new draft.
  SELECT props->'result' INTO existing FROM public.event_log
    WHERE session_id = p_session_id AND event_type = 'read_shown'
      AND props->>'answered' = p_answered::text
      AND jsonb_typeof(props->'result') = 'object'
    ORDER BY created_at DESC, id DESC LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  INSERT INTO public.event_log(user_id, session_id, event_type, props)
    VALUES(p_owner_id, p_session_id, 'read_shown', p_props);
  RETURN p_props->'result';
END;
$$;
REVOKE ALL ON FUNCTION public.save_musicdna_deferred_read(uuid, uuid, uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_musicdna_deferred_read(uuid, uuid, uuid, integer, jsonb) TO service_role;
