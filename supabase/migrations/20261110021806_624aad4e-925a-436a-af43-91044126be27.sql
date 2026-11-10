UPDATE songs SET active = true, updated_at = now() WHERE scoring_version = 'country_expansion_2026_11_10';
DO $$ DECLARE r record; BEGIN
FOR r IN SELECT id FROM pairings WHERE hypothesis LIKE 'Country expansion 2026-11-10%' LOOP
  BEGIN UPDATE pairings SET active = true, updated_at = now() WHERE id = r.id;
  EXCEPTION WHEN others THEN RAISE NOTICE 'kept off %: %', r.id, SQLERRM; END;
END LOOP; END $$;