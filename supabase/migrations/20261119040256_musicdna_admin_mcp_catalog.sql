-- Operator-only extensions to the existing catalog/review system. No grants,
-- sources, model calls, activations or historical invented review records.
CREATE SCHEMA IF NOT EXISTS musicdna_admin_mcp;
REVOKE ALL ON SCHEMA musicdna_admin_mcp FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA musicdna_admin_mcp TO authenticated;

CREATE TABLE public.musicdna_mcp_grants (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('catalog_reader','qa_auditor','catalog_editor','reviewer')),
 granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 PRIMARY KEY(user_id,role)
);
GRANT SELECT ON public.musicdna_mcp_grants TO authenticated;
GRANT ALL ON public.musicdna_mcp_grants TO service_role;
ALTER TABLE public.musicdna_mcp_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_grants_self ON public.musicdna_mcp_grants FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));

-- Private, narrowly defined role lookup avoids RLS recursion. No caller-supplied actor.
CREATE FUNCTION musicdna_admin_mcp.can(cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT cap IN ('catalog_read','catalog_propose','catalog_review','qa_read') AND auth.uid() IS NOT NULL
 AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND NOT coalesce(is_anonymous,false))
 AND (public.has_role(auth.uid(),'admin') OR EXISTS (
  SELECT 1 FROM public.musicdna_mcp_grants g WHERE g.user_id=auth.uid() AND g.revoked_at IS NULL
   AND CASE cap
    WHEN 'catalog_read' THEN g.role IN ('catalog_reader','qa_auditor','catalog_editor','reviewer')
    WHEN 'catalog_propose' THEN g.role='catalog_editor'
    WHEN 'catalog_review' THEN g.role='reviewer'
    WHEN 'qa_read' THEN g.role='qa_auditor'
    ELSE false END));
$$;
REVOKE ALL ON FUNCTION musicdna_admin_mcp.can(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION musicdna_admin_mcp.can(text) TO authenticated;
CREATE FUNCTION public.musicdna_mcp_access() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
 SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('catalog_read',musicdna_admin_mcp.can('catalog_read'),
 'catalog_propose',musicdna_admin_mcp.can('catalog_propose'),
 'catalog_review',musicdna_admin_mcp.can('catalog_review'),'qa_read',musicdna_admin_mcp.can('qa_read'));
$$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_access() TO authenticated;
CREATE POLICY mcp_catalog_explanations_read ON public.song_trait_explanations
 FOR SELECT TO authenticated USING(musicdna_admin_mcp.can('catalog_read'));

CREATE FUNCTION musicdna_admin_mcp.why_version(row_value jsonb) RETURNS text
 LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT 'why-v1:'||encode(sha256(convert_to(row_value::text,'UTF8')),'hex');
$$;
REVOKE ALL ON FUNCTION musicdna_admin_mcp.why_version(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION musicdna_admin_mcp.why_version(jsonb) TO authenticated;

CREATE TABLE public.musicdna_song_why_history (
 id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 explanation_id uuid NOT NULL REFERENCES public.song_trait_explanations(id) ON DELETE CASCADE,
 version text NOT NULL, snapshot jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 recording_kind text NOT NULL CHECK(recording_kind IN ('baseline','before_change','after_change')),
 PRIMARY KEY(explanation_id,version)
);
GRANT SELECT ON public.musicdna_song_why_history TO authenticated;
GRANT ALL ON public.musicdna_song_why_history TO service_role;
ALTER TABLE public.musicdna_song_why_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_why_history_read ON public.musicdna_song_why_history FOR SELECT TO authenticated
 USING(musicdna_admin_mcp.can('catalog_read'));
-- A baseline is the current saved row, not a reconstruction of its earlier drafts.
INSERT INTO public.musicdna_song_why_history(explanation_id,version,snapshot,recording_kind)
 SELECT id,musicdna_admin_mcp.why_version(to_jsonb(w)),to_jsonb(w),'baseline'
 FROM public.song_trait_explanations w;
CREATE FUNCTION musicdna_admin_mcp.capture_why_history() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  INSERT INTO public.musicdna_song_why_history(explanation_id,version,snapshot,recording_kind)
  VALUES(OLD.id,musicdna_admin_mcp.why_version(to_jsonb(OLD)),to_jsonb(OLD),'before_change')
  ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO public.musicdna_song_why_history(explanation_id,version,snapshot,recording_kind)
 VALUES(NEW.id,musicdna_admin_mcp.why_version(to_jsonb(NEW)),to_jsonb(NEW),'after_change')
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION musicdna_admin_mcp.capture_why_history() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER musicdna_why_history AFTER INSERT OR UPDATE ON public.song_trait_explanations
 FOR EACH ROW EXECUTE FUNCTION musicdna_admin_mcp.capture_why_history();

CREATE TABLE public.musicdna_song_why_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 explanation_id uuid NOT NULL REFERENCES public.song_trait_explanations(id) ON DELETE CASCADE,
 base_version text NOT NULL, base_snapshot jsonb NOT NULL,
 audible_evidence text NOT NULL CHECK(length(trim(audible_evidence)) BETWEEN 10 AND 300),
 interpretation text NOT NULL CHECK(length(trim(interpretation)) BETWEEN 10 AND 300),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
 supporting_evidence jsonb NOT NULL,
 author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 mutation_id uuid NOT NULL, request_hash text NOT NULL,
 status text NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','rejected')),
 reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, reviewed_at timestamptz,
 decision_id uuid, decision_hash text,
 created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(author_id,mutation_id)
);
GRANT SELECT ON public.musicdna_song_why_proposals TO authenticated;
GRANT ALL ON public.musicdna_song_why_proposals TO service_role;
ALTER TABLE public.musicdna_song_why_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_proposals_read ON public.musicdna_song_why_proposals FOR SELECT TO authenticated
 USING(musicdna_admin_mcp.can('catalog_review') OR
 (author_id=(SELECT auth.uid()) AND musicdna_admin_mcp.can('catalog_propose')));
CREATE INDEX mcp_proposals_queue ON public.musicdna_song_why_proposals(status,created_at,id);

CREATE TABLE public.musicdna_catalog_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 action text NOT NULL, object_id uuid NOT NULL, before_version text, after_version text,
 mutation_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,action,mutation_id)
);
GRANT SELECT ON public.musicdna_catalog_audit_events TO authenticated;
GRANT ALL ON public.musicdna_catalog_audit_events TO service_role;
ALTER TABLE public.musicdna_catalog_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_audit_read ON public.musicdna_catalog_audit_events FOR SELECT TO authenticated
 USING(musicdna_admin_mcp.can('catalog_review'));

CREATE TABLE public.musicdna_song_why_audit_findings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), explanation_id uuid NOT NULL REFERENCES public.song_trait_explanations(id) ON DELETE CASCADE,
 base_version text NOT NULL, finding_key text NOT NULL,
 severity text NOT NULL CHECK(severity IN ('info','warning','error')),
 category text NOT NULL, excerpt text NOT NULL, explanation text NOT NULL,
 suggested_wording text, verification_kind text NOT NULL CHECK(verification_kind IN ('catalog_fact','text_inference','requires_listening')),
 auditor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, mutation_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mcp_unresolved_finding ON public.musicdna_song_why_audit_findings(explanation_id,base_version,finding_key) WHERE status='open';
GRANT SELECT ON public.musicdna_song_why_audit_findings TO authenticated;
GRANT ALL ON public.musicdna_song_why_audit_findings TO service_role;
ALTER TABLE public.musicdna_song_why_audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_findings_read ON public.musicdna_song_why_audit_findings FOR SELECT TO authenticated
 USING(musicdna_admin_mcp.can('catalog_read'));

CREATE TABLE public.musicdna_mcp_exports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 mutation_id uuid NOT NULL, request_hash text NOT NULL, filters jsonb NOT NULL, format text NOT NULL CHECK(format IN ('json','csv')),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','ready','failed')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 snapshot jsonb, generated_at timestamptz, total_count integer, error_code text,
 UNIQUE(user_id,mutation_id)
);
GRANT SELECT ON public.musicdna_mcp_exports TO authenticated;
GRANT ALL ON public.musicdna_mcp_exports TO service_role;
ALTER TABLE public.musicdna_mcp_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_exports_owner ON public.musicdna_mcp_exports FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) AND musicdna_admin_mcp.can('catalog_read') AND expires_at>now());

-- One authoritative projection: full saved explanation, exact score/axis and honest gaps.
CREATE VIEW public.musicdna_mcp_whys WITH(security_invoker=true) AS
SELECT w.id,w.song_id,w.axis,w.status,w.confidence,w.created_at,w.updated_at,
 musicdna_admin_mcp.why_version(to_jsonb(w)) AS source_version,
 s.title,s.artist,s.year,s.primary_lane AS genre,
 (to_jsonb(s)->>w.axis)::numeric AS current_score,
 w.score_at_write IS DISTINCT FROM (to_jsonb(s)->>w.axis)::numeric AS stale,
 jsonb_build_object(
  'explanation',to_jsonb(w),'version',musicdna_admin_mcp.why_version(to_jsonb(w)),
  'song',jsonb_build_object('id',s.id,'title',s.title,'artist',s.artist,'year',s.year,'genre',s.primary_lane,'subgenre',s.sub_lane,'active',s.active),
  'attribute',jsonb_build_object('key',a.key,'low_pole',a.low_pole,'high_pole',a.high_pole,'definition',a.tradeoff_sentence,'label',a.analyst_label,'min',0,'max',100,'current_score',(to_jsonb(s)->>w.axis)::numeric,'score_at_write',w.score_at_write),
  'availability',jsonb_build_object('writer_model_id','not_recorded','reviewer_model_id','not_recorded','reviewer_confidence_numeric','not_recorded','audio_verification','requires_listening','historical_edits_before_baseline','not_recorded')
 ) AS record
FROM public.song_trait_explanations w JOIN public.songs s ON s.id=w.song_id
 LEFT JOIN public.axes a ON a.key=w.axis
WHERE musicdna_admin_mcp.can('catalog_read');
REVOKE ALL ON public.musicdna_mcp_whys FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.musicdna_mcp_whys TO authenticated;

CREATE FUNCTION public.musicdna_mcp_catalog_summary() RETURNS jsonb LANGUAGE plpgsql STABLE
 SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_read') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'songs',jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE active),'inactive',count(*) FILTER(WHERE NOT active),
    'missing_year',count(*) FILTER(WHERE year IS NULL),'last_updated',max(updated_at),
    'incomplete_attributes',count(*) FILTER(WHERE movement IS NULL OR atmosphere IS NULL OR immersion IS NULL OR scale IS NULL OR community IS NULL OR perspective IS NULL OR confidence IS NULL OR tension IS NULL OR texture IS NULL OR transformation IS NULL),
    'missing_metadata',count(*) FILTER(WHERE year IS NULL OR nullif(trim(title),'') IS NULL OR nullif(trim(artist),'') IS NULL OR nullif(trim(primary_lane),'') IS NULL),
    'without_displayable_artwork',count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM public.song_artwork a WHERE a.song_id=s.id AND a.display_enabled AND a.match_status='verified' AND a.rights_status IN ('licensed','permission_granted') AND nullif(trim(a.rights_reference),'') IS NOT NULL AND a.image_url LIKE 'https://%')),
    'without_approved_why',count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM public.song_trait_explanations w WHERE w.song_id=s.id AND w.status='approved')),
    'never_in_catalog_pairing',count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM public.pairings p WHERE s.id IN(p.song_a_id,p.song_b_id))))
 ) INTO result FROM public.songs s;
 RETURN result || jsonb_build_object(
  'by_decade',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT (year/10)*10 decade,count(*) songs FROM public.songs GROUP BY (year/10)*10 ORDER BY decade NULLS LAST)x),
  'by_genre',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT primary_lane genre,count(*) songs FROM public.songs GROUP BY primary_lane ORDER BY primary_lane)x),
  'why_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}') FROM (SELECT status,count(*) n FROM public.song_trait_explanations GROUP BY status)x),
  'why_by_attribute',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT axis,status,count(*) explanations FROM public.song_trait_explanations GROUP BY axis,status ORDER BY axis,status)x),
  'why_by_decade_genre',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT (s.year/10)*10 decade,s.primary_lane genre,w.status,count(*) explanations FROM public.song_trait_explanations w JOIN public.songs s ON s.id=w.song_id GROUP BY (s.year/10)*10,s.primary_lane,w.status ORDER BY decade,genre,status)x),
  'why_coverage',(SELECT jsonb_agg(x) FROM(SELECT explanations,count(*) songs FROM(SELECT s.id,count(w.id) explanations FROM public.songs s LEFT JOIN public.song_trait_explanations w ON w.song_id=s.id AND w.status='approved' GROUP BY s.id)y GROUP BY explanations ORDER BY explanations)x),
  'revisions_since_baseline',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT explanation_id,count(*)-1 recorded_changes FROM public.musicdna_song_why_history GROUP BY explanation_id HAVING count(*)>1 ORDER BY recorded_changes DESC,explanation_id LIMIT 20)x),
  'usage',jsonb_build_object('source','catalog pairing participation only; live exposure/skip statistics require QA metrics'),
  'unavailable',jsonb_build_object('reviewer_pass_fail_statistics','Rejected model drafts were not persisted; saved rejected rows are human review status, not a model failure rate','most_frequently_revised','History begins at the new baseline; no older edit count is reconstructed'));
END $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_catalog_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_catalog_summary() TO authenticated;

CREATE FUNCTION public.musicdna_mcp_submit_why_revision(p_id uuid,p_base_version text,p_hear text,p_means text,p_reason text,p_evidence jsonb,p_mutation uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE base public.song_trait_explanations; prior public.musicdna_song_why_proposals; new_id uuid; request_hash text;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_propose') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_hear IS NULL OR p_means IS NULL OR p_reason IS NULL OR p_mutation IS NULL OR p_base_version IS NULL OR p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'array' OR octet_length(p_evidence::text)>20000
  OR length(trim(p_hear)) NOT BETWEEN 10 AND 300 OR length(trim(p_means)) NOT BETWEEN 10 AND 300 OR length(trim(p_reason)) NOT BETWEEN 10 AND 2000
 THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 request_hash:=musicdna_admin_mcp.why_version(jsonb_build_array(p_id,p_base_version,trim(p_hear),trim(p_means),trim(p_reason),p_evidence));
 -- Serialize a caller's idempotency key, including simultaneous retries.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,0));
 SELECT * INTO prior FROM public.musicdna_song_why_proposals WHERE author_id=auth.uid() AND mutation_id=p_mutation;
 IF FOUND THEN
  IF prior.request_hash<>request_hash THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('id',prior.id,'status',prior.status,'version',prior.version,'replayed',true);
 END IF;
 SELECT * INTO base FROM public.song_trait_explanations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MCP_NOT_FOUND'; END IF;
 IF musicdna_admin_mcp.why_version(to_jsonb(base))<>p_base_version THEN RAISE EXCEPTION 'MCP_STALE_VERSION'; END IF;
 INSERT INTO public.musicdna_song_why_proposals(explanation_id,base_version,base_snapshot,audible_evidence,interpretation,reason,supporting_evidence,author_id,mutation_id,request_hash)
 VALUES(p_id,p_base_version,to_jsonb(base),trim(p_hear),trim(p_means),trim(p_reason),p_evidence,auth.uid(),p_mutation,request_hash) RETURNING id INTO new_id;
 INSERT INTO public.musicdna_catalog_audit_events(actor_id,action,object_id,before_version,mutation_id)
 VALUES(auth.uid(),'why_revision_proposed',new_id,p_base_version,p_mutation);
 RETURN jsonb_build_object('id',new_id,'status','pending_review','version',1,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_submit_why_revision(uuid,text,text,text,text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_submit_why_revision(uuid,text,text,text,text,jsonb,uuid) TO authenticated;

-- Only called by the existing human Admin UI. Never registered as an MCP approval tool.
CREATE FUNCTION public.musicdna_mcp_review_why_revision(p_id uuid,p_version integer,p_decision text,p_mutation uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE proposal public.musicdna_song_why_proposals; base public.song_trait_explanations; v_decision_hash text; after_hash text;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_review') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_mutation IS NULL OR p_version IS NULL OR p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 v_decision_hash:=musicdna_admin_mcp.why_version(jsonb_build_array(p_id,p_version,p_decision));
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,0));
 IF EXISTS(SELECT 1 FROM public.musicdna_catalog_audit_events WHERE actor_id=auth.uid() AND mutation_id=p_mutation AND object_id<>p_id AND action IN ('why_revision_approved','why_revision_rejected')) THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
 SELECT * INTO proposal FROM public.musicdna_song_why_proposals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MCP_NOT_FOUND'; END IF;
 IF proposal.decision_id=p_mutation THEN
  IF proposal.reviewer_id<>auth.uid() OR proposal.decision_hash<>v_decision_hash THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('id',proposal.id,'status',proposal.status,'version',proposal.version,'replayed',true);
 END IF;
 IF proposal.status<>'pending_review' OR proposal.version<>p_version THEN RAISE EXCEPTION 'MCP_STALE_VERSION'; END IF;
 IF p_decision='approved' THEN
  SELECT * INTO base FROM public.song_trait_explanations WHERE id=proposal.explanation_id FOR UPDATE;
  IF NOT FOUND OR musicdna_admin_mcp.why_version(to_jsonb(base))<>proposal.base_version THEN RAISE EXCEPTION 'MCP_STALE_VERSION'; END IF;
  IF EXISTS(SELECT 1 FROM public.songs s WHERE s.id=base.song_id AND ((to_jsonb(s)->>base.axis)::numeric IS DISTINCT FROM base.score_at_write OR s.scoring_version IS DISTINCT FROM base.scoring_version)) THEN RAISE EXCEPTION 'MCP_STALE_SCORE'; END IF;
  UPDATE public.song_trait_explanations SET audible_evidence=proposal.audible_evidence,interpretation=proposal.interpretation,status='approved',confidence='reviewed',drafted_by='mcp_revision',review_note='Human-approved correction; proposal '||proposal.id::text||'. Earlier model review applies only to the previous version.',reviewed_by=auth.uid(),reviewed_at=now() WHERE id=base.id RETURNING * INTO base;
  after_hash:=musicdna_admin_mcp.why_version(to_jsonb(base));
 END IF;
 UPDATE public.musicdna_song_why_proposals SET status=p_decision,version=version+1,reviewer_id=auth.uid(),reviewed_at=now(),decision_id=p_mutation,decision_hash=v_decision_hash WHERE id=p_id;
 INSERT INTO public.musicdna_catalog_audit_events(actor_id,action,object_id,before_version,after_version,mutation_id)
 VALUES(auth.uid(),'why_revision_'||p_decision,p_id,proposal.base_version,after_hash,p_mutation);
 RETURN jsonb_build_object('id',p_id,'status',p_decision,'version',proposal.version+1,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_review_why_revision(uuid,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_review_why_revision(uuid,integer,text,uuid) TO authenticated;

CREATE FUNCTION public.musicdna_mcp_export(p_action text,p_mutation uuid DEFAULT NULL,p_filters jsonb DEFAULT '{}',p_format text DEFAULT 'json',p_id uuid DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 25)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE job public.musicdna_mcp_exports; req_hash text; payload jsonb; n integer;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_read') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_action='start' THEN
  IF p_mutation IS NULL OR p_format NOT IN ('json','csv') OR p_filters IS NULL OR jsonb_typeof(p_filters)<>'object'
    OR p_filters-ARRAY['status','created_after','created_before']<>'{}'::jsonb
    OR (p_filters ? 'status' AND p_filters->>'status' NOT IN ('approved','pending_review','rejected'))
  THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
  req_hash:=musicdna_admin_mcp.why_version(jsonb_build_array(p_filters,p_format));
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,0));
  SELECT * INTO job FROM public.musicdna_mcp_exports WHERE user_id=auth.uid() AND mutation_id=p_mutation FOR UPDATE;
  IF FOUND THEN
   IF job.request_hash<>req_hash THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
   IF job.expires_at<=now() THEN RAISE EXCEPTION 'MCP_EXPORT_EXPIRED'; END IF;
  ELSE
   -- Expiry removes access; physical artifact retention requires a separately approved job.
   INSERT INTO public.musicdna_mcp_exports(user_id,mutation_id,request_hash,filters,format)
   VALUES(auth.uid(),p_mutation,req_hash,p_filters,p_format) RETURNING * INTO job;
   INSERT INTO public.musicdna_catalog_audit_events(actor_id,action,object_id,mutation_id)
   VALUES(auth.uid(),'why_export_requested',job.id,p_mutation);
  END IF;
 ELSE
  SELECT * INTO job FROM public.musicdna_mcp_exports WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MCP_NOT_FOUND'; END IF;
  IF job.expires_at<=now() THEN RAISE EXCEPTION 'MCP_EXPORT_EXPIRED'; END IF;
  IF p_action='status' AND job.state='queued' THEN
   BEGIN
    -- Count and complete untruncated snapshot use the same statement snapshot.
    SELECT coalesce(jsonb_agg(record ORDER BY id),'[]'),count(*) INTO payload,n
    FROM public.musicdna_mcp_whys
    WHERE (NOT(job.filters ? 'status') OR status=job.filters->>'status')
     AND (NOT(job.filters ? 'created_after') OR created_at>=(job.filters->>'created_after')::timestamptz)
     AND (NOT(job.filters ? 'created_before') OR created_at<=(job.filters->>'created_before')::timestamptz);
    UPDATE public.musicdna_mcp_exports SET state='ready',snapshot=payload,generated_at=clock_timestamp(),total_count=n WHERE id=job.id RETURNING * INTO job;
    INSERT INTO public.musicdna_catalog_audit_events(actor_id,action,object_id,mutation_id)
    VALUES(auth.uid(),'why_export_completed',job.id,job.mutation_id);
   EXCEPTION WHEN query_canceled THEN
    UPDATE public.musicdna_mcp_exports SET state='failed',error_code='EXPORT_TIMEOUT' WHERE id=job.id RETURNING * INTO job;
    INSERT INTO public.musicdna_catalog_audit_events(actor_id,action,object_id,mutation_id) VALUES(auth.uid(),'why_export_failed',job.id,job.mutation_id);
   END;
  ELSIF p_action IN ('download','download_page') THEN
   IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
   IF job.state<>'ready' THEN RAISE EXCEPTION 'MCP_EXPORT_NOT_READY'; END IF;
   RETURN jsonb_build_object('schema_version','musicdna-admin-export.v1','id',job.id,'format',job.format,
    'generation_timestamp',job.generated_at,'expires_at',job.expires_at,'total_record_count',job.total_count,
    'export_count',jsonb_array_length(job.snapshot),'offset',p_offset,
    'next_offset',CASE WHEN p_action='download_page' AND p_offset+p_limit<job.total_count THEN p_offset+p_limit ELSE NULL END,
    'records',CASE WHEN p_action='download' THEN job.snapshot ELSE (SELECT coalesce(jsonb_agg(value ORDER BY ordinal),'[]') FROM jsonb_array_elements(job.snapshot) WITH ORDINALITY AS t(value,ordinal) WHERE ordinal>p_offset AND ordinal<=p_offset+p_limit) END);
  ELSIF p_action<>'status' THEN RAISE EXCEPTION 'MCP_INVALID_INPUT';
  END IF;
 END IF;
 RETURN jsonb_build_object('schema_version','musicdna-admin-export.v1','id',job.id,'state',job.state,
  'format',job.format,'created_at',job.created_at,'expires_at',job.expires_at,'total_record_count',job.total_count,
  'export_count',CASE WHEN job.state='ready' THEN jsonb_array_length(job.snapshot) ELSE 0 END,'error_code',job.error_code);
END $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_export(text,uuid,jsonb,text,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_export(text,uuid,jsonb,text,uuid,integer,integer) TO authenticated;

ALTER TABLE public.musicdna_catalog_audit_events ADD COLUMN request_hash text;
CREATE FUNCTION public.musicdna_mcp_record_why_findings(p_id uuid,p_base_version text,p_findings jsonb,p_mutation uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE base public.song_trait_explanations; req_hash text; prior public.musicdna_catalog_audit_events;
 f jsonb; key_hash text; ids jsonb:='[]'; found_id uuid;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_propose') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_base_version IS NULL OR p_mutation IS NULL OR p_findings IS NULL OR jsonb_typeof(p_findings)<>'array' OR jsonb_array_length(p_findings) NOT BETWEEN 1 AND 25 OR octet_length(p_findings::text)>50000 THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 req_hash:=musicdna_admin_mcp.why_version(jsonb_build_array(p_id,p_base_version,p_findings));
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,0));
 SELECT * INTO prior FROM public.musicdna_catalog_audit_events WHERE actor_id=auth.uid() AND action='why_findings_recorded' AND mutation_id=p_mutation;
 IF FOUND THEN
  IF prior.request_hash<>req_hash THEN RAISE EXCEPTION 'MCP_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('recorded',jsonb_array_length(p_findings),'replayed',true);
 END IF;
 SELECT * INTO base FROM public.song_trait_explanations WHERE id=p_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MCP_NOT_FOUND'; END IF;
 IF musicdna_admin_mcp.why_version(to_jsonb(base))<>p_base_version THEN RAISE EXCEPTION 'MCP_STALE_VERSION'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(p_findings) LOOP
  IF jsonb_typeof(f)<>'object' OR NOT (f ?& ARRAY['severity','category','excerpt','explanation','verification_kind'])
   OR jsonb_typeof(f->'severity') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'category') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'excerpt') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'explanation') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'verification_kind') IS DISTINCT FROM 'string'
   OR f->>'severity' NOT IN ('info','warning','error') OR f->>'verification_kind' NOT IN ('catalog_fact','text_inference','requires_listening')
   OR length(f->>'category') NOT BETWEEN 1 AND 80 OR length(f->>'excerpt') NOT BETWEEN 1 AND 1000
   OR length(f->>'explanation') NOT BETWEEN 10 AND 2000 OR coalesce(length(f->>'suggested_wording'),0)>1000
  THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
  -- The reported excerpt must actually occur in this saved record.
  IF position(f->>'excerpt' IN base.audible_evidence)=0 AND position(f->>'excerpt' IN base.interpretation)=0 AND position(f->>'excerpt' IN coalesce(base.review_note,''))=0 THEN RAISE EXCEPTION 'MCP_EVIDENCE_MISMATCH'; END IF;
  key_hash:=musicdna_admin_mcp.why_version(jsonb_build_array(f->>'category',lower(trim(f->>'excerpt')),f->>'verification_kind'));
  INSERT INTO public.musicdna_song_why_audit_findings(explanation_id,base_version,finding_key,severity,category,excerpt,explanation,suggested_wording,verification_kind,auditor_id,mutation_id)
  VALUES(p_id,p_base_version,key_hash,f->>'severity',f->>'category',f->>'excerpt',f->>'explanation',f->>'suggested_wording',f->>'verification_kind',auth.uid(),p_mutation)
  ON CONFLICT(explanation_id,base_version,finding_key) WHERE status='open' DO UPDATE SET last_seen_at=now()
  RETURNING id INTO found_id;
  ids:=ids||jsonb_build_array(found_id);
 END LOOP;
 INSERT INTO public.musicdna_catalog_audit_events(actor_id,action,object_id,before_version,mutation_id,request_hash)
 VALUES(auth.uid(),'why_findings_recorded',p_id,p_base_version,p_mutation,req_hash);
 RETURN jsonb_build_object('recorded',jsonb_array_length(ids),'ids',ids,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_record_why_findings(uuid,text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_record_why_findings(uuid,text,jsonb,uuid) TO authenticated;

-- Explicitly remove any project default grants before restoring narrow access.
REVOKE ALL ON public.musicdna_mcp_grants,public.musicdna_song_why_history,
 public.musicdna_song_why_proposals,public.musicdna_catalog_audit_events,
 public.musicdna_song_why_audit_findings,public.musicdna_mcp_exports FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.musicdna_mcp_grants,public.musicdna_song_why_history,
 public.musicdna_song_why_proposals,public.musicdna_catalog_audit_events,
 public.musicdna_song_why_audit_findings,public.musicdna_mcp_exports TO authenticated;

-- Text identity matching only; never changes musical scores or pairing selection.
CREATE FUNCTION musicdna_admin_mcp.search_text(value text) RETURNS text LANGUAGE sql IMMUTABLE
 SET search_path=pg_catalog AS $$SELECT trim(regexp_replace(regexp_replace(lower(normalize(coalesce(value,''),NFD)),U&'[\0300-\036F]','','g'), '[^a-z0-9]+',' ','g'))$$;
REVOKE ALL ON FUNCTION musicdna_admin_mcp.search_text(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION musicdna_admin_mcp.search_text(text) TO authenticated;
CREATE FUNCTION musicdna_admin_mcp.text_match(needle text,haystack text) RETURNS numeric LANGUAGE sql IMMUTABLE
 SET search_path=pg_catalog AS $$
 WITH n AS(SELECT DISTINCT substr(needle,i,3) t FROM generate_series(1,greatest(length(needle)-2,0)) i),
 h AS(SELECT DISTINCT substr(haystack,i,3) t FROM generate_series(1,greatest(length(haystack)-2,0)) i)
 SELECT CASE WHEN needle='' THEN 0 WHEN position(needle IN haystack)>0 THEN 1
 ELSE coalesce((SELECT 2.0*count(*) FROM n JOIN h USING(t))/nullif((SELECT count(*) FROM n)+(SELECT count(*) FROM h),0),0) END
$$;
REVOKE ALL ON FUNCTION musicdna_admin_mcp.text_match(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION musicdna_admin_mcp.text_match(text,text) TO authenticated;
CREATE FUNCTION public.musicdna_mcp_search_songs(p_query text,p_limit integer DEFAULT 20,p_after uuid DEFAULT NULL,p_snapshot timestamptz DEFAULT now())
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public SET statement_timeout='10s' AS $$
DECLARE needle text; result jsonb;
BEGIN
 IF NOT musicdna_admin_mcp.can('catalog_read') THEN RAISE EXCEPTION 'MCP_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_query IS NULL OR length(p_query) NOT BETWEEN 1 AND 200 OR p_limit NOT BETWEEN 1 AND 50 OR p_snapshot IS NULL THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 needle:=musicdna_admin_mcp.search_text(p_query);
 IF needle='' THEN RAISE EXCEPTION 'MCP_INVALID_INPUT'; END IF;
 WITH matches AS (
 SELECT s.id,s.title,s.artist,s.year,s.primary_lane,s.active,
 greatest(musicdna_admin_mcp.text_match(needle,musicdna_admin_mcp.search_text(s.title)),musicdna_admin_mcp.text_match(needle,musicdna_admin_mcp.search_text(s.artist)),musicdna_admin_mcp.text_match(needle,musicdna_admin_mcp.search_text(s.title||' '||s.artist)),musicdna_admin_mcp.text_match(needle,musicdna_admin_mcp.search_text(a.release_title))) AS match_confidence
 FROM public.songs s LEFT JOIN public.song_artwork a ON a.song_id=s.id AND a.match_status='verified' AND a.display_enabled AND a.rights_status IN ('licensed','permission_granted') AND nullif(trim(a.rights_reference),'') IS NOT NULL AND a.image_url LIKE 'https://%' WHERE s.created_at<=p_snapshot
 ), eligible AS (SELECT * FROM matches WHERE match_confidence>=0.3),
 page AS (SELECT * FROM eligible WHERE p_after IS NULL OR id>p_after ORDER BY id LIMIT p_limit+1)
 SELECT jsonb_build_object('songs',coalesce((SELECT jsonb_agg(p ORDER BY id) FROM page p),'[]'),'total_count',(SELECT count(*) FROM eligible)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.musicdna_mcp_search_songs(text,integer,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.musicdna_mcp_search_songs(text,integer,uuid,timestamptz) TO authenticated;
