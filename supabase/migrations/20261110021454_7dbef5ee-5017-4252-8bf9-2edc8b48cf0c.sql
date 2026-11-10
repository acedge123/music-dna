WITH v(title, artist, year, mov, atm, tra, com, imm, sca, per, con, ten, tex, pol, trd, pd, ids, lon, cgm, canon, dims, sig, why) AS (VALUES
('Jolene','Dolly Parton',1973,60,45,30,40,55,40,85,25,80,40,18,18,12,12,10,13,92,ARRAY['tension','confidence','perspective'],ARRAY['pleading','storyteller'],'A begging, nervy plea to a rival; vulnerability as the whole song.'),
('9 to 5','Dolly Parton',1980,80,25,25,90,40,70,60,85,40,35,16,15,11,12,10,13,88,ARRAY['community','movement','confidence'],ARRAY['working_class_anthem','crossover_pop'],'A clock-punching singalong; country as shared grievance and good humor.'),
('Friends in Low Places','Garth Brooks',1990,65,30,20,95,40,85,55,80,25,40,18,15,11,14,10,12,88,ARRAY['community','scale','confidence'],ARRAY['bar_anthem','arena_country'],'The ultimate barroom chant-along; belonging over brooding.'),
('Before He Cheats','Carrie Underwood',2006,75,35,35,75,50,80,70,92,80,45,19,16,11,13,8,13,80,ARRAY['confidence','tension','scale'],ARRAY['revenge_anthem','big_voice'],'Big-voiced revenge with a Louisville Slugger; fury played for the arena.'),
('Tennessee Whiskey','Chris Stapleton',2015,30,70,30,55,70,45,75,70,25,70,17,15,11,12,8,14,84,ARRAY['atmosphere','texture','tension'],ARRAY['soul_country','slow_burn'],'Smoky, slow-pour soul; warmth and grain over story.'),
('Ring of Fire','Johnny Cash',1963,70,40,30,75,50,60,60,80,50,50,16,15,11,13,10,13,92,ARRAY['community','confidence','movement'],ARRAY['mariachi_horns','outlaw_classic'],'Mariachi-horned classic everyone can hum; love as a burn you embrace.'),
('Mama Tried','Merle Haggard',1968,60,35,40,60,45,40,85,60,55,45,17,17,11,13,9,12,84,ARRAY['perspective','tension','community'],ARRAY['outlaw','prison_confession'],'A plainspoken outlaw confession; personal story over spectacle.'),
('He Stopped Loving Her Today','George Jones',1980,25,65,60,30,75,50,90,30,40,55,19,18,12,13,9,12,88,ARRAY['perspective','immersion','transformation'],ARRAY['countrypolitan_tearjerker','storyteller'],'The saddest twist ending in country; grief told slowly and fully.'),
('Coat of Many Colors','Dolly Parton',1971,35,50,45,45,55,30,95,55,25,35,17,16,11,12,9,12,80,ARRAY['perspective','scale','texture'],ARRAY['memory','storyteller'],'A small, warm childhood memory; pride in being poor, told at the kitchen table.'),
('Man! I Feel Like a Woman!','Shania Twain',1997,85,25,20,90,40,85,45,92,25,25,19,15,11,13,8,14,82,ARRAY['confidence','community','movement'],ARRAY['country_pop','party'],'Glossy, shout-along party pop; country as pure fun.'),
('Chicken Fried','Zac Brown Band',2008,60,35,20,90,35,60,60,70,15,40,18,15,11,14,7,12,72,ARRAY['community','tension','immersion'],ARRAY['comfort_country','back_porch'],'Cold-beer comfort and simple pleasures; contentment as identity.'),
('Follow Your Arrow','Kacey Musgraves',2013,60,40,40,70,40,55,70,80,25,35,21,17,11,13,7,14,72,ARRAY['confidence','community','perspective'],ARRAY['progressive_country','wry'],'Wry live-and-let-live advice; independence with a grin.'),
('Cover Me Up','Jason Isbell',2013,30,60,75,25,80,35,95,40,60,55,20,19,12,13,6,13,74,ARRAY['transformation','perspective','immersion'],ARRAY['americana','sobriety_redemption'],'A raw sobriety love song; redemption told close to the bone.'),
('Elephant','Jason Isbell',2017,25,60,55,20,80,25,95,25,70,40,20,18,12,13,6,13,66,ARRAY['perspective','tension','immersion'],ARRAY['americana','unflinching'],'Unflinching song about a dying friend; refuses to look away.'),
('Fast Car','Luke Combs',2023,55,45,55,70,55,65,85,55,55,45,21,17,11,12,4,14,72,ARRAY['perspective','community','transformation'],ARRAY['cover','escape_story'],'A faithful arena-country cover of an escape story; longing everyone can share.'),
('Wagon Wheel','Old Crow Medicine Show',2004,75,35,25,90,40,55,60,70,20,75,19,15,11,13,7,13,74,ARRAY['community','texture','movement'],ARRAY['string_band','campfire'],'Fiddle-and-banjo campfire singalong; rough and communal.'),
('Lady May','Tyler Childers',2017,20,65,35,20,75,20,90,40,30,80,19,17,12,13,5,12,62,ARRAY['texture','perspective','scale'],ARRAY['appalachian','solo_acoustic'],'One voice and a guitar on the porch; devotion stripped bare.'),
('Whitehouse Road','Tyler Childers',2017,80,40,30,60,55,50,70,75,70,85,19,16,11,13,5,12,60,ARRAY['texture','movement','tension'],ARRAY['appalachian','rowdy'],'Rowdy, ragged Appalachian bar burner; danger with a grin.'),
('Boot Scootin'' Boogie','Brooks & Dunn',1992,92,20,15,90,35,70,40,85,20,40,18,14,11,13,9,13,78,ARRAY['movement','community','confidence'],ARRAY['line_dance','honky_tonk'],'Line-dance fuel; movement first, feelings later.'),
('Crazy','Patsy Cline',1961,25,70,40,30,70,40,80,30,55,45,17,16,11,12,10,14,92,ARRAY['atmosphere','confidence','perspective'],ARRAY['nashville_sound','torch'],'A lush torch ballad; heartbreak with velvet strings.'),
('Luckenbach, Texas','Waylon Jennings',1977,45,55,40,65,45,40,75,60,25,55,17,16,11,13,9,12,74,ARRAY['community','perspective','tension'],ARRAY['outlaw','back_to_basics'],'Outlaw shrug at fame; back-to-basics ease.'),
('Last Night','Morgan Wallen',2023,60,40,25,70,40,70,70,55,55,30,22,15,11,13,4,14,70,ARRAY['scale','perspective','texture'],ARRAY['modern_mainstream','polished'],'Slick, streaming-era mainstream country; polished hook over grit.'),
('Something in the Orange','Zach Bryan',2022,30,75,40,30,80,35,90,30,65,75,21,17,12,14,4,13,68,ARRAY['atmosphere','perspective','texture'],ARRAY['new_americana','lonesome'],'A lonesome, ragged plea at dusk; mood and ache over polish.'),
('Texas Hold ''Em','Beyoncé',2024,85,35,40,85,40,75,55,90,30,50,23,17,11,14,3,14,70,ARRAY['movement','confidence','community'],ARRAY['crossover','hoedown'],'A pop-star hoedown; country reclaimed as a party and a statement.'),
('Wichita Lineman','Glen Campbell',1968,30,80,45,25,80,60,85,35,40,45,18,17,11,12,10,14,86,ARRAY['atmosphere','immersion','perspective'],ARRAY['countrypolitan','cinematic_loneliness'],'Cinematic loneliness on a telephone wire; atmosphere as emotion.'),
('Need You Now','Lady A',2009,45,60,40,45,60,70,80,30,70,40,18,16,11,12,7,14,76,ARRAY['tension','confidence','scale'],ARRAY['country_pop','late_night_longing'],'Late-night, slightly drunk longing; polished vulnerability.')
)
INSERT INTO songs (title, artist, year, lane, primary_lane, movement, atmosphere, transformation, community, immersion, scale, perspective, confidence, tension, texture, polarization, tradeoff_richness, pairing_density, identity_signaling, longevity, cross_genre_mapping, diagnostic_power, canon_score, primary_dimensions, archetype_signals, rationale, active, scoring_version, scored_at)
SELECT title, artist, year, 'country', 'country', mov, atm, tra, com, imm, sca, per, con, ten, tex, pol, trd, pd, ids, lon, cgm, pol+trd+pd+ids+lon+cgm, canon, dims, sig, why, false, 'country_expansion_2026_11_10', now() FROM v;

WITH pr(a, b, saying) AS (VALUES
('Jolene','Before He Cheats','Beg the rival to back off, or take a bat to his truck?'),
('9 to 5','He Stopped Loving Her Today','Punch the clock with the crew, or sit alone with the saddest ending ever told?'),
('Friends in Low Places','Lady May','Hold court at the bar, or whisper on the porch?'),
('Tennessee Whiskey','Boot Scootin'' Boogie','Slow-pour the feeling, or hit the dance floor?'),
('Cover Me Up','Man! I Feel Like a Woman!','Get sober for someone, or get loud for yourself?'),
('Elephant','Chicken Fried','Stare down the hard truth, or count your simple blessings?'),
('Wichita Lineman','Wagon Wheel','Lonely on the wire, or rowdy round the campfire?'),
('Something in the Orange','Texas Hold ''Em','Ache at sundown, or two-step till sunrise?'),
('Crazy','Ring of Fire','Velvet heartbreak, or a burn you jump into?'),
('Coat of Many Colors','Friends in Low Places','A small memory held close, or a big night shared loud?'),
('Mama Tried','Last Night','An outlaw owning his mistakes, or a slick hook about one bad night?'),
('Whitehouse Road','Tennessee Whiskey','Raise hell down the holler, or melt into the slow dance?'),
('Lady May','Before He Cheats','One quiet vow, or one loud revenge?'),
('Follow Your Arrow','Jolene','Shrug and do you, or beg not to lose him?'),
('He Stopped Loving Her Today','Boot Scootin'' Boogie','Mourn to the last verse, or scoot your boots?'),
('Wagon Wheel','Elephant','Sing it with strangers, or face it alone?'),
('Need You Now','Chicken Fried','Drunk-dial at midnight, or settle in with a cold one?'),
('Fast Car','Wichita Lineman','Plan the escape out loud, or listen for a voice on the line?'),
('Texas Hold ''Em','Cover Me Up','Pull everyone onto the floor, or promise one person you''ll stay?'),
('Luckenbach, Texas','Before He Cheats','Go back to basics, or burn it down?'),
('Something in the Orange','9 to 5','A ragged plea at dusk, or a polished workday anthem?'),
('Man! I Feel Like a Woman!','Crazy','Glitter and swagger, or a torch song in the dark?'),
('Ring of Fire','He Stopped Loving Her Today','A love you hum along to, or a love that ends at the graveside?'),
('Last Night','Lady May','Studio-polished regret, or a porch-light promise?'),
('Coat of Many Colors','Texas Hold ''Em','Proud of where you came from, or making the whole room move?'),
('Jolene','Friends in Low Places','A trembling plea, or a toast to the cheap seats?'),
('Turtles All the Way Down','Boot Scootin'' Boogie','A cosmic trip, or a honky-tonk shuffle?'),
('The Gambler','Need You Now','Hard-won advice for the road, or a late-night slip?'),
('I Walk the Line','Something in the Orange','Steady as a train track, or unraveling at sunset?'),
('Your Cheatin'' Heart','Man! I Feel Like a Woman!','Wounded and plainspoken, or shiny and unbothered?'),
('Blue Eyes Crying in the Rain','Whitehouse Road','Hushed and spare, or wild and rowdy?'),
('You Should Probably Leave','Coat of Many Colors','Temptation at the door, or a mother''s love stitched by hand?')
), j AS (
  SELECT pr.saying, a.id aid, b.id bid,
    ARRAY(SELECT k FROM (VALUES ('movement',a.movement,b.movement),('atmosphere',a.atmosphere,b.atmosphere),('transformation',a.transformation,b.transformation),('community',a.community,b.community),('immersion',a.immersion,b.immersion),('scale',a.scale,b.scale),('perspective',a.perspective,b.perspective),('confidence',a.confidence,b.confidence),('tension',a.tension,b.tension),('texture',a.texture,b.texture)) t(k,x,y)
      WHERE x IS NOT NULL AND y IS NOT NULL AND abs(x-y) >= 25 ORDER BY abs(x-y) DESC, k LIMIT 3) tests
  FROM pr JOIN songs a ON a.title = pr.a AND a.lane = 'country' JOIN songs b ON b.title = pr.b AND b.lane = 'country'
)
INSERT INTO pairings (song_a_id, song_b_id, tests, lane, user_facing_tradeoff, hypothesis, why_good, diagnostic_weight, active)
SELECT aid, bid, tests, 'country', saying,
  'Country expansion 2026-11-10: within-lane contrast on ' || array_to_string(tests, ', ') || '.',
  'Separates country listeners on ' || array_to_string(tests, ', ') || ' without leaving the lane.',
  80, false
FROM j;