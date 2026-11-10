WITH v(title, mov, atm, tra, com, imm, sca, per, con, ten, tex) AS (VALUES
('Hotel California',50,85,55,55,80,75,80,70,65,70),('White Rabbit',45,85,80,30,80,60,60,75,85,60),
('Sympathy for the Devil',70,60,40,70,60,65,85,90,65,55),('Sweet Home Alabama',75,35,20,90,35,65,65,85,20,55),
('Won''t Get Fooled Again',85,55,75,80,65,95,70,90,75,65),('Dreams',55,75,30,45,70,45,80,55,40,55),
('Carry On Wayward Son',80,50,80,75,60,85,70,80,60,75),('Whole Lotta Love',85,60,65,65,65,85,40,95,85,80),
('You Really Got Me',90,20,15,75,25,45,50,90,75,85),('Fortunate Son',90,25,15,85,25,60,75,90,85,65),
('Tiny Dancer',45,60,65,75,60,70,80,55,30,45),('Imagine',25,60,25,70,55,45,70,40,15,25),
('Paranoid',92,30,15,60,45,60,55,90,85,80),('Go Your Own Way',80,40,30,75,40,65,85,80,70,55),
('More Than a Feeling',65,55,55,80,55,85,80,70,40,70),('Black Magic Woman',60,75,45,45,70,55,50,70,60,65),
('Paint It Black',80,65,35,55,60,60,70,80,85,55),('Proud Mary',70,35,80,75,40,70,55,85,45,50),
('American Girl',88,30,20,70,30,55,60,80,60,55),('Riders on the Storm',40,92,40,25,90,60,50,55,65,60),
('Layla',80,50,85,65,60,80,85,75,80,70),('Heart of Gold',40,40,20,55,40,25,85,45,25,40),
('Baba O''Riley',80,60,80,85,65,95,55,85,60,75),('Wild Horses',30,60,35,40,65,30,85,35,35,40),
('Free Bird',60,55,90,85,70,90,70,70,60,70),('Thunder Road',70,55,70,75,55,80,90,75,50,55),
('Space Oddity',35,85,65,25,85,85,80,40,60,60),('House of the Rising Sun',55,70,45,55,60,60,90,70,70,50),
('Landslide',20,55,30,30,60,15,95,25,30,25),('Wish You Were Here',35,65,35,45,65,40,85,35,30,40)
)
UPDATE songs s SET movement=v.mov, atmosphere=v.atm, transformation=v.tra, community=v.com, immersion=v.imm, scale=v.sca, perspective=v.per, confidence=v.con, tension=v.ten, texture=v.tex,
  scoring_version='classic_rock_rescore_2026_11_10', scored_at=now(), updated_at=now()
FROM v WHERE s.title=v.title AND s.lane='classic_rock' AND s.movement=50 AND s.atmosphere=50 AND s.community=50;

UPDATE songs SET active = true, updated_at = now() WHERE scoring_version = 'classic_rock_expansion_2026_11_10';
DO $$ DECLARE r record; BEGIN
FOR r IN SELECT id FROM pairings WHERE hypothesis LIKE 'Classic rock expansion 2026-11-10%' LOOP
  BEGIN UPDATE pairings SET active = true, updated_at = now() WHERE id = r.id;
  EXCEPTION WHEN others THEN RAISE NOTICE 'kept off %: %', r.id, SQLERRM; END;
END LOOP; END $$;