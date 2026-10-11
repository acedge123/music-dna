
-- 1. Reference table for subcultures vocabulary
CREATE TABLE public.subcultures (
  slug text PRIMARY KEY,
  label text NOT NULL,
  family text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subcultures TO anon, authenticated;
GRANT ALL ON public.subcultures TO service_role;

ALTER TABLE public.subcultures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcultures readable by all"
  ON public.subcultures FOR SELECT
  USING (true);

CREATE POLICY "subcultures admin write"
  ON public.subcultures FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Seed vocabulary from docs/musicdna/subcultures.md
INSERT INTO public.subcultures (slug, label, family, notes) VALUES
  ('post_punk',         'Post-punk',         'post_punk_new_wave', 'Angular, austere, art-school aftermath of punk.'),
  ('new_wave',          'New wave',          'post_punk_new_wave', 'Pop-adjacent post-punk.'),
  ('goth',              'Goth',              'post_punk_new_wave', 'Bauhaus, Sisters of Mercy, early Cure.'),
  ('darkwave',          'Darkwave',          'post_punk_new_wave', 'Synth-forward gothic.'),
  ('industrial',        'Industrial',        'post_punk_new_wave', 'NIN, Ministry, Skinny Puppy.'),
  ('shoegaze',          'Shoegaze',          'guitar_alt',         'Wall-of-guitar, buried vocals.'),
  ('dream_pop',         'Dream pop',         'guitar_alt',         'Melodic, gauzy.'),
  ('noise_pop',         'Noise pop',         'guitar_alt',         'Melody under distortion.'),
  ('britpop',           'Britpop',           'guitar_alt',         'Oasis, Blur, Pulp.'),
  ('indie_pop',         'Indie pop',         'guitar_alt',         'Smiths lineage, jangly.'),
  ('college_rock',      'College rock',      'guitar_alt',         'US 80s alternative.'),
  ('grunge',            'Grunge',            'guitar_alt',         'Nirvana, Soundgarden.'),
  ('alternative_rock',  'Alternative rock',  'guitar_alt',         '90s mainstream alt.'),
  ('punk',              'Punk',              'guitar_alt',         'Ramones, Clash, Pistols.'),
  ('hardcore',          'Hardcore',          'guitar_alt',         'Minor Threat, Black Flag, Fugazi.'),
  ('no_wave',           'No wave',           'guitar_alt',         'Late-70s NYC anti-rock.'),
  ('post_rock',         'Post-rock',         'guitar_alt',         'Slint, Mogwai, Godspeed.'),
  ('art_rock',          'Art rock',          'guitar_alt',         'Roxy Music, Berlin Bowie, Talk Talk.'),
  ('electronica',       'Electronica',       'dance_electronic',   'Umbrella for non-club electronic.'),
  ('club',              'Club',              'dance_electronic',   'House, techno, garage floor music.'),
  ('dance',             'Dance',             'dance_electronic',   'Pop-facing dance.'),
  ('madchester',        'Madchester',        'dance_electronic',   'Stone Roses, Happy Mondays.'),
  ('baggy',             'Baggy',             'dance_electronic',   'Loose-limbed madchester cousin.'),
  ('indie_dance',       'Indie dance',       'dance_electronic',   'Post-Madchester crossover.'),
  ('trip_hop',          'Trip-hop',          'dance_electronic',   'Portishead, Massive Attack.'),
  ('synth_pop',         'Synth-pop',         'dance_electronic',   'Depeche Mode, OMD, Human League.'),
  ('sophisti_pop',      'Sophisti-pop',      'pop_soul',           'Prefab Sprout, Style Council, Sade.');

-- 3. Add subculture[] column to songs
ALTER TABLE public.songs
  ADD COLUMN subculture text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.songs
  ADD CONSTRAINT songs_subculture_max_len CHECK (array_length(subculture, 1) IS NULL OR array_length(subculture, 1) <= 3);

-- 4. Trigger to validate every tag exists in the reference table
CREATE OR REPLACE FUNCTION public.songs_validate_subculture()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  bad text;
BEGIN
  IF NEW.subculture IS NULL OR array_length(NEW.subculture, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT s INTO bad
    FROM unnest(NEW.subculture) AS s
    WHERE s NOT IN (SELECT slug FROM public.subcultures);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown subculture slug: %', bad;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER songs_validate_subculture_trg
  BEFORE INSERT OR UPDATE OF subculture ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.songs_validate_subculture();

-- 5. Backfill from legacy lane
UPDATE public.songs SET subculture = CASE lane
  WHEN 'post_punk_new_wave'      THEN ARRAY['post_punk','new_wave']
  WHEN 'shoegaze_dreampop'       THEN ARRAY['shoegaze','dream_pop']
  WHEN 'goth_darkwave'           THEN ARRAY['goth','darkwave']
  WHEN 'britpop_indiepop'        THEN ARRAY['britpop','indie_pop']
  WHEN 'grunge_altrock'          THEN ARRAY['grunge','alternative_rock']
  WHEN 'manchester_indie_dance'  THEN ARRAY['madchester','indie_dance']
  WHEN 'electronic_crossover'    THEN ARRAY['electronica','club']
  WHEN 'artrock_experimental'    THEN ARRAY['art_rock']
  WHEN 'sophistipop_lyric_indie' THEN ARRAY['sophisti_pop','indie_pop']
  WHEN 'punk_noise_edge'         THEN ARRAY['punk','noise_pop']
  WHEN 'post-punk'               THEN ARRAY['post_punk']
  WHEN 'madchester'              THEN ARRAY['madchester']
  WHEN 'alt-rock'                THEN ARRAY['alternative_rock']
  ELSE ARRAY[]::text[]
END
WHERE lane IS NOT NULL;
