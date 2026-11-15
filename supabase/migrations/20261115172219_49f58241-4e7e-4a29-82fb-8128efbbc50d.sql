CREATE TABLE public.staged_opener_songs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 identity_key text NOT NULL UNIQUE,
 cleaned_title text NOT NULL,
 cleaned_artist text NOT NULL DEFAULT '',
 matched_song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'unmatched' CHECK(status IN ('unmatched','matched','pending_review','rejected','promoted')),
 submission_count integer NOT NULL DEFAULT 0 CHECK(submission_count >= 0),
 ai_draft jsonb,
 scoring_model text,
 scoring_version text,
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.staged_opener_songs TO authenticated;
GRANT ALL ON public.staged_opener_songs TO service_role;
ALTER TABLE public.staged_opener_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_admin_read ON public.staged_opener_songs FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY intake_admin_update ON public.staged_opener_songs FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TRIGGER intake_song_updated BEFORE UPDATE ON public.staged_opener_songs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX intake_demand ON public.staged_opener_songs(status,submission_count DESC);

CREATE TABLE public.staged_opener_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 song_intake_id uuid NOT NULL REFERENCES public.staged_opener_songs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 batch_key text NOT NULL,
 position smallint NOT NULL CHECK(position BETWEEN 1 AND 3),
 raw_input text NOT NULL CHECK(length(raw_input) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,batch_key,position)
);
GRANT SELECT ON public.staged_opener_submissions TO authenticated;
GRANT ALL ON public.staged_opener_submissions TO service_role;
ALTER TABLE public.staged_opener_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_submissions_admin_read ON public.staged_opener_submissions FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TRIGGER intake_submission_updated BEFORE UPDATE ON public.staged_opener_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX intake_submissions_song ON public.staged_opener_submissions(song_intake_id);

CREATE FUNCTION public.capture_musicdna_opener_intake() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE raw text; title_part text; artist_part text; identity text; intake_id uuid; catalog_id uuid; batch text; n integer; inserted_id uuid;
BEGIN
 IF jsonb_typeof(NEW.opening_songs) IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
 IF jsonb_array_length(NEW.opening_songs) <> 3 THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF NEW.opening_songs IS NOT DISTINCT FROM OLD.opening_songs THEN RETURN NEW; END IF;
 END IF;
 batch := md5(NEW.opening_songs::text);
 FOR n IN 0..2 LOOP
  IF jsonb_typeof(NEW.opening_songs->n) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'invalid_opener_intake'; END IF;
  raw := btrim(NEW.opening_songs->>n);
  IF length(raw) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_opener_intake'; END IF;
  title_part := btrim((regexp_split_to_array(raw, '\s+[—–-]\s+'))[1]);
  artist_part := btrim(coalesce((regexp_split_to_array(raw, '\s+[—–-]\s+'))[2],''));
  identity := lower(regexp_replace(title_part,'\s+',' ','g')) || chr(31) || lower(regexp_replace(artist_part,'\s+',' ','g'));
  catalog_id := NULL;
  SELECT min(s.id::text)::uuid INTO catalog_id FROM public.songs s
   WHERE lower(s.title)=lower(title_part) AND (artist_part='' OR lower(s.artist)=lower(artist_part))
   HAVING count(*)=1;
  INSERT INTO public.staged_opener_songs(identity_key,cleaned_title,cleaned_artist,matched_song_id,status)
   VALUES(identity,title_part,artist_part,catalog_id,CASE WHEN catalog_id IS NULL THEN 'unmatched' ELSE 'matched' END)
   ON CONFLICT(identity_key) DO UPDATE SET identity_key=EXCLUDED.identity_key RETURNING id INTO intake_id;
  inserted_id := NULL;
  INSERT INTO public.staged_opener_submissions(song_intake_id,user_id,batch_key,position,raw_input)
   VALUES(intake_id,NEW.user_id,batch,n+1,raw)
   ON CONFLICT(user_id,batch_key,position) DO NOTHING RETURNING id INTO inserted_id;
  IF inserted_id IS NOT NULL THEN
   UPDATE public.staged_opener_songs SET submission_count=submission_count+1 WHERE id=intake_id;
  END IF;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.capture_musicdna_opener_intake() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profiles_capture_opener_intake AFTER INSERT OR UPDATE OF opening_songs ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.capture_musicdna_opener_intake();

CREATE FUNCTION public.remove_musicdna_opener_demand() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.staged_opener_songs SET submission_count=greatest(0,submission_count-1) WHERE id=OLD.song_intake_id;
 RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.remove_musicdna_opener_demand() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER intake_deleted_submission AFTER DELETE ON public.staged_opener_submissions FOR EACH ROW EXECUTE FUNCTION public.remove_musicdna_opener_demand();

CREATE FUNCTION public.promote_musicdna_opener_song(p_id uuid,p_expected_draft jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE candidate public.staged_opener_songs; d jsonb; song_id uuid; axis text; value numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO candidate FROM public.staged_opener_songs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'intake_not_found'; END IF;
 IF candidate.status='promoted' AND candidate.ai_draft=p_expected_draft THEN RETURN candidate.matched_song_id; END IF;
 IF candidate.status <> 'pending_review' OR candidate.ai_draft IS DISTINCT FROM p_expected_draft THEN RAISE EXCEPTION 'intake_changed_refresh'; END IF;
 d := candidate.ai_draft;
 IF coalesce(d->>'title','')='' OR coalesce(d->>'artist','')='' OR coalesce(d->>'rationale','')='' OR coalesce(d->>'identity_confident','false') <> 'true' THEN RAISE EXCEPTION 'unverified_song_identity'; END IF;
 IF (d->>'year')::integer NOT BETWEEN 1900 AND 2100 THEN RAISE EXCEPTION 'invalid_song_year'; END IF;
 IF d->>'lane' NOT IN ('alternative','pop','hip_hop','electronic','classic_rock','metal','country','r_and_b','yacht_rock','disco','punk','reggae','general') THEN RAISE EXCEPTION 'invalid_song_lane'; END IF;
 FOREACH axis IN ARRAY ARRAY['movement','atmosphere','immersion','scale','community','perspective','confidence','tension','texture','transformation'] LOOP
  IF jsonb_typeof(d->'scores'->axis) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_song_score'; END IF;
  value := (d->'scores'->>axis)::numeric;
  IF value<0 OR value>100 OR value<>trunc(value) THEN RAISE EXCEPTION 'invalid_song_score'; END IF;
 END LOOP;
 SELECT id INTO song_id FROM public.songs WHERE lower(title)=lower(btrim(d->>'title')) AND lower(artist)=lower(btrim(d->>'artist')) ORDER BY created_at LIMIT 1;
 IF song_id IS NULL THEN
  INSERT INTO public.songs(title,artist,year,lane,primary_lane,movement,atmosphere,immersion,scale,community,perspective,confidence,tension,texture,transformation,diagnostic_power,primary_dimensions,archetype_signals,active,rationale,scoring_version,scored_at,scoring_provenance)
   VALUES(btrim(d->>'title'),btrim(d->>'artist'),(d->>'year')::integer,d->>'lane',d->>'lane',
    (d->'scores'->>'movement')::integer,(d->'scores'->>'atmosphere')::integer,(d->'scores'->>'immersion')::integer,(d->'scores'->>'scale')::integer,(d->'scores'->>'community')::integer,(d->'scores'->>'perspective')::integer,(d->'scores'->>'confidence')::integer,(d->'scores'->>'tension')::integer,(d->'scores'->>'texture')::integer,(d->'scores'->>'transformation')::integer,
    0,ARRAY[]::text[],ARRAY[]::text[],false,d->>'rationale',candidate.scoring_version,now(),jsonb_build_object('source','listener_intake','model',candidate.scoring_model,'intake_id',p_id,'reviewed_by',auth.uid(),'reviewed_at',now(),'draft',d)) RETURNING id INTO song_id;
 END IF;
 UPDATE public.staged_opener_songs SET status='promoted',matched_song_id=song_id,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=p_id;
 RETURN song_id;
END; $$;
REVOKE ALL ON FUNCTION public.promote_musicdna_opener_song(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.promote_musicdna_opener_song(uuid,jsonb) TO authenticated,service_role;