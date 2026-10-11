CREATE TABLE public.decade_opening_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decade text NOT NULL,
  position int NOT NULL CHECK (position BETWEEN 1 AND 20),
  text text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decade, position)
);

-- Only one active opening prompt per decade
CREATE UNIQUE INDEX decade_opening_prompts_one_active
  ON public.decade_opening_prompts (decade)
  WHERE is_active;

CREATE INDEX decade_opening_prompts_decade_idx
  ON public.decade_opening_prompts (decade, position);

GRANT SELECT ON public.decade_opening_prompts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decade_opening_prompts TO authenticated;
GRANT ALL ON public.decade_opening_prompts TO service_role;

ALTER TABLE public.decade_opening_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read decade prompts"
  ON public.decade_opening_prompts FOR SELECT USING (true);

CREATE POLICY "Admins can insert decade prompts"
  ON public.decade_opening_prompts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update decade prompts"
  ON public.decade_opening_prompts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete decade prompts"
  ON public.decade_opening_prompts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER decade_opening_prompts_updated_at
  BEFORE UPDATE ON public.decade_opening_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed all 25 (your favorites marked active per decade)
INSERT INTO public.decade_opening_prompts (decade, position, text, is_active) VALUES
  ('70s', 1, 'What''s the song that would still be playing if you never changed the cassette?', false),
  ('70s', 2, 'What song made the world feel bigger than your hometown?', true),
  ('70s', 3, 'What''s the song you''d play while staring out the car window on a summer evening?', false),
  ('70s', 4, 'What song made you believe adulthood might actually be interesting?', false),
  ('70s', 5, 'If you could save only one song from the decade, what survives?', false),

  ('80s', 1, 'What song still feels like midnight?', false),
  ('80s', 2, 'What song would you rescue from a box of old mixtapes?', false),
  ('80s', 3, 'What song still sounds like the future?', true),
  ('80s', 4, 'What song takes you back the fastest?', false),
  ('80s', 5, 'What song never left you, even when the decade did?', false),

  ('90s', 1, 'What song still feels like freedom?', false),
  ('90s', 2, 'What song would be playing at the end of your 90s movie?', false),
  ('90s', 3, 'What song still gives you that first-day-of-summer feeling?', false),
  ('90s', 4, 'What song reminds you who you were becoming?', true),
  ('90s', 5, 'What song still sounds like possibility?', false),

  ('00s', 1, 'What song survived your iPod?', false),
  ('00s', 2, 'What song instantly takes you back to where you were?', false),
  ('00s', 3, 'What song felt like a secret before everyone found it?', true),
  ('00s', 4, 'What song defined a chapter of your life?', false),
  ('00s', 5, 'What song would still be on your burned CD?', false),

  ('10s', 1, 'What song stopped you in your tracks the first time you heard it?', false),
  ('10s', 2, 'What song still feels uniquely yours?', false),
  ('10s', 3, 'What song did you discover at exactly the right moment?', false),
  ('10s', 4, 'What song changed after you changed?', true),
  ('10s', 5, 'What song still feels like a screenshot of that decade?', false);