WITH v(title, artist, year, mov, atm, tra, com, imm, sca, per, con, ten, tex, canon, dims, sig, why) AS (VALUES
('Stairway to Heaven','Led Zeppelin',1971,40,80,95,60,85,90,70,75,50,75,95,ARRAY['transformation','scale','immersion'],ARRAY['slow_build_epic','folk_to_hard_rock'],'Folk whisper to hard-rock summit; the long climb as the point.'),
('Hey Jude','The Beatles',1968,45,45,70,98,50,85,75,65,25,45,96,ARRAY['community','scale','transformation'],ARRAY['singalong_coda','comfort'],'Gentle advice that becomes a four-minute everybody-sing coda.'),
('A Day in the Life','The Beatles',1967,40,80,90,30,85,80,70,55,65,80,92,ARRAY['transformation','atmosphere','immersion'],ARRAY['psychedelic','orchestral_collapse'],'Dreamy news-of-the-day drift that collapses into orchestral chaos.'),
('(I Can''t Get No) Satisfaction','The Rolling Stones',1965,85,25,15,85,25,60,60,92,75,40,94,ARRAY['confidence','tension','movement'],ARRAY['riff_hook','frustration'],'One fuzz riff and pure frustrated swagger.'),
('Purple Haze','Jimi Hendrix',1967,75,70,45,50,60,65,55,90,70,90,90,ARRAY['texture','atmosphere','confidence'],ARRAY['fuzz_psych','guitar_hero'],'Fuzz, feedback and disorientation; sound as the message.'),
('Light My Fire','The Doors',1967,65,65,60,60,70,60,55,75,45,60,86,ARRAY['immersion','atmosphere','transformation'],ARRAY['organ_jam','psychedelic'],'Organ-led jam that stretches out; groove for getting lost in.'),
('Reelin'' in the Years','Steely Dan',1972,75,35,30,55,40,55,70,85,40,75,78,ARRAY['texture','confidence','movement'],ARRAY['studio_precision','sardonic'],'Slick, sardonic precision; every chord placed just so.'),
('Brown Eyed Girl','Van Morrison',1967,75,30,15,90,25,45,75,70,10,35,88,ARRAY['community','tension','movement'],ARRAY['sunny_pop_rock','nostalgia'],'Three minutes of sunny sha-la-la nostalgia.'),
('Fire and Rain','James Taylor',1970,25,60,50,25,70,20,95,30,40,30,82,ARRAY['perspective','scale','confidence'],ARRAY['singer_songwriter','grief'],'A quiet, first-person reckoning with loss.'),
('Ziggy Stardust','David Bowie',1972,60,60,55,55,65,70,85,80,55,60,88,ARRAY['perspective','confidence','scale'],ARRAY['glam','persona'],'A rock star persona told as myth; character over confession.'),
('Rock and Roll All Nite','KISS',1975,90,20,10,98,20,85,30,95,30,40,82,ARRAY['community','movement','confidence'],ARRAY['party_anthem','arena'],'Pure party chant; no subtext, all fun.'),
('The Weight','The Band',1968,50,45,30,85,45,40,80,60,30,55,86,ARRAY['community','perspective','scale'],ARRAY['americana_roots','front_porch'],'Ramshackle front-porch chorus about helping out; roots and kinship.'),
('Highway to Hell','AC/DC',1979,85,25,15,85,30,80,55,95,65,60,90,ARRAY['confidence','movement','community'],ARRAY['hard_rock','riff_hook'],'A straight shot of riff and swagger; no detours.'),
('Roundabout','Yes',1971,75,60,90,30,75,75,55,80,55,85,80,ARRAY['transformation','texture','immersion'],ARRAY['prog','virtuoso'],'A prog maze of moving parts; complexity as pleasure.'),
('Simple Man','Lynyrd Skynyrd',1973,35,55,40,45,65,50,85,55,40,55,82,ARRAY['perspective','movement','scale'],ARRAY['southern_rock','mothers_advice'],'Plain advice passed down; humility over spectacle.'),
('Mr. Blue Sky','Electric Light Orchestra',1977,70,55,75,75,50,85,50,80,15,90,82,ARRAY['texture','tension','transformation'],ARRAY['orchestral_pop','sunshine'],'Lavish orchestral sunshine; maximal joy.'),
('The Sound of Silence','Simon & Garfunkel',1965,25,80,40,25,80,40,85,35,55,35,90,ARRAY['atmosphere','immersion','perspective'],ARRAY['folk_rock','alienation'],'Hushed, two-voice alienation; quiet as the statement.')
)
INSERT INTO songs (title, artist, year, lane, primary_lane, movement, atmosphere, transformation, community, immersion, scale, perspective, confidence, tension, texture, polarization, tradeoff_richness, pairing_density, identity_signaling, longevity, cross_genre_mapping, diagnostic_power, canon_score, primary_dimensions, archetype_signals, rationale, active, scoring_version, scored_at)
SELECT title, artist, year, 'classic_rock', 'classic_rock', mov, atm, tra, com, imm, sca, per, con, ten, tex, 17, 17, 11, 12, 10, 13, 80, canon, dims, sig, why, false, 'classic_rock_expansion_2026_11_10', now()
FROM v WHERE NOT EXISTS (SELECT 1 FROM songs s WHERE lower(s.title) = lower(v.title) AND lower(s.artist) = lower(v.artist));

WITH pr(a, b, saying) AS (VALUES
('Stairway to Heaven','Rock and Roll All Nite','A slow climb to the sky, or a party that never stops?'),
('Hey Jude','Fire and Rain','Everybody sing the na-na-nas, or one man alone with his losses?'),
('A Day in the Life','Brown Eyed Girl','A dream that unravels into an orchestra, or a sunny sha-la-la?'),
('(I Can''t Get No) Satisfaction','The Sound of Silence','Snarl about what you can''t get, or whisper into the dark?'),
('Purple Haze','The Weight','Feedback and fuzz, or a front-porch chorus?'),
('Roundabout','Highway to Hell','A prog maze, or a straight shot to hell?'),
('Mr. Blue Sky','Gimme Shelter','Pure sunshine, or a storm closing in?'),
('Simple Man','Ziggy Stardust','Mama''s plain advice, or an alien rock-star persona?'),
('Light My Fire','Reelin'' in the Years','Stretch out the organ solo, or tighten every chord?'),
('Fire and Rain','Born to Run','Sit with the sorrow, or floor it out of town?'),
('Bohemian Rhapsody','Brown Eyed Girl','A six-minute opera, or three minutes of summer?'),
('Comfortably Numb','Rock and Roll All Nite','Drift numb through the haze, or shout every night?'),
('Kashmir','Simple Man','An epic desert march, or a quiet word from mom?'),
('The Chain','Hey Jude','A band breaking apart, or a crowd coming together?'),
('Don''t Stop Believin''','The Sound of Silence','Hold on to that feeling, or listen to the silence?'),
('Wish You Were Here','Highway to Hell','Miss someone gently, or raise hell loudly?'),
('Landslide','Won''t Get Fooled Again','Take stock of your life, or smash the new boss?'),
('Heart of Gold','Purple Haze','Search plainly for something true, or blow your mind?'),
('Space Oddity','(I Can''t Get No) Satisfaction','Float alone in a tin can, or stomp around frustrated?'),
('Stairway to Heaven','Wild Horses','Build to a towering finale, or stay small and tender?'),
('Rebel Rebel','A Day in the Life','A glam strut, or a psychedelic free fall?'),
('Riders on the Storm','Mr. Blue Sky','Rain-slicked dread, or a cloudless morning?'),
('Imagine','Highway to Hell','Dream of peace, or ride the highway down?'),
('Roundabout','Heart of Gold','Twenty moving parts, or three chords and a harmonica?'),
('The Weight','Paint It Black','Lighten someone''s load, or paint the whole world black?')
), j AS (
  SELECT pr.saying, a.id aid, b.id bid,
    ARRAY(SELECT k FROM (VALUES ('movement',a.movement,b.movement),('atmosphere',a.atmosphere,b.atmosphere),('transformation',a.transformation,b.transformation),('community',a.community,b.community),('immersion',a.immersion,b.immersion),('scale',a.scale,b.scale),('perspective',a.perspective,b.perspective),('confidence',a.confidence,b.confidence),('tension',a.tension,b.tension),('texture',a.texture,b.texture)) t(k,x,y)
      WHERE x IS NOT NULL AND y IS NOT NULL AND abs(x-y) >= 25 ORDER BY abs(x-y) DESC, k LIMIT 3) tests
  FROM pr JOIN songs a ON a.title = pr.a AND a.lane = 'classic_rock' JOIN songs b ON b.title = pr.b AND b.lane = 'classic_rock'
)
INSERT INTO pairings (song_a_id, song_b_id, tests, lane, user_facing_tradeoff, hypothesis, why_good, diagnostic_weight, active)
SELECT aid, bid, tests, 'classic_rock', saying,
  'Classic rock expansion 2026-11-10: within-lane contrast on ' || array_to_string(tests, ', ') || '.',
  'Separates classic rock listeners on ' || array_to_string(tests, ', ') || ' without leaving the lane.',
  80, false
FROM j;