
INSERT INTO public.pairings (song_a_id, song_b_id, lane, tests, hypothesis, why_good, diagnostic_weight, active)
SELECT a.id, b.id, 'country', tests, hypothesis, why_good, diagnostic_weight, true
FROM (VALUES
  ('I Walk the Line','Turtles All the Way Down', ARRAY['confidence','transformation','perspective']::text[], 'Certainty versus curiosity.', 'Do they want country to tell them what to do, or ask what it all means?', 97),
  ('Blue Eyes Crying in the Rain','You Should Probably Leave', ARRAY['tension','texture','confidence']::text[], 'Acceptance versus temptation.', 'Quiet surrender to loss, or leaning into the thing they know is trouble.', 95),
  ('The Gambler','The Architect', ARRAY['perspective','transformation','community']::text[], 'Old wisdom versus modern searching. Know when to hold ''em — or ask why we''re even here.', 'Almost a philosophy test disguised as a song pick.', 98),
  ('Need a Favor','Your Cheatin'' Heart', ARRAY['tension','transformation','perspective']::text[], 'Prayer versus memory. Action versus regret.', 'Reaching forward for rescue, or looking back at the wound.', 94)
) AS p(song_a_title, song_b_title, tests, hypothesis, why_good, diagnostic_weight)
JOIN public.songs a ON a.title = p.song_a_title AND a.primary_lane='country'
JOIN public.songs b ON b.title = p.song_b_title AND b.primary_lane='country';
