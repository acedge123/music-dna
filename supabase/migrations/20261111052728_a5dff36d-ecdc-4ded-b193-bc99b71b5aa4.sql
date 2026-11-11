ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'discover',
  ADD COLUMN IF NOT EXISTS decade smallint,
  ADD COLUMN IF NOT EXISTS parent_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sessions_parent_session_idx ON public.sessions(parent_session_id) WHERE parent_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sessions_validate_explore()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.mode NOT IN ('discover','explore') THEN RAISE EXCEPTION 'invalid session mode'; END IF;
  IF NEW.mode = 'discover' THEN
    IF NEW.decade IS NOT NULL OR NEW.parent_session_id IS NOT NULL THEN RAISE EXCEPTION 'discover sessions have no decade/parent'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.decade IS NULL OR NEW.decade NOT IN (1970,1980,1990,2000,2010,2020) THEN RAISE EXCEPTION 'invalid decade'; END IF;
  IF NEW.parent_session_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sessions p WHERE p.id = NEW.parent_session_id AND p.user_id = NEW.user_id AND p.mode = 'discover' AND p.completed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'explore session needs a completed reading owned by the same listener'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.mode IS DISTINCT FROM OLD.mode OR NEW.decade IS DISTINCT FROM OLD.decade OR NEW.parent_session_id IS DISTINCT FROM OLD.parent_session_id) THEN
    RAISE EXCEPTION 'explore identity is immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sessions_validate_explore ON public.sessions;
CREATE TRIGGER sessions_validate_explore BEFORE INSERT OR UPDATE OF mode, decade, parent_session_id ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.sessions_validate_explore();