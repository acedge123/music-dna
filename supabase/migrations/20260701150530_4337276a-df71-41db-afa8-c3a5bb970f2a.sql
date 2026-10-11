WITH metal_songs AS (
  INSERT INTO public.songs
    (title, artist, year, lane, primary_lane,
     movement, atmosphere, immersion, scale, community, perspective, confidence, tension, texture, transformation,
     diagnostic_power, primary_dimensions, archetype_signals, active)
  VALUES
    ('Paranoid', 'Black Sabbath', 1970, 'metal', 'metal',
      82, 28, 70, 78, 45, 60, 90, 88, 65, 25,
      94, ARRAY['tension','confidence','texture'], ARRAY['riff_discipline','doom_weight'], true),
    ('Master of Puppets', 'Metallica', 1986, 'metal', 'metal',
      84, 24, 82, 88, 55, 70, 92, 94, 72, 55,
      96, ARRAY['tension','confidence','transformation'], ARRAY['precision_thrash','riff_control'], true),
    ('The Number of the Beast', 'Iron Maiden', 1982, 'metal', 'metal',
      78, 40, 75, 92, 70, 72, 90, 82, 60, 45,
      92, ARRAY['movement','scale','confidence'], ARRAY['epic_pacing','dual_guitar'], true),
    ('Raining Blood', 'Slayer', 1986, 'metal', 'metal',
      94, 22, 78, 82, 40, 55, 95, 96, 80, 30,
      97, ARRAY['tension','confidence','texture'], ARRAY['thrash_attack','brutality'], true),
    ('Schism', 'Tool', 2001, 'metal', 'metal',
      70, 62, 92, 80, 45, 78, 78, 78, 70, 88,
      95, ARRAY['transformation','immersion','tension'], ARRAY['prog_metal','polyrhythm'], true),
    ('Blood and Thunder', 'Mastodon', 2004, 'metal', 'metal',
      86, 48, 82, 90, 55, 65, 88, 84, 75, 60,
      90, ARRAY['movement','scale','tension'], ARRAY['sludge_progsurge','cathedral_weight'], true),
    ('My Own Summer (Shove It)', 'Deftones', 1997, 'metal', 'metal',
      68, 72, 88, 72, 45, 68, 78, 76, 82, 50,
      88, ARRAY['atmosphere','texture','immersion'], ARRAY['nu_metal','heavy_air'], true),
    ('Blind', 'Korn', 1994, 'metal', 'metal',
      72, 55, 80, 70, 55, 60, 82, 82, 78, 40,
      87, ARRAY['tension','texture','confidence'], ARRAY['nu_metal','groove_crush'], true),
    ('Toxic Garbage Island', 'Gojira', 2006, 'metal', 'metal',
      80, 58, 88, 90, 40, 72, 90, 90, 82, 72,
      94, ARRAY['transformation','tension','texture'], ARRAY['technical_death','precision_weight'], true),
    ('Walk', 'Pantera', 1992, 'metal', 'metal',
      74, 30, 72, 78, 55, 55, 95, 80, 70, 25,
      93, ARRAY['confidence','tension','texture'], ARRAY['groove_metal','command'], true)
  RETURNING id, title
)
INSERT INTO public.pairings (song_a_id, song_b_id, lane, tests, hypothesis, why_good, diagnostic_weight, active)
SELECT a.id, b.id, 'metal', tests, hypothesis, why_good, diagnostic_weight, true
FROM (
  VALUES
    ('Paranoid', 'Master of Puppets', ARRAY['tension','confidence','transformation']::text[], 'Old-school doom bite versus modern thrash architecture.', 'Tests whether the listener rewards weight and menace, or control and mechanical force.', 97),
    ('Paranoid', 'The Number of the Beast', ARRAY['scale','movement','confidence']::text[], 'Hooks that still feel dangerous versus hooks that feel immortal.', 'Separates melody-first metal from riff-first metal.', 92),
    ('Master of Puppets', 'Raining Blood', ARRAY['tension','texture','transformation']::text[], 'Tight, disciplined punishment versus pure velocity.', 'Shows whether the listener prefers composure under pressure or total rupture.', 98),
    ('The Number of the Beast', 'Walk', ARRAY['scale','confidence','community']::text[], 'Epic theatrical command versus blunt groove authority.', 'Tests whether metal for them is grandeur or swagger.', 90),
    ('Schism', 'Toxic Garbage Island', ARRAY['transformation','immersion','tension']::text[], 'Mathy structure versus technical density.', 'For listeners who reward architecture more than attack.', 95),
    ('Schism', 'My Own Summer (Shove It)', ARRAY['atmosphere','immersion','texture']::text[], 'Alien air and controlled unease versus immediate physical impact.', 'Separates atmosphere-metal from punchy crossover metal.', 91),
    ('Blood and Thunder', 'Walk', ARRAY['movement','confidence','scale']::text[], 'Cathedral-size surge versus chest-out groove.', 'Clarifies whether the listener wants forward propulsion or grounded stomp.', 93),
    ('Blind', 'My Own Summer (Shove It)', ARRAY['texture','tension','atmosphere']::text[], 'Raw nerve versus polished pressure.', 'Tests what kind of heaviness they trust when the room gets ugly.', 89),
    ('Toxic Garbage Island', 'Master of Puppets', ARRAY['transformation','tension','texture']::text[], 'Technical labyrinth versus surgical thrash.', 'Shows whether precision matters more than speed.', 94),
    ('Raining Blood', 'Blood and Thunder', ARRAY['tension','movement','scale']::text[], 'Pure attack versus epic crush.', 'For listeners who think heaviness should either sprint or avalanche.', 96),
    ('Paranoid', 'Blind', ARRAY['texture','confidence','tension']::text[], 'Sabbath swing versus nu-metal pound.', 'Separates classic metal weight from modern low-end force.', 88),
    ('The Number of the Beast', 'Schism', ARRAY['transformation','scale','immersion']::text[], 'Singable menace versus shape-shifting structure.', 'Tests whether the listener wants the song to stay a song or mutate in front of them.', 90)
) AS p(song_a_title, song_b_title, tests, hypothesis, why_good, diagnostic_weight)
JOIN metal_songs a ON a.title = p.song_a_title
JOIN metal_songs b ON b.title = p.song_b_title;