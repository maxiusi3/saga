import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'

const migrationPath = 'supabase/migrations/20261029000001_operational_snapshot.sql'
const foundationPath = 'supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql'
const tables = ['media_assets', 'deletion_requests', 'processing_jobs', 'processing_attempts']
const evidenceDir = join(root, 'docs/research/evidence/2026-10-29-operational-snapshot')
const mode = process.argv.includes('--without-migration') ? 'red-without-migration' : 'verify'
const output = join(evidenceDir, `pg-${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)
const report = {
  startedAt: new Date().toISOString(), status: 'running', mode,
  scope: 'Synthetic local PG17.4 operational SQL aggregates and real role ACLs; not production/PostgREST/provider/billing qualification',
  sources: {}, assertions: 0, actorConnections: [], scenarios: [],
}
const h = new Harness(report)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { if (!h.finishing && !h.signal) h.signal = signal })
}
const USER = '11111111-1111-4111-8111-111111111111'
const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_PROJECT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ASSET = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const SENTINEL = 'SYNTHETIC_PRIVATE_CONTENT_DO_NOT_RETURN'

async function setup() {
  const foundation = await readFile(join(root, foundationPath), 'utf8')
  report.sources[foundationPath] = digest(foundation)
  report.sources['experiments/pg17-routines/runtime.mjs'] = digest(await readFile(join(root, 'experiments/pg17-routines/runtime.mjs')))
  report.sources['experiments/pg17-operational-snapshot/verify.mjs'] = digest(await readFile(new URL(import.meta.url)))
  await h.db.query(`
    CREATE SCHEMA auth;
    CREATE ROLE anon LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE authenticated LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE service_role LOGIN NOSUPERUSER BYPASSRLS;
    CREATE ROLE metadata_reader LOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, metadata_reader;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.projects (id uuid PRIMARY KEY);
    CREATE TABLE public.stories (id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${USER}');
    INSERT INTO public.projects VALUES ('${PROJECT}'), ('${OTHER_PROJECT}');
  `)
  // Execute exact table DDL from the frozen P1 migration, not a parallel schema.
  report.fixture = { syntheticPrerequisites: ['auth.users(id)', 'public.projects(id)', 'public.stories(id)'], exactP1Tables: tables, excluded: 'Other P1 tables, indexes and project-member policies; no full migration-chain claim' }
  for (const table of tables) {
    const ddl = foundation.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?\n\\);`))?.[0]
    h.ok(ddl, `exact P1 ${table} DDL found`)
    await h.db.query(ddl)
    await h.db.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated; GRANT SELECT ON public.${table} TO service_role;`)
  }
  await h.db.query(`INSERT INTO public.media_assets (id, project_id, created_by, bucket, object_key, kind, mime_type, original_filename)
    VALUES ('${ASSET}', '${PROJECT}', '${USER}', 'saga', '${SENTINEL}/asset', 'original_audio', 'audio/webm', '${SENTINEL}')`)
}

async function actor(role, claim = role) {
  const client = await h.client(role)
  const identity = (await client.query('SELECT current_user, session_user, rolsuper, rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user')).rows[0]
  h.eq(identity, { current_user: role, session_user: role, rolsuper: false, rolbypassrls: role === 'service_role' }, 'real database caller identity')
  if (!report.actorConnections.some((item) => item.current_user === role)) report.actorConnections.push(identity)
  await client.query("SELECT pg_catalog.set_config('request.jwt.claim.role', $1, false)", [claim])
  return client
}

async function snapshot(client) {
  const result = await client.query('SELECT public.read_operational_snapshot() AS snapshot, floor(extract(epoch FROM statement_timestamp()) * 1000)::text AS statement_ms')
  const value = result.rows[0].snapshot
  h.eq(Object.keys(value).sort(), ['costs', 'deletions', 'observedAt', 'processing', 'schemaVersion'], 'exact root key allowlist')
  h.eq(Object.keys(value.processing).sort(), ['invalidJobCount', 'maxRunnableBacklogAgeSeconds', 'stalledJobsCount'], 'exact processing key allowlist')
  h.eq(Object.keys(value.costs).sort(), ['maxProjectKnownExposureCents', 'unknownAttemptCostsCount'], 'exact cost key allowlist')
  h.eq(Object.keys(value.deletions).sort(), ['invalidRequestCount', 'overdueRequestsCount'], 'exact deletion key allowlist')
  h.eq(value.schemaVersion, 1, 'schema version')
  h.eq(Date.parse(value.observedAt), Number(result.rows[0].statement_ms), 'observation time comes from this database statement')
  h.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.observedAt), 'UTC ISO timestamp independent of DateStyle')
  for (const group of [value.processing, value.costs, value.deletions]) {
    h.ok(Object.values(group).every((n) => Number.isSafeInteger(n) && n >= 0), 'nonnegative safe integer metrics')
  }
  const serialized = JSON.stringify(value)
  h.ok(![USER, PROJECT, OTHER_PROJECT, ASSET, SENTINEL].some((text) => serialized.includes(text)), 'no row identities, names, private text or object paths')
  return value
}

async function reset() {
  await h.db.query('TRUNCATE public.processing_attempts, public.processing_jobs, public.deletion_requests')
}

async function job(options = {}) {
  const id = randomUUID()
  const { state = 'queued', age = 0, delay = null, lease = null, owner = null, project = PROJECT } = options
  await h.db.query(`INSERT INTO public.processing_jobs
    (id, project_id, asset_id, job_type, processor_version, model_config_version, parameter_version, idempotency_key,
     state, created_by, created_at, updated_at, not_before, lease_expires_at, lease_owner, result_ref, error_code)
    VALUES ($1::uuid, $2, $3, 'transcribe', 'v1', 'v1', 'v1', ($1::uuid)::text, $4, $5,
      statement_timestamp() - $6::double precision * interval '1 second', statement_timestamp(),
      CASE WHEN $7::double precision IS NULL THEN NULL ELSE statement_timestamp() + $7::double precision * interval '1 second' END,
      CASE WHEN $8::double precision IS NULL THEN NULL ELSE statement_timestamp() + $8::double precision * interval '1 second' END, $9, $10, $10)`,
  [id, project, ASSET, state, USER, age, delay, lease, owner, SENTINEL])
  return id
}

async function attempt(jobId, state, reserved, settled) {
  await h.db.query(`INSERT INTO public.processing_attempts
    (job_id, attempt_no, worker_id, provider, provider_request_id, result_state, reserved_cost_usd, settled_cost_usd)
    SELECT $1, COALESCE(max(attempt_no), 0) + 1, $2, $2, $2, $3, $4, $5 FROM public.processing_attempts WHERE job_id = $1`,
  [jobId, SENTINEL, state, reserved, settled])
}

async function denied(client, sql, expected, label) {
  let sqlstate = '00000'
  try { await client.query(sql) } catch (error) { sqlstate = error.code }
  h.eq(sqlstate, expected, label)
}

try {
  await h.start()
  await setup()
  if (mode !== 'red-without-migration' && await exists(join(root, migrationPath))) {
    const migration = await readFile(join(root, migrationPath), 'utf8')
    report.sources[migrationPath] = digest(migration)
    await h.db.query(migration)
  }
  const service = await actor('service_role')
  await h.scenario('RPC exists and returns exact empty aggregate, not platform readiness', async () => {
    let sqlstate = '00000'
    try { await service.query('SELECT public.read_operational_snapshot()') } catch (error) { sqlstate = error.code }
    report.rpcProbeSqlstate = sqlstate
    h.eq(sqlstate, '00000', 'service RPC must exist and execute (42883 before implementation)')
    const value = await snapshot(service)
    h.eq(value.processing, { stalledJobsCount: 0, maxRunnableBacklogAgeSeconds: 0, invalidJobCount: 0 }, 'empty job aggregate')
    h.eq(value.costs, { maxProjectKnownExposureCents: 0, unknownAttemptCostsCount: 0 }, 'empty cost ledger')
    h.eq(value.deletions, { overdueRequestsCount: 0, invalidRequestCount: 0 }, 'empty deletion aggregate')
  })

  await h.scenario('Actual roles and forged service-role claim cannot bypass function ACL', async () => {
    for (const role of ['anon', 'authenticated', 'metadata_reader']) {
      for (const claim of [role, 'service_role']) {
        const client = await actor(role, claim)
        await denied(client, 'SELECT public.read_operational_snapshot()', '42501', `${role} execute denied even with ${claim} claim`)
        await h.close(client)
      }
    }
    await denied(service, "SELECT public.read_operational_snapshot('2000-01-01'::timestamptz)", '42883', 'RPC accepts no spoofable observation timestamp')
  })

  await h.scenario('Migration is idempotent and restores least-privilege grants', async () => {
    const migration = await readFile(join(root, migrationPath), 'utf8')
    await h.db.query('GRANT EXECUTE ON FUNCTION public.read_operational_snapshot() TO PUBLIC, anon, authenticated')
    await h.db.query(migration)
    await h.db.query(migration)
    const metadata = (await h.db.query(`SELECT l.lanname, p.provolatile, p.prosecdef, p.proconfig, p.pronargs
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid = p.prolang
      WHERE p.oid = 'public.read_operational_snapshot()'::regprocedure`)).rows[0]
    h.eq(metadata, { lanname: 'sql', provolatile: 's', prosecdef: false, proconfig: ['search_path=pg_catalog, public, pg_temp'], pronargs: 0 }, 'SQL stable invoker fixed trusted search path with temp last')
    for (const role of ['anon', 'authenticated', 'metadata_reader', 'service_role']) {
      const allowed = (await h.db.query("SELECT has_function_privilege($1, 'public.read_operational_snapshot()', 'EXECUTE') AS allowed", [role])).rows[0].allowed
      h.eq(allowed, role === 'service_role', `idempotent effective ACL ${role}`)
    }
    await denied(service, 'DELETE FROM public.processing_jobs', '42501', 'SQL invoker test role only has SELECT privileges')
  })

  await h.scenario('Queued and retry work age starts at later of creation and scheduled eligibility', async () => {
    await reset()
    await job({ age: 7200 })
    await job({ state: 'retry_wait', age: 200000, delay: -1800 })
    await job({ age: 900000, delay: 3600 })
    await job({ state: 'retry_wait', age: 900000, delay: 1 })
    await job({ state: 'awaiting_review', age: 900000 })
    await job({ state: 'failed', age: 900000 })
    const value = await snapshot(service)
    h.ok(value.processing.maxRunnableBacklogAgeSeconds >= 7200 && value.processing.maxRunnableBacklogAgeSeconds < 7205, 'future delays and human review excluded from backlog')
    h.eq(value.processing.stalledJobsCount, 0, 'queued/retry are backlog rather than stalled leases')
    h.eq(value.processing.invalidJobCount, 0, 'legitimate delayed work is valid')
    await reset()
    await job({ state: 'retry_wait', age: 7200, delay: -1800 })
    const delayed = await snapshot(service)
    h.ok(delayed.processing.maxRunnableBacklogAgeSeconds >= 1800 && delayed.processing.maxRunnableBacklogAgeSeconds < 1805, 'retry clock uses not_before, not original creation')
  })

  await h.scenario('Missing and expired leases and unknown outcomes stall; valid leases and review do not', async () => {
    await reset()
    await job({ state: 'leased', age: 60, lease: -10, owner: SENTINEL })
    await job({ state: 'running', age: 60 })
    await job({ state: 'running', age: 60, lease: 100, owner: '   ' })
    await job({ state: 'outcome_unknown', age: 60, lease: 100, owner: SENTINEL })
    await job({ state: 'running', age: 60, lease: 100, owner: SENTINEL })
    await job({ state: 'awaiting_review', age: 900000 })
    for (const state of ['succeeded', 'failed', 'cancelled']) await job({ state, age: 900000 })
    const value = await snapshot(service)
    h.eq(value.processing, { stalledJobsCount: 4, maxRunnableBacklogAgeSeconds: 0, invalidJobCount: 0 }, 'stalled eligibility is state and lease specific')
  })

  await h.scenario('Ledger lifetime per-project costs include failures without double-counting reservations', async () => {
    await reset()
    const alpha = await job({ state: 'succeeded', age: 900000 })
    const beta = await job({ state: 'cancelled', project: OTHER_PROJECT })
    await attempt(alpha, 'succeeded', '99', '1.25')
    await attempt(alpha, 'retryable_error', '99', '0.25')
    await attempt(alpha, 'fatal_error', '99', '0.50')
    await attempt(alpha, 'cancelled', '99', '0.125')
    await attempt(alpha, 'running', '1.2', '0.2')
    await attempt(alpha, 'outcome_unknown', '0.1', '0.4')
    await attempt(alpha, 'running', '0.5', null)
    await attempt(beta, 'succeeded', '99', '3.9')
    const value = await snapshot(service)
    h.eq(value.costs, { maxProjectKnownExposureCents: 423, unknownAttemptCostsCount: 0 }, 'alpha 4.225 dollars rounded once; max not global sum; reservations never added twice')
  })

  await h.scenario('Sub-cent costs round up once after aggregation within each project', async () => {
    await reset()
    const alpha = await job()
    const beta = await job({ project: OTHER_PROJECT })
    await attempt(alpha, 'succeeded', null, '0.004')
    await attempt(alpha, 'fatal_error', null, '0.004')
    await attempt(beta, 'cancelled', null, '0.000001')
    h.eq((await snapshot(service)).costs, { maxProjectKnownExposureCents: 1, unknownAttemptCostsCount: 0 }, '0.008 rounds to one cent not two; sub-cent spend not hidden')
  })

  await h.scenario('Missing, negative and NaN required costs are unknown, retaining only valid lower bounds', async () => {
    await reset()
    const id = await job()
    await attempt(id, 'succeeded', '50', null)
    await attempt(id, 'fatal_error', '50', '-1')
    await attempt(id, 'cancelled', '50', 'NaN')
    await attempt(id, 'running', null, '0.5')
    await attempt(id, 'running', '-1', '0.25')
    await attempt(id, 'outcome_unknown', 'NaN', '0.1')
    await attempt(id, 'running', '0.2', 'NaN')
    await attempt(id, 'running', '0.05', '-1')
    await attempt(id, 'running', '0.1', null)
    h.eq((await snapshot(service)).costs, { maxProjectKnownExposureCents: 120, unknownAttemptCostsCount: 8 }, 'invalid amounts never imply a complete zero-cost ledger')
  })

  await h.scenario('P1 precision rejects infinities; corrupted unconstrained ledger still fails closed', async () => {
    await reset()
    const id = await job()
    for (const value of ['Infinity', '-Infinity']) {
      await denied(h.db, `INSERT INTO public.processing_attempts (job_id, attempt_no, worker_id, reserved_cost_usd) VALUES ('${id}', 1, 'synthetic', '${value}')`, '22003', 'P1 numeric precision rejects infinity')
    }
    await attempt(id, 'running', '0.25', '0.2')
    await h.db.query('BEGIN')
    try {
      await h.db.query('ALTER TABLE public.processing_attempts ALTER COLUMN reserved_cost_usd TYPE numeric, ALTER COLUMN settled_cost_usd TYPE numeric')
      await h.db.query("UPDATE public.processing_attempts SET reserved_cost_usd = 'Infinity', settled_cost_usd = '0.2'")
      h.eq((await snapshot(h.db)).costs, { maxProjectKnownExposureCents: 20, unknownAttemptCostsCount: 1 }, 'positive infinity invalid, valid settled amount preserved')
      await h.db.query("UPDATE public.processing_attempts SET reserved_cost_usd = '0.25', settled_cost_usd = '-Infinity'")
      h.eq((await snapshot(h.db)).costs, { maxProjectKnownExposureCents: 25, unknownAttemptCostsCount: 1 }, 'negative infinity invalid, valid reservation preserved')
    } finally { await h.db.query('ROLLBACK') }
  })

  await h.scenario('Invalid job timestamps fail closed and legitimate future schedules remain valid', async () => {
    await reset()
    for (const timestamp of ['infinity', '-infinity']) {
      const id = await job({ age: 10 })
      await h.db.query('UPDATE public.processing_jobs SET created_at = $2 WHERE id = $1', [id, timestamp])
    }
    const future = await job({ age: -100 })
    const schedule = await job({ state: 'retry_wait' })
    await h.db.query("UPDATE public.processing_jobs SET not_before = 'infinity' WHERE id = $1", [schedule])
    const lease = await job({ state: 'running' })
    await h.db.query("UPDATE public.processing_jobs SET lease_expires_at = '-infinity' WHERE id = $1", [lease])
    const update = await job({ age: 10 })
    await h.db.query("UPDATE public.processing_jobs SET updated_at = statement_timestamp() + interval '1 day' WHERE id = $1", [update])
    const reversed = await job({ age: 10 })
    await h.db.query("UPDATE public.processing_jobs SET updated_at = created_at - interval '1 second' WHERE id = $1", [reversed])
    h.ok(Boolean(future), 'future creation fixture exists')
    await job({ age: 10, delay: 86400 })
    h.eq((await snapshot(service)).processing.invalidJobCount, 7, 'invalid time rows counted once without treating future eligibility as invalid')
  })

  await h.scenario('Deletion overdue window is strictly greater than seven days; completed ignored', async () => {
    await reset()
    // One command message gives every fixture and the RPC the exact same statement timestamp.
    const results = await h.db.query(`
      BEGIN;
      INSERT INTO public.deletion_requests (project_id, subject_id, requested_by, state, requested_at)
        SELECT '${PROJECT}', '${SENTINEL}', '${USER}', state, statement_timestamp() - age
        FROM (VALUES ('requested', interval '7 days'), ('processing', interval '7 days 1 second'),
          ('failed', interval '8 days'), ('requested', interval '6 days'), ('completed', interval '9 days')) AS fixture(state, age);
      SELECT public.read_operational_snapshot() AS snapshot;
      ROLLBACK;
    `)
    h.eq(results[2].rows[0].snapshot.deletions, { overdueRequestsCount: 2, invalidRequestCount: 0 }, 'exact seven day boundary not overdue; failed requests remain obligations')
  })

  await h.scenario('Invalid open deletion dates are explicit, completed dates do not affect the live metric', async () => {
    await reset()
    await h.db.query(`INSERT INTO public.deletion_requests (project_id, subject_id, requested_by, state, requested_at)
      VALUES ('${PROJECT}', '${SENTINEL}', '${USER}', 'requested', 'infinity'),
        ('${PROJECT}', '${SENTINEL}', '${USER}', 'failed', '-infinity'),
        ('${PROJECT}', '${SENTINEL}', '${USER}', 'processing', statement_timestamp() + interval '1 day'),
        ('${PROJECT}', '${SENTINEL}', '${USER}', 'completed', 'infinity')`)
    h.eq((await snapshot(service)).deletions, { overdueRequestsCount: 0, invalidRequestCount: 3 }, 'invalid requests cannot become healthy zero evidence')
  })

  await h.scenario('Seven-day deadline means 168 elapsed hours even when a database timezone crosses DST', async () => {
    await reset()
    for (const timezone of ['UTC', 'Europe/Berlin', 'America/New_York', 'Pacific/Auckland']) {
      const results = await h.db.query(`
        BEGIN;
        SET LOCAL TIME ZONE '${timezone}';
        INSERT INTO public.deletion_requests (project_id, subject_id, requested_by, state, requested_at)
          VALUES ('${PROJECT}', '${SENTINEL}', '${USER}', 'requested', statement_timestamp() - interval '168 hours'),
            ('${PROJECT}', '${SENTINEL}', '${USER}', 'failed', statement_timestamp() - interval '168 hours 1 second');
        SELECT public.read_operational_snapshot() AS snapshot;
        ROLLBACK;
      `)
      h.eq(results[3].rows[0].snapshot.deletions, { overdueRequestsCount: 1, invalidRequestCount: 0 }, `elapsed-time boundary independent of ${timezone} DST`)
    }
  })

  await h.scenario('Legacy constraint drift cannot turn invalid states or missing times into healthy metrics', async () => {
    await reset()
    const id = await job()
    await attempt(id, 'succeeded', null, '0.1')
    await h.db.query(`INSERT INTO public.deletion_requests (project_id, subject_id, requested_by) VALUES ('${PROJECT}', '${SENTINEL}', '${USER}')`)
    await h.db.query('BEGIN')
    try {
      await h.db.query(`
        ALTER TABLE public.processing_jobs DROP CONSTRAINT processing_jobs_state_check, ALTER COLUMN created_at DROP NOT NULL;
        ALTER TABLE public.processing_attempts DROP CONSTRAINT processing_attempts_result_state_check;
        ALTER TABLE public.deletion_requests DROP CONSTRAINT deletion_requests_state_check, ALTER COLUMN requested_at DROP NOT NULL;
        UPDATE public.processing_jobs SET state = 'invalid_state';
        UPDATE public.processing_attempts SET result_state = 'invalid_state';
        UPDATE public.deletion_requests SET state = 'invalid_state';
      `)
      const invalidState = await snapshot(h.db)
      h.eq(invalidState.processing.invalidJobCount, 1, 'unknown job state invalidates processing group')
      h.eq(invalidState.costs, { maxProjectKnownExposureCents: 10, unknownAttemptCostsCount: 1 }, 'unknown attempt state keeps only valid settlement lower bound')
      h.eq(invalidState.deletions.invalidRequestCount, 1, 'unknown deletion state invalidates deletion group')
      await h.db.query("UPDATE public.processing_jobs SET state = 'queued', created_at = NULL; UPDATE public.deletion_requests SET state = 'requested', requested_at = NULL")
      const missingTime = await snapshot(h.db)
      h.eq(missingTime.processing.invalidJobCount, 1, 'missing creation date explicitly invalid')
      h.eq(missingTime.deletions.invalidRequestCount, 1, 'missing requested date explicitly invalid')
    } finally { await h.db.query('ROLLBACK') }
  })

  await h.scenario('MVCC aggregates are read-only and share the caller statement snapshot', async () => {
    await reset()
    await service.query('BEGIN READ ONLY')
    await service.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    try {
      const before = await snapshot(service)
      await job({ state: 'outcome_unknown' })
      const after = await snapshot(service)
      h.eq(after.processing, before.processing, 'concurrent commit not visible inside repeatable read snapshot')
    } finally { await service.query('ROLLBACK') }
    h.eq((await snapshot(service)).processing.stalledJobsCount, 1, 'fresh statement sees committed change')
    const before = (await h.db.query('SELECT to_jsonb(j) AS row FROM public.processing_jobs j ORDER BY id')).rows
    await service.query("SET DateStyle = 'SQL, DMY'; SET TIME ZONE 'Pacific/Auckland'; CREATE TEMP TABLE processing_jobs (fake text); SET search_path = pg_temp")
    h.eq((await snapshot(service)).processing.stalledJobsCount, 1, 'fixed qualified source independent of hostile search path and temp table')
    const after = (await h.db.query('SELECT to_jsonb(j) AS row FROM public.processing_jobs j ORDER BY id')).rows
    h.eq(after, before, 'snapshot leaves job ledger byte-equivalent')
  })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failure = { code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'UNEXPECTED_FAILURE', label: error.label ?? 'local verification failed; raw error omitted' }
} finally {
  await h.cleanup()
  if (report.cleanup) {
    report.cleanup.socketRemoved = !h.scratch || !await exists(join(h.scratch, 'socket/.s.PGSQL.5432'))
    if (!Number.isInteger(report.runtime.serverPid)) report.cleanup.serverPidGone = true
    else {
      try { process.kill(report.runtime.serverPid, 0); report.cleanup.serverPidGone = false } catch (error) { report.cleanup.serverPidGone = error.code === 'ESRCH' }
    }
    if (!report.cleanup.socketRemoved || !report.cleanup.serverPidGone) report.status = 'failed'
  }
  report.completedAt = new Date().toISOString()
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ status: report.status, scenarios: report.scenarios.length, assertions: report.assertions, failure: report.failure, cleanup: report.cleanup, output }))
  process.exitCode = report.status === 'passed' ? 0 : 1
}
