-- Recurring physical deletion. Captured requests/targets remain immutable.
BEGIN;
CREATE TABLE public.media_deletion_executions (
  request_id uuid PRIMARY KEY REFERENCES public.deletion_requests(id) ON DELETE RESTRICT,
  capture_sha256 text NOT NULL CHECK (capture_sha256 ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('blocked_reference','scanning','reconcile','observed_absent')),
  run_id uuid, lease_expires_at timestamptz,
  next_scan_at timestamptz NOT NULL DEFAULT now(), last_verified_at timestamptz,
  CHECK ((run_id IS NULL) = (lease_expires_at IS NULL))
);
CREATE TABLE public.media_deletion_fences (
  request_id uuid NOT NULL REFERENCES public.media_deletion_executions(request_id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('object','prefix','asset','session','story')),
  bucket text NOT NULL, object_key text NOT NULL, inventory_run_id uuid,
  PRIMARY KEY(request_id,kind,bucket,object_key),
  CHECK ((kind IN ('object','prefix') AND bucket IN ('saga','audio-recordings','recording-candidates'))
    OR (kind IN ('asset','session','story') AND bucket=''))
);
CREATE INDEX media_deletion_fence_address ON public.media_deletion_fences(bucket,object_key);
CREATE TABLE public.media_deletion_objects (
  request_id uuid NOT NULL REFERENCES public.media_deletion_executions(request_id) ON DELETE RESTRICT,
  bucket text NOT NULL CHECK (bucket IN ('saga','audio-recordings','recording-candidates')),
  object_key text NOT NULL CHECK (length(object_key)<=1024 AND object_key ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)+$' AND object_key !~ '(^|/)\.{1,2}(/|$)'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','present','dispatching','absent','unknown')),
  observed_run_id uuid, operation_id uuid, observed_at timestamptz,
  physical_uncertain boolean NOT NULL DEFAULT false,
  PRIMARY KEY(request_id,bucket,object_key)
);
CREATE TABLE public.media_deletion_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.media_deletion_executions(request_id) ON DELETE RESTRICT,
  run_id uuid NOT NULL, bucket text, object_key text, operation_id uuid,
  event text NOT NULL CHECK (event IN ('begin','blocked_reference','present','absent','dispatch','deleted','not_found','unknown','observed_absent','reconcile')),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['media_deletion_executions','media_deletion_fences','media_deletion_objects','media_deletion_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role',t);
    EXECUTE format('CREATE POLICY service_read ON public.%I FOR SELECT TO service_role USING(true)',t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.media_deletion_events_id_seq FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.media_deletion_path_matches(p_scopes jsonb,p_bucket text,p_key text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_scopes) AS f(kind text,bucket text,object_key text)
    WHERE f.bucket=p_bucket AND ((f.kind='object' AND f.object_key=p_key)
      OR (f.kind='prefix' AND starts_with(p_key,f.object_key||'/'))))
$$;
REVOKE ALL ON FUNCTION public.media_deletion_path_matches(jsonb,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.media_deletion_legacy_blocked(p_row jsonb,p_scopes jsonb,p_selected boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE value text; asset uuid;
BEGIN
  IF coalesce(p_row->'images','null') NOT IN ('null'::jsonb,'[]'::jsonb) THEN RETURN true; END IF;
  FOREACH value IN ARRAY ARRAY[p_row->>'audio_url',p_row->>'photo_url'] LOOP
    IF nullif(value,'') IS NULL THEN CONTINUE; END IF;
    IF value !~ '^/api/media/assets/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/play$' THEN RETURN true; END IF;
    asset:=split_part(value,'/',5)::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.media_assets a WHERE a.id=asset)
      OR p_selected IS DISTINCT FROM EXISTS(SELECT 1 FROM jsonb_to_recordset(p_scopes) f(kind text,object_key text) WHERE f.kind='asset' AND f.object_key=asset::text) THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.media_deletion_legacy_blocked(jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;

-- Persistent namespace fences include BYPASSRLS writers. Previously accepted
-- remote byte writes still require recurring Storage reconciliation.
CREATE FUNCTION public.guard_media_deletion_reference() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE r jsonb; old_r jsonb; blocked boolean:=false; new_blocked boolean:=false; row_blocked boolean; protected_old boolean; i integer:=0; scopes jsonb;
BEGIN
  LOCK TABLE public.deletion_requests,public.deletion_targets IN SHARE MODE;
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
REVOKE ALL ON FUNCTION public.guard_media_deletion_reference() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['media_assets','recording_chunks','recording_output_candidates','recording_sessions','stories','legacy_media_references','prompts'] LOOP
    EXECUTE format('CREATE TRIGGER media_deletion_reference_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_media_deletion_reference()',t);
  END LOOP;
END $$;
CREATE TRIGGER media_deletion_storage_guard BEFORE INSERT OR UPDATE ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION public.guard_media_deletion_reference();

CREATE FUNCTION public.media_deletion_execute(p_request_id uuid,p_run_id uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp SET timezone='UTC' SET lock_timeout='3s' AS $$
DECLARE req public.deletion_requests%ROWTYPE; ex public.media_deletion_executions%ROWTYPE;
  obj public.media_deletion_objects%ROWTYPE; job public.media_deletion_jobs%ROWTYPE;
  targets jsonb; scopes jsonb; cap text; assets uuid[]; sessions uuid[]; stories uuid[];
  now_at timestamptz; conflict boolean; b text; k text; outcome text; op uuid; receipt jsonb;
BEGIN
  IF p_request_id IS NULL OR p_run_id IS NULL OR p_action IS NULL OR p_action NOT IN ('begin','discover','inventory','observe','dispatch','result','finish')
    OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Invalid media deletion execution arguments' USING ERRCODE='22023';
  END IF;
  LOCK TABLE public.deletion_requests,public.deletion_targets IN SHARE MODE;
  PERFORM pg_advisory_xact_lock(hashtextextended('media-deletion-execution:'||p_request_id::text,0));
  SELECT * INTO req FROM public.deletion_requests WHERE id=p_request_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY target_id),'[]') INTO targets FROM public.deletion_targets t WHERE deletion_request_id=p_request_id;
  IF req.id IS NULL OR req.capture_version IS DISTINCT FROM 1 OR req.state<>'requested' OR req.attempt<>0
    OR req.tombstone_at IS NULL OR req.requested_at IS DISTINCT FROM req.tombstone_at
    OR jsonb_array_length(targets) IS DISTINCT FROM req.capture_target_count
    OR encode(sha256(convert_to(targets::text,'UTF8')),'hex') IS DISTINCT FROM req.capture_targets_sha256 THEN
    RAISE EXCEPTION 'Deletion capture changed' USING ERRCODE='23505';
  END IF;
  cap:=encode(sha256(convert_to(jsonb_build_array(to_jsonb(req),targets)::text,'UTF8')),'hex');
  SELECT * INTO ex FROM public.media_deletion_executions WHERE request_id=p_request_id FOR UPDATE;
  now_at:=clock_timestamp();
  IF ex.request_id IS NOT NULL AND ex.capture_sha256 IS DISTINCT FROM cap THEN RAISE EXCEPTION 'Deletion capture binding changed' USING ERRCODE='23505'; END IF;
  IF p_action='begin' THEN
    IF p_payload<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid begin payload' USING ERRCODE='22023'; END IF;
    IF ex.run_id IS NOT NULL AND ex.lease_expires_at>now_at THEN RAISE EXCEPTION 'Deletion run already owned' USING ERRCODE='23505'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.media_deletion_fences WHERE request_id=p_request_id) THEN
      LOCK TABLE public.stories,public.media_assets,public.recording_sessions,public.recording_chunks,
        public.recording_output_candidates,public.legacy_media_references,public.prompts IN SHARE ROW EXCLUSIVE MODE;
      SELECT coalesce(array_agg(split_part(t->>'target_id',':',2)::uuid),'{}') INTO assets FROM jsonb_array_elements(targets) t WHERE t->>'kind'='media_asset';
      stories:=CASE WHEN req.subject_type='story' THEN ARRAY[req.subject_id::uuid] ELSE '{}'::uuid[] END;
      SELECT coalesce(array_agg(s.id),'{}') INTO sessions FROM public.recording_sessions s WHERE s.story_id=ANY(stories)
        OR s.confirmed_asset_id=ANY(assets) OR s.seal_input->>'assetId'=ANY(assets::text[]);
      SELECT coalesce(jsonb_agg(q),'[]') INTO scopes FROM (
        SELECT 'object' AS kind,t->>'bucket' AS bucket,t->>'object_key' AS object_key FROM jsonb_array_elements(targets) t WHERE t->>'kind'='storage_object'
        UNION SELECT 'asset','',unnest(assets)::text
        UNION SELECT 'story','',unnest(stories)::text
        UNION SELECT 'session','',unnest(sessions)::text
        UNION SELECT 'prefix','audio-recordings',s.user_id::text||'/projects/'||s.project_id::text||'/sessions/'||s.id::text FROM public.recording_sessions s WHERE s.id=ANY(sessions)
      ) q;
      conflict:=EXISTS(SELECT 1 FROM public.media_assets a WHERE
          ((a.id=ANY(assets)) AND (a.project_id<>req.project_id OR a.state<>'deleting' OR (req.subject_type='story' AND a.story_id IS DISTINCT FROM req.subject_id::uuid)
            OR NOT public.media_deletion_path_matches(scopes,a.bucket,a.object_key)))
          OR (NOT a.id=ANY(assets) AND (a.parent_asset_id=ANY(assets) OR a.story_id=ANY(stories) OR public.media_deletion_path_matches(scopes,a.bucket,a.object_key))))
        OR (SELECT count(*) FROM public.media_assets WHERE id=ANY(assets))<>cardinality(assets)
        OR EXISTS(SELECT 1 FROM public.recording_sessions s WHERE s.id=ANY(sessions) AND (s.project_id<>req.project_id
          OR (req.subject_type='story' AND s.story_id IS DISTINCT FROM req.subject_id::uuid)
          OR (s.confirmed_asset_id IS NOT NULL AND NOT s.confirmed_asset_id=ANY(assets))
          OR (s.seal_input IS NOT NULL AND (s.seal_input->>'projectId' IS DISTINCT FROM s.project_id::text
            OR s.seal_input->>'userId' IS DISTINCT FROM s.user_id::text OR s.seal_input->>'sessionId' IS DISTINCT FROM s.id::text
            OR s.seal_input->>'storyId' IS DISTINCT FROM s.story_id::text
            OR EXISTS(SELECT 1 FROM public.media_assets a WHERE a.id::text=s.seal_input->>'assetId' AND (a.created_by IS DISTINCT FROM s.user_id OR a.story_id IS DISTINCT FROM s.story_id)) ))))
        OR EXISTS(SELECT 1 FROM public.recording_chunks c WHERE public.media_deletion_path_matches(scopes,c.bucket,c.object_key) AND NOT c.session_id=ANY(sessions))
        OR EXISTS(SELECT 1 FROM public.recording_output_candidates c WHERE public.media_deletion_path_matches(scopes,c.bucket,c.object_key)
          AND (NOT c.asset_id=ANY(assets) OR NOT c.session_id=ANY(sessions) OR c.project_id<>req.project_id))
        OR EXISTS(SELECT 1 FROM public.legacy_media_references l WHERE l.mapping_state<>'removed' AND
          (l.mapping_state IN ('unresolved','conflict') OR
           (CASE WHEN l.source_table='stories' AND l.source_row_id=ANY(stories)
             THEN NOT public.media_deletion_path_matches(scopes,l.resolved_bucket,l.resolved_object_key)
             ELSE l.asset_id=ANY(assets) OR public.media_deletion_path_matches(scopes,l.resolved_bucket,l.resolved_object_key) END)))
        OR EXISTS(SELECT 1 FROM public.stories s WHERE public.media_deletion_legacy_blocked(to_jsonb(s),scopes,s.id=ANY(stories)))
        OR EXISTS(SELECT 1 FROM public.prompts p WHERE public.media_deletion_legacy_blocked(to_jsonb(p),scopes));
      INSERT INTO public.media_deletion_executions(request_id,capture_sha256,state) VALUES(p_request_id,cap,'blocked_reference') ON CONFLICT DO NOTHING;
      IF conflict THEN
        UPDATE public.media_deletion_executions SET state='blocked_reference',next_scan_at=clock_timestamp()+interval '5 minutes' WHERE request_id=p_request_id;
        INSERT INTO public.media_deletion_events(request_id,run_id,event) VALUES(p_request_id,p_run_id,'blocked_reference');
      ELSE
        -- Bootstrap through the accepted coordination ledger; it never grants
        -- Storage permission itself. Unknown old ownership is observed first.
        SELECT * INTO job FROM public.media_deletion_jobs WHERE request_id=p_request_id;
        IF job.request_id IS NULL OR job.state='retry_wait' THEN
          receipt:=public.media_deletion_job_lease(p_request_id,'claim',replace(p_run_id::text,'-',''),NULL,120000);
          PERFORM public.media_deletion_job_lease(p_request_id,'start',receipt->>'workerId',(receipt->>'attempt')::integer,NULL);
        ELSIF job.state IN ('leased','running') THEN
          IF job.lease_expires_at>clock_timestamp() THEN RAISE EXCEPTION 'Bootstrap lease owned' USING ERRCODE='23505'; END IF;
          PERFORM public.media_deletion_job_lease(p_request_id,'recover',NULL,NULL,NULL);
        ELSE
          PERFORM public.media_deletion_job_lease(p_request_id,'recover',NULL,NULL,NULL);
        END IF;
        INSERT INTO public.media_deletion_fences(request_id,kind,bucket,object_key)
          SELECT p_request_id,f.kind,f.bucket,f.object_key FROM jsonb_to_recordset(scopes) f(kind text,bucket text,object_key text);
        INSERT INTO public.media_deletion_objects(request_id,bucket,object_key)
          SELECT p_request_id,f.bucket,f.object_key FROM jsonb_to_recordset(scopes) f(kind text,bucket text,object_key text) WHERE kind='object';
      END IF;
    ELSE conflict:=false;
    END IF;
    IF NOT conflict THEN
      INSERT INTO public.media_deletion_events(request_id,run_id,bucket,object_key,operation_id,event)
        SELECT request_id,p_run_id,bucket,object_key,operation_id,'unknown' FROM public.media_deletion_objects WHERE request_id=p_request_id AND state='dispatching';
      UPDATE public.media_deletion_objects SET physical_uncertain=true,state='unknown' WHERE request_id=p_request_id AND state='dispatching';
      UPDATE public.media_deletion_executions SET run_id=p_run_id,state='scanning',lease_expires_at=clock_timestamp()+interval '120 seconds',
        next_scan_at=clock_timestamp()+interval '120 seconds' WHERE request_id=p_request_id;
      INSERT INTO public.media_deletion_events(request_id,run_id,event) VALUES(p_request_id,p_run_id,'begin');
    END IF;
  ELSE
    IF ex.request_id IS NULL OR ex.run_id IS DISTINCT FROM p_run_id OR ex.state<>'scanning' OR ex.lease_expires_at<=now_at THEN
      RAISE EXCEPTION 'Deletion execution fence rejected' USING ERRCODE='23505';
    END IF;
    IF p_action='finish' THEN
      IF p_payload NOT IN ('{}'::jsonb,'{"interrupted":true}'::jsonb) THEN RAISE EXCEPTION 'Invalid finish payload' USING ERRCODE='22023'; END IF;
      IF p_payload='{}'::jsonb AND (EXISTS(SELECT 1 FROM public.media_deletion_fences WHERE request_id=p_request_id AND kind='prefix' AND inventory_run_id IS DISTINCT FROM p_run_id)
        OR EXISTS(SELECT 1 FROM public.media_deletion_objects WHERE request_id=p_request_id AND (state<>'absent' OR observed_run_id IS DISTINCT FROM p_run_id))) THEN
        RAISE EXCEPTION 'Deletion observations incomplete' USING ERRCODE='23505';
      END IF;
      outcome:=CASE WHEN p_payload='{}'::jsonb AND NOT EXISTS(SELECT 1 FROM public.media_deletion_objects WHERE request_id=p_request_id AND physical_uncertain) THEN 'observed_absent' ELSE 'reconcile' END;
      UPDATE public.media_deletion_executions SET state=outcome,run_id=NULL,lease_expires_at=NULL,next_scan_at=clock_timestamp()+interval '5 minutes',
        last_verified_at=CASE WHEN outcome='observed_absent' THEN clock_timestamp() ELSE last_verified_at END WHERE request_id=p_request_id;
      INSERT INTO public.media_deletion_events(request_id,run_id,event) VALUES(p_request_id,p_run_id,outcome);
    ELSE
      b:=p_payload->>'bucket'; k:=p_payload->>'objectKey';
      IF p_payload - ARRAY['bucket','objectKey','state','operationId'] <> '{}'::jsonb OR b IS NULL OR k IS NULL THEN
        RAISE EXCEPTION 'Invalid object payload' USING ERRCODE='22023';
      END IF;
      IF p_action='inventory' THEN
        UPDATE public.media_deletion_fences SET inventory_run_id=p_run_id WHERE request_id=p_request_id AND kind='prefix' AND bucket=b AND object_key=k;
        IF NOT FOUND THEN RAISE EXCEPTION 'Unknown deletion prefix' USING ERRCODE='23505'; END IF;
      ELSE
        IF p_action='discover' THEN
          IF NOT EXISTS(SELECT 1 FROM public.media_deletion_fences f WHERE f.request_id=p_request_id AND f.kind='prefix' AND f.bucket=b
            AND starts_with(k,f.object_key||'/') AND substring(k FROM length(f.object_key)+2) ~ '^(0|[1-9][0-9]*)$') THEN
            RAISE EXCEPTION 'Object outside deletion prefix' USING ERRCODE='23505';
          END IF;
          INSERT INTO public.media_deletion_objects(request_id,bucket,object_key) VALUES(p_request_id,b,k) ON CONFLICT DO NOTHING;
        ELSE
          SELECT * INTO obj FROM public.media_deletion_objects WHERE request_id=p_request_id AND bucket=b AND object_key=k FOR UPDATE;
          IF obj.request_id IS NULL THEN RAISE EXCEPTION 'Unknown deletion object' USING ERRCODE='23505'; END IF;
          IF p_action='observe' THEN
            outcome:=p_payload->>'state';
            IF outcome IS NULL OR outcome NOT IN ('present','absent') THEN RAISE EXCEPTION 'Invalid observation' USING ERRCODE='22023'; END IF;
            IF obj.state='dispatching' THEN RAISE EXCEPTION 'Dispatch result unresolved' USING ERRCODE='23505'; END IF;
            UPDATE public.media_deletion_objects SET state=outcome,observed_run_id=p_run_id,observed_at=clock_timestamp(),operation_id=NULL WHERE request_id=p_request_id AND bucket=b AND object_key=k;
          ELSIF p_action='dispatch' THEN
            IF obj.state<>'present' OR obj.observed_run_id IS DISTINCT FROM p_run_id THEN RAISE EXCEPTION 'Fresh presence required' USING ERRCODE='23505'; END IF;
            op:=gen_random_uuid();outcome:='dispatch';
            UPDATE public.media_deletion_objects SET state='dispatching',operation_id=op WHERE request_id=p_request_id AND bucket=b AND object_key=k;
          ELSE
            outcome:=p_payload->>'state';op:=(p_payload->>'operationId')::uuid;
            IF outcome IS NULL OR outcome NOT IN ('deleted','not_found','unknown') OR op IS NULL OR obj.operation_id IS DISTINCT FROM op
              OR obj.observed_run_id IS DISTINCT FROM p_run_id OR obj.state<>'dispatching' THEN RAISE EXCEPTION 'Deletion result fence rejected' USING ERRCODE='23505'; END IF;
            -- A delete acknowledgment is not an absence observation.
            UPDATE public.media_deletion_objects SET state='unknown',physical_uncertain=physical_uncertain OR outcome IN ('unknown','not_found') WHERE request_id=p_request_id AND bucket=b AND object_key=k;
          END IF;
          INSERT INTO public.media_deletion_events(request_id,run_id,bucket,object_key,operation_id,event) VALUES(p_request_id,p_run_id,b,k,op,outcome);
        END IF;
      END IF;
      UPDATE public.media_deletion_executions SET lease_expires_at=clock_timestamp()+interval '120 seconds',next_scan_at=clock_timestamp()+interval '120 seconds' WHERE request_id=p_request_id;
    END IF;
  END IF;
  SELECT * INTO ex FROM public.media_deletion_executions WHERE request_id=p_request_id;
  RETURN jsonb_build_object('requestId',p_request_id,'runId',p_run_id,'state',ex.state,'serverNow',clock_timestamp(),
    'leaseExpiresAt',ex.lease_expires_at,'lastVerifiedAt',ex.last_verified_at,'nextScanAt',ex.next_scan_at,'operationId',op,
    'physicalDeletionComplete',false,
    'unresolvedPhysicalCount',(SELECT count(*) FROM public.media_deletion_objects WHERE request_id=p_request_id AND physical_uncertain),
    'objects',CASE WHEN p_action='begin' AND ex.state='scanning' THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'objectKey',object_key) ORDER BY bucket,object_key),'[]') FROM public.media_deletion_objects WHERE request_id=p_request_id) ELSE '[]'::jsonb END,
    'prefixes',CASE WHEN p_action='begin' AND ex.state='scanning' THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'objectKey',object_key) ORDER BY bucket,object_key),'[]') FROM public.media_deletion_fences WHERE request_id=p_request_id AND kind='prefix') ELSE '[]'::jsonb END);
END $$;
REVOKE ALL ON FUNCTION public.media_deletion_execute(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_deletion_execute(uuid,uuid,text,jsonb) TO service_role;
COMMIT;
