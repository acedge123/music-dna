CREATE TABLE public.critic_profile (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bluntness SMALLINT NOT NULL DEFAULT 0 CHECK (bluntness BETWEEN -3 AND 3),
  playfulness SMALLINT NOT NULL DEFAULT 0 CHECK (playfulness BETWEEN -3 AND 3),
  patience SMALLINT NOT NULL DEFAULT 0 CHECK (patience BETWEEN -3 AND 3),
  provocation_appetite SMALLINT NOT NULL DEFAULT 0 CHECK (provocation_appetite BETWEEN -3 AND 3),
  move_tally JSONB NOT NULL DEFAULT '{}'::jsonb,
  forbidden_moves TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  turns_observed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.critic_profile TO authenticated;
GRANT ALL ON public.critic_profile TO service_role;

ALTER TABLE public.critic_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own critic profile"
  ON public.critic_profile FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_critic_profile_updated_at
  BEFORE UPDATE ON public.critic_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();