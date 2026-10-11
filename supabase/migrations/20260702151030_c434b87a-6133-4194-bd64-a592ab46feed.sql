CREATE OR REPLACE VIEW public.pairings_with_songs AS
SELECT
  p.*,
  sa.title        AS song_a_title,
  sa.artist       AS song_a_artist,
  sa.primary_lane AS song_a_primary_lane,
  sa.year         AS song_a_year,
  sb.title        AS song_b_title,
  sb.artist       AS song_b_artist,
  sb.primary_lane AS song_b_primary_lane,
  sb.year         AS song_b_year
FROM public.pairings p
LEFT JOIN public.songs sa ON sa.id = p.song_a_id
LEFT JOIN public.songs sb ON sb.id = p.song_b_id;

GRANT SELECT ON public.pairings_with_songs TO authenticated;
GRANT SELECT ON public.pairings_with_songs TO service_role;