DO $$
DECLARE r record; ok int := 0; bad int := 0;
BEGIN
  FOR r IN
    WITH c AS (
      SELECT p.id, t.k, abs(t.va - t.vb) gap
      FROM pairings p JOIN songs a ON a.id = p.song_a_id JOIN songs b ON b.id = p.song_b_id
      CROSS JOIN LATERAL (VALUES ('movement',a.movement,b.movement),('atmosphere',a.atmosphere,b.atmosphere),('transformation',a.transformation,b.transformation),('community',a.community,b.community),('immersion',a.immersion,b.immersion),('scale',a.scale,b.scale),('perspective',a.perspective,b.perspective),('confidence',a.confidence,b.confidence),('tension',a.tension,b.tension),('texture',a.texture,b.texture)) t(k,va,vb)
      WHERE NOT p.active AND coalesce(array_length(p.tests,1),0) = 0 AND a.active AND b.active
        AND t.va IS NOT NULL AND t.vb IS NOT NULL AND abs(t.va - t.vb) >= 25
    ), rk AS (SELECT *, row_number() OVER (PARTITION BY id ORDER BY gap DESC, k) rn FROM c)
    SELECT id, array_agg(k ORDER BY rn) tests FROM rk WHERE rn <= 3 GROUP BY id
  LOOP
    BEGIN
      UPDATE pairings SET tests = r.tests, active = true, updated_at = now() WHERE id = r.id;
      ok := ok + 1;
    EXCEPTION WHEN others THEN
      UPDATE pairings SET tests = r.tests, updated_at = now() WHERE id = r.id;
      bad := bad + 1;
      RAISE NOTICE 'kept inactive %: %', r.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'activated %, kept inactive %', ok, bad;
END $$;