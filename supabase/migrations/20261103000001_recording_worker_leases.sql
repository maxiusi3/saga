-- G1 local candidate: durable input-worker fences, not publication or cleanup.
BEGIN;

ALTER TABLE public.processing_attempts ALTER COLUMN dispatched_at DROP NOT NULL;
ALTER TABLE public.processing_attempts DROP CONSTRAINT processing_attempts_result_state_check;
ALTER TABLE public.processing_attempts ADD CONSTRAINT processing_attempts_result_state_check
  CHECK (result_state IN ('leased', 'running', 'succeeded', 'retryable_error', 'fatal_error', 'outcome_unknown', 'cancelled'));

CREATE OR REPLACE FUNCTION public.recording_job_lease(
  p_job_id uuid, p_action text, p_worker_id text, p_attempt integer, p_lease_ms integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  v_root_keys constant text[] := ARRAY['schemaVersion', 'projectId', 'sessionId', 'userId', 'storyId', 'assetId', 'mimeType', 'chunks'];
  v_chunk_keys constant text[] := ARRAY['index', 'chunkId', 'bucket', 'objectKey', 'storageObjectKey', 'byteSize', 'sha256'];
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_discovered_job public.processing_jobs%ROWTYPE;
  v_discovered_session public.recording_sessions%ROWTYPE;
  v_job public.processing_jobs%ROWTYPE;
  v_session public.recording_sessions%ROWTYPE;
  v_asset public.media_assets%ROWTYPE;
  v_attempt public.processing_attempts%ROWTYPE;
  v_manifest jsonb;
  v_chunk jsonb;
  v_role record;
  v_story record;
  v_allowed boolean := true;
  v_deleted boolean := false;
  v_key text;
  v_count integer;
  v_index integer := 0;
  v_total_bytes bigint := 0;
  v_chunk_ids text[] := ARRAY[]::text[];
  v_object_key text;
  v_canonical_chunks text := '[';
  v_identity_bytes bytea;
  v_asset_id uuid;
  v_idempotency_key text;
  v_manifest_sha256 text;
  v_now timestamptz;
  v_attempt_state text;
BEGIN
  IF p_job_id IS NULL OR p_action IS NULL OR p_action NOT IN ('claim', 'start', 'heartbeat', 'check', 'recover') THEN
    RAISE EXCEPTION 'Invalid recording lease action' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'recover' THEN
    IF p_worker_id IS NOT NULL OR p_attempt IS NOT NULL OR p_lease_ms IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid recovery arguments' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_worker_id IS NULL OR p_worker_id !~ '^[A-Za-z0-9_-]{1,128}$' THEN
      RAISE EXCEPTION 'Invalid recording worker' USING ERRCODE = '22023';
    END IF;
    IF (p_action = 'claim' AND p_attempt IS NOT NULL)
      OR (p_action <> 'claim' AND (p_attempt IS NULL OR p_attempt < 1)) THEN
      RAISE EXCEPTION 'Invalid recording attempt' USING ERRCODE = '22023';
    END IF;
    IF (p_action IN ('claim', 'heartbeat') AND (p_lease_ms IS NULL OR p_lease_ms < 1000 OR p_lease_ms > 120000))
      OR (p_action IN ('start', 'check') AND p_lease_ms IS NOT NULL) THEN
      RAISE EXCEPTION 'Invalid recording lease duration' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Discovery is not authority. Re-read under locks before trusting any binding.
  SELECT j.* INTO v_discovered_job FROM public.processing_jobs j WHERE j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recording job unavailable' USING ERRCODE = '23505';
  END IF;
  SELECT count(*) INTO v_count FROM public.recording_sessions s
    WHERE s.seal_input @> jsonb_build_object('assetId', v_discovered_job.asset_id::text);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Recording input is not uniquely sealed' USING ERRCODE = '23505';
  END IF;
  SELECT s.* INTO v_discovered_session FROM public.recording_sessions s
    WHERE s.seal_input @> jsonb_build_object('assetId', v_discovered_job.asset_id::text);

  -- Match seal lock order, then lock assets/jobs/attempts in the same order for
  -- every action. No advisory lock is assumed to bind older deletion writers.
  PERFORM pg_advisory_xact_lock(hashtextextended('recording-seal:' || v_discovered_session.id::text, 0));
  PERFORM 1 FROM public.projects p WHERE p.id = v_discovered_job.project_id FOR SHARE;
  IF NOT FOUND THEN v_allowed := false; END IF;
  PERFORM 1 FROM auth.users u WHERE u.id = v_discovered_job.created_by FOR KEY SHARE;
  IF NOT FOUND THEN v_allowed := false; END IF;
  SELECT pr.role, pr.status INTO v_role FROM public.project_roles pr
    WHERE pr.project_id = v_discovered_job.project_id AND pr.user_id = v_discovered_job.created_by FOR SHARE;
  IF NOT FOUND OR v_role.role IS DISTINCT FROM 'storyteller' OR v_role.status IS DISTINCT FROM 'active' THEN
    v_allowed := false;
  END IF;
  IF v_discovered_session.story_id IS NOT NULL THEN
    SELECT s.project_id, s.storyteller_id INTO v_story FROM public.stories s
      WHERE s.id = v_discovered_session.story_id FOR SHARE;
    IF NOT FOUND OR v_story.project_id IS DISTINCT FROM v_discovered_job.project_id
      OR v_story.storyteller_id IS DISTINCT FROM v_discovered_job.created_by THEN
      v_allowed := false;
    END IF;
  END IF;
  SELECT s.* INTO v_session FROM public.recording_sessions s WHERE s.id = v_discovered_session.id FOR SHARE;
  IF NOT FOUND OR v_session.seal_input IS DISTINCT FROM v_discovered_session.seal_input THEN
    RAISE EXCEPTION 'Recording seal changed during discovery' USING ERRCODE = '23505';
  END IF;
  PERFORM 1 FROM public.recording_chunks c WHERE c.session_id = v_session.id ORDER BY c.chunk_index FOR SHARE;
  SELECT a.* INTO v_asset FROM public.media_assets a WHERE a.id = v_discovered_job.asset_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recording asset unavailable' USING ERRCODE = '23505';
  END IF;
  SELECT j.* INTO v_job FROM public.processing_jobs j WHERE j.id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.project_id IS DISTINCT FROM v_discovered_job.project_id
    OR v_job.asset_id IS DISTINCT FROM v_discovered_job.asset_id OR v_job.created_by IS DISTINCT FROM v_discovered_job.created_by THEN
    RAISE EXCEPTION 'Recording job changed during discovery' USING ERRCODE = '23505';
  END IF;
  PERFORM 1 FROM public.processing_attempts a WHERE a.job_id = p_job_id ORDER BY a.attempt_no FOR UPDATE;
  -- Locks stabilize existing tombstones only. Absent rows are not an atomic
  -- deletion barrier; publication and older broad service writes remain outside.
  PERFORM 1 FROM public.deletion_requests d WHERE d.project_id = v_job.project_id
    AND d.subject_id = ANY(ARRAY[v_job.project_id::text, v_session.id::text, v_job.asset_id::text, v_session.story_id::text])
    ORDER BY d.id FOR SHARE;
  SELECT EXISTS (SELECT 1 FROM public.deletion_requests d WHERE d.project_id = v_job.project_id
    AND d.tombstone_at IS NOT NULL
    AND d.subject_id = ANY(ARRAY[v_job.project_id::text, v_session.id::text, v_job.asset_id::text, v_session.story_id::text])) INTO v_deleted;
  v_now := clock_timestamp();

  v_manifest := v_session.seal_input;
  IF jsonb_typeof(v_manifest) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid fixed recording manifest' USING ERRCODE = '23505';
  END IF;
  IF NOT (v_manifest ?& v_root_keys) OR v_manifest - v_root_keys <> '{}'::jsonb
    OR jsonb_typeof(v_manifest -> 'schemaVersion') IS DISTINCT FROM 'number'
    OR v_manifest ->> 'schemaVersion' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Invalid fixed recording schema' USING ERRCODE = '23505';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['projectId', 'sessionId', 'userId', 'assetId', 'storyId'] LOOP
    IF v_key = 'storyId' AND v_manifest -> v_key = 'null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(v_manifest -> v_key) IS DISTINCT FROM 'string' OR (v_manifest ->> v_key) !~ v_uuid_pattern THEN
      RAISE EXCEPTION 'Invalid fixed recording identity' USING ERRCODE = '23505';
    END IF;
  END LOOP;
  IF jsonb_typeof(v_manifest -> 'mimeType') IS DISTINCT FROM 'string'
    OR (v_manifest ->> 'mimeType') !~ '^audio/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$'
    OR jsonb_typeof(v_manifest -> 'chunks') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid fixed recording media' USING ERRCODE = '23505';
  END IF;
  v_count := jsonb_array_length(v_manifest -> 'chunks');
  IF v_count < 1 OR v_count > 2000 THEN
    RAISE EXCEPTION 'Invalid fixed recording chunk count' USING ERRCODE = '23505';
  END IF;
  FOR v_chunk IN SELECT value FROM jsonb_array_elements(v_manifest -> 'chunks') LOOP
    IF jsonb_typeof(v_chunk) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid fixed recording chunk' USING ERRCODE = '23505';
    END IF;
    IF NOT (v_chunk ?& v_chunk_keys) OR v_chunk - v_chunk_keys <> '{}'::jsonb
      OR jsonb_typeof(v_chunk -> 'index') IS DISTINCT FROM 'number' OR v_chunk ->> 'index' IS DISTINCT FROM v_index::text
      OR jsonb_typeof(v_chunk -> 'chunkId') IS DISTINCT FROM 'string' OR (v_chunk ->> 'chunkId') !~ '^[A-Za-z0-9_-]{1,128}$'
      OR (v_chunk ->> 'chunkId') = ANY(v_chunk_ids)
      OR jsonb_typeof(v_chunk -> 'bucket') IS DISTINCT FROM 'string' OR v_chunk ->> 'bucket' IS DISTINCT FROM 'audio-recordings'
      OR jsonb_typeof(v_chunk -> 'sha256') IS DISTINCT FROM 'string' OR (v_chunk ->> 'sha256') !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(v_chunk -> 'byteSize') IS DISTINCT FROM 'number' OR (v_chunk ->> 'byteSize') !~ '^[1-9][0-9]{0,8}$' THEN
      RAISE EXCEPTION 'Invalid fixed recording chunk fields' USING ERRCODE = '23505';
    END IF;
    v_total_bytes := v_total_bytes + (v_chunk ->> 'byteSize')::bigint;
    IF v_total_bytes > 104857600 THEN
      RAISE EXCEPTION 'Fixed recording input exceeds quota' USING ERRCODE = '23505';
    END IF;
    v_object_key := 'projects/' || v_job.project_id::text || '/sessions/' || v_session.id::text || '/' || v_index::text;
    IF jsonb_typeof(v_chunk -> 'objectKey') IS DISTINCT FROM 'string' OR v_chunk ->> 'objectKey' IS DISTINCT FROM v_object_key
      OR jsonb_typeof(v_chunk -> 'storageObjectKey') IS DISTINCT FROM 'string'
      OR v_chunk ->> 'storageObjectKey' IS DISTINCT FROM v_job.created_by::text || '/' || v_object_key THEN
      RAISE EXCEPTION 'Invalid fixed recording object location' USING ERRCODE = '23505';
    END IF;
    -- This closed schema contains no spaces in string values: removing jsonb's
    -- separator spaces reproduces the application's JSON.stringify tuples.
    v_canonical_chunks := v_canonical_chunks || CASE WHEN v_index > 0 THEN ',' ELSE '' END ||
      replace(jsonb_build_array(v_index, v_chunk ->> 'chunkId', v_chunk ->> 'bucket', v_object_key,
        (v_chunk ->> 'byteSize')::integer, v_chunk ->> 'sha256')::text, ' ', '');
    v_chunk_ids := array_append(v_chunk_ids, v_chunk ->> 'chunkId');
    v_index := v_index + 1;
  END LOOP;
  v_canonical_chunks := v_canonical_chunks || ']';
  v_identity_bytes := sha256(convert_to(replace(jsonb_build_array('saga-recording-asset-v1',
    v_job.project_id::text, v_session.id::text, v_job.created_by::text)::text, ' ', ''), 'UTF8'));
  v_identity_bytes := set_byte(v_identity_bytes, 6, (get_byte(v_identity_bytes, 6) & 15) | 128);
  v_identity_bytes := set_byte(v_identity_bytes, 8, (get_byte(v_identity_bytes, 8) & 63) | 128);
  v_asset_id := encode(substring(v_identity_bytes FROM 1 FOR 16), 'hex')::uuid;
  v_manifest_sha256 := encode(sha256(convert_to(v_manifest::text, 'UTF8')), 'hex');
  v_idempotency_key := 'processing-job-v1:' || replace(jsonb_build_array(v_job.project_id::text,
    v_asset_id::text, 1, 'recording_merge', 'ffmpeg-merge-v1', 'none', 'default')::text, ' ', '') ||
    ':mime=' || (v_manifest ->> 'mimeType') || ':session=' || v_session.id::text ||
    ':chunks=' || encode(sha256(convert_to(v_canonical_chunks, 'UTF8')), 'hex');
  IF v_manifest ->> 'projectId' IS DISTINCT FROM v_job.project_id::text
    OR v_manifest ->> 'sessionId' IS DISTINCT FROM v_session.id::text
    OR v_manifest ->> 'userId' IS DISTINCT FROM v_job.created_by::text
    OR v_manifest ->> 'assetId' IS DISTINCT FROM v_asset_id::text OR v_job.asset_id IS DISTINCT FROM v_asset_id
    OR v_manifest ->> 'storyId' IS DISTINCT FROM v_session.story_id::text
    OR v_session.project_id IS DISTINCT FROM v_job.project_id OR v_session.user_id IS DISTINCT FROM v_job.created_by
    OR v_session.mime_type IS DISTINCT FROM v_manifest ->> 'mimeType' OR v_session.state IS DISTINCT FROM 'sealing'
    OR v_session.total_chunks IS DISTINCT FROM v_count OR v_session.total_input_bytes IS DISTINCT FROM v_total_bytes
    OR v_session.manifest_sha256 IS DISTINCT FROM v_manifest_sha256
    OR v_session.confirmed_asset_id IS NOT NULL OR v_session.merge_job_id IS NOT NULL OR v_session.confirmed_at IS NOT NULL
    OR v_session.sealed_at IS NULL OR NOT isfinite(v_session.sealed_at) OR NOT isfinite(v_session.started_at)
    OR v_session.sealed_at < v_session.started_at OR v_session.sealed_at > v_now THEN
    RAISE EXCEPTION 'Recording seal identity conflict' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM public.recording_chunks c WHERE c.session_id = v_session.id) <> v_count OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_manifest -> 'chunks') expected(chunk)
    LEFT JOIN public.recording_chunks c ON c.session_id = v_session.id AND c.chunk_index = (expected.chunk ->> 'index')::integer
    WHERE c.id IS NULL OR c.project_id IS DISTINCT FROM v_job.project_id
      OR c.seal_chunk_id IS DISTINCT FROM expected.chunk ->> 'chunkId' OR c.bucket IS DISTINCT FROM expected.chunk ->> 'bucket'
      OR c.object_key IS DISTINCT FROM expected.chunk ->> 'storageObjectKey'
      OR c.byte_size IS DISTINCT FROM (expected.chunk ->> 'byteSize')::integer OR c.sha256 IS DISTINCT FROM expected.chunk ->> 'sha256'
      OR NOT isfinite(c.persisted_at) OR c.persisted_at > v_now
  ) THEN
    RAISE EXCEPTION 'Recording chunk ledger conflict' USING ERRCODE = '23505';
  END IF;
  IF v_asset.project_id IS DISTINCT FROM v_job.project_id OR v_asset.created_by IS DISTINCT FROM v_job.created_by
    OR v_asset.story_id IS DISTINCT FROM v_session.story_id OR v_asset.bucket IS DISTINCT FROM 'audio-recordings'
    OR v_asset.object_key IS DISTINCT FROM v_job.created_by::text || '/projects/' || v_job.project_id::text || '/assets/' || v_asset_id::text || '/original'
    OR v_asset.kind IS DISTINCT FROM 'original_audio' OR v_asset.mime_type IS DISTINCT FROM v_session.mime_type
    OR v_asset.byte_size IS DISTINCT FROM v_total_bytes OR v_asset.version IS DISTINCT FROM 1
    OR v_asset.idempotency_key IS DISTINCT FROM v_idempotency_key OR v_asset.original_filename IS DISTINCT FROM 'unnamed-asset'
    OR v_asset.parent_asset_id IS NOT NULL OR v_asset.sha256 IS NOT NULL OR v_asset.duration_ms IS NOT NULL
    OR v_asset.verified_at IS NOT NULL OR v_asset.content_verified_at IS NOT NULL OR v_asset.verification_error IS NOT NULL
    OR v_asset.state NOT IN ('verifying', 'deleting', 'deleted')
    OR NOT isfinite(v_asset.created_at) OR NOT isfinite(v_asset.updated_at)
    OR v_asset.updated_at < v_asset.created_at OR v_asset.updated_at > v_now THEN
    RAISE EXCEPTION 'Recording asset identity conflict' USING ERRCODE = '23505';
  END IF;
  IF v_job.input_version IS DISTINCT FROM 1 OR v_job.job_type IS DISTINCT FROM 'recording_merge'
    OR v_job.processor_version IS DISTINCT FROM 'ffmpeg-merge-v1' OR v_job.model_config_version IS DISTINCT FROM 'none'
    OR v_job.parameter_version IS DISTINCT FROM 'default' OR v_job.idempotency_key IS DISTINCT FROM v_idempotency_key
    OR v_job.max_attempts IS DISTINCT FROM 3 OR v_job.attempt_count > v_job.max_attempts OR v_job.result_ref IS NOT NULL
    OR NOT isfinite(v_job.created_at) OR NOT isfinite(v_job.updated_at)
    OR v_job.updated_at < v_job.created_at OR v_job.updated_at > v_now
    OR (v_job.not_before IS NOT NULL AND NOT isfinite(v_job.not_before))
    OR (v_job.cancel_requested_at IS NOT NULL AND (NOT isfinite(v_job.cancel_requested_at) OR v_job.cancel_requested_at > v_now)) THEN
    RAISE EXCEPTION 'Recording job identity conflict' USING ERRCODE = '23505';
  END IF;

  -- Only undispatched failed leases may precede this attempt. An unknown result
  -- cannot be retried by resetting just the job state through a broad old ACL.
  IF (SELECT count(*) FROM public.processing_attempts a WHERE a.job_id = p_job_id) <> v_job.attempt_count OR EXISTS (
    SELECT 1 FROM public.processing_attempts a WHERE a.job_id = p_job_id AND (
      a.attempt_no > v_job.attempt_count OR a.worker_id !~ '^[A-Za-z0-9_-]{1,128}$'
      OR a.provider IS NOT NULL OR a.provider_request_id IS NOT NULL OR a.usage_units IS NOT NULL
      OR a.reserved_cost_usd IS NOT NULL OR a.settled_cost_usd IS NOT NULL
      OR ((p_action = 'claim' OR a.attempt_no < v_job.attempt_count) AND (
        a.result_state IS DISTINCT FROM 'retryable_error' OR a.dispatched_at IS NOT NULL
        OR a.finished_at IS NULL OR NOT isfinite(a.finished_at) OR a.finished_at > v_now
        OR a.error_code IS DISTINCT FROM 'lease_expired_before_dispatch'))
    )
  ) THEN
    RAISE EXCEPTION 'Recording attempt history conflict' USING ERRCODE = '23505';
  END IF;
  -- Re-sample after input validation too; parsing a large seal consumes lease
  -- time. updated_at is not a TTL anchor because cancellation may update it.
  v_now := clock_timestamp();
  IF p_action = 'claim' THEN
    IF v_job.state NOT IN ('queued', 'retry_wait') OR v_job.lease_owner IS NOT NULL OR v_job.lease_expires_at IS NOT NULL
      OR v_job.attempt_count >= v_job.max_attempts OR v_job.not_before > v_now
      OR (v_job.state = 'queued' AND (v_job.attempt_count <> 0 OR v_job.error_code IS NOT NULL))
      OR (v_job.state = 'retry_wait' AND (v_job.attempt_count < 1 OR v_job.error_code IS DISTINCT FROM 'lease_expired_before_dispatch')) THEN
      RAISE EXCEPTION 'Recording job cannot be claimed' USING ERRCODE = '23505';
    END IF;
  ELSE
    IF v_job.state NOT IN ('leased', 'running') OR v_job.attempt_count < 1 OR v_job.lease_owner IS NULL
      OR v_job.lease_owner !~ '^[A-Za-z0-9_-]{1,128}$' OR v_job.lease_expires_at IS NULL OR NOT isfinite(v_job.lease_expires_at)
      OR v_job.lease_expires_at <= v_job.created_at OR v_job.lease_expires_at > v_now + interval '120 seconds'
      OR v_job.not_before IS NOT NULL OR v_job.error_code IS NOT NULL THEN
      RAISE EXCEPTION 'Recording job has no coherent active lease' USING ERRCODE = '23505';
    END IF;
    SELECT a.* INTO v_attempt FROM public.processing_attempts a WHERE a.job_id = p_job_id AND a.attempt_no = v_job.attempt_count;
    IF NOT FOUND OR v_attempt.worker_id IS DISTINCT FROM v_job.lease_owner OR v_attempt.result_state IS DISTINCT FROM v_job.state
      OR v_attempt.finished_at IS NOT NULL OR v_attempt.error_code IS NOT NULL
      OR (v_job.state = 'leased' AND v_attempt.dispatched_at IS NOT NULL)
      OR (v_job.state = 'running' AND (v_attempt.dispatched_at IS NULL OR NOT isfinite(v_attempt.dispatched_at)
        OR v_attempt.dispatched_at < v_job.created_at OR v_attempt.dispatched_at > v_job.updated_at
        OR v_attempt.dispatched_at >= v_job.lease_expires_at)) THEN
      RAISE EXCEPTION 'Recording active attempt conflict' USING ERRCODE = '23505';
    END IF;
    IF p_action <> 'recover' AND (v_job.lease_owner IS DISTINCT FROM p_worker_id OR v_job.attempt_count IS DISTINCT FROM p_attempt
      OR v_job.lease_expires_at <= v_now OR (p_action = 'start' AND v_job.state <> 'leased')
      OR (p_action = 'heartbeat' AND v_job.state <> 'running')) THEN
      RAISE EXCEPTION 'Recording lease fence rejected' USING ERRCODE = '23505';
    END IF;
  END IF;

  v_deleted := v_deleted OR v_asset.state IN ('deleting', 'deleted') OR v_job.cancel_requested_at IS NOT NULL;
  IF p_action <> 'recover' AND (NOT v_allowed OR v_deleted) THEN
    RAISE EXCEPTION 'Recording access revoked' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'claim' THEN
    UPDATE public.processing_jobs SET state = 'leased', attempt_count = attempt_count + 1,
      lease_owner = p_worker_id, lease_expires_at = v_now + p_lease_ms * interval '1 millisecond',
      not_before = NULL, error_code = NULL, updated_at = v_now WHERE id = p_job_id RETURNING * INTO v_job;
    INSERT INTO public.processing_attempts(job_id, attempt_no, worker_id, dispatched_at, result_state)
      VALUES (p_job_id, v_job.attempt_count, p_worker_id, NULL, 'leased');
  ELSIF p_action = 'start' THEN
    UPDATE public.processing_jobs SET state = 'running', updated_at = v_now WHERE id = p_job_id RETURNING * INTO v_job;
    UPDATE public.processing_attempts SET result_state = 'running', dispatched_at = v_now WHERE id = v_attempt.id;
  ELSIF p_action = 'heartbeat' THEN
    UPDATE public.processing_jobs SET lease_expires_at = v_now + p_lease_ms * interval '1 millisecond', updated_at = v_now
      WHERE id = p_job_id RETURNING * INTO v_job;
  ELSIF p_action = 'recover' THEN
    IF NOT v_allowed OR v_deleted THEN
      v_job.state := 'cancelled';
      v_job.error_code := 'recording_access_revoked';
      v_attempt_state := 'cancelled';
    ELSIF v_job.lease_expires_at > v_now THEN
      RAISE EXCEPTION 'Recording lease has not expired' USING ERRCODE = '23505';
    ELSIF v_job.state = 'running' THEN
      v_job.state := 'outcome_unknown';
      v_job.error_code := 'lease_expired_after_dispatch_unknown';
      v_attempt_state := 'outcome_unknown';
    ELSIF v_job.attempt_count >= v_job.max_attempts THEN
      v_job.state := 'failed';
      v_job.error_code := 'lease_expired_before_dispatch_max_attempts';
      v_attempt_state := 'fatal_error';
    ELSE
      v_job.state := 'retry_wait';
      v_job.error_code := 'lease_expired_before_dispatch';
      v_attempt_state := 'retryable_error';
    END IF;
    UPDATE public.processing_jobs SET state = v_job.state, error_code = v_job.error_code, lease_owner = NULL,
      lease_expires_at = NULL, not_before = CASE WHEN v_job.state = 'retry_wait' THEN v_now ELSE NULL END, updated_at = v_now
      WHERE id = p_job_id RETURNING * INTO v_job;
    UPDATE public.processing_attempts SET result_state = v_attempt_state, error_code = v_job.error_code, finished_at = v_now
      WHERE id = v_attempt.id;
  END IF;
  RETURN jsonb_build_object('schemaVersion', 1, 'jobId', v_job.id::text, 'projectId', v_job.project_id::text,
    'assetId', v_job.asset_id::text, 'sessionId', v_session.id::text, 'manifestSha256', v_manifest_sha256,
    'state', v_job.state, 'attempt', v_job.attempt_count, 'workerId', v_job.lease_owner,
    'leaseExpiresAt', v_job.lease_expires_at, 'serverNow', v_now, 'canClearLocalDrafts', false);
END;
$$;

REVOKE ALL ON FUNCTION public.recording_job_lease(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recording_job_lease(uuid, text, text, integer, integer) TO service_role;

-- Do not alter existing job/asset grants: registration and deletion still use
-- those server writes. Session/chunk writes stay restricted by the seal migration.
COMMIT;
