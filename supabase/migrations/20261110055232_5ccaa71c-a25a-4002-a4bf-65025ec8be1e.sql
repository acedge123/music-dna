CREATE TABLE public.interview_qa_sessions (
 session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 purpose text NOT NULL CHECK (purpose = 'owner_qa'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interview_qa_sessions TO authenticated;
GRANT ALL ON public.interview_qa_sessions TO service_role;
ALTER TABLE public.interview_qa_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read QA tags" ON public.interview_qa_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.interview_qa_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER interview_qa_updated BEFORE UPDATE ON public.interview_qa_sessions FOR EACH ROW EXECUTE FUNCTION public.interview_qa_touch();
CREATE FUNCTION public.create_interview_qa(p_vector jsonb,p_lane text,p_confidence numeric,p_candidates jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
 INSERT INTO public.sessions(user_id,vector,lane,lane_confidence,probe_candidate_lanes,probe_state)
 VALUES(auth.uid(),p_vector,p_lane,p_confidence,p_candidates,'{"probes_shown":[],"pending":{},"lane_alignment":{},"flips":[]}'::jsonb) RETURNING id INTO sid;
 INSERT INTO public.interview_qa_sessions(session_id,created_by,purpose) VALUES(sid,auth.uid(),'owner_qa');
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.create_interview_qa(jsonb,text,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_interview_qa(jsonb,text,numeric,jsonb) TO authenticated;
DO $$ DECLARE n text; d text; BEGIN
 FOREACH n IN ARRAY ARRAY['v_session_stability','v_axis_independence','v_contradiction_load','v_residual_rate','v_human_agreement'] LOOP
 SELECT pg_get_viewdef(format('public.%I',n)::regclass,true) INTO d;
 EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_invoker=true) AS SELECT original.* FROM (%s) original WHERE NOT EXISTS (SELECT 1 FROM public.interview_qa_sessions qa WHERE qa.session_id=original.session_id)',n,rtrim(d,E';\n '));
 END LOOP;
END $$;
COMMENT ON TABLE public.interview_qa_sessions IS 'Operator-created owner QA only. Not independent synthetic evidence or learning enrollment. Excluded from listener metrics.';