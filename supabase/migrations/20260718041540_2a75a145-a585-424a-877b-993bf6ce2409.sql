CREATE OR REPLACE VIEW public.pairing_recognition
WITH (security_invoker = true) AS
SELECT
  p.id AS pairing_id,
  p.lane,
  p.is_bootstrap,
  p.active,
  p.diagnostic_weight,
  sa.id AS song_a_id,
  sb.id AS song_b_id,
  COALESCE(sa.canon_score, 0) AS song_a_canon,
  COALESCE(sb.canon_score, 0) AS song_b_canon,
  ((COALESCE(sa.canon_score, 0) + COALESCE(sb.canon_score, 0))::numeric / 2.0) AS avg_canon,
  LEAST(COALESCE(sa.canon_score, 0), COALESCE(sb.canon_score, 0)) AS min_canon,
  sa.year AS song_a_year,
  sb.year AS song_b_year,
  CASE
    WHEN sa.year IS NULL OR sb.year IS NULL THEN NULL
    ELSE ABS(sa.year - sb.year)
  END AS era_span_years,
  CASE
    WHEN sa.year IS NULL OR sb.year IS NULL THEN NULL
    ELSE ((sa.year + sb.year)::numeric / 2.0)
  END AS avg_year,
  CASE
    WHEN sa.year IS NULL OR sb.year IS NULL THEN 'unknown'
    WHEN ABS(sa.year - sb.year) > 15 THEN 'mixed'
    ELSE (FLOOR(((sa.year + sb.year) / 2.0) / 10) * 10)::text || 's'
  END AS era_bucket,
  COALESCE(
    ARRAY(
      SELECT UNNEST(sa.subculture)
      INTERSECT
      SELECT UNNEST(sb.subculture)
    ),
    ARRAY[]::text[]
  ) AS shared_subculture_slugs,
  COALESCE(array_length(
    ARRAY(
      SELECT UNNEST(sa.subculture)
      INTERSECT
      SELECT UNNEST(sb.subculture)
    ), 1), 0) AS shared_subcultures,
  (COALESCE(array_length(
    ARRAY(
      SELECT UNNEST(sa.subculture)
      INTERSECT
      SELECT UNNEST(sb.subculture)
    ), 1), 0) = 0) AS cross_subculture,
  -- Recognition score: weight the *less* famous song more, penalize wide era splits.
  GREATEST(0,
    (0.6 * LEAST(COALESCE(sa.canon_score, 0), COALESCE(sb.canon_score, 0)))
    + (0.4 * ((COALESCE(sa.canon_score, 0) + COALESCE(sb.canon_score, 0))::numeric / 2.0))
    - CASE
        WHEN sa.year IS NOT NULL AND sb.year IS NOT NULL AND ABS(sa.year - sb.year) > 15 THEN 10
        ELSE 0
      END
  )::numeric AS recognition_score
FROM public.pairings p
JOIN public.songs sa ON sa.id = p.song_a_id
JOIN public.songs sb ON sb.id = p.song_b_id;

GRANT SELECT ON public.pairing_recognition TO authenticated, anon;
