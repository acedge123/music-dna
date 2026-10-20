-- Review-only: do not apply to production without approval.
-- Mutations use authenticated subjects, session locks and immutable operation rows.
CREATE TABLE public.chat_turns (
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 mutation_id text NOT NULL, user_id uuid NOT NULL, message text NOT NULL,
 user_message_id uuid NOT NULL, assistant_message_id uuid, reply text,
 lease_token uuid NOT NULL, lease_until timestamptz NOT NULL,
 result_version integer, PRIMARY KEY(session_id, mutation_id)
);
GRANT SELECT ON public.chat_turns TO authenticated;
GRANT ALL ON public.chat_turns TO service_role;
ALTER TABLE public.chat_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_chat_turn ON public.chat_turns FOR SELECT TO authenticated
 USING (user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid()));
CREATE INDEX chat_history_cursor ON public.chat_messages(session_id, created_at DESC, id DESC);
ALTER TABLE public.sessions ADD COLUMN published_read jsonb;
-- Fail review/apply on duplicates; never silently delete feedback history.
CREATE UNIQUE INDEX IF NOT EXISTS result_feedback_mutation_unique
 ON public.result_feedback(session_id,mutation_id) WHERE mutation_id IS NOT NULL;

CREATE FUNCTION public.save_result_feedback(p_session_id uuid, p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); s public.sessions; r public.result_feedback; v integer;
 key text:=coalesce(nullif(p_payload->>'mutation_id',''),gen_random_uuid()::text);
 payload jsonb:=p_payload - 'mutation_id';
BEGIN
 SELECT * INTO s FROM sessions WHERE id=p_session_id AND user_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 v:=(payload->>'result_version')::integer;
 IF v IS NULL THEN SELECT max(version) INTO v FROM session_results WHERE session_id=p_session_id AND user_id=u; END IF;
 payload:=jsonb_build_object('accuracy',payload->>'accuracy','rating',(payload->>'rating')::smallint,
 'comment',payload->>'comment','target',payload->>'target','result_version',v,
 'most_accurate_sentence',payload->>'most_accurate_sentence','least_accurate_sentence',payload->>'least_accurate_sentence');
 SELECT * INTO r FROM result_feedback WHERE session_id=p_session_id AND user_id=u AND mutation_id=key;
 IF FOUND THEN
   IF jsonb_build_object('accuracy',r.accuracy,'rating',r.rating,'comment',r.comment,'target',r.target,
     'result_version',r.result_version,'most_accurate_sentence',r.most_accurate_sentence,
     'least_accurate_sentence',r.least_accurate_sentence) IS DISTINCT FROM payload THEN
     RAISE EXCEPTION 'MUTATION_CONFLICT' USING ERRCODE='23505'; END IF;
   RETURN jsonb_build_object('id',r.id,'updated',false,'replayed',true,'mutation_id',key,'result_version',r.result_version);
 END IF;
 v:=(payload->>'result_version')::integer;
 IF v IS NULL THEN SELECT max(version) INTO v FROM session_results WHERE session_id=p_session_id AND user_id=u; END IF;
 IF v IS NULL OR NOT EXISTS(SELECT 1 FROM session_results WHERE session_id=p_session_id AND user_id=u AND version=v) THEN
 RAISE EXCEPTION 'INVALID_RESULT_VERSION' USING ERRCODE='22023'; END IF;
 INSERT INTO result_feedback(user_id,session_id,accuracy,rating,comment,target,result_version,mutation_id,most_accurate_sentence,least_accurate_sentence)
 VALUES(u,p_session_id,payload->>'accuracy',(payload->>'rating')::smallint,payload->>'comment',payload->>'target',v,key,payload->>'most_accurate_sentence',payload->>'least_accurate_sentence') RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'updated',false,'replayed',false,'mutation_id',key,'result_version',v);
END $$;
-- Persist the resolved version in replay comparison: legacy callers resolve before RPC.
REVOKE INSERT, UPDATE, DELETE ON public.result_feedback FROM authenticated;

CREATE FUNCTION public.begin_chat_turn(p_session_id uuid,p_mutation_id text,p_message text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); t public.chat_turns; msg public.chat_messages; assistant public.chat_messages; token uuid:=gen_random_uuid();
BEGIN
 PERFORM 1 FROM sessions WHERE id=p_session_id AND user_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM chat_turns WHERE session_id=p_session_id AND mutation_id=p_mutation_id;
 IF FOUND THEN
 IF t.message<>p_message THEN RAISE EXCEPTION 'MUTATION_CONFLICT' USING ERRCODE='23505'; END IF;
 IF t.assistant_message_id IS NOT NULL THEN RETURN to_jsonb(t)||jsonb_build_object('replayed',true); END IF;
 IF t.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('pending',true,'user_message_id',t.user_message_id); END IF;
 UPDATE chat_turns SET lease_token=token,lease_until=clock_timestamp()+interval '60 seconds'
 WHERE session_id=p_session_id AND mutation_id=p_mutation_id RETURNING * INTO t;
 RETURN to_jsonb(t);
 END IF;
 -- Adopt pre-migration interrupted turns rather than leaving them pending forever.
 SELECT * INTO msg FROM chat_messages WHERE session_id=p_session_id AND role='user' AND mutation_id=p_mutation_id;
 IF FOUND AND msg.content<>p_message THEN RAISE EXCEPTION 'MUTATION_CONFLICT' USING ERRCODE='23505'; END IF;
 IF msg.id IS NULL THEN
 INSERT INTO chat_messages(session_id,user_id,role,content,mutation_id) VALUES(p_session_id,u,'user',p_message,p_mutation_id) RETURNING * INTO msg;
 END IF;
 SELECT * INTO assistant FROM chat_messages WHERE session_id=p_session_id AND role='assistant' AND mutation_id=p_mutation_id||':reply';
 INSERT INTO chat_turns(session_id,mutation_id,user_id,message,user_message_id,assistant_message_id,reply,lease_token,lease_until)
 VALUES(p_session_id,p_mutation_id,u,p_message,msg.id,assistant.id,assistant.content,token,clock_timestamp()+interval '60 seconds') RETURNING * INTO t;
 RETURN to_jsonb(t)||jsonb_build_object('replayed',assistant.id IS NOT NULL);
END $$;

CREATE FUNCTION public.complete_chat_turn(p_session_id uuid,p_mutation_id text,p_lease_token uuid,p_reply text,p_refinement jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); t public.chat_turns; a public.chat_messages; base public.session_results; latest public.session_results;
 v integer; report jsonb; revised jsonb; cumulative jsonb; correction text;
BEGIN
 PERFORM 1 FROM sessions WHERE id=p_session_id AND user_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM chat_turns WHERE session_id=p_session_id AND mutation_id=p_mutation_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CHAT_LEASE_LOST' USING ERRCODE='40001'; END IF;
 IF t.assistant_message_id IS NOT NULL THEN RETURN to_jsonb(t)||jsonb_build_object('replayed',true); END IF;
 IF t.lease_token IS DISTINCT FROM p_lease_token THEN RAISE EXCEPTION 'CHAT_LEASE_LOST' USING ERRCODE='40001'; END IF;
 IF nullif(trim(p_reply),'') IS NULL THEN RAISE EXCEPTION 'EMPTY_REPLY'; END IF;
 IF p_refinement IS NOT NULL THEN
 IF jsonb_typeof(p_refinement)<>'object' THEN RAISE EXCEPTION 'INVALID_REFINEMENT' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM jsonb_each(p_refinement))>5 OR EXISTS(
 SELECT 1 FROM jsonb_each(p_refinement) WHERE key NOT IN
 ('movement','atmosphere','immersion','scale','community','perspective','confidence','tension','texture','transformation')
 OR jsonb_typeof(value)<>'number') THEN RAISE EXCEPTION 'INVALID_REFINEMENT' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_refinement) WHERE abs(value::text::numeric)>10
 OR value::text::numeric<>trunc(value::text::numeric)) THEN RAISE EXCEPTION 'INVALID_REFINEMENT' USING ERRCODE='22023'; END IF;
 END IF;
 SELECT * INTO base FROM session_results WHERE session_id=p_session_id AND source='pairings' ORDER BY version LIMIT 1;
 SELECT * INTO latest FROM session_results WHERE session_id=p_session_id ORDER BY version DESC LIMIT 1;
 IF base.id IS NOT NULL AND p_refinement IS NOT NULL AND p_refinement<>'{}'::jsonb THEN
 v:=latest.version+1;
 SELECT coalesce(jsonb_object_agg(axis,total),'{}'::jsonb) INTO cumulative FROM (
 SELECT axis,sum(delta)::integer total FROM (
 SELECT key axis,value::text::numeric delta FROM jsonb_each(coalesce(latest.self_report->'deltas','{}'::jsonb))
 UNION ALL SELECT key,value::text::numeric FROM jsonb_each(p_refinement)
 ) values_by_axis GROUP BY axis) totals;
 SELECT string_agg(CASE key
 WHEN 'movement' THEN CASE WHEN value::text::numeric>0 THEN 'forward motion rather than stillness' ELSE 'stillness rather than forward motion' END
 WHEN 'atmosphere' THEN CASE WHEN value::text::numeric>0 THEN 'immersive mood rather than statement' ELSE 'statement rather than immersive mood' END
 WHEN 'immersion' THEN CASE WHEN value::text::numeric>0 THEN 'slow reveal rather than immediacy' ELSE 'immediacy rather than slow reveal' END
 WHEN 'scale' THEN CASE WHEN value::text::numeric>0 THEN 'vastness rather than intimacy' ELSE 'intimacy rather than vastness' END
 WHEN 'community' THEN CASE WHEN value::text::numeric>0 THEN 'communal rather than solitary listening' ELSE 'solitary rather than communal listening' END
 WHEN 'perspective' THEN CASE WHEN value::text::numeric>0 THEN 'witness rather than feeling' ELSE 'feeling rather than witness' END
 WHEN 'confidence' THEN CASE WHEN value::text::numeric>0 THEN 'command rather than vulnerability' ELSE 'vulnerability rather than command' END
 WHEN 'tension' THEN CASE WHEN value::text::numeric>0 THEN 'danger rather than release' ELSE 'release rather than danger' END
 WHEN 'texture' THEN CASE WHEN value::text::numeric>0 THEN 'refinement rather than rawness' ELSE 'rawness rather than refinement' END
 WHEN 'transformation' THEN CASE WHEN value::text::numeric>0 THEN 'music that takes you somewhere rather than holds its shape' ELSE 'music that holds its shape rather than takes you somewhere' END
 END, '; ' ORDER BY key) INTO correction FROM jsonb_each(cumulative) WHERE value::text::numeric<>0;
 report:=jsonb_build_object('originating_mutation_id',p_mutation_id,'user_message_id',t.user_message_id,
 'message',t.message,'applied_deltas',p_refinement,'deltas',cumulative,'previous_version',latest.version,'kind','explicit_self_report',
 'renderer_version','self-report-revision-v1',
 'turns',coalesce((latest.self_report->>'turns')::integer,0)+1);
 -- Never turn self-report into corroborating votes: preserve the frozen evidence and qualify the revision.
 revised:=base.content||jsonb_build_object('synthesis',coalesce(base.content->>'synthesis','')||E'\n\nYour own account changes the angle: '||coalesce(correction,'your earlier correction is now mixed')||'. That qualifies the reading above; it does not erase what the picks showed. This is self-report, not another supporting vote.',
 'refinement',report);
 INSERT INTO session_results(session_id,user_id,version,source,base_version,content,evidence,self_report,ledger_version,policy_version,engine_version)
 VALUES(p_session_id,u,v,'chat_self_report',base.version,revised,base.evidence,report,base.ledger_version,base.policy_version,base.engine_version);
 INSERT INTO event_log(user_id,session_id,event_type,props,client) VALUES(u,p_session_id,'self_report',report,'server');
 END IF;
 INSERT INTO chat_messages(session_id,user_id,role,content,mutation_id) VALUES(p_session_id,u,'assistant',p_reply,p_mutation_id||':reply') RETURNING * INTO a;
 UPDATE chat_turns SET assistant_message_id=a.id,reply=a.content,result_version=v WHERE session_id=p_session_id AND mutation_id=p_mutation_id RETURNING * INTO t;
 RETURN to_jsonb(t)||jsonb_build_object('replayed',false);
END $$;
CREATE FUNCTION public.release_chat_turn(p_session_id uuid,p_mutation_id text,p_lease_token uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE chat_turns SET lease_until=clock_timestamp() WHERE session_id=p_session_id AND mutation_id=p_mutation_id
 AND user_id=auth.uid() AND lease_token=p_lease_token AND assistant_message_id IS NULL;
$$;

CREATE FUNCTION public.publish_saved_read(p_session_id uuid,p_publish boolean,p_version integer DEFAULT NULL) RETURNS jsonb
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
CREATE FUNCTION public.lookup_published_read(p_token text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT published_read||jsonb_build_object('share_token',share_token) FROM sessions
 WHERE is_public AND completed_at IS NOT NULL AND published_read IS NOT NULL
 AND share_token=p_token LIMIT 1;
$$;
-- Only trusted publication transactions can alter consent/snapshot fields.
CREATE FUNCTION public.guard_publication_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND
 (NEW.published_read IS DISTINCT FROM OLD.published_read OR NEW.is_public IS DISTINCT FROM OLD.is_public OR NEW.share_token IS DISTINCT FROM OLD.share_token)
 THEN RAISE EXCEPTION 'Use publish_saved_read' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_publication_snapshot BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.guard_publication_snapshot();
REVOKE ALL ON FUNCTION public.save_result_feedback(uuid,jsonb),public.begin_chat_turn(uuid,text,text),public.complete_chat_turn(uuid,text,uuid,text,jsonb),public.release_chat_turn(uuid,text,uuid),public.publish_saved_read(uuid,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_result_feedback(uuid,jsonb),public.begin_chat_turn(uuid,text,text),public.complete_chat_turn(uuid,text,uuid,text,jsonb),public.release_chat_turn(uuid,text,uuid),public.publish_saved_read(uuid,boolean,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.lookup_published_read(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_published_read(text) TO anon,authenticated,service_role;
