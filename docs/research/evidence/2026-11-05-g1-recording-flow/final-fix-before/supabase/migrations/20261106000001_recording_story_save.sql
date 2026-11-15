-- One immutable save intent per session, reserved before sealed identity exists.
BEGIN;
CREATE TABLE public.recording_story_intents (
  session_id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  story_id uuid NOT NULL UNIQUE REFERENCES public.stories(id),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recording_story_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_story_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.recording_story_intents FROM PUBLIC, anon, authenticated, service_role;
-- Only the definer routine accesses the ledger; no client-supplied JWT policy.

CREATE FUNCTION public.recording_story_save(
  p_actor_id uuid, p_project_id uuid, p_session_id uuid, p_action text,
  p_metadata jsonb, p_manifest_sha256 text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
SET lock_timeout = '3s'
AS $$
DECLARE
  v_intent public.recording_story_intents%ROWTYPE;
  v_story public.stories%ROWTYPE;
  v_session public.recording_sessions%ROWTYPE;
  v_asset public.media_assets%ROWTYPE;
  v_job public.processing_jobs%ROWTYPE;
  v_attempt public.processing_attempts%ROWTYPE;
  v_candidate public.recording_output_candidates%ROWTYPE;
  v_snapshot jsonb;
  v_intent_json jsonb := 'null';
  v_row jsonb;
  v_asset_id uuid;
  v_count integer;
  v_key text;
  v_expected_story jsonb;
  v_confirmed timestamptz;
  v_manifest jsonb;
  v_chunk jsonb;
  v_index integer := 0;
  v_total_bytes bigint := 0;
  v_chunk_ids text[] := ARRAY[]::text[];
  v_object_key text;
  v_canonical_chunks text := '[';
  v_identity_bytes bytea;
  v_expected_asset_id uuid;
  v_idempotency_key text;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' OR p_actor_id IS NULL OR p_project_id IS NULL
    OR p_session_id IS NULL OR p_action IS NULL OR p_action NOT IN ('lookup','reserve','confirm') THEN
    RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '22023';
  END IF;
  IF (p_action <> 'reserve' AND p_metadata IS NOT NULL) OR (p_action <> 'confirm' AND p_manifest_sha256 IS NOT NULL)
    OR (p_action = 'confirm' AND (p_manifest_sha256 IS NULL OR p_manifest_sha256 !~ '^[0-9a-f]{64}$')) THEN
    RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'reserve' THEN
    IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR
      NOT (p_metadata ?& ARRAY['title','content','transcript','happenedAt','recordingMode','isPublic']) OR
      p_metadata - ARRAY['title','content','transcript','happenedAt','recordingMode','isPublic'] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '22023';
    END IF;
    FOREACH v_key IN ARRAY ARRAY['title','content','transcript'] LOOP
      IF jsonb_typeof(p_metadata -> v_key) IS DISTINCT FROM 'string' OR
        length(p_metadata ->> v_key) > (CASE WHEN v_key = 'title' THEN 500 ELSE 200000 END) THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF jsonb_typeof(p_metadata -> 'happenedAt') IS DISTINCT FROM 'string' OR
      p_metadata ->> 'happenedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' OR
      jsonb_typeof(p_metadata -> 'recordingMode') IS DISTINCT FROM 'string' OR
      p_metadata ->> 'recordingMode' NOT IN ('chat','deep_dive') OR
      jsonb_typeof(p_metadata -> 'isPublic') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '22023';
    END IF;
    BEGIN
      IF to_char((p_metadata ->> 'happenedAt')::timestamptz,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> p_metadata ->> 'happenedAt' THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '22023';
      END IF;
    EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '22023';
    END;
  END IF;
  -- Same order as terminal publication: deletion table before session advisory,
  -- project, actor, role, story, session/chunks, asset, job, attempts, candidate.
  -- The table lock also covers previously absent tombstones.
  LOCK TABLE public.deletion_requests IN SHARE MODE;
  PERFORM pg_advisory_xact_lock(hashtextextended('recording-seal:' || p_session_id::text,0));
  SELECT to_jsonb(p) INTO v_row FROM public.projects p WHERE p.id = p_project_id FOR SHARE;
  IF NOT FOUND OR jsonb_strip_nulls(v_row) ?| ARRAY['tombstone_at','deletion_requested_at','deleted_at','cancel_requested_at'] THEN
    RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(u) INTO v_row FROM auth.users u WHERE u.id = p_actor_id FOR SHARE;
  IF NOT FOUND OR jsonb_strip_nulls(v_row) ?| ARRAY['tombstone_at','deletion_requested_at','deleted_at','cancel_requested_at'] THEN
    RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(r) INTO v_row FROM public.project_roles r WHERE r.project_id = p_project_id AND r.user_id = p_actor_id FOR SHARE;
  IF NOT FOUND OR v_row ->> 'role' IS DISTINCT FROM 'storyteller' OR v_row ->> 'status' IS DISTINCT FROM 'active' OR
    jsonb_strip_nulls(v_row) ?| ARRAY['tombstone_at','deletion_requested_at','deleted_at','cancel_requested_at'] THEN
    RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT i.* INTO v_intent FROM public.recording_story_intents i WHERE i.session_id = p_session_id FOR UPDATE;
  IF FOUND AND (v_intent.actor_id <> p_actor_id OR v_intent.project_id <> p_project_id) THEN
    RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '42501';
  END IF;
  IF v_intent.session_id IS NOT NULL THEN
    SELECT st.* INTO v_story FROM public.stories st WHERE st.id = v_intent.story_id FOR UPDATE;
    IF NOT FOUND OR v_story.project_id IS DISTINCT FROM p_project_id OR v_story.storyteller_id IS DISTINCT FROM p_actor_id
      OR v_story.user_id IS DISTINCT FROM p_actor_id OR jsonb_strip_nulls(to_jsonb(v_story)) ?| ARRAY['tombstone_at','deletion_requested_at','deleted_at','cancel_requested_at'] THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '42501';
    END IF;
  END IF;
  SELECT s.* INTO v_session FROM public.recording_sessions s WHERE s.id = p_session_id FOR SHARE;
  IF FOUND THEN
    IF v_session.user_id IS DISTINCT FROM p_actor_id OR v_session.project_id IS DISTINCT FROM p_project_id THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '42501';
    END IF;
    IF v_intent.session_id IS NULL OR v_session.story_id IS DISTINCT FROM v_intent.story_id THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
    v_asset_id := (v_session.seal_input ->> 'assetId')::uuid;
    PERFORM 1 FROM public.recording_chunks c WHERE c.session_id = p_session_id ORDER BY c.chunk_index FOR SHARE;
    SELECT a.* INTO v_asset FROM public.media_assets a WHERE a.id = v_asset_id FOR SHARE;
    IF jsonb_strip_nulls(to_jsonb(v_session)) ?| ARRAY['tombstone_at','deletion_requested_at','deleted_at','cancel_requested_at']
      OR jsonb_strip_nulls(to_jsonb(v_asset)) ?| ARRAY['tombstone_at','deletion_requested_at','deleted_at','cancel_requested_at']
      OR v_asset.state IN ('deleting','deleted') THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.deletion_requests d WHERE d.project_id = p_project_id AND d.tombstone_at IS NOT NULL
    AND d.subject_id IN (p_project_id::text,p_session_id::text,v_intent.story_id::text,v_asset_id::text)) THEN
    RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'reserve' THEN
    IF v_intent.session_id IS NULL THEN
      INSERT INTO public.stories(project_id,user_id,storyteller_id,title,content,transcript,happened_at,recording_mode,is_public,status)
      VALUES(p_project_id,p_actor_id,p_actor_id,p_metadata ->> 'title',p_metadata ->> 'content',p_metadata ->> 'transcript',
        (p_metadata ->> 'happenedAt')::timestamptz,p_metadata ->> 'recordingMode',(p_metadata ->> 'isPublic')::boolean,'processing') RETURNING * INTO v_story;
      IF NOT FOUND THEN RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505'; END IF;
      INSERT INTO public.recording_story_intents(session_id,project_id,actor_id,story_id,metadata)
        VALUES(p_session_id,p_project_id,p_actor_id,v_story.id,p_metadata) RETURNING * INTO v_intent;
      IF NOT FOUND OR v_intent.metadata IS DISTINCT FROM p_metadata OR v_intent.confirmed_at IS NOT NULL THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
      END IF;
    ELSIF v_intent.metadata IS DISTINCT FROM p_metadata THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
  END IF;
  IF p_action = 'confirm' THEN
    IF v_intent.session_id IS NULL OR v_session.manifest_sha256 IS DISTINCT FROM p_manifest_sha256 OR
      v_session.state IS DISTINCT FROM 'cloud_confirmed' OR v_session.confirmed_asset_id IS DISTINCT FROM v_asset_id OR
      v_session.confirmed_at IS NULL OR v_session.merge_job_id IS NULL OR v_asset.state IS DISTINCT FROM 'ready' THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
    SELECT j.* INTO v_job FROM public.processing_jobs j WHERE j.id = v_session.merge_job_id FOR SHARE;
    PERFORM 1 FROM public.processing_attempts a WHERE a.job_id = v_job.id ORDER BY a.attempt_no FOR SHARE;
    SELECT a.* INTO v_attempt FROM public.processing_attempts a WHERE a.job_id = v_job.id AND a.attempt_no = v_job.attempt_count;
    PERFORM 1 FROM public.recording_output_candidates c WHERE c.job_id = v_job.id OR c.asset_id = v_asset_id OR c.session_id = p_session_id ORDER BY c.id FOR SHARE;
    SELECT count(*) INTO v_count FROM public.recording_output_candidates c WHERE c.job_id = v_job.id OR c.asset_id = v_asset_id OR c.session_id = p_session_id;
    IF v_count <> 1 THEN RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505'; END IF;
    SELECT c.* INTO v_candidate FROM public.recording_output_candidates c WHERE c.job_id = v_job.id OR c.asset_id = v_asset_id OR c.session_id = p_session_id;
    -- Rebuild immutable identity exactly as recording_job_lease and the
    -- application's prepareRecordingSessionSeal do. Equality between two
    -- stored keys alone cannot prove either key is canonical. These checks
    -- must precede DML: application rejection after the RPC cannot roll it back.
    v_manifest := v_session.seal_input;
    IF jsonb_typeof(v_manifest) IS DISTINCT FROM 'object' OR
      NOT (v_manifest ?& ARRAY['schemaVersion','projectId','sessionId','userId','storyId','assetId','mimeType','chunks']) OR
      v_manifest - ARRAY['schemaVersion','projectId','sessionId','userId','storyId','assetId','mimeType','chunks'] <> '{}'::jsonb OR
      v_manifest -> 'schemaVersion' IS DISTINCT FROM '1'::jsonb THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
    FOREACH v_key IN ARRAY ARRAY['projectId','sessionId','userId','storyId','assetId'] LOOP
      IF jsonb_typeof(v_manifest -> v_key) IS DISTINCT FROM 'string' OR
        v_manifest ->> v_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
      END IF;
    END LOOP;
    IF jsonb_typeof(v_manifest -> 'mimeType') IS DISTINCT FROM 'string' OR
      v_manifest ->> 'mimeType' !~ '^audio/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$' OR
      jsonb_typeof(v_manifest -> 'chunks') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
    IF jsonb_array_length(v_manifest -> 'chunks') NOT BETWEEN 1 AND 2000 THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
    FOR v_chunk IN SELECT value FROM jsonb_array_elements(v_manifest -> 'chunks') LOOP
      IF jsonb_typeof(v_chunk) IS DISTINCT FROM 'object' OR
        NOT (v_chunk ?& ARRAY['index','chunkId','bucket','objectKey','storageObjectKey','byteSize','sha256']) OR
        v_chunk - ARRAY['index','chunkId','bucket','objectKey','storageObjectKey','byteSize','sha256'] <> '{}'::jsonb OR
        v_chunk -> 'index' IS DISTINCT FROM to_jsonb(v_index) OR
        jsonb_typeof(v_chunk -> 'chunkId') IS DISTINCT FROM 'string' OR v_chunk ->> 'chunkId' !~ '^[A-Za-z0-9_-]{1,128}$' OR
        (v_chunk ->> 'chunkId') = ANY(v_chunk_ids) OR v_chunk -> 'bucket' IS DISTINCT FROM '"audio-recordings"'::jsonb OR
        jsonb_typeof(v_chunk -> 'sha256') IS DISTINCT FROM 'string' OR v_chunk ->> 'sha256' !~ '^[0-9a-f]{64}$' OR
        jsonb_typeof(v_chunk -> 'byteSize') IS DISTINCT FROM 'number' OR v_chunk ->> 'byteSize' !~ '^[1-9][0-9]{0,8}$' THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
      END IF;
      v_total_bytes := v_total_bytes + (v_chunk ->> 'byteSize')::bigint;
      v_object_key := 'projects/' || p_project_id::text || '/sessions/' || p_session_id::text || '/' || v_index::text;
      IF v_total_bytes > 104857600 OR v_chunk -> 'objectKey' IS DISTINCT FROM to_jsonb(v_object_key) OR
        v_chunk -> 'storageObjectKey' IS DISTINCT FROM to_jsonb(p_actor_id::text || '/' || v_object_key) THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
      END IF;
      v_canonical_chunks := v_canonical_chunks || CASE WHEN v_index > 0 THEN ',' ELSE '' END ||
        replace(jsonb_build_array(v_index,v_chunk ->> 'chunkId',v_chunk ->> 'bucket',v_object_key,
          (v_chunk ->> 'byteSize')::integer,v_chunk ->> 'sha256')::text,' ','');
      v_chunk_ids := array_append(v_chunk_ids,v_chunk ->> 'chunkId');
      v_index := v_index + 1;
    END LOOP;
    v_canonical_chunks := v_canonical_chunks || ']';
    v_identity_bytes := sha256(convert_to(replace(jsonb_build_array('saga-recording-asset-v1',
      p_project_id::text,p_session_id::text,p_actor_id::text)::text,' ',''),'UTF8'));
    v_identity_bytes := set_byte(v_identity_bytes,6,(get_byte(v_identity_bytes,6) & 15) | 128);
    v_identity_bytes := set_byte(v_identity_bytes,8,(get_byte(v_identity_bytes,8) & 63) | 128);
    v_expected_asset_id := encode(substring(v_identity_bytes FROM 1 FOR 16),'hex')::uuid;
    v_idempotency_key := 'processing-job-v1:' || replace(jsonb_build_array(p_project_id::text,
      v_expected_asset_id::text,1,'recording_merge','ffmpeg-merge-v1','none','default')::text,' ','') ||
      ':mime=' || (v_manifest ->> 'mimeType') || ':session=' || p_session_id::text ||
      ':chunks=' || encode(sha256(convert_to(v_canonical_chunks,'UTF8')),'hex');
    IF v_asset_id IS DISTINCT FROM v_expected_asset_id OR v_asset.id IS DISTINCT FROM v_expected_asset_id OR
      v_asset.idempotency_key IS DISTINCT FROM v_idempotency_key OR v_job.idempotency_key IS DISTINCT FROM v_idempotency_key OR
      v_session.total_input_bytes IS DISTINCT FROM v_total_bytes THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
    IF v_job.state IS DISTINCT FROM 'succeeded' OR v_job.result_ref IS DISTINCT FROM v_asset_id::text OR
      v_job.project_id IS DISTINCT FROM p_project_id OR v_job.created_by IS DISTINCT FROM p_actor_id OR v_job.asset_id IS DISTINCT FROM v_asset_id OR
      v_job.job_type IS DISTINCT FROM 'recording_merge' OR v_job.input_version IS DISTINCT FROM 1 OR
      v_job.processor_version IS DISTINCT FROM 'ffmpeg-merge-v1' OR v_job.parameter_version IS DISTINCT FROM 'default' OR v_job.model_config_version IS DISTINCT FROM 'none' OR
      v_job.lease_owner IS NOT NULL OR v_job.lease_expires_at IS NOT NULL OR v_job.not_before IS NOT NULL OR v_job.error_code IS NOT NULL OR v_job.cancel_requested_at IS NOT NULL OR
      v_job.attempt_count < 1 OR v_job.attempt_count > 3 OR v_job.max_attempts <> 3 OR
      v_attempt.result_state IS DISTINCT FROM 'succeeded' OR v_attempt.dispatched_at IS NULL OR v_attempt.error_code IS NOT NULL OR
      v_attempt.provider IS NOT NULL OR v_attempt.provider_request_id IS NOT NULL OR v_attempt.usage_units IS NOT NULL OR v_attempt.reserved_cost_usd IS NOT NULL OR v_attempt.settled_cost_usd IS NOT NULL OR
      v_candidate.state IS DISTINCT FROM 'prepared' OR v_candidate.prepared_at IS NULL OR
      v_candidate.project_id IS DISTINCT FROM p_project_id OR v_candidate.session_id IS DISTINCT FROM p_session_id OR
      v_candidate.asset_id IS DISTINCT FROM v_asset_id OR v_candidate.job_id IS DISTINCT FROM v_job.id OR
      v_candidate.manifest_sha256 IS DISTINCT FROM p_manifest_sha256 OR v_candidate.attempt_no IS DISTINCT FROM v_attempt.attempt_no OR v_candidate.worker_id IS DISTINCT FROM v_attempt.worker_id OR
      v_asset.project_id IS DISTINCT FROM p_project_id OR v_asset.created_by IS DISTINCT FROM p_actor_id OR v_asset.story_id IS DISTINCT FROM v_intent.story_id OR
      v_asset.kind IS DISTINCT FROM 'original_audio' OR v_asset.version <> 1 OR v_asset.bucket IS DISTINCT FROM v_candidate.bucket OR
      v_candidate.bucket IS DISTINCT FROM 'recording-candidates' OR v_asset.object_key IS DISTINCT FROM v_candidate.object_key OR
      v_candidate.object_key IS DISTINCT FROM 'jobs/' || v_job.id::text || '/attempts/' || v_attempt.attempt_no::text || '/' || v_candidate.id::text OR
      v_asset.byte_size IS DISTINCT FROM v_candidate.byte_size OR v_asset.sha256 IS DISTINCT FROM v_candidate.sha256 OR
      v_asset.duration_ms IS DISTINCT FROM v_candidate.duration_ms OR v_asset.mime_type IS DISTINCT FROM v_candidate.mime_type OR
      v_asset.mime_type IS DISTINCT FROM v_session.mime_type OR v_asset.verification_error IS NOT NULL OR
      v_asset.updated_at IS DISTINCT FROM v_job.updated_at OR v_asset.verified_at IS DISTINCT FROM v_job.updated_at OR
      v_asset.content_verified_at IS DISTINCT FROM v_job.updated_at OR v_session.confirmed_at IS DISTINCT FROM v_job.updated_at OR v_attempt.finished_at IS DISTINCT FROM v_job.updated_at OR
      v_candidate.created_at < v_attempt.dispatched_at OR v_candidate.prepared_at < v_candidate.created_at OR v_candidate.prepared_at > v_job.updated_at OR
      v_job.updated_at > clock_timestamp() OR v_asset.duration_ms IS NULL OR v_asset.duration_ms < 1 OR v_asset.duration_ms > 7200000 OR
      v_session.manifest_sha256 IS DISTINCT FROM encode(sha256(convert_to(v_session.seal_input::text,'UTF8')),'hex') OR
      v_session.seal_input ->> 'storyId' IS DISTINCT FROM v_intent.story_id::text OR
      (SELECT count(*) FROM public.processing_jobs j WHERE j.asset_id = v_asset_id) <> 1 OR
      (SELECT count(*) FROM public.recording_sessions s WHERE s.seal_input ->> 'assetId' = v_asset_id::text) <> 1 OR
      (SELECT count(*) FROM public.processing_attempts a WHERE a.job_id = v_job.id) <> v_job.attempt_count THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
    IF v_session.total_chunks IS DISTINCT FROM jsonb_array_length(v_session.seal_input -> 'chunks') OR
      (SELECT count(*) FROM public.recording_chunks c WHERE c.session_id=p_session_id) <> v_session.total_chunks OR
      (SELECT sum(c.byte_size) FROM public.recording_chunks c WHERE c.session_id=p_session_id) IS DISTINCT FROM v_session.total_input_bytes OR
      v_asset.byte_size IS DISTINCT FROM v_session.total_input_bytes OR
      v_session.seal_input ->> 'sessionId' IS DISTINCT FROM p_session_id::text OR
      v_session.seal_input ->> 'projectId' IS DISTINCT FROM p_project_id::text OR
      v_session.seal_input ->> 'userId' IS DISTINCT FROM p_actor_id::text OR
      v_session.seal_input ->> 'mimeType' IS DISTINCT FROM v_asset.mime_type OR
      v_session.started_at IS NULL OR v_session.sealed_at IS NULL OR NOT isfinite(v_session.started_at) OR NOT isfinite(v_session.sealed_at) OR
      v_session.started_at > v_session.sealed_at OR v_session.sealed_at > v_attempt.dispatched_at OR
      v_asset.created_at > v_job.created_at OR v_job.created_at > v_attempt.dispatched_at OR v_attempt.dispatched_at > v_candidate.created_at OR
      v_asset.parent_asset_id IS NOT NULL OR v_asset.original_filename IS DISTINCT FROM 'unnamed-asset' OR
      EXISTS (SELECT 1 FROM jsonb_array_elements(v_session.seal_input -> 'chunks') WITH ORDINALITY expected(chunk,ordinal)
        LEFT JOIN public.recording_chunks c ON c.session_id=p_session_id AND c.chunk_index=expected.ordinal-1
        WHERE c.id IS NULL OR c.project_id IS DISTINCT FROM p_project_id OR c.seal_chunk_id IS DISTINCT FROM expected.chunk ->> 'chunkId'
          OR c.chunk_index::text IS DISTINCT FROM expected.chunk ->> 'index' OR c.bucket IS DISTINCT FROM expected.chunk ->> 'bucket'
          OR c.object_key IS DISTINCT FROM expected.chunk ->> 'storageObjectKey' OR c.byte_size::text IS DISTINCT FROM expected.chunk ->> 'byteSize'
          OR c.sha256 IS DISTINCT FROM expected.chunk ->> 'sha256' OR c.persisted_at > v_session.sealed_at) OR
      EXISTS (SELECT 1 FROM public.processing_attempts a WHERE a.job_id=v_job.id AND a.attempt_no < v_job.attempt_count AND
        (a.attempt_no < 1 OR a.result_state IS DISTINCT FROM 'retryable_error' OR a.error_code IS DISTINCT FROM 'lease_expired_before_dispatch'
          OR a.dispatched_at IS NOT NULL OR a.finished_at IS NULL OR a.finished_at < v_session.sealed_at OR a.finished_at > v_attempt.dispatched_at)) THEN
      RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
    END IF;
    -- Return the unfiltered, bounded chain to the existing strict application
    -- validator; its independently verified success is required for cleanup.
    IF v_intent.confirmed_at IS NULL THEN
      IF v_story.status IS DISTINCT FROM 'processing' OR v_story.audio_url IS NOT NULL THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
      END IF;
      v_confirmed := clock_timestamp();
      v_expected_story := to_jsonb(v_story) || jsonb_build_object('status','ready','audio_url','/api/media/assets/' || v_asset_id::text || '/play',
        'audio_duration',ceil(v_asset.duration_ms::numeric / 1000)::integer,'duration',ceil(v_asset.duration_ms::numeric / 1000)::integer,'updated_at',v_confirmed);
      UPDATE public.stories SET status='ready',audio_url='/api/media/assets/' || v_asset_id::text || '/play',
        audio_duration=ceil(v_asset.duration_ms::numeric / 1000)::integer,duration=ceil(v_asset.duration_ms::numeric / 1000)::integer,updated_at=v_confirmed WHERE id=v_intent.story_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505'; END IF;
      UPDATE public.recording_story_intents SET confirmed_at=v_confirmed WHERE session_id=p_session_id RETURNING * INTO v_intent;
      IF NOT FOUND OR v_intent.confirmed_at IS DISTINCT FROM v_confirmed OR
        (SELECT to_jsonb(st) FROM public.stories st WHERE st.id=v_intent.story_id) IS DISTINCT FROM v_expected_story THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
      END IF;
    ELSE
      IF v_story.status IS DISTINCT FROM 'ready' OR v_story.audio_url IS DISTINCT FROM '/api/media/assets/' || v_asset_id::text || '/play' OR
        v_story.audio_duration IS DISTINCT FROM ceil(v_asset.duration_ms::numeric / 1000)::integer THEN
        RAISE EXCEPTION 'recording_save_unavailable' USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;
  IF v_session.id IS NOT NULL THEN
    v_snapshot := public.read_recording_session_snapshot(p_actor_id,p_project_id,p_session_id,v_session.manifest_sha256);
    -- A lock wait can cross publication; observation must follow the fresh read.
    v_snapshot := v_snapshot || jsonb_build_object('observedAt',clock_timestamp());
  END IF;
  IF v_intent.session_id IS NOT NULL THEN
    v_intent_json := jsonb_build_object('storyId',v_intent.story_id,'metadata',v_intent.metadata,
      'manifestSha256',v_session.manifest_sha256,'assetId',v_asset_id,'confirmed',v_intent.confirmed_at IS NOT NULL);
  END IF;
  RETURN jsonb_build_object('lookup',jsonb_build_object('schemaVersion',1,'actorId',p_actor_id,'projectId',p_project_id,
    'sessionId',p_session_id,'intent',v_intent_json,'canClearLocalDrafts',false),'snapshot',v_snapshot);
END;
$$;
REVOKE ALL ON FUNCTION public.recording_story_save(uuid,uuid,uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recording_story_save(uuid,uuid,uuid,text,jsonb,text) TO service_role;
COMMIT;
