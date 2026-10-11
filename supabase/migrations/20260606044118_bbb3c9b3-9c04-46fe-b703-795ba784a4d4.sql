
-- 1. Generic event log: every behavioral signal lands here
CREATE TABLE public.event_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  -- typed refs (nullable; populated when relevant)
  pairing_id UUID REFERENCES public.pairings(id) ON DELETE SET NULL,
  choice_id UUID REFERENCES public.choices(id) ON DELETE SET NULL,
  -- behavior metrics
  response_time_ms INTEGER,
  -- experiment fields for future A/B
  variant TEXT,
  experiment_key TEXT,
  -- flexible payload for event-specific fields
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- client/runtime context (no PII)
  client TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_log_user_idx ON public.event_log(user_id, created_at DESC);
CREATE INDEX event_log_session_idx ON public.event_log(session_id, created_at);
CREATE INDEX event_log_type_idx ON public.event_log(event_type, created_at DESC);
CREATE INDEX event_log_pairing_idx ON public.event_log(pairing_id) WHERE pairing_id IS NOT NULL;

GRANT SELECT, INSERT ON public.event_log TO authenticated;
GRANT ALL ON public.event_log TO service_role;

ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert their own events"
  ON public.event_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read their own events"
  ON public.event_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. LLM call log: every model invocation, separately from session_reasoning
CREATE TABLE public.llm_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                  -- 'analyst' | 'critic' | other
  model TEXT NOT NULL,                 -- e.g. 'google/gemini-2.5-flash'
  prompt_version TEXT NOT NULL,        -- bumpable string, e.g. 'critic-v1'
  status TEXT NOT NULL,                -- 'ok' | 'error' | 'fallback'
  latency_ms INTEGER,
  error_message TEXT,
  -- artifacts: keep reasoning separate from final prose
  input_summary JSONB,                 -- what was fed in (e.g. allowed_claims, observation counts)
  output JSONB,                        -- full structured response
  narrative TEXT,                      -- final user-facing prose (Critic only)
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX llm_calls_session_idx ON public.llm_calls(session_id);
CREATE INDEX llm_calls_user_idx ON public.llm_calls(user_id, created_at DESC);
CREATE INDEX llm_calls_role_version_idx ON public.llm_calls(role, prompt_version, created_at DESC);

GRANT SELECT, INSERT ON public.llm_calls TO authenticated;
GRANT ALL ON public.llm_calls TO service_role;

ALTER TABLE public.llm_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read their own llm calls"
  ON public.llm_calls FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Writes happen from server functions via service_role, but allow user inserts scoped to self
CREATE POLICY "users insert their own llm calls"
  ON public.llm_calls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Result feedback: accuracy ratings, thumbs, optional text
CREATE TABLE public.result_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  accuracy TEXT,                       -- 'accurate' | 'not_accurate' | 'mixed'
  rating SMALLINT,                     -- thumbs: -1, 0, 1
  comment TEXT,
  -- which claim/dimension was being rated, if granular
  target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX result_feedback_session_idx ON public.result_feedback(session_id);
CREATE INDEX result_feedback_user_idx ON public.result_feedback(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.result_feedback TO authenticated;
GRANT ALL ON public.result_feedback TO service_role;

ALTER TABLE public.result_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage their own feedback"
  ON public.result_feedback FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_result_feedback_updated_at
  BEFORE UPDATE ON public.result_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Experiment assignments: stable variant per (user, experiment)
CREATE TABLE public.experiment_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experiment_key TEXT NOT NULL,
  variant TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, experiment_key)
);

CREATE INDEX experiment_assignments_user_idx ON public.experiment_assignments(user_id);
CREATE INDEX experiment_assignments_key_idx ON public.experiment_assignments(experiment_key, variant);

GRANT SELECT, INSERT ON public.experiment_assignments TO authenticated;
GRANT ALL ON public.experiment_assignments TO service_role;

ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read their own assignments"
  ON public.experiment_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users insert their own assignments"
  ON public.experiment_assignments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
