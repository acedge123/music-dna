-- Independent diagnostic component recalibration v2.
--
-- This intentionally recalibrates all active rows, including the 29 LLM/Lovable
-- rows, because the first pass over-scored broad consensus songs as if they
-- were polarizing identity probes.
--
-- Principle:
--   canon_score/routing_power can be high for universally known songs;
--   diagnostic_power should only be high when the song independently reveals
--   a meaningful taste tradeoff.
--
-- Inputs intentionally not used:
--   pairings, pairing winners/losers, app insight copy, user response logic.

BEGIN;

WITH lane_traits(lane, route_bias, scene_bias) AS (
  VALUES
    ('classic_rock', 12, 0),
    ('pop', 13, 0),
    ('hip_hop', 10, 1),
    ('electronic', 8, 2),
    ('metal', 9, 3),
    ('grunge_altrock', 8, 2),
    ('britpop_indiepop', 9, 1),
    ('post_punk_new_wave', 8, 2),
    ('artrock_experimental', 5, 3),
    ('electronic_crossover', 7, 2),
    ('manchester_indie_dance', 7, 3),
    ('goth_darkwave', 5, 3),
    ('punk_noise_edge', 6, 3),
    ('shoegaze_dreampop', 4, 3),
    ('sophistipop_lyric_indie', 5, 2),
    ('r_and_b', 10, 0),
    ('country', 10, 0),
    ('alt-rock', 6, 2),
    ('madchester', 5, 3),
    ('post-punk', 5, 2)
),
features AS (
  SELECT
    s.id,
    s.lane,
    s.canon_score,
    s.year,
    COALESCE(lt.route_bias, 6) AS route_bias,
    COALESCE(lt.scene_bias, 1) AS scene_bias,
    GREATEST(
      s.movement, s.atmosphere, s.transformation, s.community, s.immersion,
      s.scale, s.perspective, s.confidence, s.tension, s.texture
    ) - LEAST(
      s.movement, s.atmosphere, s.transformation, s.community, s.immersion,
      s.scale, s.perspective, s.confidence, s.tension, s.texture
    ) AS axis_spread,
    (
      (CASE WHEN s.movement NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.atmosphere NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.transformation NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.community NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.immersion NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.scale NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.perspective NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.confidence NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.tension NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN s.texture NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END)
    ) AS strong_axis_count,
    abs(s.movement - s.atmosphere) +
    abs(s.movement - s.immersion) +
    abs(s.community - s.perspective) +
    abs(s.confidence - s.tension) +
    abs(s.scale - s.texture) +
    abs(s.transformation - s.confidence) AS contrast_sum,
    COALESCE(cardinality(NULLIF(s.primary_dimensions, ARRAY[]::text[])), 0) AS primary_count,
    COALESCE(cardinality(NULLIF(s.archetype_signals, ARRAY[]::text[])), 0) AS signal_count,
    s.atmosphere,
    s.transformation,
    s.texture,
    s.perspective
  FROM public.songs AS s
  LEFT JOIN lane_traits AS lt
    ON lt.lane = s.lane
  WHERE s.active = true
),
raw AS (
  SELECT
    *,
    CASE
      WHEN year IS NULL THEN 4
      WHEN year <= 1989 AND canon_score >= 75 THEN 10
      WHEN year <= 1999 AND canon_score >= 70 THEN 9
      WHEN year <= 2009 AND canon_score >= 70 THEN 8
      WHEN year <= 2016 AND canon_score >= 70 THEN 6
      WHEN year <= 2020 AND canon_score >= 75 THEN 5
      WHEN canon_score >= 90 THEN 4
      WHEN canon_score >= 75 THEN 3
      ELSE 2
    END AS longevity_score,
    LEAST(25, GREATEST(3, ROUND(
      5
      + axis_spread * 0.12
      + strong_axis_count * 0.70
      + signal_count * 0.70
      + scene_bias
      + GREATEST(0, 75 - canon_score) / 12.0
      - CASE WHEN canon_score >= 90 THEN 4 WHEN canon_score >= 80 THEN 2 ELSE 0 END
    )))::integer AS raw_polarization,
    LEAST(20, GREATEST(4, ROUND(
      4
      + strong_axis_count * 1.05
      + primary_count * 1.25
      + signal_count * 0.75
      + contrast_sum / 100.0
    )))::integer AS raw_tradeoff_richness,
    LEAST(15, GREATEST(3, ROUND(
      3
      + strong_axis_count * 0.45
      + signal_count * 0.70
      + canon_score / 28.0
      + scene_bias * 0.35
    )))::integer AS raw_pairing_density,
    LEAST(15, GREATEST(3, ROUND(
      4
      + signal_count * 1.10
      + strong_axis_count * 0.50
      + axis_spread / 45.0
      + GREATEST(0, 85 - canon_score) / 18.0
      + scene_bias * 0.50
    )))::integer AS raw_identity_signaling,
    LEAST(15, GREATEST(3, ROUND(
      4
      + (atmosphere + transformation + texture + perspective) / 48.0
      + strong_axis_count * 0.25
      + canon_score / 40.0
    )))::integer AS raw_cross_genre_mapping
  FROM features
),
scored AS (
  SELECT
    id,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_polarization, 8)
      WHEN canon_score >= 90 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_polarization, 11)
      WHEN canon_score >= 85 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_polarization, 14)
      ELSE raw_polarization
    END AS polarization,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_tradeoff_richness, 14)
      WHEN canon_score >= 90 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_tradeoff_richness, 16)
      ELSE raw_tradeoff_richness
    END AS tradeoff_richness,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_pairing_density, 11)
      WHEN canon_score >= 90 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_pairing_density, 12)
      ELSE raw_pairing_density
    END AS pairing_density,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_identity_signaling, 7)
      WHEN canon_score >= 90 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_identity_signaling, 9)
      WHEN canon_score >= 85 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_identity_signaling, 10)
      ELSE raw_identity_signaling
    END AS identity_signaling,
    longevity_score AS longevity,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country') THEN LEAST(raw_cross_genre_mapping, 13)
      ELSE raw_cross_genre_mapping
    END AS cross_genre_mapping,
    LEAST(
      100,
      GREATEST(
        10,
        ROUND(
          canon_score * 0.74
          + route_bias
          - CASE WHEN axis_spread > 60 THEN 10 WHEN axis_spread > 45 THEN 6 ELSE 0 END
          - scene_bias * 0.8
        )
      )
    )::integer AS routing_power
  FROM raw
)
UPDATE public.songs AS s
SET polarization = scored.polarization,
    tradeoff_richness = scored.tradeoff_richness,
    pairing_density = scored.pairing_density,
    identity_signaling = scored.identity_signaling,
    longevity = scored.longevity,
    cross_genre_mapping = scored.cross_genre_mapping,
    routing_power = scored.routing_power,
    scoring_version = 'independent_vector_v2',
    scored_at = now(),
    scoring_provenance = jsonb_build_object(
      'method', 'deterministic_song_level_recalibration',
      'version', 'independent_vector_v2',
      'uses_pairings', false,
      'reviewed_lovable_rows', true,
      'bias_controls', ARRAY[
        'consensus_canon_polarization_cap',
        'consensus_identity_signaling_cap',
        'routing_separated_from_diagnostic_power',
        'no_pairing_table_inputs'
      ],
      'inputs', ARRAY[
        'axis_scores',
        'canon_score',
        'year',
        'lane',
        'primary_dimensions',
        'archetype_signals'
      ]
    ),
    updated_at = now()
FROM scored
WHERE s.id = scored.id;

COMMIT;
