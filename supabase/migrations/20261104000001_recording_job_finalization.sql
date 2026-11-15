-- Atomic local recording publication/failure. No Storage writes or cleanup.
BEGIN;

ALTER TABLE public.media_assets DROP CONSTRAINT media_assets_bucket_check;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_bucket_check
  CHECK (bucket IN ('audio-recordings', 'saga', 'recording-candidates'));

CREATE FUNCTION public.finalize_recording_job(
  p_job_id uuid, p_action text, p_worker_id text, p_attempt integer,
  p_manifest_sha256 text, p_candidate_id uuid, p_output jsonb, p_failure_code text
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
SET lock_timeout = '3s'
AS $$
DECLARE
  v_lease jsonb;
  v_candidate public.recording_output_candidates%ROWTYPE;
  v_asset_id uuid;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_now timestamptz;
  v_expected_asset jsonb;
  v_expected_job jsonb;
  v_expected_attempt jsonb;
  v_expected_session jsonb;
BEGIN
  IF p_job_id IS NULL OR p_action IS NULL OR p_action NOT IN ('publish', 'fail')
    OR p_manifest_sha256 IS NULL OR p_manifest_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid recording finalization arguments' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'publish' THEN
    IF p_candidate_id IS NULL OR p_output IS NULL OR p_failure_code IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid recording publication arguments' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_candidate_id IS NOT NULL OR p_output IS NOT NULL OR p_failure_code IS NULL
      OR p_failure_code NOT IN ('recording_source_missing', 'recording_source_not_private_file',
        'recording_source_size_mismatch', 'recording_source_hash_mismatch',
        'recording_decode_invalid_pcm', 'recording_decode_duration_exceeded') THEN
      RAISE EXCEPTION 'Invalid recording permanent failure' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- A repeatable snapshot could miss a tombstone committed while this call
  -- waits. VOLATILE statements under READ COMMITTED take fresh snapshots.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Recording finalization requires read committed' USING ERRCODE = '22023';
  END IF;
  -- First lock, before even the lease validator's advisory lock. This conflicts
  -- with ordinary INSERT/UPDATE/DELETE, including previously absent tombstones.
  -- Held until the enclosing transaction ends; legacy reverse lock orders can
  -- safely abort with deadlock/timeout and must not be represented as success.
  LOCK TABLE public.deletion_requests IN SHARE MODE;

  v_lease := public.recording_job_lease(p_job_id, 'check', p_worker_id, p_attempt, NULL);
  IF v_lease ->> 'state' IS DISTINCT FROM 'running'
    OR v_lease ->> 'manifestSha256' IS DISTINCT FROM p_manifest_sha256 THEN
    RAISE EXCEPTION 'Recording finalization fence rejected' USING ERRCODE = '23505';
  END IF;
  v_asset_id := (v_lease ->> 'assetId')::uuid;
  v_session_id := (v_lease ->> 'sessionId')::uuid;
  v_expires_at := (v_lease ->> 'leaseExpiresAt')::timestamptz;

  IF p_action = 'publish' THEN
    -- Candidate lock follows the job lock. Check prepared before replay: the
    -- prepare RPC also accepts reserved candidates, which finalization must not.
    SELECT c.* INTO v_candidate FROM public.recording_output_candidates c
      WHERE c.id = p_candidate_id FOR UPDATE;
    IF NOT FOUND OR v_candidate.state IS DISTINCT FROM 'prepared' THEN
      RAISE EXCEPTION 'Recording candidate is not prepared' USING ERRCODE = '23505';
    END IF;
    -- Reuses the exact closed output/identity/time validation without mutation
    -- because the locked candidate is already prepared.
    PERFORM public.recording_output_candidate(p_job_id, 'prepare', p_worker_id,
      p_attempt, p_manifest_sha256, p_candidate_id, p_output);
  ELSE
    -- Reserve also takes this job lock: no cooperating reserver can insert a
    -- phantom after this check. Any earlier attempt's candidate is evidence too.
    IF EXISTS (SELECT 1 FROM public.recording_output_candidates c WHERE c.job_id = p_job_id) THEN
      RAISE EXCEPTION 'Recording failure has candidate evidence' USING ERRCODE = '23505';
    END IF;
  END IF;

  SELECT to_jsonb(a) INTO v_expected_asset FROM public.media_assets a WHERE a.id = v_asset_id;
  SELECT to_jsonb(j) INTO v_expected_job FROM public.processing_jobs j WHERE j.id = p_job_id;
  SELECT to_jsonb(a) INTO v_expected_attempt FROM public.processing_attempts a
    WHERE a.job_id = p_job_id AND a.attempt_no = p_attempt;
  SELECT to_jsonb(s) INTO v_expected_session FROM public.recording_sessions s WHERE s.id = v_session_id;
  v_now := clock_timestamp();
  IF v_expires_at <= v_now THEN
    RAISE EXCEPTION 'Recording finalization lease expired' USING ERRCODE = '23505';
  END IF;
  v_expected_asset := v_expected_asset || jsonb_build_object(
    'state', CASE WHEN p_action = 'publish' THEN 'ready' ELSE 'quarantined' END,
    'verification_error', p_failure_code, 'updated_at', v_now);
  IF p_action = 'publish' THEN
    v_expected_asset := v_expected_asset || jsonb_build_object('bucket', v_candidate.bucket,
      'object_key', v_candidate.object_key, 'byte_size', v_candidate.byte_size, 'sha256', v_candidate.sha256,
      'mime_type', v_candidate.mime_type, 'duration_ms', v_candidate.duration_ms,
      'verified_at', v_now, 'content_verified_at', v_now);
  END IF;
  v_expected_job := v_expected_job || jsonb_build_object(
    'state', CASE WHEN p_action = 'publish' THEN 'succeeded' ELSE 'failed' END,
    'result_ref', CASE WHEN p_action = 'publish' THEN v_asset_id::text ELSE NULL END,
    'lease_owner', NULL, 'lease_expires_at', NULL, 'not_before', NULL,
    'error_code', p_failure_code, 'updated_at', v_now);
  v_expected_attempt := v_expected_attempt || jsonb_build_object(
    'result_state', CASE WHEN p_action = 'publish' THEN 'succeeded' ELSE 'fatal_error' END,
    'finished_at', v_now, 'error_code', p_failure_code);
  v_expected_session := v_expected_session || jsonb_build_object(
    'state', CASE WHEN p_action = 'publish' THEN 'cloud_confirmed' ELSE 'failed' END,
    'confirmed_asset_id', CASE WHEN p_action = 'publish' THEN v_asset_id ELSE NULL END,
    'merge_job_id', CASE WHEN p_action = 'publish' THEN p_job_id ELSE NULL END,
    'confirmed_at', CASE WHEN p_action = 'publish' THEN v_now ELSE NULL END);

  IF p_action = 'publish' THEN
    UPDATE public.media_assets SET state = 'ready', bucket = v_candidate.bucket,
      object_key = v_candidate.object_key, byte_size = v_candidate.byte_size,
      sha256 = v_candidate.sha256, mime_type = v_candidate.mime_type, duration_ms = v_candidate.duration_ms,
      verified_at = v_now, content_verified_at = v_now, verification_error = NULL, updated_at = v_now
      WHERE id = v_asset_id;
  ELSE
    UPDATE public.media_assets SET state = 'quarantined', verification_error = p_failure_code,
      updated_at = v_now WHERE id = v_asset_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recording asset update failed' USING ERRCODE = '23505'; END IF;

  UPDATE public.processing_jobs SET state = CASE WHEN p_action = 'publish' THEN 'succeeded' ELSE 'failed' END,
    result_ref = CASE WHEN p_action = 'publish' THEN v_asset_id::text ELSE NULL END,
    lease_owner = NULL, lease_expires_at = NULL, not_before = NULL,
    error_code = p_failure_code, updated_at = v_now WHERE id = p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recording job update failed' USING ERRCODE = '23505'; END IF;

  UPDATE public.processing_attempts SET result_state = CASE WHEN p_action = 'publish' THEN 'succeeded' ELSE 'fatal_error' END,
    finished_at = v_now, error_code = p_failure_code WHERE job_id = p_job_id AND attempt_no = p_attempt;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recording attempt update failed' USING ERRCODE = '23505'; END IF;

  UPDATE public.recording_sessions SET state = CASE WHEN p_action = 'publish' THEN 'cloud_confirmed' ELSE 'failed' END,
    confirmed_asset_id = CASE WHEN p_action = 'publish' THEN v_asset_id ELSE NULL END,
    merge_job_id = CASE WHEN p_action = 'publish' THEN p_job_id ELSE NULL END,
    confirmed_at = CASE WHEN p_action = 'publish' THEN v_now ELSE NULL END WHERE id = v_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recording session update failed' USING ERRCODE = '23505'; END IF;

  -- PK/unique predicates plus FOUND prove exactly one affected row each.
  -- Re-read after all DML to catch suppressing/tampering triggers (including
  -- changes to earlier rows) before issuing a receipt for the intended tuple.
  IF (SELECT to_jsonb(a) FROM public.media_assets a WHERE a.id = v_asset_id) IS DISTINCT FROM v_expected_asset
    OR (SELECT to_jsonb(j) FROM public.processing_jobs j WHERE j.id = p_job_id) IS DISTINCT FROM v_expected_job
    OR (SELECT to_jsonb(a) FROM public.processing_attempts a WHERE a.job_id = p_job_id AND a.attempt_no = p_attempt) IS DISTINCT FROM v_expected_attempt
    OR (SELECT to_jsonb(s) FROM public.recording_sessions s WHERE s.id = v_session_id) IS DISTINCT FROM v_expected_session
    OR (p_action = 'publish' AND (SELECT to_jsonb(c) FROM public.recording_output_candidates c WHERE c.id = p_candidate_id)
      IS DISTINCT FROM to_jsonb(v_candidate)) THEN
    RAISE EXCEPTION 'Recording terminal tuple conflict' USING ERRCODE = '23505';
  END IF;

  -- Row upgrades, unique-index waits and triggers may consume the remaining
  -- lease during DML. Raising here rolls back all four terminal writes.
  IF v_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Recording finalization lease expired' USING ERRCODE = '23505';
  END IF;
  RETURN jsonb_build_object('schemaVersion', 1, 'jobId', p_job_id::text,
    'projectId', v_lease ->> 'projectId', 'assetId', v_asset_id::text, 'sessionId', v_session_id::text,
    'manifestSha256', p_manifest_sha256, 'workerId', p_worker_id, 'attempt', p_attempt,
    'state', CASE WHEN p_action = 'publish' THEN 'succeeded' ELSE 'failed' END,
    'assetState', CASE WHEN p_action = 'publish' THEN 'ready' ELSE 'quarantined' END,
    'sessionState', CASE WHEN p_action = 'publish' THEN 'cloud_confirmed' ELSE 'failed' END,
    'candidateId', v_candidate.id::text, 'bucket', v_candidate.bucket, 'objectKey', v_candidate.object_key,
    'byteSize', v_candidate.byte_size, 'sha256', v_candidate.sha256, 'mimeType', v_candidate.mime_type,
    'durationMs', v_candidate.duration_ms, 'errorCode', p_failure_code, 'finishedAt', v_now,
    'canClearLocalDrafts', false);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_recording_job(uuid, text, text, integer, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_recording_job(uuid, text, text, integer, text, uuid, jsonb, text)
  TO service_role;

COMMIT;
