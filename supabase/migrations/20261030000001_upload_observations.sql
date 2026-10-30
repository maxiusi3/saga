-- Local-only candidate until deployment gates are satisfied.
-- These are untrusted browser PUT reports, not Storage or asset-validity evidence.
CREATE TABLE IF NOT EXISTS public.browser_upload_attempts (
  id uuid PRIMARY KEY,
  binding_hash text NOT NULL,
  state text NOT NULL DEFAULT 'started',
  started_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  finished_at timestamptz,
  CONSTRAINT browser_upload_attempts_binding_check CHECK (
    length(binding_hash) = 64 AND binding_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT browser_upload_attempts_state_check CHECK (
    state IN ('started', 'client_succeeded', 'client_failed', 'client_conflict', 'client_cancelled')
  ),
  CONSTRAINT browser_upload_attempts_time_check CHECK (
    isfinite(started_at)
    AND (
      (state = 'started' AND finished_at IS NULL)
      OR (state <> 'started' AND finished_at IS NOT NULL
        AND isfinite(finished_at) AND finished_at >= started_at)
    )
  )
);

CREATE TABLE IF NOT EXISTS public.upload_observation_coverage (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  coverage_started_at timestamptz NOT NULL DEFAULT statement_timestamp()
    CHECK (isfinite(coverage_started_at))
);

-- Replaying the migration must retain the first observation epoch.
INSERT INTO public.upload_observation_coverage (singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_browser_upload_attempt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $guard$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'upload attempt deletion is forbidden';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.binding_hash IS DISTINCT FROM OLD.binding_hash
    OR NEW.started_at IS DISTINCT FROM OLD.started_at
    OR OLD.state IS DISTINCT FROM 'started'
    OR NEW.state NOT IN ('client_succeeded', 'client_failed', 'client_conflict', 'client_cancelled')
    OR NEW.state IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'upload attempt transition is forbidden';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_browser_upload_attempt() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS browser_upload_attempt_transition ON public.browser_upload_attempts;
CREATE TRIGGER browser_upload_attempt_transition
BEFORE UPDATE OR DELETE ON public.browser_upload_attempts
FOR EACH ROW EXECUTE FUNCTION public.guard_browser_upload_attempt();

ALTER TABLE public.browser_upload_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_observation_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.browser_upload_attempts, public.upload_observation_coverage
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.browser_upload_attempts, public.upload_observation_coverage TO service_role;

DROP POLICY IF EXISTS browser_upload_attempts_service_read ON public.browser_upload_attempts;
CREATE POLICY browser_upload_attempts_service_read ON public.browser_upload_attempts
  FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS upload_observation_coverage_service_read ON public.upload_observation_coverage;
CREATE POLICY upload_observation_coverage_service_read ON public.upload_observation_coverage
  FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.begin_browser_upload_attempt(p_attempt_id uuid, p_binding_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $begin_attempt$
DECLARE
  actual_state text;
  actual_binding text;
BEGIN
  IF p_attempt_id IS NULL OR p_binding_hash IS NULL
    OR length(p_binding_hash) <> 64 OR p_binding_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid upload attempt binding';
  END IF;

  INSERT INTO public.browser_upload_attempts (id, binding_hash)
  VALUES (p_attempt_id, p_binding_hash) ON CONFLICT (id) DO NOTHING;
  SELECT a.state, a.binding_hash INTO actual_state, actual_binding
  FROM public.browser_upload_attempts a WHERE a.id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR actual_binding IS DISTINCT FROM p_binding_hash THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'upload attempt binding mismatch';
  END IF;

  RETURN jsonb_build_object('schemaVersion', 1, 'attemptId', p_attempt_id, 'state', actual_state);
END;
$begin_attempt$;

CREATE OR REPLACE FUNCTION public.finish_browser_upload_attempt(p_attempt_id uuid, p_binding_hash text, p_outcome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $finish_attempt$
DECLARE
  actual_state text;
  actual_binding text;
BEGIN
  IF p_attempt_id IS NULL OR p_binding_hash IS NULL
    OR length(p_binding_hash) <> 64 OR p_binding_hash !~ '^[0-9a-f]{64}$'
    OR p_outcome IS NULL
    OR p_outcome NOT IN ('client_succeeded', 'client_failed', 'client_conflict', 'client_cancelled') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid upload attempt outcome';
  END IF;

  SELECT a.state, a.binding_hash INTO actual_state, actual_binding
  FROM public.browser_upload_attempts a WHERE a.id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR actual_binding IS DISTINCT FROM p_binding_hash THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'upload attempt binding mismatch';
  END IF;
  IF actual_state = p_outcome THEN
    RETURN jsonb_build_object('schemaVersion', 1, 'attemptId', p_attempt_id, 'state', actual_state);
  END IF;
  IF actual_state IS DISTINCT FROM 'started' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'upload attempt already has another outcome';
  END IF;

  UPDATE public.browser_upload_attempts
  SET state = p_outcome, finished_at = statement_timestamp()
  WHERE id = p_attempt_id;
  RETURN jsonb_build_object('schemaVersion', 1, 'attemptId', p_attempt_id, 'state', p_outcome);
END;
$finish_attempt$;

REVOKE ALL ON FUNCTION public.begin_browser_upload_attempt(uuid, text),
  public.finish_browser_upload_attempt(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_browser_upload_attempt(uuid, text),
  public.finish_browser_upload_attempt(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.read_operational_snapshot_v3()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $snapshot$
WITH observed AS (
  SELECT statement_timestamp() AS at
), attempt_facts AS (
  SELECT a.state, a.finished_at, o.at,
    COALESCE(
      length(a.binding_hash) = 64 AND a.binding_hash ~ '^[0-9a-f]{64}$'
      AND a.state IN ('started', 'client_succeeded', 'client_failed', 'client_conflict', 'client_cancelled')
      AND isfinite(a.started_at) AND a.started_at <= o.at
      AND (
        (a.state = 'started' AND a.finished_at IS NULL)
        OR (a.state <> 'started' AND isfinite(a.finished_at)
          AND a.finished_at BETWEEN a.started_at AND o.at)
      ), false
    ) AS valid
  FROM public.browser_upload_attempts a CROSS JOIN observed o
), attempts AS (
  SELECT count(*) FILTER (WHERE valid AND state IN ('client_succeeded', 'client_failed', 'client_conflict')
      AND finished_at >= at - interval '60 minutes') AS evaluated,
    count(*) FILTER (WHERE valid AND state = 'client_failed'
      AND finished_at >= at - interval '60 minutes') AS failures,
    count(*) FILTER (WHERE valid AND state = 'client_cancelled'
      AND finished_at >= at - interval '60 minutes') AS cancellations,
    count(*) FILTER (WHERE valid AND state = 'started') AS unsettled,
    count(*) FILTER (WHERE NOT valid) AS invalid
  FROM attempt_facts
), coverage AS (
  SELECT (SELECT c.coverage_started_at FROM public.upload_observation_coverage c
    WHERE c.singleton) AS started_at
)
SELECT public.read_operational_snapshot_v2() || jsonb_build_object(
  'schemaVersion', 3,
  'uploads', jsonb_build_object(
    'scope', 'project_hub_audio_put_reports',
    'windowMinutes', 60,
    -- The wire timestamp has no era suffix; do not misserialize a corrupt BC epoch.
    'coverageStartedAt', CASE WHEN isfinite(c.started_at)
      AND c.started_at >= timestamptz '0001-01-01 00:00:00+00' AND c.started_at <= o.at
      THEN to_char(c.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') ELSE NULL END,
    'windowComplete', COALESCE(isfinite(c.started_at)
      AND c.started_at >= timestamptz '0001-01-01 00:00:00+00'
      AND c.started_at <= o.at - interval '60 minutes', false),
    'evaluatedAttemptsCount', a.evaluated,
    'reportedFailuresCount', a.failures,
    'reportedCancellationsCount', a.cancellations,
    'unsettledAttemptsCount', a.unsettled,
    'invalidAttemptsCount', a.invalid
  )
)
FROM observed o CROSS JOIN attempts a CROSS JOIN coverage c;
$snapshot$;

REVOKE ALL ON FUNCTION public.read_operational_snapshot_v3() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_operational_snapshot_v3() TO service_role;

COMMENT ON TABLE public.browser_upload_attempts IS
  'Random attempt ID, server-computed credential binding hash, finite client-reported state and DB times only. Reports never establish Storage acceptance, asset validity or authorization. Started rows include pre-PUT crashes and remain unsettled.';
COMMENT ON TABLE public.upload_observation_coverage IS
  'First project-hub audio PUT reporting epoch; migration replay does not reset it. Ledger age alone does not prove actual PUT, all-client coverage or historical evidence.';
COMMENT ON FUNCTION public.read_operational_snapshot_v3() IS
  'Read-only v2 composition plus project-hub audio PUT client reports. Missing/bad epoch is unavailable, fresh coverage is incomplete, invalid rows suppress healthy conclusions. No identifiers, bindings, provider details or family content.';
