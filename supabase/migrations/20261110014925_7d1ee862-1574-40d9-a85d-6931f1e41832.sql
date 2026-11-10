UPDATE public.pairings p SET user_facing_tradeoff = v.s, updated_at = now() FROM (VALUES
('c4e6ebb2-6d9f-581c-acfe-40a454e1afbd'::uuid, 'Chrome-plated air, or mud on the boots?'),
('a58e5b54-6291-5283-a79b-cd4a3da7b33d'::uuid, 'Spiral down slow, or sprint out the door grinning?'),
('7a48dcce-e496-56ba-a808-c7b882b06647'::uuid, 'Two minutes of elbows, or seven of sky?'),
('b594c456-ef48-5c1e-be44-3a45671e497e'::uuid, 'Fever in the bedsit, or a pint in the sun?'),
('2d1239a2-4905-5933-9c49-bb1fe2ba5ff6'::uuid, 'Dread that keeps building, or a hand on your shoulder?'),
('b5da650d-56c8-54f0-bb6c-4e45bdd23865'::uuid, 'Left out in the storm, or let in from it?'),
('7331095e-1a02-52e6-9f68-832d1f5a8d53'::uuid, 'Lose ten minutes in the trance, or lock into the groove now?'),
('3b2fa5c0-bd6d-5f39-8fff-424a0a54c719'::uuid, 'A confession that won''t stop, or three words that settle it?'),
('7b681231-ed70-5c4e-9031-27563b3f3356'::uuid, 'One man at a piano, or a cathedral on fire?'),
('642d0ade-9465-533e-a13e-87124b688f51'::uuid, 'Lost in someone else''s skin, or at rest by the water?'),
('b29f440e-8388-53fb-ae72-69f2a800a431'::uuid, 'A slow war story, or a two-minute punch?'),
('c8644381-847b-58c5-8621-09932421ccb6'::uuid, 'A whisper under the bridge, or guitars to the rafters?'),
('b0fc73e5-5bfc-51b1-a044-15ca26a9eb13'::uuid, 'Begging at the door, or arms around the whole room?'),
('32d1b595-2b69-5da2-9075-56fe3787b3cb'::uuid, 'Coming apart at the seams, or finally home?'),
('75f67f4c-34e6-519c-bd4a-3439446aeb61'::uuid, 'Let it wash over you, or grab the hook and run?'),
('f1d61728-b395-5868-a57a-4159a0a6ba41'::uuid, 'Twitching nerves, or a pure sugar rush?'),
('cd65c7f4-9dc6-5fa7-b140-f75c29ccd6c7'::uuid, 'Ten minutes of horizon, or one voice in your ear?'),
('6d5b5396-f0a5-589b-a3c9-5a9abcbd5e3c'::uuid, 'Pressure that won''t let up, or floating off the ground?'),
('534f1cf6-fd2f-55ca-8d34-d62cdb928c1b'::uuid, 'Dread in the bones, or a summer you still miss?'),
('712c8fb1-251b-5b2d-9df3-c32e3109aeb5'::uuid, 'Fuzz left raw at the edges, or chimes polished to a shine?'),
('1d93ffe4-ec40-5989-894e-64f58326d8bc'::uuid, 'Make them wait for it, or give it away on the first beat?'),
('2790131f-05eb-41b2-81e6-81031a659825'::uuid, 'Wondering who built the stars, or crying in the rain about it?'),
('b056d3ae-a00b-443c-8390-68411d0d9d0d'::uuid, 'Old dust and resignation, or a modern look at the cosmos?')
) AS v(id, s) WHERE p.id = v.id;

CREATE OR REPLACE FUNCTION public.pairings_activation_checks()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  a jsonb; b jsonb; t text; ok_tests int := 0;
  dims text[] := ARRAY['movement','atmosphere','immersion','scale','community','perspective','confidence','tension','texture','transformation'];
  saying text := lower(btrim(coalesce(NEW.user_facing_tradeoff, '')));
BEGIN
  IF NOT NEW.active THEN RETURN NEW; END IF;
  -- Diagnostic integrity: >=1 declared, valid trait with a >=20 point song-to-song contrast.
  SELECT to_jsonb(s) INTO a FROM songs s WHERE s.id = NEW.song_a_id;
  SELECT to_jsonb(s) INTO b FROM songs s WHERE s.id = NEW.song_b_id;
  FOREACH t IN ARRAY coalesce(NEW.tests, ARRAY[]::text[]) LOOP
    IF t = ANY(dims) AND a ? t AND b ? t AND jsonb_typeof(a->t) = 'number' AND jsonb_typeof(b->t) = 'number'
       AND abs((a->>t)::numeric - (b->>t)::numeric) >= 20 THEN ok_tests := ok_tests + 1; END IF;
  END LOOP;
  IF ok_tests = 0 THEN
    RAISE EXCEPTION 'Pairing % cannot go live: needs at least one tested trait where the songs differ by 20+ points', NEW.id;
  END IF;
  -- Editorial quality: a specific saying, not generic, not reused by another live matchup.
  IF length(saying) < 12 OR saying IN ('which one stays with you?','which one would you keep?','which one?','pick one.','pick one','which do you prefer?','a or b?','this or that?') THEN
    RAISE EXCEPTION 'Pairing % cannot go live: needs a specific saying that describes this matchup', NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pairings o WHERE o.active AND o.id <> NEW.id AND lower(btrim(o.user_facing_tradeoff)) = saying) THEN
    RAISE EXCEPTION 'Pairing % cannot go live: its saying is already used by another live matchup', NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pairings_activation_checks ON public.pairings;
CREATE TRIGGER pairings_activation_checks BEFORE INSERT OR UPDATE ON public.pairings
FOR EACH ROW EXECUTE FUNCTION public.pairings_activation_checks();