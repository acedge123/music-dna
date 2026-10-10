ALTER TABLE public.choices ADD COLUMN IF NOT EXISTS mutation_id text, ADD COLUMN IF NOT EXISTS response jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS choices_session_mutation_unique ON public.choices (session_id, mutation_id) WHERE mutation_id IS NOT NULL;

CREATE TABLE public.session_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version integer NOT NULL,
  source text NOT NULL DEFAULT 'pairings',
  base_version integer,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  self_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  ledger_version text NOT NULL,
  policy_version text NOT NULL,
  engine_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, version)
);
GRANT SELECT, INSERT ON public.session_results TO authenticated;
GRANT ALL ON public.session_results TO service_role;
ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their result versions" ON public.session_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners add result versions for their sessions" ON public.session_results
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );
CREATE INDEX session_results_session_idx ON public.session_results (session_id, version DESC);