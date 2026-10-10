-- No backfill from mutable catalog data: NULL means historical evidence unavailable.
ALTER TABLE public.choices ADD COLUMN IF NOT EXISTS evidence jsonb;
REVOKE ALL ON FUNCTION public.record_choice_atomic(uuid, uuid, uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_choice_atomic(uuid, uuid, uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) TO authenticated, service_role;
-- Individual votes cannot be removed and recast. Reading/account deletion
-- remains possible through the sessions cascade or the trusted deletion service.
REVOKE DELETE ON public.choices FROM authenticated;

CREATE FUNCTION public.capture_choice_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  p record;
  chosen jsonb;
  rejected jsonb;
  catalog jsonb;
  contrasts jsonb;
  axes text[] := ARRAY['movement','atmosphere','immersion','scale','community',
    'perspective','confidence','tension','texture','transformation'];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW.session_id, NEW.pairing_id, NEW.chosen_song_id,
      NEW.rejected_song_id, NEW.created_at, NEW.ms_to_decide, NEW.mutation_id, NEW.evidence, NEW.response)
      IS DISTINCT FROM ROW(OLD.id, OLD.session_id, OLD.pairing_id, OLD.chosen_song_id,
      OLD.rejected_song_id, OLD.created_at, OLD.ms_to_decide, OLD.mutation_id, OLD.evidence, OLD.response) THEN
      RAISE EXCEPTION 'choice_evidence_is_immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT song_a_id, song_b_id, tests, diagnostic_weight, updated_at INTO p
    FROM public.pairings WHERE id = NEW.pairing_id;
  IF NOT FOUND OR NOT (
    (NEW.chosen_song_id = p.song_a_id AND NEW.rejected_song_id = p.song_b_id) OR
    (NEW.chosen_song_id = p.song_b_id AND NEW.rejected_song_id = p.song_a_id)
  ) OR NEW.rejected_song_id IS NULL THEN
    RAISE EXCEPTION 'invalid_pairing_evidence' USING ERRCODE = '23514';
  END IF;

  SELECT jsonb_build_object('id', s.id, 'title', s.title, 'artist', s.artist,
    'year', s.year, 'lane', s.lane, 'primary_lane', s.primary_lane,
    'values', (SELECT jsonb_object_agg(d, CASE WHEN jsonb_typeof(to_jsonb(s)->d) = 'number'
      THEN to_jsonb(s)->d ELSE 'null'::jsonb END) FROM unnest(axes) d))
    INTO chosen FROM public.songs s WHERE id = NEW.chosen_song_id;
  SELECT jsonb_build_object('id', s.id, 'title', s.title, 'artist', s.artist,
    'year', s.year, 'lane', s.lane, 'primary_lane', s.primary_lane,
    'values', (SELECT jsonb_object_agg(d, CASE WHEN jsonb_typeof(to_jsonb(s)->d) = 'number'
      THEN to_jsonb(s)->d ELSE 'null'::jsonb END) FROM unnest(axes) d))
    INTO rejected FROM public.songs s WHERE id = NEW.rejected_song_id;
  IF chosen IS NULL OR rejected IS NULL THEN
    RAISE EXCEPTION 'song_evidence_unavailable' USING ERRCODE = '23514';
  END IF;
  catalog := jsonb_build_object('pairing_revision', p.updated_at,
    'tests', COALESCE((SELECT jsonb_agg(d ORDER BY d) FROM
      (SELECT DISTINCT unnest(p.tests) d) t WHERE d = ANY(axes)), '[]'::jsonb),
    'diagnostic_weight', p.diagnostic_weight, 'chosen', chosen, 'rejected', rejected);
  -- The atomic RPC supplies the exact catalog used to score. A concurrent
  -- catalog edit must roll back and retry, not save a different ledger.
  IF NEW.response ? '_expected_catalog' AND
    (NEW.response->'_expected_catalog') IS DISTINCT FROM catalog THEN
    RAISE EXCEPTION 'stale_choice_catalog' USING ERRCODE = '40001';
  END IF;
  NEW.response := NEW.response - '_expected_catalog';
  SELECT COALESCE(jsonb_object_agg(d, (chosen->'values'->>d)::numeric -
    (rejected->'values'->>d)::numeric), '{}'::jsonb) INTO contrasts
    FROM jsonb_array_elements_text(catalog->'tests') d
    WHERE jsonb_typeof(chosen->'values'->d) = 'number'
      AND jsonb_typeof(rejected->'values'->d) = 'number';
  NEW.evidence := jsonb_build_object('version', 'choice-evidence-v1',
    'source', 'pairing', 'choice_id', NEW.id, 'session_id', NEW.session_id,
    'pairing_id', NEW.pairing_id, 'song_a_id', p.song_a_id, 'song_b_id', p.song_b_id, 'created_at', NEW.created_at,
    'ms_to_decide', NEW.ms_to_decide, 'mutation_id', NEW.mutation_id,
    'catalog_revision', md5(catalog::text), 'catalog', catalog, 'contrasts', contrasts);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_choice_evidence() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER choices_capture_evidence BEFORE INSERT OR UPDATE ON public.choices
  FOR EACH ROW EXECUTE FUNCTION public.capture_choice_evidence();
