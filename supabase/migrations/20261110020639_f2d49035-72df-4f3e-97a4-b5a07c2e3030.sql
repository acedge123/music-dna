WITH v(title, artist, year, mov, atm, tra, com, imm, sca, per, con, ten, tex, pol, trd, pd, ids, lon, cgm, canon, dims, sig, why) AS (VALUES
('Planet Caravan','Black Sabbath',1970,25,90,40,20,85,40,55,40,15,60,20,18,12,12,9,14,80,ARRAY['atmosphere','tension','immersion'],ARRAY['doom_haze','psych_drift'],'Sabbath with the amps unplugged: a jazz-smoke float that shows whether heaviness is volume or mood.'),
('Fade to Black','Metallica',1984,45,70,75,40,80,70,85,45,60,55,20,19,12,13,10,13,86,ARRAY['perspective','transformation','atmosphere'],ARRAY['thrash_ballad','private_despair'],'Acoustic despair that builds into a gallop; inward-facing where most thrash points out.'),
('Enter Sandman','Metallica',1991,75,45,30,85,65,90,40,90,70,55,18,16,12,13,10,13,92,ARRAY['community','scale','confidence'],ARRAY['stadium_metal','riff_hook'],'The stadium-sized singalong riff: menace packaged for the whole arena.'),
('Run to the Hills','Iron Maiden',1982,92,30,30,85,60,85,55,88,72,50,17,16,11,12,10,12,85,ARRAY['movement','community','confidence'],ARRAY['gallop','dual_guitar'],'Pure cavalry gallop and fist-in-the-air chorus; momentum over mood.'),
('Breaking the Law','Judas Priest',1980,85,20,20,90,45,75,50,92,60,40,16,14,11,13,10,12,84,ARRAY['community','confidence','movement'],ARRAY['leather_anthem','riff_hook'],'Two-and-a-half minutes of chant-along defiance; the simplest possible metal statement.'),
('Cemetery Gates','Pantera',1990,55,60,80,45,75,80,80,60,65,55,19,18,12,12,9,12,74,ARRAY['transformation','perspective','scale'],ARRAY['power_ballad','grief'],'A wounded, shapeshifting epic from a band known for blunt force.'),
('Crazy Train','Ozzy Osbourne',1980,85,35,25,85,55,80,45,85,55,45,16,15,11,12,10,13,88,ARRAY['movement','community','confidence'],ARRAY['riff_hook','guitar_hero'],'A runaway riff and a party-sized chorus; fun first.'),
('Symphony of Destruction','Megadeth',1992,70,35,25,70,60,75,45,88,75,55,17,15,11,13,9,12,80,ARRAY['confidence','tension','community'],ARRAY['precision_thrash','political'],'Cold, marching precision with a sneer; control over chaos.'),
('Ghost of Perdition','Opeth',2005,65,75,95,25,92,85,75,75,80,85,21,19,12,14,6,13,70,ARRAY['transformation','immersion','texture'],ARRAY['prog_death','clean_growl_switch'],'Ten minutes of growl-to-folk switchbacks; rewards patience and puzzle-solving.'),
('Funeralopolis','Electric Wizard',2000,25,90,60,20,95,85,40,70,85,95,22,18,11,14,6,12,62,ARRAY['texture','immersion','atmosphere'],ARRAY['stoner_doom','fuzz_wall'],'Bong-rattling doom: slow, fuzzed, crushing; weight as a place to live.'),
('In Fiction','Isis',2004,30,92,85,20,95,80,60,50,60,80,21,19,11,14,5,13,58,ARRAY['atmosphere','transformation','immersion'],ARRAY['post_metal','slow_build'],'Post-metal tide that builds for minutes; heaviness as weather.'),
('Souvenirs d''un autre monde','Alcest',2007,35,95,70,20,90,70,70,35,30,85,21,18,11,14,5,14,52,ARRAY['atmosphere','texture','immersion'],ARRAY['blackgaze','dreamy_heavy'],'Shimmering blackgaze memory; metal that floats instead of hits.'),
('Duality','Slipknot',2004,85,45,45,80,75,80,75,85,90,75,19,17,12,13,8,12,80,ARRAY['tension','community','confidence'],ARRAY['nu_metal','catharsis'],'A cathartic scream-along that tears the wall down from the first beat.'),
('Chop Suey!','System of a Down',2001,85,40,70,75,70,75,70,75,85,70,20,19,12,13,9,13,85,ARRAY['transformation','tension','movement'],ARRAY['whiplash','alt_metal'],'Whiplash mood swings, frantic to operatic and back in seconds.'),
('Bring Me to Life','Evanescence',2003,60,70,45,70,65,80,80,55,70,55,21,16,11,13,8,14,76,ARRAY['perspective','atmosphere','scale'],ARRAY['gothic_pop_metal','cinematic'],'Cinematic plea for rescue; drama and vulnerability over aggression.'),
('Square Hammer','Ghost',2016,75,55,25,85,55,80,40,85,45,40,19,16,11,13,6,14,70,ARRAY['community','confidence','movement'],ARRAY['theatrical','hooky'],'Spooky theatre with a pop hook you can sing back.'),
('The Summoning','Sleep Token',2023,60,75,80,60,85,75,80,60,60,65,22,18,11,14,3,14,55,ARRAY['transformation','perspective','immersion'],ARRAY['ritual_alt_metal','genre_fluid'],'Seductive odd-meter ritual that shapeshifts between R&B lightness and djent weight.'),
('Redneck','Lamb of God',2006,92,25,25,70,65,75,50,95,92,80,20,15,11,13,6,11,66,ARRAY['tension','confidence','movement'],ARRAY['groove_metal','beatdown'],'A wrecking-ball groove; aggression with no apology.'),
('Can You Feel My Heart','Bring Me the Horizon',2013,65,70,45,75,70,80,85,50,70,60,21,17,11,14,6,14,68,ARRAY['perspective','atmosphere','confidence'],ARRAY['metalcore_pop','heart_on_sleeve'],'Heart-on-sleeve metalcore turned electro anthem; ache in public.'),
('Black No. 1','Type O Negative',1993,40,90,60,40,85,75,55,70,50,80,21,18,11,14,7,13,68,ARRAY['atmosphere','texture','immersion'],ARRAY['goth_metal','velvet_gloom'],'Velvet gothic gloom, slow and seductive, with a wink.'),
('Iron Man','Black Sabbath',1970,50,55,35,80,70,85,55,90,70,80,17,15,11,12,10,12,90,ARRAY['scale','confidence','texture'],ARRAY['doom_weight','riff_monolith'],'The lumbering titan riff; weight and stomp over speed.'),
('Ace of Spades','Motörhead',1980,98,20,15,85,50,70,40,95,80,75,17,14,11,13,10,12,86,ARRAY['movement','confidence','tension'],ARRAY['speed_rock','bar_fight'],'Short, fast and filthy; live-fast rock-and-roll velocity.')
)
INSERT INTO songs (title, artist, year, lane, primary_lane, movement, atmosphere, transformation, community, immersion, scale, perspective, confidence, tension, texture, polarization, tradeoff_richness, pairing_density, identity_signaling, longevity, cross_genre_mapping, diagnostic_power, canon_score, primary_dimensions, archetype_signals, rationale, active, scoring_version, scored_at)
SELECT title, artist, year, 'metal', 'metal', mov, atm, tra, com, imm, sca, per, con, ten, tex, pol, trd, pd, ids, lon, cgm, pol+trd+pd+ids+lon+cgm, canon, dims, sig, why, false, 'metal_expansion_2026_11_10', now() FROM v;

WITH pr(a, b, saying) AS (VALUES
('Planet Caravan','Paranoid','Float in the smoke, or bolt out the door?'),
('Fade to Black','Enter Sandman','The private confession, or the stadium nightmare?'),
('Funeralopolis','Ace of Spades','Sink into the sludge, or floor it to the finish line?'),
('Souvenirs d''un autre monde','Redneck','Drift into a dream, or brace for the beatdown?'),
('In Fiction','Run to the Hills','Get lost in the fog, or ride with the cavalry?'),
('Ghost of Perdition','Breaking the Law','A ten-minute labyrinth, or two minutes of rule-breaking?'),
('Black No. 1','Crazy Train','Gothic candlelight, or a runaway riff?'),
('The Summoning','Square Hammer','A ritual that shapeshifts, or a hook that never lets go?'),
('Bring Me to Life','Raining Blood','Plead to be saved, or watch the sky bleed?'),
('Can You Feel My Heart','Master of Puppets','Heart on the sleeve, or a machine that never flinches?'),
('Duality','Planet Caravan','Scream it out, or let it drift?'),
('Chop Suey!','Breaking the Law','Whiplash mood swings, or one fist-pump chorus?'),
('Cemetery Gates','Walk','Mourn out loud, or demand respect?'),
('Iron Man','Souvenirs d''un autre monde','The lumbering giant, or the shimmering memory?'),
('Ace of Spades','Black No. 1','Live fast and loud, or linger in velvet gloom?'),
('Enter Sandman','Ghost of Perdition','Singalong menace, or a long descent with no map?'),
('Run to the Hills','Funeralopolis','Gallop into battle, or crawl through the wreckage?'),
('Symphony of Destruction','In Fiction','A tight march, or a slow tide?'),
('Redneck','Fade to Black','Swing the hammer, or sit with the darkness?'),
('Square Hammer','Schism','A sermon you can sing back, or a puzzle you have to solve?'),
('Crazy Train','The Summoning','Ride the riff, or follow the ritual?'),
('Bring Me to Life','Blind','A plea for rescue, or a fight inside your own head?'),
('Can You Feel My Heart','Redneck','Ache in public, or hit like a wrecking ball?'),
('Duality','Black No. 1','Tear the wall down, or seduce in slow motion?'),
('Planet Caravan','Symphony of Destruction','A hazy orbit, or a doomsday drumline?'),
('Iron Man','Chop Suey!','One unstoppable stomp, or chaos that turns on a dime?'),
('Cemetery Gates','Breaking the Law','A wounded epic, or a three-chord riot?'),
('Square Hammer','Funeralopolis','Spooky and catchy, or heavy as a collapsing star?'),
('Bring Me to Life','Ace of Spades','Cinematic drama, or a bar-fight blur?'),
('In Fiction','Duality','Let it build for minutes, or erupt on the first beat?'),
('The Summoning','Raining Blood','Seduction in odd meters, or a thrash ambush?'),
('Fade to Black','Iron Man','Confess your darkest hour, or stomp like a titan?'),
('Symphony of Destruction','Can You Feel My Heart','Cold precision, or a heart cracked wide open?'),
('Toxic Garbage Island','Square Hammer','Ecological fury, or theatrical camp?'),
('Ghost of Perdition','Ace of Spades','Patient and elaborate, or short, fast and filthy?')
), j AS (
  SELECT pr.saying, a.id aid, b.id bid,
    ARRAY(SELECT k FROM (VALUES ('movement',a.movement,b.movement),('atmosphere',a.atmosphere,b.atmosphere),('transformation',a.transformation,b.transformation),('community',a.community,b.community),('immersion',a.immersion,b.immersion),('scale',a.scale,b.scale),('perspective',a.perspective,b.perspective),('confidence',a.confidence,b.confidence),('tension',a.tension,b.tension),('texture',a.texture,b.texture)) t(k,x,y)
      WHERE x IS NOT NULL AND y IS NOT NULL AND abs(x-y) >= 25 ORDER BY abs(x-y) DESC, k LIMIT 3) tests
  FROM pr JOIN songs a ON a.title = pr.a AND a.lane = 'metal' JOIN songs b ON b.title = pr.b AND b.lane = 'metal'
)
INSERT INTO pairings (song_a_id, song_b_id, tests, lane, user_facing_tradeoff, hypothesis, why_good, diagnostic_weight, active)
SELECT aid, bid, tests, 'metal', saying,
  'Metal expansion 2026-11-10: within-lane contrast on ' || array_to_string(tests, ', ') || '.',
  'Separates metal listeners on ' || array_to_string(tests, ', ') || ' without leaving the lane.',
  80, false
FROM j;