
CREATE TABLE public.session_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  counterarguments jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_thresholds jsonb NOT NULL DEFAULT '{"supporting_choices":3,"confidence_threshold":0.65}'::jsonb,
  narrative text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_reasoning TO authenticated;
GRANT ALL ON public.session_reasoning TO service_role;

ALTER TABLE public.session_reasoning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own reasoning"
  ON public.session_reasoning FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own reasoning"
  ON public.session_reasoning FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own reasoning"
  ON public.session_reasoning FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX session_reasoning_user_idx ON public.session_reasoning(user_id);

CREATE TRIGGER update_session_reasoning_updated_at
  BEFORE UPDATE ON public.session_reasoning
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
