-- Independent Music DNA vector/component backfill.
--
-- Intent:
--   Score song vectors from song-level musical metadata only, without tuning
--   values to fit pairing outcomes or downstream insight copy.
--
-- Inputs used:
--   existing axis scores, canon_score, year, lane, primary_dimensions,
--   archetype_signals, and broad lane defaults for axis gaps.
--
-- Inputs intentionally not used:
--   pairings, pairing winners/losers, user response logic, insight templates.

BEGIN;

WITH pop_axis_overrides(artist, title, movement, atmosphere, transformation, community, immersion, scale, perspective, confidence, tension, texture, primary_dimensions) AS (
  VALUES
    ('Billie Eilish','Birds of a Feather',70,65,55,75,45,70,55,70,35,65,ARRAY['movement','community','atmosphere']::text[]),
    ('Carly Rae Jepsen','Run Away With Me',92,66,78,78,55,82,48,84,34,70,ARRAY['movement','scale','community']::text[]),
    ('Chappell Roan','Good Luck, Babe!',72,70,78,72,55,78,70,76,68,68,ARRAY['tension','transformation','perspective']::text[]),
    ('Charli XCX','Track 10',65,88,92,38,82,80,72,58,76,92,ARRAY['texture','transformation','immersion']::text[]),
    ('Harry Styles','As It Was',78,60,62,78,42,82,64,68,50,62,ARRAY['movement','community','scale']::text[]),
    ('Kacey Musgraves','Golden Hour',48,86,60,50,78,58,66,60,28,80,ARRAY['atmosphere','immersion','texture']::text[]),
    ('Madonna','Into the Groove',94,58,62,92,35,72,44,86,28,70,ARRAY['movement','community','confidence']::text[]),
    ('Miley Cyrus','Flowers',78,55,62,78,38,76,72,88,35,58,ARRAY['confidence','community','movement']::text[]),
    ('NewJeans','Ditto',70,82,58,62,62,52,64,58,42,78,ARRAY['atmosphere','texture','movement']::text[]),
    ('Robyn','Dancing On My Own',86,78,78,70,58,82,68,72,72,74,ARRAY['movement','tension','transformation']::text[]),
    ('Taylor Swift','Anti-Hero',74,62,58,76,38,78,74,62,56,58,ARRAY['perspective','community','movement']::text[]),
    ('The Weeknd','Blinding Lights',94,66,74,90,36,94,48,88,46,72,ARRAY['movement','scale','community']::text[]),
    ('Whitney Houston','I Wanna Dance with Somebody',95,62,60,95,35,90,45,92,40,64,ARRAY['movement','community','confidence']::text[])
)
UPDATE public.songs AS s
SET movement = p.movement,
    atmosphere = p.atmosphere,
    transformation = p.transformation,
    community = p.community,
    immersion = p.immersion,
    scale = p.scale,
    perspective = p.perspective,
    confidence = p.confidence,
    tension = p.tension,
    texture = p.texture,
    primary_dimensions = p.primary_dimensions,
    updated_at = now()
FROM pop_axis_overrides AS p
WHERE s.active = true
  AND s.lane = 'pop'
  AND s.artist = p.artist
  AND s.title = p.title
  AND (
    s.immersion IS NULL
    OR s.scale IS NULL
    OR s.perspective IS NULL
    OR s.confidence IS NULL
    OR s.tension IS NULL
    OR s.texture IS NULL
    OR s.primary_dimensions = ARRAY[]::text[]
  );

WITH lane_defaults(lane, immersion, scale, perspective, confidence, tension, texture, routing_bias) AS (
  VALUES
    ('classic_rock',50,82,56,78,48,58,12),
    ('pop',42,76,58,78,42,60,13),
    ('hip_hop',58,68,72,76,64,70,10),
    ('electronic',70,68,45,62,56,86,8),
    ('metal',72,82,50,72,78,74,9),
    ('grunge_altrock',60,70,62,58,74,72,8),
    ('britpop_indiepop',44,62,64,64,46,56,9),
    ('post_punk_new_wave',56,58,68,58,62,70,8),
    ('artrock_experimental',72,68,72,50,62,80,5),
    ('electronic_crossover',72,70,50,66,56,84,7),
    ('manchester_indie_dance',66,68,52,66,42,74,7),
    ('goth_darkwave',74,66,70,46,78,82,5),
    ('punk_noise_edge',42,58,62,72,82,68,6),
    ('shoegaze_dreampop',84,62,62,44,52,92,4),
    ('sophistipop_lyric_indie',58,52,82,52,46,58,5),
    ('r_and_b',60,56,62,66,48,66,10),
    ('country',54,54,72,62,54,54,10),
    ('alt-rock',58,64,58,62,62,72,6),
    ('madchester',72,70,55,62,48,76,5),
    ('post-punk',62,56,70,52,64,72,5)
),
song_vectors AS (
  SELECT
    s.id,
    s.lane,
    s.artist,
    s.title,
    s.year,
    s.canon_score,
    COALESCE(s.movement, 50)::integer AS movement,
    COALESCE(s.atmosphere, 50)::integer AS atmosphere,
    COALESCE(s.transformation, 50)::integer AS transformation,
    COALESCE(s.community, 50)::integer AS community,
    COALESCE(s.immersion, ld.immersion, 50)::integer AS immersion,
    COALESCE(s.scale, ld.scale, 50)::integer AS scale,
    COALESCE(s.perspective, ld.perspective, 50)::integer AS perspective,
    COALESCE(s.confidence, ld.confidence, 50)::integer AS confidence,
    COALESCE(s.tension, ld.tension, 50)::integer AS tension,
    COALESCE(s.texture, ld.texture, 50)::integer AS texture,
    COALESCE(cardinality(NULLIF(s.primary_dimensions, ARRAY[]::text[])), 0) AS primary_count,
    COALESCE(cardinality(NULLIF(s.archetype_signals, ARRAY[]::text[])), 0) AS signal_count,
    COALESCE(ld.routing_bias, 6) AS routing_bias
  FROM public.songs AS s
  LEFT JOIN lane_defaults AS ld
    ON ld.lane = s.lane
  WHERE s.active = true
),
features AS (
  SELECT
    *,
    GREATEST(
      movement, atmosphere, transformation, community, immersion,
      scale, perspective, confidence, tension, texture
    ) - LEAST(
      movement, atmosphere, transformation, community, immersion,
      scale, perspective, confidence, tension, texture
    ) AS axis_spread,
    (
      (CASE WHEN movement NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN atmosphere NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN transformation NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN community NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN immersion NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN scale NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN perspective NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN confidence NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN tension NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END) +
      (CASE WHEN texture NOT BETWEEN 35 AND 65 THEN 1 ELSE 0 END)
    ) AS strong_axis_count,
    abs(movement - atmosphere) +
    abs(movement - immersion) +
    abs(community - perspective) +
    abs(confidence - tension) +
    abs(scale - texture) +
    abs(transformation - confidence) AS contrast_sum,
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
    END AS longevity_score
  FROM song_vectors
),
scored AS (
  SELECT
    id,
    immersion,
    scale,
    perspective,
    confidence,
    tension,
    texture,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country')
      THEN LEAST(11, LEAST(25, GREATEST(3, ROUND(axis_spread * 0.22 + strong_axis_count * 1.4 + signal_count * 1.1 - canon_score * 0.03))))::integer
      WHEN canon_score >= 90 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country')
      THEN LEAST(14, LEAST(25, GREATEST(3, ROUND(axis_spread * 0.22 + strong_axis_count * 1.4 + signal_count * 1.1 - canon_score * 0.03))))::integer
      ELSE LEAST(25, GREATEST(3, ROUND(axis_spread * 0.22 + strong_axis_count * 1.4 + signal_count * 1.1 - canon_score * 0.03)))::integer
    END AS polarization,
    LEAST(20, GREATEST(4, ROUND(strong_axis_count * 1.55 + primary_count * 1.6 + signal_count * 1.2 + contrast_sum / 55.0)))::integer AS tradeoff_richness,
    LEAST(15, GREATEST(3, ROUND(strong_axis_count * 0.75 + signal_count * 1.15 + canon_score / 18.0)))::integer AS pairing_density,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country')
      THEN LEAST(8, LEAST(15, GREATEST(3, ROUND(signal_count * 1.8 + strong_axis_count * 0.9 + (100 - canon_score) / 18.0 + axis_spread / 30.0))))::integer
      WHEN canon_score >= 90 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country')
      THEN LEAST(10, LEAST(15, GREATEST(3, ROUND(signal_count * 1.8 + strong_axis_count * 0.9 + (100 - canon_score) / 18.0 + axis_spread / 30.0))))::integer
      ELSE LEAST(15, GREATEST(3, ROUND(signal_count * 1.8 + strong_axis_count * 0.9 + (100 - canon_score) / 18.0 + axis_spread / 30.0)))::integer
    END AS identity_signaling,
    longevity_score::integer AS longevity,
    LEAST(15, GREATEST(3, ROUND((atmosphere + transformation + texture + perspective) / 34.0 + strong_axis_count * 0.45 + canon_score / 28.0)))::integer AS cross_genre_mapping,
    LEAST(100, GREATEST(10, ROUND(canon_score * 0.72 + routing_bias + CASE WHEN axis_spread > 55 THEN -8 WHEN axis_spread > 40 THEN -4 ELSE 0 END)))::integer AS routing_power,
    LEAST(1.00, GREATEST(0.55, ROUND((0.62 + signal_count * 0.05 + primary_count * 0.04 + LEAST(canon_score, 95) / 950.0)::numeric, 2))) AS diagnostic_power_confidence
  FROM features
)
UPDATE public.songs AS s
SET immersion = COALESCE(s.immersion, scored.immersion),
    scale = COALESCE(s.scale, scored.scale),
    perspective = COALESCE(s.perspective, scored.perspective),
    confidence = COALESCE(s.confidence, scored.confidence),
    tension = COALESCE(s.tension, scored.tension),
    texture = COALESCE(s.texture, scored.texture),
    polarization = COALESCE(s.polarization, scored.polarization),
    tradeoff_richness = COALESCE(s.tradeoff_richness, scored.tradeoff_richness),
    pairing_density = COALESCE(s.pairing_density, scored.pairing_density),
    identity_signaling = COALESCE(s.identity_signaling, scored.identity_signaling),
    longevity = COALESCE(s.longevity, scored.longevity),
    cross_genre_mapping = COALESCE(s.cross_genre_mapping, scored.cross_genre_mapping),
    routing_power = COALESCE(s.routing_power, scored.routing_power),
    diagnostic_power_confidence = CASE
      WHEN s.diagnostic_power_confidence IS NULL OR s.diagnostic_power_confidence = 0
      THEN scored.diagnostic_power_confidence
      ELSE s.diagnostic_power_confidence
    END,
    scoring_version = COALESCE(s.scoring_version, 'independent_vector_v1'),
    scored_at = COALESCE(s.scored_at, now()),
    scoring_provenance = COALESCE(
      s.scoring_provenance,
      jsonb_build_object(
        'method', 'deterministic_song_level_backfill',
        'version', 'independent_vector_v1',
        'uses_pairings', false,
        'inputs', ARRAY[
          'axis_scores',
          'canon_score',
          'year',
          'lane',
          'primary_dimensions',
          'archetype_signals'
        ]
      )
    ),
    updated_at = now()
FROM scored
WHERE s.id = scored.id
  AND (
    s.polarization IS NULL
    OR s.tradeoff_richness IS NULL
    OR s.pairing_density IS NULL
    OR s.identity_signaling IS NULL
    OR s.longevity IS NULL
    OR s.cross_genre_mapping IS NULL
    OR s.immersion IS NULL
    OR s.scale IS NULL
    OR s.perspective IS NULL
    OR s.confidence IS NULL
    OR s.tension IS NULL
    OR s.texture IS NULL
    OR s.routing_power IS NULL
    OR s.scoring_version IS NULL
    OR s.scored_at IS NULL
    OR s.scoring_provenance IS NULL
  );

WITH recalculated AS (
  SELECT
    s.id,
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
    s.canon_score,
    s.lane,
    s.atmosphere,
    s.transformation,
    s.texture,
    s.perspective
  FROM public.songs AS s
  WHERE s.active = true
    AND s.scoring_version = 'independent_vector_v1'
),
rescored AS (
  SELECT
    id,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country')
      THEN LEAST(11, LEAST(25, GREATEST(3, ROUND(axis_spread * 0.22 + strong_axis_count * 1.4 + signal_count * 1.1 - canon_score * 0.03))))::integer
      WHEN canon_score >= 90 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country')
      THEN LEAST(14, LEAST(25, GREATEST(3, ROUND(axis_spread * 0.22 + strong_axis_count * 1.4 + signal_count * 1.1 - canon_score * 0.03))))::integer
      ELSE LEAST(25, GREATEST(3, ROUND(axis_spread * 0.22 + strong_axis_count * 1.4 + signal_count * 1.1 - canon_score * 0.03)))::integer
    END AS polarization,
    LEAST(20, GREATEST(4, ROUND(strong_axis_count * 1.55 + primary_count * 1.6 + signal_count * 1.2 + contrast_sum / 55.0)))::integer AS tradeoff_richness,
    LEAST(15, GREATEST(3, ROUND(strong_axis_count * 0.75 + signal_count * 1.15 + canon_score / 18.0)))::integer AS pairing_density,
    CASE
      WHEN canon_score >= 95 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country')
      THEN LEAST(8, LEAST(15, GREATEST(3, ROUND(signal_count * 1.8 + strong_axis_count * 0.9 + (100 - canon_score) / 18.0 + axis_spread / 30.0))))::integer
      WHEN canon_score >= 90 AND lane IN ('pop', 'classic_rock', 'r_and_b', 'country')
      THEN LEAST(10, LEAST(15, GREATEST(3, ROUND(signal_count * 1.8 + strong_axis_count * 0.9 + (100 - canon_score) / 18.0 + axis_spread / 30.0))))::integer
      ELSE LEAST(15, GREATEST(3, ROUND(signal_count * 1.8 + strong_axis_count * 0.9 + (100 - canon_score) / 18.0 + axis_spread / 30.0)))::integer
    END AS identity_signaling,
    LEAST(15, GREATEST(3, ROUND((atmosphere + transformation + texture + perspective) / 34.0 + strong_axis_count * 0.45 + canon_score / 28.0)))::integer AS cross_genre_mapping
  FROM recalculated
)
UPDATE public.songs AS s
SET polarization = r.polarization,
    tradeoff_richness = r.tradeoff_richness,
    pairing_density = r.pairing_density,
    identity_signaling = r.identity_signaling,
    cross_genre_mapping = r.cross_genre_mapping,
    updated_at = now()
FROM rescored AS r
WHERE s.id = r.id;

COMMIT;
