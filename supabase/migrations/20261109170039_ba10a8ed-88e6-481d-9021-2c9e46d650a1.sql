CREATE TABLE public.song_artwork (
 song_id uuid PRIMARY KEY REFERENCES public.songs(id) ON DELETE CASCADE,
 recording_mbid uuid,
 release_mbid uuid,
 release_title text,
 release_artist text,
 release_date text,
 source text NOT NULL DEFAULT 'cover_art_archive',
 candidate_image_url text,
 match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched','candidate','verified','ambiguous','not_found','upstream_error')),
 match_score smallint CHECK (match_score BETWEEN 0 AND 100),
 rights_status text NOT NULL DEFAULT 'unreviewed' CHECK (rights_status IN ('unreviewed','permission_granted','licensed','rejected')),
 rights_reference text,
 image_url text,
 attribution text,
 display_enabled boolean NOT NULL DEFAULT false,
 checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_artwork TO authenticated;
GRANT ALL ON public.song_artwork TO service_role;
ALTER TABLE public.song_artwork ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved artwork read" ON public.song_artwork FOR SELECT TO authenticated USING (display_enabled AND match_status = 'verified' AND rights_status IN ('permission_granted','licensed') AND image_url IS NOT NULL);
CREATE POLICY "Artwork admin review" ON public.song_artwork FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE FUNCTION public.validate_song_artwork() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.display_enabled AND (NEW.match_status <> 'verified' OR NEW.rights_status NOT IN ('permission_granted','licensed') OR NULLIF(btrim(NEW.rights_reference),'') IS NULL OR NEW.image_url IS NULL OR NEW.image_url !~ '^https://') THEN
  RAISE EXCEPTION 'Artwork requires verified release, documented rights and an HTTPS image before display';
 END IF;
 IF NEW.candidate_image_url IS NOT NULL AND NEW.candidate_image_url !~ '^https://' THEN
  RAISE EXCEPTION 'Candidate artwork URL must use HTTPS';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_song_artwork() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER song_artwork_validate BEFORE INSERT OR UPDATE ON public.song_artwork FOR EACH ROW EXECUTE FUNCTION public.validate_song_artwork();
CREATE TRIGGER song_artwork_updated_at BEFORE UPDATE ON public.song_artwork FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
COMMENT ON TABLE public.song_artwork IS 'Release-specific artwork review. Retrieval is not copyright permission; display remains opt-in after editorial and rights verification.';