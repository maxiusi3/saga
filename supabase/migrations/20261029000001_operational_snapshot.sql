-- Local-only candidate until the normal deployment gates are satisfied.
-- P1 ledger observations, not proof of provider billing or platform readiness.
CREATE OR REPLACE FUNCTION public.read_operational_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $snapshot$
WITH observed AS (
  SELECT statement_timestamp() AS at
), job_facts AS (
  SELECT j.state, j.created_at, j.not_before, j.lease_owner, j.lease_expires_at,
    COALESCE(
      j.state IN ('queued', 'leased', 'running', 'retry_wait', 'succeeded',
        'failed', 'outcome_unknown', 'awaiting_review', 'cancelled')
      AND isfinite(j.created_at) AND j.created_at <= o.at
      AND isfinite(j.updated_at) AND j.updated_at BETWEEN j.created_at AND o.at
      AND (j.state NOT IN ('queued', 'retry_wait')
        OR j.not_before IS NULL OR isfinite(j.not_before))
      AND (j.state NOT IN ('leased', 'running')
        OR j.lease_expires_at IS NULL
        OR (isfinite(j.lease_expires_at) AND j.lease_expires_at >= j.created_at)),
      false
    ) AS valid,
    o.at
  FROM public.processing_jobs j CROSS JOIN observed o
), jobs AS (
  SELECT
    count(*) FILTER (WHERE valid AND (
      state = 'outcome_unknown'
      OR (state IN ('leased', 'running') AND (
        NULLIF(btrim(lease_owner), '') IS NULL
        OR lease_expires_at IS NULL OR lease_expires_at <= at
      ))
    )) AS stalled,
    COALESCE(max(CASE
      WHEN valid AND state IN ('queued', 'retry_wait')
        AND (not_before IS NULL OR not_before <= at)
      THEN floor(extract(epoch FROM at - greatest(created_at, not_before)))
    END), 0) AS backlog_age,
    count(*) FILTER (WHERE NOT valid) AS invalid
  FROM job_facts
), attempt_facts AS (
  SELECT j.project_id, a.result_state, a.reserved_cost_usd, a.settled_cost_usd,
    COALESCE(a.reserved_cost_usd >= 0
      AND a.reserved_cost_usd NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric), false) AS reserved_valid,
    COALESCE(a.settled_cost_usd >= 0
      AND a.settled_cost_usd NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric), false) AS settled_valid
  FROM public.processing_attempts a
  JOIN public.processing_jobs j ON j.id = a.job_id
), attempt_costs AS (
  SELECT project_id,
    CASE WHEN result_state IN ('running', 'outcome_unknown') THEN
      greatest(
        CASE WHEN reserved_valid THEN reserved_cost_usd ELSE 0 END,
        CASE WHEN settled_valid THEN settled_cost_usd ELSE 0 END
      )
    ELSE CASE WHEN settled_valid THEN settled_cost_usd ELSE 0 END END AS known_usd,
    CASE
      WHEN result_state IN ('running', 'outcome_unknown')
        THEN NOT reserved_valid OR (settled_cost_usd IS NOT NULL AND NOT settled_valid)
      WHEN result_state IN ('succeeded', 'retryable_error', 'fatal_error', 'cancelled')
        THEN NOT settled_valid
      ELSE true
    END AS unknown
  FROM attempt_facts
), project_costs AS (
  -- Round once per project, not once per attempt, and never add reserve to settlement.
  SELECT ceil(sum(known_usd) * 100) AS cents
  FROM attempt_costs GROUP BY project_id
), costs AS (
  SELECT COALESCE((SELECT max(cents) FROM project_costs), 0) AS max_cents,
    (SELECT count(*) FROM attempt_costs WHERE unknown) AS unknown_count
), deletion_facts AS (
  SELECT d.state, d.requested_at, o.at,
    COALESCE(d.state IN ('requested', 'processing', 'failed')
      AND isfinite(d.requested_at) AND d.requested_at <= o.at, false) AS valid
  FROM public.deletion_requests d CROSS JOIN observed o
  WHERE d.state IS DISTINCT FROM 'completed'
), deletions AS (
  SELECT count(*) FILTER (WHERE valid AND requested_at < at - interval '168 hours') AS overdue,
    count(*) FILTER (WHERE NOT valid) AS invalid
  FROM deletion_facts
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'observedAt', to_char(o.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'processing', jsonb_build_object(
    'stalledJobsCount', j.stalled,
    'maxRunnableBacklogAgeSeconds', j.backlog_age,
    'invalidJobCount', j.invalid
  ),
  'costs', jsonb_build_object(
    'maxProjectKnownExposureCents', c.max_cents,
    'unknownAttemptCostsCount', c.unknown_count
  ),
  'deletions', jsonb_build_object(
    'overdueRequestsCount', d.overdue,
    'invalidRequestCount', d.invalid
  )
)
FROM observed o CROSS JOIN jobs j CROSS JOIN costs c CROSS JOIN deletions d;
$snapshot$;

REVOKE ALL ON FUNCTION public.read_operational_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_operational_snapshot() TO service_role;

COMMENT ON FUNCTION public.read_operational_snapshot() IS
  'Read-only P1 operational ledger aggregate. No user data or identities. Invalid/unknown counts must suppress healthy conclusions for their metric group; zero rows only mean an empty ledger.';
