-- Operator diagnostics only. Aggregate catalog metadata; no listener records.
-- Review uncovered songs/pairings before any import or activation.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
WITH paired AS (
  SELECT song_a_id AS song_id FROM public.pairings WHERE active
  UNION SELECT song_b_id FROM public.pairings WHERE active
)
SELECT s.primary_lane AS lane,
  count(*) AS active_songs,
  count(*) FILTER (WHERE p.song_id IS NOT NULL) AS songs_in_active_matchups,
  count(*) FILTER (WHERE p.song_id IS NULL) AS songs_without_active_matchups
FROM public.songs s LEFT JOIN paired p ON p.song_id=s.id
WHERE s.active GROUP BY s.primary_lane ORDER BY s.primary_lane;
SELECT lane, count(*) AS active_matchups,
  count(*) FILTER (WHERE is_bootstrap) AS marked_bootstrap_matchups,
  count(*) FILTER (WHERE tests IS NULL OR cardinality(tests)=0) AS missing_declared_tests
FROM public.pairings WHERE active GROUP BY lane ORDER BY lane;
COMMIT;
