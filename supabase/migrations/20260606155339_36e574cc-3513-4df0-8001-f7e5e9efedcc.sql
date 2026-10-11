
CREATE TABLE public.onboarding_openers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_key TEXT NOT NULL UNIQUE,
  eyebrow TEXT NOT NULL DEFAULT 'three songs · ranked',
  headline TEXT NOT NULL,
  sub TEXT,
  slot_labels JSONB NOT NULL,
  cta TEXT NOT NULL DEFAULT 'See what I think →',
  weight INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_openers TO anon, authenticated;
GRANT ALL ON public.onboarding_openers TO service_role;

ALTER TABLE public.onboarding_openers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active openers"
  ON public.onboarding_openers FOR SELECT
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_onboarding_openers_updated_at
BEFORE UPDATE ON public.onboarding_openers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.onboarding_openers (variant_key, eyebrow, headline, sub, slot_labels, cta) VALUES
('desert_island',
 'three songs · ranked',
 E'You can only save three songs.\nThe archive is burning.',
 'The fire is spreading. Pick fast. Order matters.',
 '["The one you''d save first","The one you''d run back for","The one you''d regret leaving behind"]'::jsonb,
 'Save them →'),
('age_14',
 'three songs · ranked',
 E'You''re 14 again.\nThree songs define your world.',
 'Not the best. Not the coolest. The three that made you who you are. Then rank them.',
 '["The one that hit hardest","The one right behind it","The one you''d never admit"]'::jsonb,
 'Show me →'),
('friend_test',
 'three songs · ranked',
 E'A friend wants to understand you.\nYou can send only three songs.',
 'What order do they hear them?',
 '["Track one — the door in","Track two — the room","Track three — the secret"]'::jsonb,
 'Send them →'),
('dna_voice',
 'three songs · ranked',
 E'Three songs.\nThat''s all I need.',
 'No bests. No coolests. Just three songs that give you away.',
 '["The one you''d fight for","The one you''d defend","The one you''d sneak onto the list"]'::jsonb,
 'Read me →'),
('contrarian',
 'three songs · ranked',
 E'Forget "best."\nPick three songs you love.',
 'The songs that reveal something about you. Rank them. Don''t overthink it.',
 '["#1 — gut answer","#2 — second instinct","#3 — the one that surprises you"]'::jsonb,
 'See what I think →'),
('three_survive',
 'three songs · ranked',
 E'You can only keep three songs.\nEverything else disappears.',
 'Which three survive? The order matters.',
 '["The first to survive","The second to survive","The third to survive"]'::jsonb,
 'Survive →');
