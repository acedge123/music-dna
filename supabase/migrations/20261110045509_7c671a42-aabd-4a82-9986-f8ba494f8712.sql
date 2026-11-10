CREATE TABLE public.critic_quality_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE, user_id uuid NOT NULL,
 attempt_key text NOT NULL, stage text NOT NULL CHECK(stage IN ('choice','read','reveal','chat')), result_version integer,
 writer_version text NOT NULL, reviewer_version text NOT NULL, status text NOT NULL, rejection_reason text, review_checks jsonb,
 evidence_context jsonb NOT NULL, calls jsonb NOT NULL DEFAULT '[]', output_text text NOT NULL, output_fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,attempt_key)
);
GRANT SELECT ON public.critic_quality_attempts TO authenticated;
GRANT ALL ON public.critic_quality_attempts TO service_role;
ALTER TABLE public.critic_quality_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY critic_quality_admin_read ON public.critic_quality_attempts FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TRIGGER critic_quality_attempts_updated BEFORE UPDATE ON public.critic_quality_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.critic_quality_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL REFERENCES public.critic_quality_attempts(id) ON DELETE CASCADE,
 reviewer_id uuid NOT NULL, rubric_version text NOT NULL DEFAULT 'critic-quality-rubric-v1', evaluator_type text NOT NULL DEFAULT 'human' CHECK(evaluator_type='human'),
 inference_accuracy smallint CHECK(inference_accuracy BETWEEN 1 AND 5), musical_specificity smallint CHECK(musical_specificity BETWEEN 1 AND 5), prose_originality smallint CHECK(prose_originality BETWEEN 1 AND 5), conversational_relevance smallint CHECK(conversational_relevance BETWEEN 1 AND 5),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(attempt_id,reviewer_id,rubric_version)
);
GRANT SELECT,INSERT ON public.critic_quality_reviews TO authenticated;
GRANT ALL ON public.critic_quality_reviews TO service_role;
ALTER TABLE public.critic_quality_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY critic_reviews_admin_read ON public.critic_quality_reviews FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY critic_reviews_admin_insert ON public.critic_quality_reviews FOR INSERT TO authenticated WITH CHECK(reviewer_id=auth.uid() AND public.has_role(auth.uid(),'admin') AND rubric_version='critic-quality-rubric-v1');
CREATE TRIGGER critic_quality_reviews_updated BEFORE UPDATE ON public.critic_quality_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.pairing_exposures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE, user_id uuid NOT NULL,
 offer_key text NOT NULL, pairing_id uuid NOT NULL REFERENCES public.pairings(id), lane text NOT NULL, catalog_revision text NOT NULL,
 songs jsonb NOT NULL, served_at timestamptz NOT NULL DEFAULT now(), reported_shown_at timestamptz, client text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,offer_key)
);
GRANT SELECT ON public.pairing_exposures TO authenticated;
GRANT ALL ON public.pairing_exposures TO service_role;
ALTER TABLE public.pairing_exposures ENABLE ROW LEVEL SECURITY;
CREATE POLICY pairing_exposures_admin_read ON public.pairing_exposures FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TRIGGER pairing_exposures_updated BEFORE UPDATE ON public.pairing_exposures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX critic_quality_queue ON public.critic_quality_attempts(created_at DESC,id);
CREATE INDEX pairing_exposures_session ON public.pairing_exposures(session_id,served_at);
COMMENT ON TABLE public.critic_quality_attempts IS 'Local-only diagnostics. Contains private saved prose; never an export projection. No historical reconstruction.';
COMMENT ON TABLE public.pairing_exposures IS 'Trusted served snapshots. reported_shown_at is a client acknowledgement, not independently proven viewing.';