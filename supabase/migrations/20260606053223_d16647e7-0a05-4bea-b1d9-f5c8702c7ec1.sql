ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS primary_lane text NOT NULL DEFAULT 'alternative';

UPDATE public.songs
SET primary_lane = CASE
  WHEN lower(lane) IN ('alternative', 'pop', 'hip_hop', 'electronic', 'classic_rock', 'general')
    THEN lower(lane)
  WHEN lower(lane) IN (
    'post_punk_new_wave','post-punk','post_punk','new_wave',
    'goth_darkwave','manchester_indie_dance','madchester',
    'shoegaze_dreampop','shoegaze','dreampop',
    'britpop_indiepop','britpop','indiepop','indie',
    'grunge_altrock','grunge','altrock','alt-rock',
    'electronic_crossover','college_rock','sophistipop','noise_pop','artrock','art_rock'
  )
    THEN 'alternative'
  ELSE 'general'
END;

CREATE INDEX IF NOT EXISTS songs_primary_lane_idx
  ON public.songs (primary_lane)
  WHERE active;

COMMENT ON COLUMN public.songs.lane IS
  'Granular diagnostic catalog lane/sub-lane, such as post_punk_new_wave or shoegaze_dreampop.';

COMMENT ON COLUMN public.songs.primary_lane IS
  'Top-level MusicDNA routing lane. Pairings.lane should match both songs.primary_lane values.';