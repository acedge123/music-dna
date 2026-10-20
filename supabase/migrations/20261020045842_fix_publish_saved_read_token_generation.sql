-- Applied migration 20261020045842: use core UUID generation under search_path=public.
-- Keep owner checks, frozen snapshots, grants, and revoke token rotation unchanged.
CREATE OR REPLACE FUNCTION public.publish_saved_read(p_session_id uuid,p_publish boolean,p_version integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); s public.sessions; r public.session_results; snapshot jsonb;
BEGIN
 SELECT * INTO s FROM sessions WHERE id=p_session_id AND user_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_publish THEN
 IF s.completed_at IS NULL THEN RAISE EXCEPTION 'Finish the reading before sharing it.'; END IF;
 SELECT * INTO r FROM session_results WHERE session_id=p_session_id AND user_id=u AND (p_version IS NULL OR version=p_version) ORDER BY version DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_RESULT_VERSION' USING ERRCODE='22023'; END IF;
 snapshot:=jsonb_build_object('session_id',s.id,'completed_at',s.completed_at,'lane',s.lane,'result_version',r.version,
 'content',r.content,'evidence',r.evidence,'interpretation',r.content->>'synthesis',
 'archetype',(SELECT jsonb_build_object('id',id,'name',name,'tagline',tagline,'description',description) FROM archetypes WHERE id=s.archetype_id));
 UPDATE sessions SET is_public=true,share_token=coalesce(share_token,replace(gen_random_uuid()::text,'-','')),published_read=snapshot WHERE id=p_session_id RETURNING * INTO s;
 ELSE
 UPDATE sessions SET is_public=false,share_token=replace(gen_random_uuid()::text,'-',''),published_read=NULL WHERE id=p_session_id RETURNING * INTO s;
 END IF;
 RETURN jsonb_build_object('is_public',s.is_public,'share_token',CASE WHEN p_publish THEN s.share_token END,'result_version',CASE WHEN p_publish THEN r.version END);
END $$;
