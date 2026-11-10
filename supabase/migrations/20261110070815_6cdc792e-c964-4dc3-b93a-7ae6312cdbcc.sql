ALTER TABLE public.critic_quality_reviews ADD COLUMN entertainment smallint CHECK (entertainment BETWEEN 1 AND 5);

CREATE TABLE public.critic_session_verdicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  rubric_version text NOT NULL,
  keep_talking text NOT NULL CHECK (keep_talking IN ('yes','maybe','no')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, reviewer_id)
);
GRANT SELECT, INSERT ON public.critic_session_verdicts TO authenticated;
GRANT ALL ON public.critic_session_verdicts TO service_role;
ALTER TABLE public.critic_session_verdicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY critic_verdicts_admin_read ON public.critic_session_verdicts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY critic_verdicts_admin_insert ON public.critic_session_verdicts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND reviewer_id = auth.uid());
CREATE TRIGGER critic_session_verdicts_updated BEFORE UPDATE ON public.critic_session_verdicts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();