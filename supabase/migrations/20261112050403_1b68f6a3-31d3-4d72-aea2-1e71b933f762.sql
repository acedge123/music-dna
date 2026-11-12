CREATE OR REPLACE FUNCTION public.sessions_validate_explore()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.mode NOT IN ('discover','explore','refine') THEN RAISE EXCEPTION 'invalid session mode'; END IF;
  IF NEW.mode = 'discover' THEN
    IF NEW.decade IS NOT NULL OR NEW.parent_session_id IS NOT NULL THEN RAISE EXCEPTION 'discover sessions have no decade/parent'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.mode = 'explore' THEN
    IF NEW.decade IS NULL OR NEW.decade NOT IN (1970,1980,1990,2000,2010,2020) THEN RAISE EXCEPTION 'invalid decade'; END IF;
  ELSE
    IF NEW.decade IS NOT NULL THEN RAISE EXCEPTION 'refine sessions have no decade'; END IF;
  END IF;
  IF NEW.parent_session_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sessions p WHERE p.id = NEW.parent_session_id AND p.user_id = NEW.user_id AND p.mode = 'discover' AND p.completed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'child session needs a completed reading owned by the same listener'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.mode IS DISTINCT FROM OLD.mode OR NEW.decade IS DISTINCT FROM OLD.decade OR NEW.parent_session_id IS DISTINCT FROM OLD.parent_session_id) THEN
    RAISE EXCEPTION 'child session identity is immutable';
  END IF;
  RETURN NEW;
END $$;