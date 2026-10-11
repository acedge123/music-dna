ALTER TABLE public.songs
  DROP COLUMN IF EXISTS groove,
  DROP COLUMN IF EXISTS darkness,
  DROP COLUMN IF EXISTS hope,
  DROP COLUMN IF EXISTS nostalgia,
  DROP COLUMN IF EXISTS complexity,
  DROP COLUMN IF EXISTS melody,
  DROP COLUMN IF EXISTS verbal_cleverness,
  DROP COLUMN IF EXISTS authenticity,
  DROP COLUMN IF EXISTS romanticism,
  DROP COLUMN IF EXISTS energy,
  DROP COLUMN IF EXISTS dreaminess;

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS immersion   smallint,
  ADD COLUMN IF NOT EXISTS scale       smallint,
  ADD COLUMN IF NOT EXISTS perspective smallint,
  ADD COLUMN IF NOT EXISTS confidence  smallint,
  ADD COLUMN IF NOT EXISTS tension     smallint,
  ADD COLUMN IF NOT EXISTS texture     smallint;

INSERT INTO public.axes (key, analyst_label, low_pole, high_pole, tradeoff_sentence, sort_order)
VALUES (
  'transformation',
  'transformation',
  'holds its shape',
  'takes you somewhere',
  'Should a song leave you where it found you, or take you somewhere else?',
  10
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.pairings SET tests = ARRAY[]::text[];