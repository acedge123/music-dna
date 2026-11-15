ALTER TABLE public.staged_opener_songs DROP CONSTRAINT staged_opener_songs_status_check;
ALTER TABLE public.staged_opener_songs ADD CONSTRAINT staged_opener_songs_status_check CHECK(status IN ('unmatched','matched','scoring','scoring_failed','pending_review','rejected','promoted'));
CREATE FUNCTION public.validate_musicdna_intake_promotion() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status='promoted' AND OLD.status IS DISTINCT FROM 'promoted' THEN
  IF jsonb_typeof(OLD.ai_draft->'year') IS DISTINCT FROM 'number' OR coalesce(OLD.ai_draft->>'lane','') NOT IN ('alternative','pop','hip_hop','electronic','classic_rock','metal','country','r_and_b','yacht_rock','disco','punk','reggae','general') THEN RAISE EXCEPTION 'invalid_intake_metadata'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_musicdna_intake_promotion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER intake_validate_promotion BEFORE UPDATE ON public.staged_opener_songs FOR EACH ROW EXECUTE FUNCTION public.validate_musicdna_intake_promotion();
CREATE FUNCTION public.lock_musicdna_intake_song_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.scoring_provenance->>'source'='listener_intake' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(NEW.title))||chr(31)||lower(btrim(NEW.artist)),0));
  IF EXISTS(SELECT 1 FROM public.songs WHERE lower(btrim(title))=lower(btrim(NEW.title)) AND lower(btrim(artist))=lower(btrim(NEW.artist))) THEN RAISE EXCEPTION 'catalog_song_exists_refresh'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.lock_musicdna_intake_song_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER songs_lock_intake_identity BEFORE INSERT ON public.songs FOR EACH ROW EXECUTE FUNCTION public.lock_musicdna_intake_song_identity();