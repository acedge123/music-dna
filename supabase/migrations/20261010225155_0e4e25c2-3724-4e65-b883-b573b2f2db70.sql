REVOKE SELECT ON public.pairings FROM anon, authenticated;
GRANT SELECT (id, song_a_id, song_b_id, tests, diagnostic_weight, active, created_at, updated_at, lane, user_facing_tradeoff, difficulty, is_bootstrap)
  ON public.pairings TO anon, authenticated;
GRANT ALL ON public.pairings TO service_role;
REVOKE SELECT ON public.pairings_with_songs FROM anon, authenticated;
GRANT SELECT ON public.pairings_with_songs TO service_role;