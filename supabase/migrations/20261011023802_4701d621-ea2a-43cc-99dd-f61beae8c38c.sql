ALTER TABLE public.result_feedback ADD COLUMN IF NOT EXISTS result_version integer;
ALTER TABLE public.result_feedback ADD COLUMN IF NOT EXISTS mutation_id text;
CREATE UNIQUE INDEX IF NOT EXISTS result_feedback_session_mutation_unique
  ON public.result_feedback (session_id, mutation_id) WHERE mutation_id IS NOT NULL;