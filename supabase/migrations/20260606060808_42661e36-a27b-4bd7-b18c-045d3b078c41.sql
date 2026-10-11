
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS probe_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS probe_candidate_lanes text[] NOT NULL DEFAULT ARRAY[]::text[];
