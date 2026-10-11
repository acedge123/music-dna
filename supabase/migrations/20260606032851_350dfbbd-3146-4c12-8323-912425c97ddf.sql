CREATE INDEX IF NOT EXISTS pairings_active_weight_idx ON public.pairings (active, diagnostic_weight DESC);
CREATE INDEX IF NOT EXISTS pairings_tests_gin_idx ON public.pairings USING GIN (tests);
CREATE INDEX IF NOT EXISTS choices_session_idx ON public.choices (session_id);
CREATE INDEX IF NOT EXISTS sessions_user_started_idx ON public.sessions (user_id, started_at DESC);