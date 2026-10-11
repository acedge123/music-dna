SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
DO $$
DECLARE s jsonb; before_vector jsonb;
BEGIN
  PERFORM public.record_choice_atomic('00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',100,'mutation-1','{}','{"vector":{"scale":80}}','{"verdict":"A over B"}');
  SELECT evidence INTO s FROM choices WHERE mutation_id = 'mutation-1';
  ASSERT s->>'version' = 'choice-evidence-v1', 'snapshot version';
  ASSERT s->'catalog'->'tests' = '["scale","tension"]'::jsonb, 'normalized declared axes';
  ASSERT s->'contrasts' = '{"scale":80}'::jsonb, 'missing values excluded';
  ASSERT NOT (s::text LIKE '%private%'), 'curator notes excluded';
  ASSERT (SELECT evidence IS NULL FROM choices WHERE pairing_id = '00000000-0000-0000-0000-000000000006'), 'legacy not backfilled';
  UPDATE songs SET title = 'Changed', scale = 0 WHERE title = 'A';
  ASSERT (SELECT evidence = s FROM choices WHERE mutation_id = 'mutation-1'), 'catalog cannot rewrite vote';
  BEGIN
    UPDATE choices SET evidence = '{}' WHERE mutation_id = 'mutation-1';
    RAISE EXCEPTION 'immutability failed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE choices SET chosen_song_id = '00000000-0000-0000-0000-000000000002' WHERE mutation_id = 'mutation-1';
    RAISE EXCEPTION 'vote identity mutation allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  SELECT vector INTO before_vector FROM sessions;
  BEGIN
    PERFORM public.record_choice_atomic('00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',100,'retry','{}','{"vector":{"scale":160}}','{}');
    RAISE EXCEPTION 'duplicate accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  ASSERT (SELECT vector = before_vector FROM sessions), 'retry changed score';
END $$;
RESET ROLE;
INSERT INTO pairings SELECT '00000000-0000-0000-0000-000000000007',song_a_id,song_b_id,tests,diagnostic_weight,updated_at,hypothesis FROM pairings;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_choice_atomic('00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',1,'stale','{}','{"vector":{"scale":160}}','{}');
    RAISE EXCEPTION 'stale accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM choices WHERE mutation_id = 'stale'), 'stale vote leaked';
  BEGIN
    PERFORM public.record_choice_atomic('00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',1,'catalog','{"scale":80}','{"vector":{"scale":80}}','{"_expected_catalog":{}}');
    RAISE EXCEPTION 'catalog mismatch accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM choices WHERE mutation_id = 'catalog'), 'catalog mismatch vote leaked';
END $$;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000009';
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM choices), 'foreign evidence readable';
  BEGIN
    PERFORM public.record_choice_atomic('00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',1,'foreign','{}','{}','{}');
    RAISE EXCEPTION 'foreign vote accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
