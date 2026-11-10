DROP POLICY "Admins read QA tags" ON public.interview_qa_sessions;
CREATE POLICY "Registered admins read QA tags" ON public.interview_qa_sessions FOR SELECT TO authenticated USING ((auth.jwt()->>'is_anonymous')::boolean IS NOT TRUE AND public.has_role(auth.uid(),'admin'));
DROP FUNCTION public.create_interview_qa(jsonb,text,numeric,jsonb);
CREATE FUNCTION public.create_interview_qa(p_owner uuid,p_vector jsonb,p_lane text,p_confidence numeric,p_candidates jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE sid uuid; BEGIN
 IF p_owner IS NULL OR NOT public.has_role(p_owner,'admin') THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
 INSERT INTO public.sessions(user_id,vector,lane,lane_confidence,probe_candidate_lanes,probe_state)
 VALUES(p_owner,p_vector,p_lane,p_confidence,ARRAY(SELECT jsonb_array_elements_text(p_candidates)),'{"probes_shown":[],"pending":{},"lane_alignment":{},"flips":[]}'::jsonb) RETURNING id INTO sid;
 INSERT INTO public.interview_qa_sessions(session_id,created_by,purpose) VALUES(sid,p_owner,'owner_qa');
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.create_interview_qa(uuid,jsonb,text,numeric,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_interview_qa(uuid,jsonb,text,numeric,jsonb) TO service_role;