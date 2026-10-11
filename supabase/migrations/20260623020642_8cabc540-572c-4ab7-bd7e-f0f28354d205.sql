CREATE TABLE public.test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  opener_songs text[],
  pairing_count int NOT NULL DEFAULT 6,
  pairings_used int NOT NULL DEFAULT 0,
  current_pairing_id uuid,
  current_pairing_payload jsonb,
  opener_payload jsonb,
  choices_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  report jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.test_runs TO service_role;

ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.test_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_test_runs_updated_at BEFORE UPDATE ON public.test_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_test_runs_persona ON public.test_runs(persona_id);