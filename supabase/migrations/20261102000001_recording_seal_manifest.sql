-- G1-01 local candidate: pin declared input identity, not verified Storage bytes.
-- Legacy rows remain unadopted. Future Worker mutations need dedicated RPCs.
BEGIN;

ALTER TABLE public.recording_sessions ADD COLUMN IF NOT EXISTS seal_input jsonb;
ALTER TABLE public.recording_chunks ADD COLUMN IF NOT EXISTS seal_chunk_id text;

REVOKE ALL ON public.recording_sessions, public.recording_chunks FROM PUBLIC, anon, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.recording_sessions, public.recording_chunks FROM authenticated;
GRANT SELECT ON public.recording_sessions, public.recording_chunks TO service_role;

DROP POLICY IF EXISTS recording_sessions_service_read ON public.recording_sessions;
CREATE POLICY recording_sessions_service_read ON public.recording_sessions
  FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS recording_chunks_service_read ON public.recording_chunks;
CREATE POLICY recording_chunks_service_read ON public.recording_chunks
  FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.seal_recording_manifest(p_manifest jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_root_keys constant text[] := ARRAY['schemaVersion', 'projectId', 'sessionId', 'userId', 'storyId', 'assetId', 'mimeType', 'chunks'];
  v_chunk_keys constant text[] := ARRAY['index', 'chunkId', 'bucket', 'objectKey', 'storageObjectKey', 'byteSize', 'sha256'];
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_key text;
  v_project_id uuid;
  v_session_id uuid;
  v_user_id uuid;
  v_story_id uuid;
  v_asset_id uuid;
  v_chunk jsonb;
  v_index integer := 0;
  v_count integer;
  v_total_bytes bigint := 0;
  v_chunk_ids text[] := ARRAY[]::text[];
  v_object_key text;
  v_manifest_sha256 text;
  v_existing public.recording_sessions%ROWTYPE;
  v_now timestamptz := statement_timestamp();
BEGIN
  IF jsonb_typeof(p_manifest) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid recording manifest' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_manifest ?& v_root_keys) OR p_manifest - v_root_keys <> '{}'::jsonb
    OR jsonb_typeof(p_manifest -> 'schemaVersion') IS DISTINCT FROM 'number'
    OR p_manifest ->> 'schemaVersion' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Invalid recording manifest schema' USING ERRCODE = '22023';
  END IF;

  FOREACH v_key IN ARRAY ARRAY['projectId', 'sessionId', 'userId', 'assetId', 'storyId'] LOOP
    IF v_key = 'storyId' AND p_manifest -> v_key = 'null'::jsonb THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(p_manifest -> v_key) IS DISTINCT FROM 'string'
      OR (p_manifest ->> v_key) !~ v_uuid_pattern THEN
      RAISE EXCEPTION 'Invalid recording identity' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF jsonb_typeof(p_manifest -> 'mimeType') IS DISTINCT FROM 'string'
    OR (p_manifest ->> 'mimeType') !~ '^audio/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$'
    OR jsonb_typeof(p_manifest -> 'chunks') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid recording media input' USING ERRCODE = '22023';
  END IF;
  v_count := jsonb_array_length(p_manifest -> 'chunks');
  IF v_count < 1 OR v_count > 2000 THEN
    RAISE EXCEPTION 'Invalid recording chunk count' USING ERRCODE = '22023';
  END IF;

  v_project_id := (p_manifest ->> 'projectId')::uuid;
  v_session_id := (p_manifest ->> 'sessionId')::uuid;
  v_user_id := (p_manifest ->> 'userId')::uuid;
  v_story_id := (p_manifest ->> 'storyId')::uuid;
  v_asset_id := (p_manifest ->> 'assetId')::uuid;
  FOR v_chunk IN SELECT value FROM jsonb_array_elements(p_manifest -> 'chunks') LOOP
    IF jsonb_typeof(v_chunk) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid recording chunk' USING ERRCODE = '22023';
    END IF;
    IF NOT (v_chunk ?& v_chunk_keys) OR v_chunk - v_chunk_keys <> '{}'::jsonb
      OR jsonb_typeof(v_chunk -> 'index') IS DISTINCT FROM 'number'
      OR v_chunk ->> 'index' IS DISTINCT FROM v_index::text
      OR jsonb_typeof(v_chunk -> 'chunkId') IS DISTINCT FROM 'string'
      OR (v_chunk ->> 'chunkId') !~ '^[A-Za-z0-9_-]{1,128}$'
      OR (v_chunk ->> 'chunkId') = ANY(v_chunk_ids)
      OR jsonb_typeof(v_chunk -> 'bucket') IS DISTINCT FROM 'string'
      OR v_chunk ->> 'bucket' IS DISTINCT FROM 'audio-recordings'
      OR jsonb_typeof(v_chunk -> 'sha256') IS DISTINCT FROM 'string'
      OR (v_chunk ->> 'sha256') !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(v_chunk -> 'byteSize') IS DISTINCT FROM 'number'
      OR (v_chunk ->> 'byteSize') !~ '^[1-9][0-9]{0,8}$' THEN
      RAISE EXCEPTION 'Invalid recording chunk fields' USING ERRCODE = '22023';
    END IF;
    v_total_bytes := v_total_bytes + (v_chunk ->> 'byteSize')::bigint;
    IF v_total_bytes > 104857600 THEN
      RAISE EXCEPTION 'Recording manifest exceeds input quota' USING ERRCODE = '22023';
    END IF;
    v_object_key := 'projects/' || v_project_id::text || '/sessions/' || v_session_id::text || '/' || v_index::text;
    IF jsonb_typeof(v_chunk -> 'objectKey') IS DISTINCT FROM 'string'
      OR v_chunk ->> 'objectKey' IS DISTINCT FROM v_object_key
      OR jsonb_typeof(v_chunk -> 'storageObjectKey') IS DISTINCT FROM 'string'
      OR v_chunk ->> 'storageObjectKey' IS DISTINCT FROM v_user_id::text || '/' || v_object_key THEN
      RAISE EXCEPTION 'Invalid recording object location' USING ERRCODE = '22023';
    END IF;
    v_chunk_ids := array_append(v_chunk_ids, v_chunk ->> 'chunkId');
    v_index := v_index + 1;
  END LOOP;

  -- Serialize absent as well as existing session IDs, including cross-project reuse.
  PERFORM pg_advisory_xact_lock(hashtextextended('recording-seal:' || v_session_id::text, 0));
  PERFORM 1 FROM public.projects p WHERE p.id = v_project_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recording project unavailable' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM auth.users u WHERE u.id = v_user_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recording owner unavailable' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.project_roles pr
    WHERE pr.project_id = v_project_id AND pr.user_id = v_user_id
      AND pr.role = 'storyteller' AND pr.status = 'active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active storyteller required' USING ERRCODE = '42501';
  END IF;
  IF v_story_id IS NOT NULL THEN
    PERFORM 1 FROM public.stories s
      WHERE s.id = v_story_id AND s.project_id = v_project_id AND s.storyteller_id = v_user_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recording story ownership mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- These locks stabilize existing permission rows, not every deletion writer.
  -- Workers must reauthorize and check tombstones again before using real bytes.
  IF EXISTS (SELECT 1 FROM public.deletion_requests dr
    WHERE dr.project_id = v_project_id AND dr.tombstone_at IS NOT NULL
      AND dr.subject_id = ANY(ARRAY[v_session_id::text, v_story_id::text, v_asset_id::text])) THEN
    RAISE EXCEPTION 'Recording is being deleted' USING ERRCODE = '23505';
  END IF;

  v_manifest_sha256 := encode(sha256(convert_to(p_manifest::text, 'UTF8')), 'hex');
  SELECT rs.* INTO v_existing FROM public.recording_sessions rs WHERE rs.id = v_session_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.seal_input IS DISTINCT FROM p_manifest
      OR v_existing.project_id IS DISTINCT FROM v_project_id
      OR v_existing.user_id IS DISTINCT FROM v_user_id
      OR v_existing.story_id IS DISTINCT FROM v_story_id
      OR v_existing.mime_type IS DISTINCT FROM p_manifest ->> 'mimeType'
      OR v_existing.state IS DISTINCT FROM 'sealing'
      OR v_existing.total_chunks IS DISTINCT FROM v_count
      OR v_existing.total_input_bytes IS DISTINCT FROM v_total_bytes
      OR v_existing.manifest_sha256 IS DISTINCT FROM v_manifest_sha256
      OR v_existing.sealed_at IS NULL OR NOT isfinite(v_existing.sealed_at)
      OR v_existing.started_at IS NULL OR NOT isfinite(v_existing.started_at)
      OR v_existing.sealed_at < v_existing.started_at
      OR v_existing.sealed_at > clock_timestamp()
      OR v_existing.confirmed_asset_id IS NOT NULL OR v_existing.merge_job_id IS NOT NULL
      OR v_existing.confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Recording seal conflicts with existing session' USING ERRCODE = '23505';
    END IF;
    PERFORM 1 FROM public.recording_chunks rc WHERE rc.session_id = v_session_id FOR SHARE;
    IF (SELECT count(*) FROM public.recording_chunks rc WHERE rc.session_id = v_session_id) <> v_count
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_manifest -> 'chunks') AS expected(chunk)
        LEFT JOIN public.recording_chunks rc ON rc.session_id = v_session_id
          AND rc.chunk_index = (expected.chunk ->> 'index')::integer
        WHERE rc.id IS NULL OR rc.project_id IS DISTINCT FROM v_project_id
          OR rc.seal_chunk_id IS DISTINCT FROM expected.chunk ->> 'chunkId'
          OR rc.bucket IS DISTINCT FROM expected.chunk ->> 'bucket'
          OR rc.object_key IS DISTINCT FROM expected.chunk ->> 'storageObjectKey'
          OR rc.byte_size IS DISTINCT FROM (expected.chunk ->> 'byteSize')::integer
          OR rc.sha256 IS DISTINCT FROM expected.chunk ->> 'sha256'
      ) THEN
      RAISE EXCEPTION 'Recording seal conflicts with existing chunks' USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO public.recording_sessions(id, project_id, user_id, story_id, mime_type, state,
      total_chunks, total_input_bytes, manifest_sha256, started_at, sealed_at, seal_input)
    VALUES (v_session_id, v_project_id, v_user_id, v_story_id, p_manifest ->> 'mimeType', 'sealing',
      v_count, v_total_bytes, v_manifest_sha256, v_now, v_now, p_manifest);
    INSERT INTO public.recording_chunks(session_id, project_id, chunk_index, bucket, object_key, byte_size, sha256, seal_chunk_id)
    SELECT v_session_id, v_project_id, (chunk ->> 'index')::integer, chunk ->> 'bucket', chunk ->> 'storageObjectKey',
      (chunk ->> 'byteSize')::integer, chunk ->> 'sha256', chunk ->> 'chunkId'
    FROM jsonb_array_elements(p_manifest -> 'chunks') AS input(chunk);
  END IF;

  RETURN jsonb_build_object('schemaVersion', 1, 'sessionId', v_session_id::text, 'state', 'sealing',
    'manifestSha256', v_manifest_sha256, 'manifest', p_manifest, 'canClearLocalDrafts', false);
END;
$$;

REVOKE ALL ON FUNCTION public.seal_recording_manifest(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seal_recording_manifest(jsonb) TO service_role;

COMMIT;
