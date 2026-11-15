CREATE TABLE public.deletion_json_probe_log(type_name text, serialized_bytes bigint, contains_unrelated_body boolean);
    CREATE FUNCTION public.deletion_json_probe(value anyelement) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $p$
    DECLARE result jsonb; BEGIN result := pg_catalog.to_jsonb(value);
      INSERT INTO public.deletion_json_probe_log VALUES(pg_typeof(value)::text,octet_length(result::text),coalesce(left(result->>'content',20)='UNRELATED_BODY_PROBE:',false));
      RETURN result; END; $p$;
CREATE FUNCTION public.request_media_deletion_json_probe(
  p_actor_id uuid, p_project_id uuid, p_subject_id uuid, p_subject_type text, p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
SET lock_timeout = '3s'
AS $$
DECLARE
  v_request public.deletion_requests%ROWTYPE;
  v_assets uuid[];
  v_sessions uuid[];
  v_jobs uuid[];
  v_candidates uuid[];
  v_stories uuid[];
  v_targets jsonb;
  v_actual jsonb;
  v_expected jsonb := '{}'::jsonb;
  v_rows jsonb;
  v_table text;
  v_now timestamptz;
  v_expected_request jsonb;
  v_subject_story uuid;
  v_count integer;
BEGIN
  IF p_actor_id IS NULL OR p_project_id IS NULL OR p_subject_id IS NULL OR p_request_id IS NULL
    OR p_subject_type IS NULL OR p_subject_type NOT IN ('media_asset','story')
    OR current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Invalid deletion capture arguments' USING ERRCODE = '22023';
  END IF;
  -- First lock matches publication/confirmation's deletion-table SHARE fence.
  -- EXCLUSIVE serializes captures, conflicts with all tombstone DML and SHARE,
  -- and still permits plain readers. Never read source addresses before waiting.
  LOCK TABLE public.deletion_requests IN EXCLUSIVE MODE;
  -- Conservative population locks cover absent roles, source inserts, rebinding
  -- and candidate reservation. Row-only locks cannot protect those phantoms.
  -- Existing legacy reverse orders can deadlock/timeout; such calls abort.
  LOCK TABLE public.projects, public.project_roles, auth.users IN SHARE MODE;
  LOCK TABLE public.stories, public.media_assets, public.recording_sessions,
    public.recording_chunks, public.processing_jobs, public.processing_attempts,
    public.recording_output_candidates, public.recording_story_intents,
    public.deletion_targets IN SHARE ROW EXCLUSIVE MODE;

  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=p_project_id AND
    (p.facilitator_id=p_actor_id OR EXISTS (SELECT 1 FROM public.project_roles r
      WHERE r.project_id=p_project_id AND r.user_id=p_actor_id AND r.role='facilitator' AND r.status='active')))
    OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_actor_id) THEN
    RAISE EXCEPTION 'Deletion access denied' USING ERRCODE = '42501';
  END IF;
  IF p_subject_type='story' THEN
    IF NOT EXISTS (SELECT 1 FROM public.stories s WHERE s.id=p_subject_id AND s.project_id=p_project_id) THEN
      RAISE EXCEPTION 'Deletion subject unavailable' USING ERRCODE = '42501';
    END IF;
    v_subject_story := p_subject_id;
  ELSE
    SELECT a.story_id INTO v_subject_story FROM public.media_assets a WHERE a.id=p_subject_id AND a.project_id=p_project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Deletion subject unavailable' USING ERRCODE = '42501'; END IF;
  END IF;

  -- Check supplied ID collisions BEFORE subject replay; no identity can borrow
  -- a different request's key just because its own subject was already captured.
  SELECT r.* INTO v_request FROM public.deletion_requests r WHERE r.id=p_request_id;
  IF FOUND AND (v_request.project_id IS DISTINCT FROM p_project_id OR v_request.subject_id IS DISTINCT FROM p_subject_id::text
    OR v_request.requested_by IS DISTINCT FROM p_actor_id OR v_request.subject_type IS DISTINCT FROM p_subject_type) THEN
    RAISE EXCEPTION 'Deletion request identity conflict' USING ERRCODE = '23505';
  END IF;
  SELECT count(*) INTO v_count FROM public.deletion_requests r WHERE r.project_id=p_project_id AND r.subject_id=p_subject_id::text;
  IF v_count > 0 THEN
    SELECT r.* INTO v_request FROM public.deletion_requests r WHERE r.project_id=p_project_id AND r.subject_id=p_subject_id::text;
    IF v_count <> 1 OR v_request.capture_version IS DISTINCT FROM 1 OR v_request.subject_type IS DISTINCT FROM p_subject_type
      OR v_request.requested_by IS DISTINCT FROM p_actor_id OR v_request.state IS DISTINCT FROM 'requested'
      OR v_request.attempt IS DISTINCT FROM 0 OR NOT isfinite(v_request.tombstone_at)
      OR v_request.requested_at IS DISTINCT FROM v_request.tombstone_at OR v_request.processing_at IS NOT NULL
      OR v_request.completed_at IS NOT NULL OR v_request.error_code IS NOT NULL
      OR v_request.capture_target_count IS NULL OR v_request.capture_target_count < 1 OR v_request.capture_targets_sha256 IS NULL THEN
      RAISE EXCEPTION 'Deletion capture cannot be replayed' USING ERRCODE = '23505';
    END IF;
    SELECT coalesce(jsonb_agg(public.deletion_json_probe(t) ORDER BY t.target_id),'[]'::jsonb) INTO v_actual
      FROM public.deletion_targets t WHERE t.deletion_request_id=v_request.id;
    IF jsonb_array_length(v_actual) IS DISTINCT FROM v_request.capture_target_count
      OR encode(sha256(convert_to(v_actual::text,'UTF8')),'hex') IS DISTINCT FROM v_request.capture_targets_sha256 THEN
      RAISE EXCEPTION 'Deletion target snapshot changed' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('id',v_request.id,'projectId',p_project_id,'subjectId',p_subject_id,'subjectType',p_subject_type,
      'state','requested','tombstoneAt',v_request.tombstone_at,'targetCount',jsonb_array_length(v_actual),'physicalDeletionComplete',false);
  END IF;

  -- Select only the explicit asset or the actual story population. Parent/child
  -- references do not implicitly expand an asset request into unrelated assets.
  SELECT coalesce(array_agg(a.id),'{}'::uuid[]) INTO v_assets FROM public.media_assets a
    WHERE (p_subject_type='media_asset' AND a.id=p_subject_id) OR (p_subject_type='story' AND a.story_id=p_subject_id);
  SELECT coalesce(array_agg(j.id),'{}'::uuid[]) INTO v_jobs FROM public.processing_jobs j WHERE j.asset_id=ANY(v_assets);
  SELECT coalesce(array_agg(s.id),'{}'::uuid[]) INTO v_sessions FROM public.recording_sessions s
    WHERE (p_subject_type='story' AND s.story_id=p_subject_id) OR s.confirmed_asset_id=ANY(v_assets)
      OR s.seal_input->>'assetId'=ANY(v_assets::text[]) OR s.merge_job_id=ANY(v_jobs);
  SELECT coalesce(array_agg(c.id),'{}'::uuid[]) INTO v_candidates FROM public.recording_output_candidates c
    WHERE c.asset_id=ANY(v_assets) OR c.session_id=ANY(v_sessions) OR c.job_id=ANY(v_jobs);
  SELECT coalesce(array_agg(DISTINCT a.story_id) FILTER (WHERE a.story_id IS NOT NULL),'{}'::uuid[]) INTO v_stories
    FROM public.media_assets a WHERE a.id=ANY(v_assets);
  IF v_subject_story IS NOT NULL THEN v_stories := array_append(v_stories,v_subject_story); END IF;
  IF EXISTS (SELECT 1 FROM public.stories s WHERE s.id=ANY(v_stories) AND s.project_id<>p_project_id)
    OR EXISTS (SELECT 1 FROM public.media_assets a WHERE a.id=ANY(v_assets) AND (a.project_id<>p_project_id OR a.state IN ('deleting','deleted')))
    OR EXISTS (SELECT 1 FROM public.processing_jobs j WHERE j.id=ANY(v_jobs) AND j.project_id<>p_project_id)
    OR EXISTS (SELECT 1 FROM public.recording_sessions s WHERE s.id=ANY(v_sessions) AND (s.project_id<>p_project_id
      OR (s.story_id IS NOT NULL AND NOT s.story_id=ANY(v_stories))
      OR (s.confirmed_asset_id IS NOT NULL AND NOT s.confirmed_asset_id=ANY(v_assets))
      OR (s.seal_input IS NOT NULL AND (s.seal_input->>'projectId' IS DISTINCT FROM p_project_id::text
        OR s.seal_input->>'sessionId' IS DISTINCT FROM s.id::text
        OR s.seal_input->>'userId' IS DISTINCT FROM s.user_id::text
        OR s.seal_input->>'storyId' IS DISTINCT FROM s.story_id::text
        OR NOT coalesce(s.seal_input->>'assetId'=ANY(v_assets::text[]),false)))
      OR (s.merge_job_id IS NOT NULL AND NOT s.merge_job_id=ANY(v_jobs))))
    OR EXISTS (SELECT 1 FROM public.recording_chunks c JOIN public.recording_sessions s ON s.id=c.session_id
      WHERE c.session_id=ANY(v_sessions) AND (c.project_id<>p_project_id OR c.bucket<>'audio-recordings'
        OR c.object_key IS DISTINCT FROM s.user_id::text||'/projects/'||p_project_id::text||'/sessions/'||s.id::text||'/'||c.chunk_index::text))
    OR EXISTS (SELECT 1 FROM public.recording_output_candidates c WHERE c.id=ANY(v_candidates) AND
      (c.project_id<>p_project_id OR NOT c.asset_id=ANY(v_assets) OR NOT c.session_id=ANY(v_sessions) OR NOT c.job_id=ANY(v_jobs)
        OR NOT EXISTS (SELECT 1 FROM public.processing_jobs j WHERE j.id=c.job_id AND j.project_id=c.project_id AND j.asset_id=c.asset_id)
        OR NOT EXISTS (SELECT 1 FROM public.recording_sessions s WHERE s.id=c.session_id AND s.project_id=c.project_id
          AND s.seal_input->>'assetId'=c.asset_id::text AND s.manifest_sha256=c.manifest_sha256)
        OR c.bucket<>'recording-candidates' OR c.object_key IS DISTINCT FROM 'jobs/'||c.job_id::text||'/attempts/'||c.attempt_no::text||'/'||c.id::text)) THEN
    RAISE EXCEPTION 'Deletion source identity conflict' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.deletion_requests r WHERE r.project_id=p_project_id AND r.tombstone_at IS NOT NULL
    AND (r.subject_id=p_project_id::text OR r.subject_id=ANY(v_stories::text[]) OR r.subject_id=ANY(v_assets::text[])
      OR r.subject_id=ANY(v_sessions::text[]))) THEN
    RAISE EXCEPTION 'Deletion subject already blocked' USING ERRCODE = '23505';
  END IF;
  -- Candidate paths must be backed by the actual candidate identity. Ordinary
  -- assets must use their owner's project namespace, never a foreign prefix.
  IF EXISTS (SELECT 1 FROM public.media_assets a WHERE a.id=ANY(v_assets) AND
    ((a.bucket='recording-candidates' AND NOT EXISTS (SELECT 1 FROM public.recording_output_candidates c
      WHERE c.id=ANY(v_candidates) AND c.asset_id=a.id AND c.bucket=a.bucket AND c.object_key=a.object_key))
    OR (a.bucket<>'recording-candidates' AND (a.bucket NOT IN ('audio-recordings','saga')
      OR left(a.object_key,length(a.created_by::text||'/projects/'||p_project_id::text||'/')) <> a.created_by::text||'/projects/'||p_project_id::text||'/')))) THEN
    RAISE EXCEPTION 'Unsafe deletion asset address' USING ERRCODE = '23505';
  END IF;

  v_now := clock_timestamp();
  WITH coordinates AS (
    SELECT a.bucket,a.object_key FROM public.media_assets a WHERE a.id=ANY(v_assets)
    UNION SELECT c.bucket,c.object_key FROM public.recording_chunks c WHERE c.session_id=ANY(v_sessions)
    UNION SELECT c.bucket,c.object_key FROM public.recording_output_candidates c WHERE c.id=ANY(v_candidates)
  ), targets AS (
    SELECT 'storage:'||c.bucket||':'||c.object_key AS target_id,'storage_object' AS kind,c.bucket,c.object_key FROM coordinates c
    UNION ALL SELECT 'asset:'||a.id::text,'media_asset',NULL,NULL FROM public.media_assets a WHERE a.id=ANY(v_assets)
    UNION ALL SELECT 'story:'||p_subject_id::text,'story',NULL,NULL WHERE p_subject_type='story'
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'deletion_request_id',p_request_id,
    'target_id',t.target_id,'kind',t.kind,'bucket',t.bucket,'object_key',t.object_key,'state','pending','error_code',NULL,'updated_at',v_now)
    ORDER BY t.target_id),'[]'::jsonb) INTO v_targets FROM targets t;
  IF jsonb_array_length(v_targets)<1 OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_targets) t WHERE t->>'kind'='storage_object'
    AND (length(t->>'object_key')>1024 OR t->>'object_key' !~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)+$'
      OR t->>'object_key' ~ '(^|/)\.{1,2}(/|$)')) THEN
    RAISE EXCEPTION 'Unsafe deletion address' USING ERRCODE = '23505';
  END IF;
  -- Reject physical aliases in unselected chains (even within this project).
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_targets) t JOIN public.media_assets a
      ON a.bucket=t->>'bucket' AND a.object_key=t->>'object_key' WHERE NOT a.id=ANY(v_assets))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_targets) t JOIN public.recording_chunks c
      ON c.bucket=t->>'bucket' AND c.object_key=t->>'object_key' WHERE NOT c.session_id=ANY(v_sessions))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_targets) t JOIN public.recording_output_candidates c
      ON c.bucket=t->>'bucket' AND c.object_key=t->>'object_key' WHERE NOT c.id=ANY(v_candidates)) THEN
    RAISE EXCEPTION 'Deletion address belongs to another chain' USING ERRCODE = '23505';
  END IF;

  -- Full tuple/population oracle, including unchanged evidence. This correctness
  -- slice intentionally scans locked source tables; O(total metadata) memory and
  -- global writer contention require redesign before throughput qualification.
  FOREACH v_table IN ARRAY ARRAY['projects','project_roles','stories','media_assets','recording_sessions','recording_chunks',
    'processing_jobs','processing_attempts','recording_output_candidates','recording_story_intents','deletion_requests','deletion_targets'] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(public.deletion_json_probe(t) ORDER BY coalesce(public.deletion_json_probe(t)->>''id'',public.deletion_json_probe(t)->>''session_id'')),''[]''::jsonb) FROM public.%I t',v_table) INTO v_rows;
    IF v_table='media_assets' THEN
      SELECT coalesce(jsonb_agg(CASE WHEN (r->>'id')::uuid=ANY(v_assets) THEN r||jsonb_build_object('state','deleting','updated_at',v_now) ELSE r END ORDER BY r->>'id'),'[]'::jsonb) INTO v_rows FROM jsonb_array_elements(v_rows) r;
    ELSIF v_table='processing_jobs' THEN
      SELECT coalesce(jsonb_agg(CASE WHEN (r->>'id')::uuid=ANY(v_jobs) AND r->>'state' NOT IN ('succeeded','failed','cancelled')
        AND r->'cancel_requested_at'='null'::jsonb THEN r||jsonb_build_object('cancel_requested_at',v_now,'updated_at',v_now) ELSE r END ORDER BY r->>'id'),'[]'::jsonb) INTO v_rows FROM jsonb_array_elements(v_rows) r;
    END IF;
    v_expected := v_expected||jsonb_build_object(v_table,v_rows);
  END LOOP;
  v_expected_request := jsonb_build_object('id',p_request_id,'project_id',p_project_id,'subject_id',p_subject_id::text,'requested_by',p_actor_id,
    'state','requested','tombstone_at',v_now,'attempt',0,'requested_at',v_now,'processing_at',NULL,'completed_at',NULL,'error_code',NULL,
    'capture_version',1,'subject_type',p_subject_type,'capture_target_count',jsonb_array_length(v_targets),
    'capture_targets_sha256',encode(sha256(convert_to(v_targets::text,'UTF8')),'hex'));
  INSERT INTO public.deletion_requests(id,project_id,subject_id,requested_by,state,tombstone_at,requested_at,capture_version,subject_type,capture_target_count,capture_targets_sha256)
    VALUES(p_request_id,p_project_id,p_subject_id::text,p_actor_id,'requested',v_now,v_now,1,p_subject_type,
      jsonb_array_length(v_targets),encode(sha256(convert_to(v_targets::text,'UTF8')),'hex'));
  INSERT INTO public.deletion_targets SELECT * FROM jsonb_populate_recordset(NULL::public.deletion_targets,v_targets);
  UPDATE public.media_assets SET state='deleting',updated_at=v_now WHERE id=ANY(v_assets);
  UPDATE public.processing_jobs SET cancel_requested_at=v_now,updated_at=v_now
    WHERE id=ANY(v_jobs) AND state NOT IN ('succeeded','failed','cancelled') AND cancel_requested_at IS NULL;
  -- Compare after every write/trigger has run, so later triggers cannot alter an
  -- earlier validated tuple, insert a missed source, or suppress target writes.
  v_expected := jsonb_set(v_expected,'{deletion_requests}',(SELECT jsonb_agg(r ORDER BY r->>'id')
    FROM jsonb_array_elements((v_expected->'deletion_requests')||jsonb_build_array(v_expected_request)) r));
  v_expected := jsonb_set(v_expected,'{deletion_targets}',(SELECT jsonb_agg(r ORDER BY r->>'id')
    FROM jsonb_array_elements((v_expected->'deletion_targets')||v_targets) r));
  FOREACH v_table IN ARRAY ARRAY['projects','project_roles','stories','media_assets','recording_sessions','recording_chunks',
    'processing_jobs','processing_attempts','recording_output_candidates','recording_story_intents','deletion_requests','deletion_targets'] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(public.deletion_json_probe(t) ORDER BY coalesce(public.deletion_json_probe(t)->>''id'',public.deletion_json_probe(t)->>''session_id'')),''[]''::jsonb) FROM public.%I t',v_table) INTO v_actual;
    IF v_actual IS DISTINCT FROM v_expected->v_table THEN
      RAISE EXCEPTION 'Deletion capture write verification failed' USING ERRCODE = '23505';
    END IF;
  END LOOP;
  RETURN jsonb_build_object('id',p_request_id,'projectId',p_project_id,'subjectId',p_subject_id,'subjectType',p_subject_type,
    'state','requested','tombstoneAt',v_now,'targetCount',jsonb_array_length(v_targets),'physicalDeletionComplete',false);
END;
$$;