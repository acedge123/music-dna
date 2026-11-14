CREATE TABLE public.critic_exemplars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL CHECK (char_length(text) BETWEEN 8 AND 400),
  why_it_works text CHECK (why_it_works IS NULL OR char_length(why_it_works) <= 300),
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','approved','retired')),
  source_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  source_attempt_id uuid REFERENCES public.critic_quality_attempts(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (text)
);
GRANT SELECT, INSERT, UPDATE ON public.critic_exemplars TO authenticated;
GRANT ALL ON public.critic_exemplars TO service_role;
ALTER TABLE public.critic_exemplars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read exemplars" ON public.critic_exemplars FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add exemplars" ON public.critic_exemplars FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY "Admins update exemplars" ON public.critic_exemplars FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER critic_exemplars_touch BEFORE UPDATE ON public.critic_exemplars FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();