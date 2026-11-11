ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_parent_session_id_fkey;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_parent_session_id_fkey FOREIGN KEY (parent_session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS explore_start_key text;
CREATE UNIQUE INDEX IF NOT EXISTS sessions_explore_start_key_uidx ON public.sessions(user_id, explore_start_key) WHERE explore_start_key IS NOT NULL;