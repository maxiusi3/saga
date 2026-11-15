-- Whole-story text/derivative erasure, preserving immutable media capture.
BEGIN;
CREATE TABLE public.story_deletion_context (
  transaction_id bigint NOT NULL, story_id uuid NOT NULL, PRIMARY KEY(transaction_id,story_id)
);
CREATE TABLE public.story_deletion_fences (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE RESTRICT,
  entity_table text NOT NULL, entity_id uuid NOT NULL,
  PRIMARY KEY(story_id,entity_table,entity_id)
);
CREATE INDEX story_deletion_fence_identity ON public.story_deletion_fences(entity_table,entity_id);
CREATE TABLE public.story_content_purges (
  request_id uuid PRIMARY KEY REFERENCES public.deletion_requests(id) ON DELETE RESTRICT,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE RESTRICT,
  purged_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['story_deletion_context','story_deletion_fences','story_content_purges'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
END $$;
GRANT SELECT ON public.story_content_purges TO service_role;
CREATE POLICY service_read ON public.story_content_purges FOR SELECT TO service_role USING(true);

CREATE FUNCTION public.story_is_deleted(p_story_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.subject_id=p_story_id::text AND d.tombstone_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.story_is_deleted(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.story_is_deleted(uuid) TO anon,authenticated,service_role;
CREATE POLICY story_deletion_read_gate ON public.stories AS RESTRICTIVE FOR SELECT TO anon,authenticated
  USING(NOT public.story_is_deleted(id));

-- Checks direct and indirect identities, including fenced IDs whose original
-- rows have already been removed. Never infer provenance from arbitrary prose.
CREATE FUNCTION public.story_content_references(p_table text,p_row jsonb,p_story_id uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.deletion_requests d WHERE d.tombstone_at IS NOT NULL
    AND (p_story_id IS NULL OR d.subject_id=p_story_id::text)
    AND d.subject_id IN (p_row->>'story_id',p_row->>'source_story_id',p_row->'data'->>'story_id',
      CASE WHEN p_table='stories' THEN p_row->>'id' END))
  OR EXISTS(SELECT 1 FROM public.story_deletion_fences f WHERE (p_story_id IS NULL OR f.story_id=p_story_id) AND (
    (f.entity_table=p_table AND f.entity_id::text=p_row->>'id')
    OR (f.entity_table='stories' AND f.entity_id::text IN(p_row->>'story_id',p_row->>'source_story_id',p_row->'data'->>'story_id'))
    OR (f.entity_table='transcript_versions' AND f.entity_id::text=p_row->>'transcript_version_id')
    OR (f.entity_table='transcript_segments' AND f.entity_id::text=p_row->>'segment_id')
    OR (f.entity_table='story_revisions' AND (f.entity_id::text=p_row->>'story_revision_id' OR coalesce(p_row->'story_revision_ids','[]') ? f.entity_id::text))
    OR (f.entity_table='recording_session' AND f.entity_id::text=p_row->'input'->>'recordingSessionId'
      AND EXISTS(SELECT 1 FROM public.recording_story_intents i WHERE i.session_id=f.entity_id
        AND i.project_id::text=p_row->>'project_id' AND i.actor_id::text=p_row->>'created_by'))
    OR (f.entity_table='agent_runs' AND f.entity_id::text=p_row->>'agent_run_id')
    OR (f.entity_table='interview_sessions' AND f.entity_id::text=p_row->>'interview_session_id')
    OR (f.entity_table='interactions' AND f.entity_id::text=p_row->'data'->>'interaction_id')
    OR (f.entity_table='public_contributions' AND (f.entity_id::text=p_row->>'public_contribution_id' OR f.entity_id::text=p_row->'input'->>'contributionId'
      OR coalesce(p_row->'source_contribution_ids','[]') ? f.entity_id::text
      OR coalesce(p_row->'payload'->'activeContributionIds','[]') ? f.entity_id::text
      OR jsonb_path_exists(coalesce(p_row->'source_refs','[]'),'$[*].source_id ? (@ == $id)',jsonb_build_object('id',f.entity_id::text))))
    OR (p_table='publication_snapshots' AND f.entity_table IN ('stories','story_revisions','transcript_versions','media_assets') AND
      (jsonb_path_exists(coalesce(p_row->'manifest_json','{}'),'$.** ? (@ == $id)',jsonb_build_object('id',f.entity_id::text))
        OR jsonb_path_exists(coalesce(p_row->'chapter_outline','[]'),'$.** ? (@ == $id)',jsonb_build_object('id',f.entity_id::text))))
    OR (f.entity_table='public_event_clusters' AND f.entity_id::text IN(p_row->>'public_event_cluster_id',p_row->'output'->>'eventClusterId',p_row->'payload'->>'existingClusterId'))))
$$;
REVOKE ALL ON FUNCTION public.story_content_references(text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- Persist provenance on the first cluster write, before the separate link
-- inserts. Legacy clusters without provenance remain readable but cannot acquire
-- new content until their contribution IDs have been supplied.
ALTER TABLE public.public_event_clusters ADD COLUMN source_contribution_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE public.public_event_clusters c SET source_contribution_ids=(SELECT coalesce(array_agg(DISTINCT l.public_contribution_id),'{}') FROM public.public_event_contributions l WHERE l.public_event_cluster_id=c.id);
CREATE FUNCTION public.guard_story_deleted_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
BEGIN
  LOCK TABLE public.deletion_requests IN SHARE MODE;
  IF TG_TABLE_NAME='agent_runs' AND nullif(to_jsonb(NEW)->'input'->>'recordingSessionId','') IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.recording_story_intents i WHERE i.session_id::text=to_jsonb(NEW)->'input'->>'recordingSessionId'
      AND (i.project_id::text IS DISTINCT FROM to_jsonb(NEW)->>'project_id' OR i.actor_id::text IS DISTINCT FROM to_jsonb(NEW)->>'created_by' OR public.story_is_deleted(i.story_id))) THEN
    RAISE EXCEPTION 'Recording interview source unavailable' USING ERRCODE='23505';
  END IF;
  IF TG_TABLE_NAME='interactions' AND public.story_is_deleted((to_jsonb(NEW)->>'answer_story_id')::uuid) THEN
    RAISE EXCEPTION 'Deleted answer fenced' USING ERRCODE='23505';
  END IF;
  IF TG_TABLE_NAME='public_event_clusters' THEN
    -- Invalidation removes a withdrawn draft from public/reviewer output before
    -- asynchronous recomputation; it may not alter text or provenance.
    IF TG_OP='UPDATE' AND to_jsonb(NEW)->>'status'='needs_reprocessing'
      AND to_jsonb(NEW)-ARRAY['status','updated_at']=to_jsonb(OLD)-ARRAY['status','updated_at']
      AND NOT public.story_content_references(TG_TABLE_NAME,to_jsonb(NEW)) THEN RETURN NEW; END IF;
    -- Withdrawal cleanup may remove all text and source IDs, but cannot use
    -- the cleanup branch to replace text or modify another identity.
    IF TG_OP='UPDATE' AND to_jsonb(NEW)->>'status'='rejected'
      AND to_jsonb(NEW)->>'event_label'='' AND to_jsonb(NEW)->>'timeframe'='' AND to_jsonb(NEW)->>'place_scope'=''
      AND to_jsonb(NEW)->>'historical_context_summary'='' AND to_jsonb(NEW)->>'perspective_summary'=''
      AND to_jsonb(NEW)->'representative_excerpts'='[]'::jsonb AND to_jsonb(NEW)->'source_contribution_ids'='[]'::jsonb
      AND to_jsonb(NEW)->>'uncertainty_notes'='All contributions were withdrawn; no active perspectives remain.'
      AND to_jsonb(NEW)-ARRAY['status','event_label','timeframe','place_scope','historical_context_summary','perspective_summary','representative_excerpts','source_contribution_ids','uncertainty_notes','updated_at']
        =to_jsonb(OLD)-ARRAY['status','event_label','timeframe','place_scope','historical_context_summary','perspective_summary','representative_excerpts','source_contribution_ids','uncertainty_notes','updated_at'] THEN RETURN NEW; END IF;
    IF coalesce(jsonb_array_length(to_jsonb(NEW)->'source_contribution_ids'),0)=0
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(to_jsonb(NEW)->'source_contribution_ids') x(id)
        WHERE NOT EXISTS(SELECT 1 FROM public.public_contributions c WHERE c.id::text=x.id AND c.status='active' AND NOT public.story_is_deleted(c.source_story_id))) THEN
      RAISE EXCEPTION 'Cluster requires live contribution provenance' USING ERRCODE='23505';
    END IF;
  END IF;
  IF public.story_content_references(TG_TABLE_NAME,to_jsonb(NEW))
    OR (TG_OP='UPDATE' AND public.story_content_references(TG_TABLE_NAME,to_jsonb(OLD))) THEN
    IF TG_TABLE_NAME='recording_story_intents' AND TG_OP='UPDATE' AND to_jsonb(NEW)->'metadata'='{}'::jsonb
      AND to_jsonb(NEW)-'metadata'=to_jsonb(OLD)-'metadata'
      AND EXISTS(SELECT 1 FROM public.story_deletion_context c WHERE c.transaction_id=txid_current() AND c.story_id::text=to_jsonb(NEW)->>'story_id') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Deleted story content fenced' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_story_deleted_content() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['recording_story_intents','interactions','transcript_versions','transcript_segments','story_assertions','story_revisions','search_index_entries',
    'agent_runs','agent_artifacts','story_elements','interview_sessions','interview_events','story_artifacts','public_archive_entries','notifications',
    'public_contribution_invitations','public_contributions','public_contribution_elements','public_event_contributions','public_event_clusters','public_archive_audit_events','publication_snapshots'] LOOP
    EXECUTE format('CREATE TRIGGER story_deleted_content_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_story_deleted_content()',t);
  END LOOP;
END $$;

CREATE FUNCTION public.story_deletion_scrub_allowed(p_old jsonb,p_new jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.story_deletion_context c WHERE c.transaction_id=txid_current() AND c.story_id::text=p_old->>'id')
    AND p_new->>'status'='deleted' AND p_new->>'title'=''
    AND p_new-'updated_at'-ARRAY['title','content','transcript','ai_prompt','ai_generated_title','ai_summary','ai_follow_up_questions','ai_confidence_score','stt_metadata','audio_url','photo_url','images','is_public','status']
      =p_old-'updated_at'-ARRAY['title','content','transcript','ai_prompt','ai_generated_title','ai_summary','ai_follow_up_questions','ai_confidence_score','stt_metadata','audio_url','photo_url','images','is_public','status']
    AND p_new->'is_public'='false'::jsonb
    AND NOT EXISTS(SELECT 1 FROM jsonb_each(p_new) e WHERE e.key=ANY(ARRAY['content','transcript','ai_prompt','ai_generated_title','ai_summary','ai_follow_up_questions','ai_confidence_score','stt_metadata','audio_url','photo_url','images']) AND e.value<>'null'::jsonb)
$$;
REVOKE ALL ON FUNCTION public.story_deletion_scrub_allowed(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- The existing reference guard retains every check; only an exact authorized
-- empty-content transition may change the captured story shell.
CREATE OR REPLACE FUNCTION public.guard_media_deletion_reference() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE r jsonb; old_r jsonb; blocked boolean:=false; new_blocked boolean:=false; row_blocked boolean; protected_old boolean; i integer:=0; scopes jsonb;
BEGIN
  IF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='stories' AND TG_OP='UPDATE'
    AND public.story_deletion_scrub_allowed(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
  LOCK TABLE public.deletion_requests,public.deletion_targets IN SHARE MODE;
  IF TG_TABLE_NAME='stories' AND TG_OP<>'DELETE' AND public.story_is_deleted((to_jsonb(NEW)->>'parent_story_id')::uuid) THEN
    RAISE EXCEPTION 'Deleted parent story fenced' USING ERRCODE='23505';
  END IF;
  LOCK TABLE public.media_deletion_fences IN SHARE MODE;
  -- Protect the capture-to-first-plan window too. Capture inserts its targets
  -- before marking assets deleting; only that exact transition is allowed below.
  SELECT coalesce(jsonb_agg(q),'[]') INTO scopes FROM (
    SELECT kind,bucket,object_key FROM public.media_deletion_fences
    UNION SELECT CASE t.kind WHEN 'storage_object' THEN 'object' WHEN 'media_asset' THEN 'asset' ELSE 'story' END,
      coalesce(t.bucket,''),coalesce(t.object_key,split_part(t.target_id,':',2))
      FROM public.deletion_targets t JOIN public.deletion_requests d ON d.id=t.deletion_request_id WHERE d.capture_version=1
    UNION SELECT 'session','',s.id::text FROM public.recording_sessions s JOIN public.deletion_requests d ON d.capture_version=1
      AND ((d.subject_type='story' AND d.subject_id=s.story_id::text) OR (d.subject_type='media_asset' AND (d.subject_id=s.confirmed_asset_id::text OR d.subject_id=s.seal_input->>'assetId')))
  ) q;
  IF scopes='[]'::jsonb THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  IF TG_OP<>'INSERT' THEN old_r:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN r:=to_jsonb(NEW); ELSE r:=old_r; END IF;
  -- Check both sides: moving an existing protected identity/path also fails.
  FOR r IN SELECT value FROM jsonb_array_elements(jsonb_build_array(r,old_r)) WHERE value<>'null'::jsonb LOOP
    i:=i+1;row_blocked:=false;
    IF TG_TABLE_SCHEMA='storage' THEN
      row_blocked:=public.media_deletion_path_matches(scopes,r->>'bucket_id',r->>'name');
    ELSIF TG_TABLE_NAME IN ('media_assets','recording_chunks','recording_output_candidates','legacy_media_references') THEN
      row_blocked:=public.media_deletion_path_matches(scopes,coalesce(r->>'bucket',r->>'resolved_bucket'),coalesce(r->>'object_key',r->>'resolved_object_key'));
    END IF;
    row_blocked:=row_blocked OR EXISTS (SELECT 1 FROM jsonb_to_recordset(scopes) f(kind text,object_key text) WHERE
      (f.kind='asset' AND (f.object_key=r->>'asset_id' OR f.object_key=r->>'parent_asset_id' OR f.object_key=r->>'confirmed_asset_id'
        OR f.object_key=r->'seal_input'->>'assetId' OR (TG_TABLE_NAME='media_assets' AND f.object_key=r->>'id')))
      OR (f.kind='session' AND (f.object_key=r->>'session_id' OR (TG_TABLE_NAME='recording_sessions' AND f.object_key=r->>'id')))
      OR (f.kind='story' AND (f.object_key=r->>'story_id' OR (TG_TABLE_NAME='stories' AND f.object_key=r->>'id'))));
    -- Unknown legacy addresses must be migrated before creating references
    -- while permanent deletion fences exist.
    IF TG_TABLE_NAME IN ('stories','prompts') AND public.media_deletion_legacy_blocked(r,scopes) THEN row_blocked:=true; END IF;
    IF TG_TABLE_NAME='legacy_media_references' AND coalesce(r->>'mapping_state','unresolved') IN ('unresolved','conflict') THEN row_blocked:=true; END IF;
    IF i=1 THEN new_blocked:=row_blocked; END IF;
    blocked:=blocked OR row_blocked;
  END LOOP;
  IF blocked THEN
    protected_old:=public.media_deletion_path_matches(scopes,old_r->>'bucket',old_r->>'object_key') OR
      EXISTS(SELECT 1 FROM jsonb_to_recordset(scopes) f(kind text,object_key text) WHERE
        (f.kind='asset' AND ((TG_TABLE_NAME='media_assets' AND f.object_key=old_r->>'id') OR (TG_TABLE_NAME='recording_output_candidates' AND f.object_key=old_r->>'asset_id')))
        OR (f.kind='session' AND ((TG_TABLE_NAME='recording_sessions' AND f.object_key=old_r->>'id') OR (TG_TABLE_NAME='recording_chunks' AND f.object_key=old_r->>'session_id')))
        OR (f.kind='story' AND TG_TABLE_NAME='stories' AND f.object_key=old_r->>'id'));
    IF TG_TABLE_SCHEMA<>'storage' AND NOT protected_old AND (TG_OP='DELETE' OR (TG_OP='UPDATE' AND NOT new_blocked)) THEN
      IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    -- Storage UPDATE can replace bytes even if its metadata is identical.
    IF TG_OP='UPDATE' AND TG_TABLE_SCHEMA<>'storage' AND to_jsonb(NEW)=old_r THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND TG_TABLE_NAME='media_assets' AND old_r->>'state' NOT IN ('deleting','deleted') AND to_jsonb(NEW)->>'state'='deleting'
      AND to_jsonb(NEW)-ARRAY['state','updated_at']=old_r-ARRAY['state','updated_at'] THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME='legacy_media_references' AND TG_OP='DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Media deletion reference fenced' USING ERRCODE='23505';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.prevent_publication_snapshot_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM public.story_deletion_fences f JOIN public.story_deletion_context c USING(story_id)
    WHERE c.transaction_id=txid_current() AND f.entity_table='publication_snapshots' AND f.entity_id=OLD.id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Published snapshots are immutable outside story erasure' USING ERRCODE='23514';
END $$;
REVOKE ALL ON FUNCTION public.prevent_publication_snapshot_mutation() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.purge_story_content(p_request_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE d public.deletion_requests%ROWTYPE; sid uuid; t text; added integer; n integer; total integer; targets jsonb; scopes jsonb;
  tables text[]:=ARRAY['interactions','transcript_versions','transcript_segments','story_assertions','story_revisions','search_index_entries',
    'agent_runs','agent_artifacts','story_elements','interview_sessions','interview_events','story_artifacts','public_archive_entries','notifications',
    'public_contribution_invitations','public_contributions','public_contribution_elements','public_event_contributions','public_event_clusters','public_archive_audit_events','publication_snapshots'];
BEGIN
  IF p_request_id IS NULL OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Invalid purge request' USING ERRCODE='22023'; END IF;
  LOCK TABLE public.deletion_requests IN EXCLUSIVE MODE;
  SELECT * INTO d FROM public.deletion_requests WHERE id=p_request_id;
  IF NOT FOUND OR d.capture_version IS DISTINCT FROM 1 OR d.subject_type IS DISTINCT FROM 'story' OR d.state<>'requested' THEN
    RAISE EXCEPTION 'Story capture required' USING ERRCODE='23505'; END IF;
  sid:=d.subject_id::uuid;
  LOCK TABLE public.deletion_targets,public.stories,public.media_assets,public.recording_story_intents IN SHARE ROW EXCLUSIVE MODE;
  FOREACH t IN ARRAY tables LOOP EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',t); END LOOP;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY target_id),'[]') INTO targets FROM public.deletion_targets x WHERE deletion_request_id=d.id;
  IF jsonb_array_length(targets) IS DISTINCT FROM d.capture_target_count OR encode(sha256(convert_to(targets::text,'UTF8')),'hex') IS DISTINCT FROM d.capture_targets_sha256
    OR NOT EXISTS(SELECT 1 FROM public.stories WHERE id=sid AND project_id=d.project_id) THEN RAISE EXCEPTION 'Capture changed' USING ERRCODE='23505'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('kind','asset','object_key',split_part(target_id,':',2))),'[]') INTO scopes
    FROM public.deletion_targets WHERE deletion_request_id=d.id AND kind='media_asset';
  IF EXISTS(SELECT 1 FROM public.stories s WHERE s.id=sid AND public.media_deletion_legacy_blocked(to_jsonb(s),scopes,true)) THEN
    RAISE EXCEPTION 'Legacy media requires mapping before content erasure' USING ERRCODE='23505'; END IF;
  INSERT INTO public.story_deletion_context VALUES(txid_current(),sid);
  INSERT INTO public.story_deletion_fences VALUES(sid,'stories',sid) ON CONFLICT DO NOTHING;
  INSERT INTO public.story_deletion_fences SELECT sid,'media_assets',split_part(target_id,':',2)::uuid FROM public.deletion_targets WHERE deletion_request_id=d.id AND kind='media_asset' ON CONFLICT DO NOTHING;
  INSERT INTO public.story_deletion_fences SELECT sid,'recording_session',i.session_id FROM public.recording_story_intents i WHERE i.story_id=sid ON CONFLICT DO NOTHING;
  INSERT INTO public.story_deletion_fences SELECT sid,'agent_runs',r.id FROM public.agent_runs r JOIN public.recording_story_intents i
    ON r.input->>'recordingSessionId'=i.session_id::text AND r.project_id=i.project_id AND r.created_by=i.actor_id WHERE i.story_id=sid ON CONFLICT DO NOTHING;
  -- Reach a fixed point over the implemented relational provenance graph.
  -- Reverse edges invalidate shared interview/cluster derivatives, not sources.
  FOR n IN 1..32 LOOP
    total:=0;
    INSERT INTO public.story_deletion_fences SELECT sid,'notifications',x.id FROM public.notifications x
      JOIN public.interactions i ON x.data->>'interaction_id'=i.id::text WHERE i.answer_story_id=sid ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS added=ROW_COUNT; total:=total+added;
    FOREACH t IN ARRAY tables LOOP
      EXECUTE format('INSERT INTO public.story_deletion_fences SELECT $1,$2,x.id FROM public.%I x WHERE public.story_content_references($2,to_jsonb(x),$1) ON CONFLICT DO NOTHING',t) USING sid,t;
      GET DIAGNOSTICS added=ROW_COUNT; total:=total+added;
    END LOOP;
    INSERT INTO public.story_deletion_fences SELECT sid,'interview_sessions',r.interview_session_id FROM public.agent_runs r
      JOIN public.story_deletion_fences f ON f.entity_table='agent_runs' AND f.entity_id=r.id AND f.story_id=sid WHERE r.interview_session_id IS NOT NULL ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS added=ROW_COUNT; total:=total+added;
    INSERT INTO public.story_deletion_fences SELECT sid,'public_event_clusters',r.public_event_cluster_id FROM public.public_event_contributions r
      JOIN public.story_deletion_fences f ON f.entity_table='public_event_contributions' AND f.entity_id=r.id AND f.story_id=sid ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS added=ROW_COUNT; total:=total+added;
    EXIT WHEN total=0;
    IF n=32 THEN RAISE EXCEPTION 'Purge graph did not settle' USING ERRCODE='23505'; END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['publication_snapshots','search_index_entries','story_assertions','story_revisions','transcript_segments','transcript_versions',
    'agent_artifacts','story_elements','agent_runs','interview_events','interview_sessions','public_archive_audit_events','public_event_contributions',
    'public_contribution_elements','public_contribution_invitations','public_event_clusters','public_contributions','interactions','story_artifacts','public_archive_entries','notifications'] LOOP
    EXECUTE format('DELETE FROM public.%I x USING public.story_deletion_fences f WHERE f.story_id=$1 AND f.entity_table=$2 AND f.entity_id=x.id',t) USING sid,t;
  END LOOP;
  UPDATE public.interactions SET answer_story_id=NULL,answered_at=NULL,status='pending' WHERE answer_story_id=sid;
  UPDATE public.recording_story_intents SET metadata='{}' WHERE story_id=sid;
  UPDATE public.stories SET title='',content=NULL,transcript=NULL,ai_prompt=NULL,ai_generated_title=NULL,ai_summary=NULL,
    ai_follow_up_questions=NULL,ai_confidence_score=NULL,stt_metadata=NULL,audio_url=NULL,photo_url=NULL,images=NULL,is_public=false,status='deleted' WHERE id=sid;
  INSERT INTO public.story_content_purges(request_id,story_id) VALUES(d.id,sid) ON CONFLICT DO NOTHING;
  DELETE FROM public.story_deletion_context WHERE transaction_id=txid_current() AND story_id=sid;
END $$;
REVOKE ALL ON FUNCTION public.purge_story_content(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_story_content(uuid) TO service_role;

CREATE FUNCTION public.request_story_deletion(p_actor_id uuid,p_project_id uuid,p_story_id uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE receipt jsonb;
BEGIN
  receipt:=public.request_media_deletion(p_actor_id,p_project_id,p_story_id,'story',p_request_id);
  PERFORM public.purge_story_content((receipt->>'id')::uuid);
  RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.request_story_deletion(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_story_deletion(uuid,uuid,uuid,uuid) TO service_role;
COMMIT;
