
-- 1. New DPS component columns on songs (nullable = unscored)
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS polarization smallint CHECK (polarization BETWEEN 0 AND 25),
  ADD COLUMN IF NOT EXISTS tradeoff_richness smallint CHECK (tradeoff_richness BETWEEN 0 AND 20),
  ADD COLUMN IF NOT EXISTS pairing_density smallint CHECK (pairing_density BETWEEN 0 AND 15),
  ADD COLUMN IF NOT EXISTS identity_signaling smallint CHECK (identity_signaling BETWEEN 0 AND 15),
  ADD COLUMN IF NOT EXISTS longevity smallint CHECK (longevity BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS cross_genre_mapping smallint CHECK (cross_genre_mapping BETWEEN 0 AND 15),
  ADD COLUMN IF NOT EXISTS canon_score smallint CHECK (canon_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS curator_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diagnostic_power_confidence numeric(3,2) NOT NULL DEFAULT 0
    CHECK (diagnostic_power_confidence BETWEEN 0 AND 1);

-- 2. Trigger: auto-derive diagnostic_power when all six components are set
CREATE OR REPLACE FUNCTION public.songs_sync_diagnostic_power()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.polarization IS NOT NULL
     AND NEW.tradeoff_richness IS NOT NULL
     AND NEW.pairing_density IS NOT NULL
     AND NEW.identity_signaling IS NOT NULL
     AND NEW.longevity IS NOT NULL
     AND NEW.cross_genre_mapping IS NOT NULL THEN
    NEW.diagnostic_power := NEW.polarization
                          + NEW.tradeoff_richness
                          + NEW.pairing_density
                          + NEW.identity_signaling
                          + NEW.longevity
                          + NEW.cross_genre_mapping;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS songs_sync_dps ON public.songs;
CREATE TRIGGER songs_sync_dps
  BEFORE INSERT OR UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.songs_sync_diagnostic_power();

-- 3. Axes table
CREATE TABLE IF NOT EXISTS public.axes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  low_pole text NOT NULL,
  high_pole text NOT NULL,
  analyst_label text,
  tradeoff_sentence text,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.axes TO authenticated;
GRANT ALL ON public.axes TO service_role;
ALTER TABLE public.axes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "axes readable by authenticated" ON public.axes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "axes admin write" ON public.axes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER axes_updated_at BEFORE UPDATE ON public.axes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. song_axes join
CREATE TABLE IF NOT EXISTS public.song_axes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  axis_id uuid NOT NULL REFERENCES public.axes(id) ON DELETE CASCADE,
  strength smallint NOT NULL DEFAULT 50 CHECK (strength BETWEEN 0 AND 100),
  pole text NOT NULL DEFAULT 'mid' CHECK (pole IN ('low','high','mid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (song_id, axis_id)
);

CREATE INDEX IF NOT EXISTS song_axes_song_idx ON public.song_axes(song_id);
CREATE INDEX IF NOT EXISTS song_axes_axis_idx ON public.song_axes(axis_id);

GRANT SELECT ON public.song_axes TO authenticated;
GRANT ALL ON public.song_axes TO service_role;
ALTER TABLE public.song_axes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "song_axes readable by authenticated" ON public.song_axes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_axes admin write" ON public.song_axes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER song_axes_updated_at BEFORE UPDATE ON public.song_axes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed the eight axes
INSERT INTO public.axes (key, low_pole, high_pole, analyst_label, tradeoff_sentence, sort_order) VALUES
  ('movement',   'stillness',     'forward motion',         'movement',   'Do you want a song that holds you still, or one that pushes you forward?', 1),
  ('atmosphere', 'statement',     'immersive mood',         'atmosphere','Should a song make a statement, or pull you into a mood?', 2),
  ('immersion',  'immediacy',     'slow reveal',            'immersion',  'Do you want the hook on contact, or a song that opens up over time?', 3),
  ('scale',      'intimate',      'vast',                   'scale',      'Do you want music that feels close to your face, or huge around you?', 4),
  ('community',  'solitary',      'communal/singalong',     'community',  'Is music something you disappear into alone, or sing with a room?', 5),
  ('story',      'vibe',          'narrative/verbal witness','story',     'Do you want a feeling, or someone telling you what happened?', 6),
  ('confidence', 'vulnerability', 'command/defiance',       'confidence', 'Do you want a song that admits something, or one that asserts something?', 7),
  ('tension',    'release',       'danger/pressure',        'tension',    'Should a song let you exhale, or keep the pressure on?', 8)
ON CONFLICT (key) DO NOTHING;
