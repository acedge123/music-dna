ALTER TABLE public.pairings
  ADD COLUMN IF NOT EXISTS user_facing_tradeoff text,
  ADD COLUMN IF NOT EXISTS difficulty smallint;

ALTER TABLE public.pairings
  DROP CONSTRAINT IF EXISTS pairings_difficulty_check;
ALTER TABLE public.pairings
  ADD CONSTRAINT pairings_difficulty_check CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 3);

COMMENT ON COLUMN public.pairings.user_facing_tradeoff IS 'Plain-language tradeoff shown to users. Must pass the Friend Test: a non-critic reads it and instantly gets the choice. e.g. "Do you disappear into a song, or bring it into the room with you?"';
COMMENT ON COLUMN public.pairings.difficulty IS '1=obvious, 2=moderate, 3=painful. Used to ramp the session.';

CREATE INDEX IF NOT EXISTS pairings_difficulty_idx ON public.pairings (difficulty) WHERE active = true;