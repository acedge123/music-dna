
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS opening_lane text,
  ADD COLUMN IF NOT EXISTS opening_lane_confidence numeric,
  ADD COLUMN IF NOT EXISTS opening_analysis_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS lane_confidence numeric NOT NULL DEFAULT 0;

ALTER TABLE public.pairings
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'alternative';

CREATE INDEX IF NOT EXISTS pairings_lane_active_weight_idx
  ON public.pairings (lane, active, diagnostic_weight DESC);

CREATE INDEX IF NOT EXISTS sessions_user_lane_idx
  ON public.sessions (user_id, lane, started_at DESC);
