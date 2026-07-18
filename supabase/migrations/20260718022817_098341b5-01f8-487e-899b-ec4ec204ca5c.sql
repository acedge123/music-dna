
ALTER TABLE public.pairings
  ADD COLUMN IF NOT EXISTS is_bootstrap boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS pairings_bootstrap_active_idx
  ON public.pairings (is_bootstrap, active)
  WHERE is_bootstrap = true AND active = true;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS bootstrap_choices_json jsonb NOT NULL DEFAULT '[]'::jsonb;
