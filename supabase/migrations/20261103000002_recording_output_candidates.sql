-- Private verified output candidates are evidence, never published assets.
BEGIN;

DO $$
DECLARE
  v_bucket storage.buckets%ROWTYPE;
BEGIN
  -- Managed Storage already owns/enables RLS. Refuse an unsafe installation
  -- instead of attempting ownership-level ALTERs on its tables.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = 'storage.buckets'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = 'storage.objects'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Recording candidate storage requires row security' USING ERRCODE = '22023';
  END IF;
  INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('recording-candidates', 'recording-candidates', false, 104857600, NULL)
    ON CONFLICT (id) DO NOTHING;
  SELECT b.* INTO v_bucket FROM storage.buckets b WHERE b.id = 'recording-candidates' FOR UPDATE;
  IF NOT FOUND OR v_bucket.name IS DISTINCT FROM 'recording-candidates'
    OR v_bucket.public IS DISTINCT FROM false OR v_bucket.file_size_limit IS DISTINCT FROM 104857600
    OR v_bucket.allowed_mime_types IS NOT NULL THEN
    RAISE EXCEPTION 'Incompatible recording candidate storage bucket' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE POLICY recording_candidates_private_objects ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'recording-candidates')
  WITH CHECK (bucket_id <> 'recording-candidates');
CREATE POLICY recording_candidates_private_bucket ON storage.buckets
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (id <> 'recording-candidates')
  WITH CHECK (id <> 'recording-candidates');

CREATE TABLE public.recording_output_candidates (
  id uuid PRIMARY KEY,
  -- Snapshot identities deliberately have no parent FKs: deletion must not
  -- erase or rewrite reserved/prepared evidence after an unknown outcome.
  job_id uuid NOT NULL,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  worker_id text NOT NULL CHECK (worker_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  project_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  session_id uuid NOT NULL,
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  bucket text NOT NULL CHECK (bucket = 'recording-candidates'),
  object_key text NOT NULL CHECK (object_key = 'jobs/' || job_id::text || '/attempts/' || attempt_no::text || '/' || id::text),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 104857600),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK (mime_type ~ '^audio/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$'),
  duration_ms integer NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 86400000),
  state text NOT NULL CHECK (state IN ('reserved', 'prepared')),
  created_at timestamptz NOT NULL CHECK (isfinite(created_at)),
  prepared_at timestamptz,
  CHECK ((state = 'reserved' AND prepared_at IS NULL)
    OR (state = 'prepared' AND prepared_at IS NOT NULL AND isfinite(prepared_at) AND prepared_at >= created_at)),
  UNIQUE (job_id, attempt_no),
  UNIQUE (bucket, object_key)
);
ALTER TABLE public.recording_output_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recording_output_candidates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.recording_output_candidates TO service_role;
CREATE POLICY recording_candidates_service_read ON public.recording_output_candidates
  FOR SELECT TO service_role USING (true);

CREATE FUNCTION public.recording_output_candidate(
  p_job_id uuid, p_action text, p_worker_id text, p_attempt integer,
  p_manifest_sha256 text, p_candidate_id uuid, p_output jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  v_output_keys constant text[] := ARRAY['byteSize', 'sha256', 'mimeType', 'durationMs'];
  v_lease jsonb;
  v_candidate public.recording_output_candidates%ROWTYPE;
  v_candidate_exists boolean;
  v_input_bytes bigint;
  v_input_mime text;
  v_bytes bigint;
  v_duration integer;
  v_object_key text;
  v_now timestamptz;
BEGIN
  IF p_job_id IS NULL OR p_action IS NULL OR p_action NOT IN ('reserve', 'prepare') OR p_candidate_id IS NULL
    OR p_manifest_sha256 IS NULL OR p_manifest_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid recording candidate arguments' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_output) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid recording candidate output' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_output ?& v_output_keys) OR p_output - v_output_keys <> '{}'::jsonb
    OR jsonb_typeof(p_output -> 'byteSize') IS DISTINCT FROM 'number' OR (p_output ->> 'byteSize') !~ '^[1-9][0-9]{0,8}$'
    OR jsonb_typeof(p_output -> 'durationMs') IS DISTINCT FROM 'number' OR (p_output ->> 'durationMs') !~ '^[1-9][0-9]{0,7}$'
    OR jsonb_typeof(p_output -> 'sha256') IS DISTINCT FROM 'string' OR (p_output ->> 'sha256') !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_output -> 'mimeType') IS DISTINCT FROM 'string'
    OR (p_output ->> 'mimeType') !~ '^audio/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$' THEN
    RAISE EXCEPTION 'Invalid recording candidate output fields' USING ERRCODE = '22023';
  END IF;
  v_bytes := (p_output ->> 'byteSize')::bigint;
  v_duration := (p_output ->> 'durationMs')::integer;
  IF v_bytes > 104857600 OR v_duration > 86400000 THEN
    RAISE EXCEPTION 'Recording candidate output exceeds limits' USING ERRCODE = '22023';
  END IF;

  -- This is the single lease validator. It locks the pinned input, access rows,
  -- job and attempts in their established order within this same transaction.
  v_lease := public.recording_job_lease(p_job_id, 'check', p_worker_id, p_attempt, NULL);
  IF v_lease ->> 'state' IS DISTINCT FROM 'running'
    OR v_lease ->> 'manifestSha256' IS DISTINCT FROM p_manifest_sha256 THEN
    RAISE EXCEPTION 'Recording candidate fence rejected' USING ERRCODE = '23505';
  END IF;
  SELECT s.total_input_bytes, s.mime_type INTO v_input_bytes, v_input_mime
    FROM public.recording_sessions s WHERE s.id = (v_lease ->> 'sessionId')::uuid;
  IF NOT FOUND OR v_input_bytes IS DISTINCT FROM v_bytes OR v_input_mime IS DISTINCT FROM p_output ->> 'mimeType' THEN
    RAISE EXCEPTION 'Recording candidate differs from sealed input' USING ERRCODE = '23505';
  END IF;
  v_object_key := 'jobs/' || p_job_id::text || '/attempts/' || p_attempt::text || '/' || p_candidate_id::text;

  -- The job is already locked by the lease RPC. Candidate locks always follow
  -- it; a waiter may outlive its lease, so never trust the earlier serverNow.
  SELECT c.* INTO v_candidate FROM public.recording_output_candidates c WHERE c.id = p_candidate_id FOR UPDATE;
  v_candidate_exists := FOUND;
  v_now := clock_timestamp();
  IF p_action = 'reserve' THEN
    IF v_candidate_exists OR EXISTS (SELECT 1 FROM public.recording_output_candidates c WHERE c.job_id = p_job_id AND c.attempt_no = p_attempt) THEN
      RAISE EXCEPTION 'Recording candidate already reserved' USING ERRCODE = '23505';
    END IF;
  ELSE
    IF NOT v_candidate_exists OR v_candidate.id IS DISTINCT FROM p_candidate_id
      OR v_candidate.job_id IS DISTINCT FROM p_job_id OR v_candidate.attempt_no IS DISTINCT FROM p_attempt
      OR v_candidate.worker_id IS DISTINCT FROM p_worker_id
      OR v_candidate.project_id::text IS DISTINCT FROM v_lease ->> 'projectId'
      OR v_candidate.asset_id::text IS DISTINCT FROM v_lease ->> 'assetId'
      OR v_candidate.session_id::text IS DISTINCT FROM v_lease ->> 'sessionId'
      OR v_candidate.manifest_sha256 IS DISTINCT FROM p_manifest_sha256
      OR v_candidate.bucket IS DISTINCT FROM 'recording-candidates' OR v_candidate.object_key IS DISTINCT FROM v_object_key
      OR v_candidate.byte_size IS DISTINCT FROM v_bytes OR v_candidate.sha256 IS DISTINCT FROM p_output ->> 'sha256'
      OR v_candidate.mime_type IS DISTINCT FROM p_output ->> 'mimeType' OR v_candidate.duration_ms IS DISTINCT FROM v_duration
      OR v_candidate.state NOT IN ('reserved', 'prepared') OR NOT isfinite(v_candidate.created_at) OR v_candidate.created_at > v_now
      OR (v_candidate.state = 'reserved' AND v_candidate.prepared_at IS NOT NULL)
      OR (v_candidate.state = 'prepared' AND (v_candidate.prepared_at IS NULL OR NOT isfinite(v_candidate.prepared_at)
        OR v_candidate.prepared_at < v_candidate.created_at OR v_candidate.prepared_at > v_now)) THEN
      RAISE EXCEPTION 'Recording candidate identity conflict' USING ERRCODE = '23505';
    END IF;
  END IF;
  -- Re-sample after metadata validation and immediately before mutation/replay.
  v_now := clock_timestamp();
  IF (v_lease ->> 'leaseExpiresAt')::timestamptz <= v_now THEN
    RAISE EXCEPTION 'Recording candidate lease expired' USING ERRCODE = '23505';
  END IF;
  IF p_action = 'reserve' THEN
    INSERT INTO public.recording_output_candidates(id, job_id, attempt_no, worker_id, project_id, asset_id, session_id,
      manifest_sha256, bucket, object_key, byte_size, sha256, mime_type, duration_ms, state, created_at, prepared_at)
    VALUES (p_candidate_id, p_job_id, p_attempt, p_worker_id, (v_lease ->> 'projectId')::uuid, (v_lease ->> 'assetId')::uuid,
      (v_lease ->> 'sessionId')::uuid, p_manifest_sha256, 'recording-candidates', v_object_key, v_bytes,
      p_output ->> 'sha256', p_output ->> 'mimeType', v_duration, 'reserved', v_now, NULL)
    RETURNING * INTO v_candidate;
  ELSIF v_candidate.state = 'reserved' THEN
    UPDATE public.recording_output_candidates SET state = 'prepared', prepared_at = v_now
      WHERE id = p_candidate_id RETURNING * INTO v_candidate;
  END IF;
  -- INSERT can wait on an uncommitted unique key that the earlier lookup could
  -- not see. Reject after DML too, rolling back any write completed past expiry.
  IF (v_lease ->> 'leaseExpiresAt')::timestamptz <= clock_timestamp() THEN
    RAISE EXCEPTION 'Recording candidate lease expired' USING ERRCODE = '23505';
  END IF;
  RETURN jsonb_build_object('schemaVersion', 1, 'candidateId', v_candidate.id::text, 'jobId', v_candidate.job_id::text,
    'projectId', v_candidate.project_id::text, 'assetId', v_candidate.asset_id::text, 'sessionId', v_candidate.session_id::text,
    'manifestSha256', v_candidate.manifest_sha256, 'workerId', v_candidate.worker_id, 'attempt', v_candidate.attempt_no,
    'state', v_candidate.state, 'bucket', v_candidate.bucket, 'objectKey', v_candidate.object_key,
    'byteSize', v_candidate.byte_size, 'sha256', v_candidate.sha256, 'mimeType', v_candidate.mime_type,
    'durationMs', v_candidate.duration_ms, 'createdAt', v_candidate.created_at, 'preparedAt', v_candidate.prepared_at,
    'canClearLocalDrafts', false);
END;
$$;
REVOKE ALL ON FUNCTION public.recording_output_candidate(uuid, text, text, integer, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recording_output_candidate(uuid, text, text, integer, text, uuid, jsonb) TO service_role;

-- No changes to historical lease/seal semantics or broad job/asset grants.
COMMIT;
