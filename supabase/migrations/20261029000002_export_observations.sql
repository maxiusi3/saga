-- Local-only candidate until the normal deployment gates are satisfied.
-- An event is server archive assembly, not delivery or final authorization.
CREATE TABLE IF NOT EXISTS public.archive_assembly_attempts (
  id uuid PRIMARY KEY,
  state text NOT NULL DEFAULT 'started',
  started_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  finished_at timestamptz,
  CONSTRAINT archive_assembly_attempts_state_check CHECK (
    state IN ('started', 'verified', 'integrity_failed', 'failed', 'cancelled', 'limit_exceeded')
  ),
  CONSTRAINT archive_assembly_attempts_time_check CHECK (
    isfinite(started_at)
    AND (
      (state = 'started' AND finished_at IS NULL)
      OR (state <> 'started' AND finished_at IS NOT NULL
        AND isfinite(finished_at) AND finished_at >= started_at)
    )
  )
);

CREATE TABLE IF NOT EXISTS public.archive_observation_coverage (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  coverage_started_at timestamptz NOT NULL DEFAULT statement_timestamp()
    CHECK (isfinite(coverage_started_at))
);

-- This first observation epoch must not advance when the migration is replayed.
INSERT INTO public.archive_observation_coverage (singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_archive_assembly_attempt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $guard$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'archive attempt deletion is forbidden';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.started_at IS DISTINCT FROM OLD.started_at
    OR OLD.state IS DISTINCT FROM 'started'
    OR NEW.state NOT IN ('verified', 'integrity_failed', 'failed', 'cancelled', 'limit_exceeded')
    OR NEW.state IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'archive attempt transition is forbidden';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_archive_assembly_attempt() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS archive_assembly_attempt_transition ON public.archive_assembly_attempts;
CREATE TRIGGER archive_assembly_attempt_transition
BEFORE UPDATE OR DELETE ON public.archive_assembly_attempts
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_assembly_attempt();

ALTER TABLE public.archive_assembly_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_observation_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_assembly_attempts, public.archive_observation_coverage
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.archive_assembly_attempts, public.archive_observation_coverage TO service_role;

DROP POLICY IF EXISTS archive_assembly_attempts_service_read ON public.archive_assembly_attempts;
CREATE POLICY archive_assembly_attempts_service_read ON public.archive_assembly_attempts
  FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS archive_observation_coverage_service_read ON public.archive_observation_coverage;
CREATE POLICY archive_observation_coverage_service_read ON public.archive_observation_coverage
  FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.begin_archive_assembly_attempt(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $begin_attempt$
DECLARE
  actual_state text;
BEGIN
  IF p_attempt_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'archive attempt ID is required';
  END IF;

  INSERT INTO public.archive_assembly_attempts (id)
  VALUES (p_attempt_id) ON CONFLICT (id) DO NOTHING;
  SELECT a.state INTO actual_state
  FROM public.archive_assembly_attempts a WHERE a.id = p_attempt_id;

  RETURN jsonb_build_object('schemaVersion', 1, 'attemptId', p_attempt_id, 'state', actual_state);
END;
$begin_attempt$;

CREATE OR REPLACE FUNCTION public.finish_archive_assembly_attempt(p_attempt_id uuid, p_outcome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $finish_attempt$
DECLARE
  actual_state text;
BEGIN
  IF p_attempt_id IS NULL OR p_outcome IS NULL
    OR p_outcome NOT IN ('verified', 'integrity_failed', 'failed', 'cancelled', 'limit_exceeded') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid archive attempt outcome';
  END IF;

  SELECT a.state INTO actual_state
  FROM public.archive_assembly_attempts a WHERE a.id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'archive attempt has not started';
  END IF;
  IF actual_state = p_outcome THEN
    RETURN jsonb_build_object('schemaVersion', 1, 'attemptId', p_attempt_id, 'state', actual_state);
  END IF;
  IF actual_state IS DISTINCT FROM 'started' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'archive attempt already has another outcome';
  END IF;

  UPDATE public.archive_assembly_attempts
  SET state = p_outcome, finished_at = statement_timestamp()
  WHERE id = p_attempt_id;
  RETURN jsonb_build_object('schemaVersion', 1, 'attemptId', p_attempt_id, 'state', p_outcome);
END;
$finish_attempt$;

REVOKE ALL ON FUNCTION public.begin_archive_assembly_attempt(uuid),
  public.finish_archive_assembly_attempt(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_archive_assembly_attempt(uuid),
  public.finish_archive_assembly_attempt(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.read_operational_snapshot_v2()
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
      a.state IN ('started', 'verified', 'integrity_failed', 'failed', 'cancelled', 'limit_exceeded')
      AND isfinite(a.started_at) AND a.started_at <= o.at
      AND (
        (a.state = 'started' AND a.finished_at IS NULL)
        OR (a.state <> 'started' AND isfinite(a.finished_at)
          AND a.finished_at BETWEEN a.started_at AND o.at)
      ), false
    ) AS valid
  FROM public.archive_assembly_attempts a CROSS JOIN observed o
), attempts AS (
  SELECT count(*) FILTER (WHERE valid AND state = 'integrity_failed'
      AND finished_at >= at - interval '60 minutes') AS integrity_failures,
    count(*) FILTER (WHERE valid AND state = 'started') AS unsettled,
    count(*) FILTER (WHERE NOT valid) AS invalid
  FROM attempt_facts
), coverage AS (
  SELECT (SELECT c.coverage_started_at FROM public.archive_observation_coverage c
    WHERE c.singleton) AS started_at
)
SELECT public.read_operational_snapshot() || jsonb_build_object(
  'schemaVersion', 2,
  'exports', jsonb_build_object(
    'scope', 'synchronous_archive_assembly',
    'windowMinutes', 60,
    'coverageStartedAt', CASE WHEN isfinite(c.started_at) AND c.started_at <= o.at
      THEN to_char(c.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') ELSE NULL END,
    'windowComplete', COALESCE(isfinite(c.started_at) AND c.started_at <= o.at - interval '60 minutes', false),
    'integrityFailuresCount', a.integrity_failures,
    'unsettledAttemptsCount', a.unsettled,
    'invalidAttemptsCount', a.invalid
  )
)
FROM observed o CROSS JOIN attempts a CROSS JOIN coverage c;
$snapshot$;

REVOKE ALL ON FUNCTION public.read_operational_snapshot_v2() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_operational_snapshot_v2() TO service_role;

COMMENT ON TABLE public.archive_assembly_attempts IS
  'Random server attempt IDs and DB times only. verified means media checks and archive compression finished; not authorization, HTTP delivery or browser validation. All started rows remain unsettled until a terminal outcome.';
COMMENT ON TABLE public.archive_observation_coverage IS
  'First local synchronous-assembly observation epoch, not historical/backfilled coverage. Reapplying the migration does not reset it.';
COMMENT ON FUNCTION public.read_operational_snapshot_v2() IS
  'Read-only v1 composition plus synchronous archive assembly observations. Missing/bad coverage is unavailable, fresh coverage is incomplete, invalid attempts suppress healthy conclusions; known failures remain a lower bound.';
