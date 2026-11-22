CREATE TABLE public.song_recognition (
 id uuid PRIMARY KEY,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 500),
 artist text NOT NULL CHECK(length(artist) BETWEEN 1 AND 500),
 year integer CHECK(year BETWEEN 1900 AND 2100),
 release_title text NOT NULL DEFAULT '',
 artist_mbid uuid NOT NULL,
 lane_hint text,
 lane_hint_source text,
 listen_count bigint NOT NULL DEFAULT 0 CHECK(listen_count >= 0),
 source_batch text NOT NULL,
 year_basis text NOT NULL DEFAULT 'MusicBrainz release-group first-release-date; recording year unverified',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.song_recognition TO anon, authenticated;
GRANT ALL ON public.song_recognition TO service_role;
ALTER TABLE public.song_recognition ENABLE ROW LEVEL SECURITY;
CREATE POLICY recognition_public_read ON public.song_recognition FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER recognition_updated BEFORE UPDATE ON public.song_recognition FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX recognition_title ON public.song_recognition(lower(title));
CREATE INDEX recognition_artist ON public.song_recognition(lower(artist));
COMMENT ON TABLE public.song_recognition IS 'Unscored public recognition metadata only; never a pairing/scoring source. ID is MusicBrainz recording MBID. Lane and release-group year are provisional hints, not verified recording facts.';