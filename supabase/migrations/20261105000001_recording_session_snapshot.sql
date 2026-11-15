-- Authorized point-in-time reconciliation. This routine grants no cleanup or
-- access capability and never replays seal, lease, candidate or terminal writes.
BEGIN;

CREATE FUNCTION public.read_recording_session_snapshot(
  p_actor_id uuid, p_project_id uuid, p_session_id uuid, p_manifest_sha256 text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'recording_status_unavailable' USING ERRCODE = '22023';
  END IF;
  IF p_actor_id IS NULL OR p_project_id IS NULL OR p_session_id IS NULL
    OR p_manifest_sha256 IS NULL OR p_manifest_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'recording_status_unavailable' USING ERRCODE = '42501';
  END IF;

  -- STABLE holds the calling statement's snapshot across every SELECT. No
  -- mutation helper is called and an explicit READ ONLY transaction is valid.
  WITH authorized AS MATERIALIZED (
    SELECT s AS session_row, a AS asset_row, s.seal_input ->> 'assetId' AS asset_id
    FROM public.recording_sessions s
    JOIN auth.users u ON u.id = p_actor_id
    JOIN public.projects p ON p.id = p_project_id
    JOIN public.project_roles pr ON pr.project_id = p.id AND pr.user_id = u.id
      AND pr.role = 'storyteller' AND pr.status = 'active'
    LEFT JOIN public.stories st ON st.id = s.story_id
    LEFT JOIN public.media_assets a ON a.id::text = s.seal_input ->> 'assetId'
    WHERE s.id = p_session_id AND s.project_id = p_project_id
      AND s.user_id = p_actor_id AND s.manifest_sha256 = p_manifest_sha256
      AND (s.story_id IS NULL OR (st.project_id = p_project_id AND st.storyteller_id = p_actor_id))
      AND (a.id IS NULL OR a.state NOT IN ('deleting', 'deleted'))
      AND NOT EXISTS (
        SELECT 1 FROM (VALUES (to_jsonb(u)), (to_jsonb(p)), (to_jsonb(pr)),
          (to_jsonb(st)), (to_jsonb(s)), (to_jsonb(a))) subject(body)
        WHERE jsonb_strip_nulls(subject.body) ?| ARRAY[
          'tombstone_at', 'deletion_requested_at', 'deleted_at', 'cancel_requested_at']
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.deletion_requests d
        WHERE d.project_id = p_project_id AND d.tombstone_at IS NOT NULL
          AND d.subject_id IN (p_project_id::text, p_session_id::text,
            s.seal_input ->> 'assetId', s.story_id::text)
      )
  ), jobs AS MATERIALIZED (
    SELECT j.* FROM public.processing_jobs j, authorized z
    WHERE j.asset_id::text = z.asset_id ORDER BY j.id LIMIT 2
  ), attempts AS MATERIALIZED (
    SELECT a.* FROM public.processing_attempts a
    WHERE a.job_id IN (SELECT j.id FROM jobs j)
    ORDER BY a.job_id, a.attempt_no, a.id LIMIT 4
  ), candidates AS MATERIALIZED (
    SELECT c.* FROM public.recording_output_candidates c, authorized z
    WHERE c.job_id IN (SELECT j.id FROM jobs j)
      OR c.asset_id::text = z.asset_id OR c.session_id = p_session_id
    ORDER BY c.id LIMIT 4
  ), chunks AS MATERIALIZED (
    SELECT c.* FROM public.recording_chunks c
    WHERE c.session_id = p_session_id ORDER BY c.chunk_index, c.id LIMIT 2001
  )
  SELECT jsonb_build_object(
    'schemaVersion', 1, 'actorId', p_actor_id, 'projectId', p_project_id,
    'sessionId', p_session_id, 'manifestSha256', p_manifest_sha256,
    'observedAt', statement_timestamp(),
    'matchingSessionCount', (SELECT count(*) FROM (
      SELECT 1 FROM public.recording_sessions s
      WHERE s.seal_input ->> 'assetId' = z.asset_id LIMIT 2
    ) matching),
    'session', to_jsonb(z.session_row), 'asset', to_jsonb(z.asset_row),
    'jobs', (SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY j.id), '[]'::jsonb) FROM jobs j),
    'attempts', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.job_id, a.attempt_no, a.id), '[]'::jsonb) FROM attempts a),
    'candidates', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id), '[]'::jsonb) FROM candidates c),
    'chunks', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.chunk_index, c.id), '[]'::jsonb) FROM chunks c)
  ) INTO v_snapshot FROM authorized z;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'recording_status_unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.read_recording_session_snapshot(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_recording_session_snapshot(uuid, uuid, uuid, text)
  TO service_role;

COMMIT;
