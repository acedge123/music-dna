
WITH country_songs AS (
  INSERT INTO public.songs (
    title, artist, year, lane, primary_lane,
    movement, atmosphere, immersion, scale, community,
    perspective, confidence, tension, texture, transformation,
    polarization, tradeoff_richness, pairing_density, identity_signaling, longevity, cross_genre_mapping,
    canon_score, primary_dimensions, archetype_signals, active
  ) VALUES
    ('I Walk the Line','Johnny Cash',1956,'country','country',
      55,30,35,45,55, 75,85,60,35,30,
      18,14,12,14,10,10, 96,
      ARRAY['confidence','perspective','community']::text[], ARRAY['plainspoken_moral_force','minimal_discipline']::text[], true),
    ('Your Cheatin'' Heart','Hank Williams',1952,'country','country',
      50,35,30,40,60, 80,30,55,40,30,
      16,12,10,13,10,8, 95,
      ARRAY['perspective','confidence','tension']::text[], ARRAY['hillbilly_lament','fatalism']::text[], true),
    ('Blue Eyes Crying in the Rain','Willie Nelson',1975,'country','country',
      30,55,60,35,40, 65,40,40,55,55,
      16,14,11,12,10,9, 90,
      ARRAY['atmosphere','texture','perspective']::text[], ARRAY['weathered_intimacy','late_night_regret']::text[], true),
    ('Turtles All the Way Down','Sturgill Simpson',2014,'country','country',
      55,80,80,75,40, 70,60,55,70,80,
      22,18,13,14,6,13, 82,
      ARRAY['transformation','immersion','atmosphere']::text[], ARRAY['cosmic_country','psychedelic_twist']::text[], true),
    ('The Architect','Kacey Musgraves',2024,'country','country',
      55,70,65,60,50, 80,60,45,60,65,
      18,16,12,12,4,11, 78,
      ARRAY['atmosphere','perspective','transformation']::text[], ARRAY['cosmic_country','wry_observation']::text[], true),
    ('You Should Probably Leave','Chris Stapleton',2020,'country','country',
      60,65,60,60,60, 60,70,75,65,55,
      18,14,12,13,5,10, 80,
      ARRAY['confidence','tension','texture']::text[], ARRAY['southern_soul_cross','smoke_room_tension']::text[], true),
    ('Need a Favor','Jelly Roll',2023,'country','country',
      70,60,55,70,70, 65,45,75,60,65,
      18,12,11,13,4,8, 72,
      ARRAY['tension','transformation','community']::text[], ARRAY['redemption_story','rough_edges']::text[], true),
    ('The Gambler','Kenny Rogers',1978,'country','country',
      50,50,45,55,80, 85,70,55,45,60,
      15,13,11,12,10,9, 90,
      ARRAY['perspective','community','confidence']::text[], ARRAY['story_song','moral_code']::text[], true)
  RETURNING id, title
)
INSERT INTO public.pairings (song_a_id, song_b_id, lane, tests, hypothesis, why_good, diagnostic_weight, active)
SELECT a.id, b.id, 'country', tests, hypothesis, why_good, diagnostic_weight, true
FROM (VALUES
  ('I Walk the Line','Your Cheatin'' Heart', ARRAY['confidence','perspective']::text[], 'Self-command versus self-destruction.', 'Tests whether the listener trusts discipline or confession.', 96),
  ('I Walk the Line','The Gambler', ARRAY['confidence','community','perspective']::text[], 'Private moral code versus public storytelling wisdom.', 'Separates straight-backed authority from social parable.', 91),
  ('Your Cheatin'' Heart','Blue Eyes Crying in the Rain', ARRAY['tension','texture','perspective']::text[], 'Raw hurt versus weathered surrender.', 'Open wound or quiet ache.', 95),
  ('Blue Eyes Crying in the Rain','The Architect', ARRAY['atmosphere','perspective','transformation']::text[], 'Dusty resignation versus cosmic reflection.', 'Plain grief or expansive thought.', 88),
  ('Turtles All the Way Down','The Gambler', ARRAY['transformation','perspective','community']::text[], 'Philosophical drift versus clean narrative frame.', 'Outsider braininess or classic country parable.', 92),
  ('Turtles All the Way Down','Need a Favor', ARRAY['transformation','tension','immersion']::text[], 'Spaced-out country versus scarred contemporary country.', 'Heady weirdness or bruised urgency.', 94),
  ('You Should Probably Leave','Need a Favor', ARRAY['confidence','tension','texture']::text[], 'Cool refusal versus messy need.', 'Smolder or sob.', 90),
  ('You Should Probably Leave','I Walk the Line', ARRAY['confidence','tension']::text[], 'Hard romantic edge versus hard moral edge.', 'Restraint versus desire.', 87),
  ('The Architect','Turtles All the Way Down', ARRAY['transformation','atmosphere','immersion']::text[], 'Wry modern shimmer versus psychedelic sprawl.', 'Polished contemporary or heady expansiveness.', 93),
  ('The Architect','Blue Eyes Crying in the Rain', ARRAY['atmosphere','texture','perspective']::text[], 'Modern air versus old ache.', 'Present-tense reflection or inherited sorrow.', 89),
  ('The Gambler','Your Cheatin'' Heart', ARRAY['perspective','community','tension']::text[], 'Wry wisdom versus naked heartbreak.', 'Story over wound.', 90),
  ('Need a Favor','Blue Eyes Crying in the Rain', ARRAY['tension','texture','atmosphere']::text[], 'Bruised plea versus resigned grace.', 'Confess or console.', 89)
) AS p(song_a_title, song_b_title, tests, hypothesis, why_good, diagnostic_weight)
JOIN country_songs a ON a.title = p.song_a_title
JOIN country_songs b ON b.title = p.song_b_title;
