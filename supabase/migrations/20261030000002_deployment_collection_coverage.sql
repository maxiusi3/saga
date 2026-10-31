-- Local-only candidate until the normal deployment gates are satisfied.
-- Deployment collection coverage & collector build attribution ledger for export and upload observations.
-- Distinguishes database migration ledger age (windowComplete) from post-cutover build collection coverage.
CREATE TABLE IF NOT EXISTS public.deployment_collection_coverage (
  scope text PRIMARY KEY,
  release_hash text NOT NULL,
  cutover_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT deployment_collection_coverage_scope_check CHECK (
    scope IN ('synchronous_archive_assembly', 'project_hub_audio_put_reports')
  ),
  CONSTRAINT deployment_collection_coverage_release_hash_check CHECK (
    length(release_hash) = 64 AND release_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT deployment_collection_coverage_cutover_at_finite_check CHECK (
    isfinite(cutover_at)
    AND cutover_at >= timestamptz '0001-01-01 00:00:00+00'
  )
);

CREATE TABLE IF NOT EXISTS public.archive_attempt_builds (
  attempt_id uuid PRIMARY KEY REFERENCES public.archive_assembly_attempts(id),
  build_hash text NOT NULL,
  CONSTRAINT archive_attempt_builds_hash_check CHECK (
    length(build_hash) = 64 AND build_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE IF NOT EXISTS public.upload_attempt_builds (
  attempt_id uuid PRIMARY KEY REFERENCES public.browser_upload_attempts(id),
  build_hash text NOT NULL,
  CONSTRAINT upload_attempt_builds_hash_check CHECK (
    length(build_hash) = 64 AND build_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE OR REPLACE FUNCTION public.guard_deployment_collection_coverage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $guard_coverage$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'deployment_collection_coverage rows cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.scope IS DISTINCT FROM OLD.scope THEN
    RAISE EXCEPTION 'deployment_collection_coverage scope is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.release_hash IS NOT DISTINCT FROM OLD.release_hash THEN
    RAISE EXCEPTION 'same-release coverage epoch cannot be updated'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.cutover_at IS NULL
    OR NOT isfinite(NEW.cutover_at)
    OR NEW.cutover_at < timestamptz '0001-01-01 00:00:00+00'
    OR NEW.cutover_at < OLD.cutover_at THEN
    RAISE EXCEPTION 'deployment_collection_coverage cutover_at cannot move backwards'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$guard_coverage$;

DROP TRIGGER IF EXISTS deployment_collection_coverage_guard ON public.deployment_collection_coverage;
CREATE TRIGGER deployment_collection_coverage_guard
  BEFORE UPDATE OR DELETE ON public.deployment_collection_coverage
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_deployment_collection_coverage();

CREATE OR REPLACE FUNCTION public.guard_attempt_build_attribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $guard_build$
BEGIN
  RAISE EXCEPTION 'attempt build attribution rows are immutable'
    USING ERRCODE = '23514';
END;
$guard_build$;

DROP TRIGGER IF EXISTS archive_attempt_builds_immutable_guard ON public.archive_attempt_builds;
CREATE TRIGGER archive_attempt_builds_immutable_guard
  BEFORE UPDATE OR DELETE ON public.archive_attempt_builds
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_attempt_build_attribution();

DROP TRIGGER IF EXISTS upload_attempt_builds_immutable_guard ON public.upload_attempt_builds;
CREATE TRIGGER upload_attempt_builds_immutable_guard
  BEFORE UPDATE OR DELETE ON public.upload_attempt_builds
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_attempt_build_attribution();

ALTER TABLE public.deployment_collection_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_attempt_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_attempt_builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deployment_collection_coverage_service_select ON public.deployment_collection_coverage;
CREATE POLICY deployment_collection_coverage_service_select
  ON public.deployment_collection_coverage
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS archive_attempt_builds_service_select ON public.archive_attempt_builds;
CREATE POLICY archive_attempt_builds_service_select
  ON public.archive_attempt_builds
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS upload_attempt_builds_service_select ON public.upload_attempt_builds;
CREATE POLICY upload_attempt_builds_service_select
  ON public.upload_attempt_builds
  FOR SELECT
  TO service_role
  USING (true);

CREATE OR REPLACE FUNCTION public.seal_deployment_collection_coverage(
  p_scope text,
  p_release_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $seal$
DECLARE
  v_release_hash text;
  v_cutover_at timestamptz;
BEGIN
  IF p_scope IS NULL OR p_scope NOT IN ('synchronous_archive_assembly', 'project_hub_audio_put_reports') THEN
    RAISE EXCEPTION 'invalid deployment collection coverage scope'
      USING ERRCODE = '22023';
  END IF;

  IF p_release_hash IS NULL OR length(p_release_hash) <> 64 OR p_release_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'release_hash must be a lowercase SHA-256 hex digest'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.deployment_collection_coverage (scope, release_hash, cutover_at)
  VALUES (p_scope, p_release_hash, statement_timestamp())
  ON CONFLICT (scope) DO NOTHING;

  SELECT c.release_hash, c.cutover_at
  INTO v_release_hash, v_cutover_at
  FROM public.deployment_collection_coverage c
  WHERE c.scope = p_scope
  FOR UPDATE;

  IF v_release_hash IS DISTINCT FROM p_release_hash THEN
    UPDATE public.deployment_collection_coverage c
    SET release_hash = p_release_hash,
        cutover_at = statement_timestamp()
    WHERE c.scope = p_scope
    RETURNING c.release_hash, c.cutover_at
    INTO v_release_hash, v_cutover_at;
  END IF;

  RETURN jsonb_build_object(
    'schemaVersion', 1,
    'scope', p_scope,
    'releaseHash', v_release_hash,
    'cutoverAt', to_char(v_cutover_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
END;
$seal$;

CREATE OR REPLACE FUNCTION public.begin_archive_assembly_attempt_v2(
  p_attempt_id uuid,
  p_build_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $begin_export_v2$
DECLARE
  v_inserted_state text;
  v_state text;
  v_build_hash text;
BEGIN
  IF p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'attempt_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_build_hash IS NULL OR length(p_build_hash) <> 64 OR p_build_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'build_hash must be a lowercase SHA-256 hex digest'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.archive_assembly_attempts (id, state, started_at)
  VALUES (p_attempt_id, 'started', statement_timestamp())
  ON CONFLICT (id) DO NOTHING
  RETURNING state INTO v_inserted_state;

  IF FOUND THEN
    INSERT INTO public.archive_attempt_builds (attempt_id, build_hash)
    VALUES (p_attempt_id, p_build_hash);
    v_state := v_inserted_state;
  ELSE
    SELECT a.state
    INTO v_state
    FROM public.archive_assembly_attempts a
    WHERE a.id = p_attempt_id
    FOR UPDATE;

    SELECT b.build_hash
    INTO v_build_hash
    FROM public.archive_attempt_builds b
    WHERE b.attempt_id = p_attempt_id;

    IF NOT FOUND OR v_build_hash IS DISTINCT FROM p_build_hash THEN
      RAISE EXCEPTION 'archive assembly attempt build binding mismatch'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'schemaVersion', 1,
    'attemptId', p_attempt_id,
    'state', v_state
  );
END;
$begin_export_v2$;

CREATE OR REPLACE FUNCTION public.begin_browser_upload_attempt_v2(
  p_attempt_id uuid,
  p_binding_hash text,
  p_build_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $begin_upload_v2$
DECLARE
  v_inserted_state text;
  v_state text;
  v_binding_hash text;
  v_build_hash text;
BEGIN
  IF p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'attempt_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_binding_hash IS NULL OR length(p_binding_hash) <> 64 OR p_binding_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'binding_hash must be a lowercase SHA-256 hex digest'
      USING ERRCODE = '22023';
  END IF;

  IF p_build_hash IS NULL OR length(p_build_hash) <> 64 OR p_build_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'build_hash must be a lowercase SHA-256 hex digest'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.browser_upload_attempts (id, binding_hash, state, started_at)
  VALUES (p_attempt_id, p_binding_hash, 'started', statement_timestamp())
  ON CONFLICT (id) DO NOTHING
  RETURNING state INTO v_inserted_state;

  IF FOUND THEN
    INSERT INTO public.upload_attempt_builds (attempt_id, build_hash)
    VALUES (p_attempt_id, p_build_hash);
    v_state := v_inserted_state;
  ELSE
    SELECT a.state, a.binding_hash
    INTO v_state, v_binding_hash
    FROM public.browser_upload_attempts a
    WHERE a.id = p_attempt_id
    FOR UPDATE;

    IF v_binding_hash IS DISTINCT FROM p_binding_hash THEN
      RAISE EXCEPTION 'browser upload attempt binding mismatch'
        USING ERRCODE = '22023';
    END IF;

    SELECT b.build_hash
    INTO v_build_hash
    FROM public.upload_attempt_builds b
    WHERE b.attempt_id = p_attempt_id;

    IF NOT FOUND OR v_build_hash IS DISTINCT FROM p_build_hash THEN
      RAISE EXCEPTION 'browser upload attempt build binding mismatch'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'schemaVersion', 1,
    'attemptId', p_attempt_id,
    'state', v_state
  );
END;
$begin_upload_v2$;

CREATE OR REPLACE FUNCTION public.read_operational_snapshot_v4()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $snapshot_v4$
WITH observed AS (
  SELECT statement_timestamp() AS at,
    public.read_operational_snapshot_v3() AS v3
), coverage_rows AS (
  SELECT c.scope, c.release_hash, c.cutover_at,
    COALESCE(
      c.scope IN ('synchronous_archive_assembly', 'project_hub_audio_put_reports')
      AND c.release_hash IS NOT NULL
      AND length(c.release_hash) = 64
      AND c.release_hash ~ '^[0-9a-f]{64}$'
      AND c.cutover_at IS NOT NULL
      AND isfinite(c.cutover_at)
      AND c.cutover_at >= timestamptz '0001-01-01 00:00:00+00'
      AND c.cutover_at <= o.at,
      false
    ) AS valid,
    o.at
  FROM public.deployment_collection_coverage c
  CROSS JOIN observed o
), scope_coverage AS (
  SELECT s.scope,
    CASE
      WHEN count(c.*) FILTER (WHERE c.scope = s.scope) = 1
        AND count(c.*) FILTER (WHERE c.scope = s.scope AND c.valid) = 1
        AND count(c.*) FILTER (WHERE c.scope IS NULL OR c.scope NOT IN ('synchronous_archive_assembly', 'project_hub_audio_put_reports')) = 0
      THEN max(c.release_hash) FILTER (WHERE c.scope = s.scope AND c.valid)
    END AS release_hash,
    CASE
      WHEN count(c.*) FILTER (WHERE c.scope = s.scope) = 1
        AND count(c.*) FILTER (WHERE c.scope = s.scope AND c.valid) = 1
        AND count(c.*) FILTER (WHERE c.scope IS NULL OR c.scope NOT IN ('synchronous_archive_assembly', 'project_hub_audio_put_reports')) = 0
      THEN max(c.cutover_at) FILTER (WHERE c.scope = s.scope AND c.valid)
    END AS cutover_at,
    (
      count(c.*) FILTER (WHERE c.scope = s.scope AND NOT c.valid)
      + CASE WHEN count(c.*) FILTER (WHERE c.scope = s.scope AND c.valid) > 1
          THEN count(c.*) FILTER (WHERE c.scope = s.scope AND c.valid)
          ELSE 0
        END
      + count(c.*) FILTER (WHERE c.scope IS NULL OR c.scope NOT IN ('synchronous_archive_assembly', 'project_hub_audio_put_reports'))
    ) AS invalid_coverage_count
  FROM (VALUES ('synchronous_archive_assembly'), ('project_hub_audio_put_reports')) AS s(scope)
  LEFT JOIN coverage_rows c ON true
  GROUP BY s.scope
), export_build_invalid AS (
  SELECT count(*) FILTER (
    WHERE b.attempt_id IS NULL
      OR b.build_hash IS NULL
      OR length(b.build_hash) <> 64
      OR b.build_hash !~ '^[0-9a-f]{64}$'
      OR a.id IS NULL
  ) AS invalid_count
  FROM public.archive_attempt_builds b
  LEFT JOIN public.archive_assembly_attempts a ON a.id = b.attempt_id
), export_in_scope AS (
  SELECT a.id,
    b.attempt_id AS build_attempt_id,
    b.build_hash,
    COALESCE(b.build_hash IS NOT NULL AND length(b.build_hash) = 64 AND b.build_hash ~ '^[0-9a-f]{64}$', false) AS build_valid
  FROM public.archive_assembly_attempts a
  CROSS JOIN observed o
  LEFT JOIN public.archive_attempt_builds b ON b.attempt_id = a.id
  WHERE COALESCE(
    a.id IS NOT NULL
    AND a.state IN ('started', 'verified', 'integrity_failed', 'failed', 'cancelled', 'limit_exceeded')
    AND a.started_at IS NOT NULL
    AND isfinite(a.started_at)
    AND a.started_at <= o.at
    AND (
      (a.state = 'started' AND a.finished_at IS NULL)
      OR (
        a.state <> 'started'
        AND a.finished_at IS NOT NULL
        AND isfinite(a.finished_at)
        AND a.finished_at BETWEEN a.started_at AND o.at
      )
    ),
    false
  )
  AND (a.state = 'started' OR a.finished_at >= o.at - interval '60 minutes')
), export_summary AS (
  SELECT sc.release_hash,
    sc.cutover_at,
    COALESCE(sc.cutover_at IS NOT NULL AND o.at - sc.cutover_at >= interval '60 minutes', false) AS cutover_window_complete,
    count(e.id) FILTER (WHERE e.build_valid AND sc.release_hash IS NOT NULL AND e.build_hash = sc.release_hash) AS matching_count,
    count(e.id) FILTER (WHERE e.build_attempt_id IS NULL) AS unattributed_count,
    count(e.id) FILTER (WHERE e.build_valid AND (sc.release_hash IS NULL OR e.build_hash <> sc.release_hash)) AS stale_count,
    (ebi.invalid_count + sc.invalid_coverage_count) AS invalid_count
  FROM scope_coverage sc
  CROSS JOIN observed o
  CROSS JOIN export_build_invalid ebi
  LEFT JOIN export_in_scope e ON true
  WHERE sc.scope = 'synchronous_archive_assembly'
  GROUP BY sc.release_hash, sc.cutover_at, o.at, ebi.invalid_count, sc.invalid_coverage_count
), upload_build_invalid AS (
  SELECT count(*) FILTER (
    WHERE b.attempt_id IS NULL
      OR b.build_hash IS NULL
      OR length(b.build_hash) <> 64
      OR b.build_hash !~ '^[0-9a-f]{64}$'
      OR a.id IS NULL
  ) AS invalid_count
  FROM public.upload_attempt_builds b
  LEFT JOIN public.browser_upload_attempts a ON a.id = b.attempt_id
), upload_in_scope AS (
  SELECT a.id,
    b.attempt_id AS build_attempt_id,
    b.build_hash,
    COALESCE(b.build_hash IS NOT NULL AND length(b.build_hash) = 64 AND b.build_hash ~ '^[0-9a-f]{64}$', false) AS build_valid
  FROM public.browser_upload_attempts a
  CROSS JOIN observed o
  LEFT JOIN public.upload_attempt_builds b ON b.attempt_id = a.id
  WHERE COALESCE(
    a.id IS NOT NULL
    AND a.binding_hash IS NOT NULL
    AND length(a.binding_hash) = 64
    AND a.binding_hash ~ '^[0-9a-f]{64}$'
    AND a.state IN ('started', 'client_succeeded', 'client_failed', 'client_conflict', 'client_cancelled')
    AND a.started_at IS NOT NULL
    AND isfinite(a.started_at)
    AND a.started_at <= o.at
    AND (
      (a.state = 'started' AND a.finished_at IS NULL)
      OR (
        a.state <> 'started'
        AND a.finished_at IS NOT NULL
        AND isfinite(a.finished_at)
        AND a.finished_at BETWEEN a.started_at AND o.at
      )
    ),
    false
  )
  AND (a.state = 'started' OR a.finished_at >= o.at - interval '60 minutes')
), upload_summary AS (
  SELECT sc.release_hash,
    sc.cutover_at,
    COALESCE(sc.cutover_at IS NOT NULL AND o.at - sc.cutover_at >= interval '60 minutes', false) AS cutover_window_complete,
    count(u.id) FILTER (WHERE u.build_valid AND sc.release_hash IS NOT NULL AND u.build_hash = sc.release_hash) AS matching_count,
    count(u.id) FILTER (WHERE u.build_attempt_id IS NULL) AS unattributed_count,
    count(u.id) FILTER (WHERE u.build_valid AND (sc.release_hash IS NULL OR u.build_hash <> sc.release_hash)) AS stale_count,
    (ubi.invalid_count + sc.invalid_coverage_count) AS invalid_count
  FROM scope_coverage sc
  CROSS JOIN observed o
  CROSS JOIN upload_build_invalid ubi
  LEFT JOIN upload_in_scope u ON true
  WHERE sc.scope = 'project_hub_audio_put_reports'
  GROUP BY sc.release_hash, sc.cutover_at, o.at, ubi.invalid_count, sc.invalid_coverage_count
)
SELECT o.v3 || jsonb_build_object(
  'schemaVersion', 4,
  'collectionCoverage', jsonb_build_object(
    'exports', jsonb_build_object(
      'scope', 'synchronous_archive_assembly',
      'windowMinutes', 60,
      'releaseHash', es.release_hash,
      'cutoverAt', CASE
        WHEN es.cutover_at IS NOT NULL
        THEN to_char(es.cutover_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        ELSE NULL
      END,
      'cutoverWindowComplete', es.cutover_window_complete,
      'matchingBuildAttemptsCount', es.matching_count,
      'unattributedAttemptsCount', es.unattributed_count,
      'staleBuildAttemptsCount', es.stale_count,
      'invalidBuildAttemptsCount', es.invalid_count,
      'buildCoverageComplete', (
        COALESCE((o.v3 #>> '{exports,windowComplete}')::boolean, false)
        AND COALESCE((o.v3 #>> '{exports,unsettledAttemptsCount}')::bigint, 1) = 0
        AND COALESCE((o.v3 #>> '{exports,invalidAttemptsCount}')::bigint, 1) = 0
        AND es.cutover_window_complete
        AND es.unattributed_count = 0
        AND es.stale_count = 0
        AND es.invalid_count = 0
      )
    ),
    'uploads', jsonb_build_object(
      'scope', 'project_hub_audio_put_reports',
      'windowMinutes', 60,
      'releaseHash', us.release_hash,
      'cutoverAt', CASE
        WHEN us.cutover_at IS NOT NULL
        THEN to_char(us.cutover_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        ELSE NULL
      END,
      'cutoverWindowComplete', us.cutover_window_complete,
      'matchingBuildAttemptsCount', us.matching_count,
      'unattributedAttemptsCount', us.unattributed_count,
      'staleBuildAttemptsCount', us.stale_count,
      'invalidBuildAttemptsCount', us.invalid_count,
      'buildCoverageComplete', (
        COALESCE((o.v3 #>> '{uploads,windowComplete}')::boolean, false)
        AND COALESCE((o.v3 #>> '{uploads,unsettledAttemptsCount}')::bigint, 1) = 0
        AND COALESCE((o.v3 #>> '{uploads,invalidAttemptsCount}')::bigint, 1) = 0
        AND us.cutover_window_complete
        AND us.unattributed_count = 0
        AND us.stale_count = 0
        AND us.invalid_count = 0
      )
    )
  )
)
FROM observed o
CROSS JOIN export_summary es
CROSS JOIN upload_summary us;
$snapshot_v4$;

REVOKE ALL ON TABLE public.deployment_collection_coverage FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.archive_attempt_builds FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.upload_attempt_builds FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.deployment_collection_coverage TO service_role;
GRANT SELECT ON TABLE public.archive_attempt_builds TO service_role;
GRANT SELECT ON TABLE public.upload_attempt_builds TO service_role;

REVOKE ALL ON FUNCTION public.guard_deployment_collection_coverage() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_attempt_build_attribution() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.seal_deployment_collection_coverage(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_archive_assembly_attempt_v2(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_browser_upload_attempt_v2(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_operational_snapshot_v4() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.seal_deployment_collection_coverage(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_archive_assembly_attempt_v2(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_browser_upload_attempt_v2(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_operational_snapshot_v4() TO service_role;

COMMENT ON TABLE public.deployment_collection_coverage IS
  'Per-scope release cutover ledger for operational observations. Distinguishes database migration ledger age from post-cutover deployment collection coverage.';

COMMENT ON TABLE public.archive_attempt_builds IS
  'Immutable collector build hash attribution for synchronous archive assembly attempts.';

COMMENT ON TABLE public.upload_attempt_builds IS
  'Immutable collector build hash attribution for client-reported project hub audio upload attempts.';

COMMENT ON FUNCTION public.read_operational_snapshot_v4() IS
  'Read-only operational ledger aggregate with deployment collection coverage and build attribution metrics. Preserves v3 windowComplete as ledger age and separates cutoverWindowComplete/buildCoverageComplete.';
