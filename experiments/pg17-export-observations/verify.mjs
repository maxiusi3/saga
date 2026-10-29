import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'

const migrationPath = 'supabase/migrations/20261029000002_export_observations.sql'
const oldMigrationPath = 'supabase/migrations/20261029000001_operational_snapshot.sql'
const foundationPath = 'supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql'
const evidenceDir = join(root, 'docs/research/evidence/2026-10-29-export-observations')
const mode = process.argv.includes('--without-migration') ? 'red-without-migration' : 'verify'
const output = join(evidenceDir, `pg-${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)
const report = {
  startedAt: new Date().toISOString(), status: 'running', mode,
  scope: 'Synthetic local PG17.4 export ledger/RPC/aggregate verification; not a full migration-chain, PostgREST, delivery or production qualification',
  sources: {}, assertions: 0, actorConnections: [], scenarios: [],
}
const h = new Harness(report)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { if (!h.finishing && !h.signal) h.signal = signal })
}
const USER = '11111111-1111-4111-8111-111111111111'
const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const JOB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const SENTINEL = 'SYNTHETIC_PRIVATE_CONTENT_DO_NOT_RETURN'
const terminals = ['verified', 'integrity_failed', 'failed', 'cancelled', 'limit_exceeded']
const ledger = 'public.archive_assembly_attempts'
const coverage = 'public.archive_observation_coverage'
let migration

async function source(path) {
  const content = await readFile(join(root, path), 'utf8')
  report.sources[path] = digest(content)
  return content
}

async function setup() {
  const foundation = await source(foundationPath)
  await source('experiments/pg17-routines/runtime.mjs')
  await source('experiments/pg17-export-observations/verify.mjs')
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
    INSERT INTO public.projects VALUES ('${PROJECT}');
  `)
  const tables = ['media_assets', 'deletion_requests', 'processing_jobs', 'processing_attempts']
  report.fixture = {
    syntheticPrerequisites: ['auth.users(id)', 'public.projects(id)', 'public.stories(id)'],
    exactP1Tables: tables,
    excluded: 'Other P1 DDL/indexes/policies/routines and later migrations; no full migration-chain claim',
  }
  for (const table of tables) {
    const ddl = foundation.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?\n\\);`))?.[0]
    h.ok(ddl, `exact frozen P1 ${table} DDL found`)
    await h.db.query(ddl)
    await h.db.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated, service_role;
      GRANT SELECT ON public.${table} TO service_role;`)
  }
  await h.db.query(await source(oldMigrationPath))
  await h.db.query(`
    INSERT INTO public.media_assets (id, project_id, created_by, bucket, object_key, kind, mime_type, original_filename)
      VALUES ('${ASSET}', '${PROJECT}', '${USER}', 'saga', '${SENTINEL}/asset', 'original_audio', 'audio/webm', '${SENTINEL}');
    INSERT INTO public.processing_jobs (id, project_id, asset_id, job_type, processor_version, model_config_version,
      parameter_version, idempotency_key, state, created_by, result_ref, error_code)
      VALUES ('${JOB}', '${PROJECT}', '${ASSET}', 'transcribe', 'v1', 'v1', 'v1', '${SENTINEL}', 'outcome_unknown', '${USER}', '${SENTINEL}', '${SENTINEL}');
    INSERT INTO public.processing_attempts (job_id, attempt_no, worker_id, provider, provider_request_id, reserved_cost_usd)
      VALUES ('${JOB}', 1, '${SENTINEL}', '${SENTINEL}', '${SENTINEL}', 0.25);
    INSERT INTO public.deletion_requests (project_id, subject_id, requested_by, requested_at, error_code)
      VALUES ('${PROJECT}', '${SENTINEL}', '${USER}', statement_timestamp() - interval '8 days', '${SENTINEL}');
  `)
}

async function actor(role, claim = role) {
  const client = await h.client(role)
  const identity = (await client.query('SELECT current_user, session_user, rolsuper, rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user')).rows[0]
  h.eq(identity, { current_user: role, session_user: role, rolsuper: false, rolbypassrls: role === 'service_role' }, 'actual login identity not a SET ROLE simulation')
  if (!report.actorConnections.some((item) => item.current_user === role)) report.actorConnections.push(identity)
  await client.query("SELECT set_config('request.jwt.claim.role', $1, false), set_config('request.jwt.claims', $2, false)", [claim, JSON.stringify({ role: claim, sub: USER })])
  return client
}

async function queryOutcome(client, sql, values = []) {
  try { return { code: '00000', result: await client.query(sql, values) } }
  catch (error) { return { code: error.code ?? 'QUERY_FAILED' } }
}

async function denied(client, sql, expected, label, values = []) {
  h.eq((await queryOutcome(client, sql, values)).code, expected, label)
}

async function begin(client, id) {
  return (await client.query('SELECT public.begin_archive_assembly_attempt($1::uuid) AS receipt', [id])).rows[0].receipt
}

async function finish(client, id, state) {
  return (await client.query('SELECT public.finish_archive_assembly_attempt($1::uuid, $2::text) AS receipt', [id, state])).rows[0].receipt
}

function receipt(actual, id, state) {
  h.eq(actual, { schemaVersion: 1, attemptId: id, state }, 'exact minimal write receipt; no private fields or time echo')
}

function exportsCounts(actual, failures, unsettled, invalid) {
  h.eq([actual.integrityFailuresCount, actual.unsettledAttemptsCount, actual.invalidAttemptsCount], [failures, unsettled, invalid], 'exact disjoint export counters')
}

async function snapshot(client, expectValidEpoch = true) {
  const row = (await client.query(`SELECT public.read_operational_snapshot_v2() AS snapshot,
    public.read_operational_snapshot() AS legacy,
    floor(extract(epoch FROM statement_timestamp()) * 1000)::text AS statement_ms`)).rows[0]
  const value = row.snapshot
  h.eq(Object.keys(value).sort(), ['costs', 'deletions', 'exports', 'observedAt', 'processing', 'schemaVersion'], 'v2 root key allowlist')
  const { exports: observed, ...old } = value
  h.eq({ ...old, schemaVersion: 1 }, row.legacy, 'old v1 shape/metrics preserved with same statement timestamp')
  h.eq(value.schemaVersion, 2, 'v2 schema version')
  h.eq(Date.parse(value.observedAt), Number(row.statement_ms), 'observedAt uses current database statement time')
  h.eq(Object.keys(observed).sort(), ['coverageStartedAt', 'integrityFailuresCount', 'invalidAttemptsCount', 'scope', 'unsettledAttemptsCount', 'windowComplete', 'windowMinutes'], 'export key allowlist')
  h.eq(observed.scope, 'synchronous_archive_assembly', 'not browser delivery/authorization claims')
  h.eq(observed.windowMinutes, 60, 'fixed elapsed 60 minute window')
  for (const key of ['integrityFailuresCount', 'unsettledAttemptsCount', 'invalidAttemptsCount']) {
    h.ok(Number.isSafeInteger(observed[key]) && observed[key] >= 0, 'safe nonnegative export metric')
  }
  if (expectValidEpoch) {
    h.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(observed.coverageStartedAt), 'epoch UTC ISO microseconds independent of timezone/DateStyle')
    const age = Date.parse(value.observedAt) - Date.parse(observed.coverageStartedAt)
    h.ok(age >= 0, 'coverage epoch not in future')
    h.eq(observed.windowComplete, age >= 3600000, 'coverage completeness derived from elapsed hour')
  } else {
    h.ok(observed.coverageStartedAt === null || !Number.isFinite(Date.parse(observed.coverageStartedAt)), 'bad or absent epoch cannot look valid to loader')
    h.eq(observed.windowComplete, false, 'bad epoch never marks complete')
  }
  h.ok(![USER, PROJECT, ASSET, JOB, SENTINEL].some((text) => JSON.stringify(value).includes(text)), 'no household/private data emitted from populated P1 fixtures')
  return value
}

async function reset() { await h.db.query(`TRUNCATE ${ledger}`) }

async function row(id) {
  return (await h.db.query(`SELECT to_jsonb(a) AS row FROM ${ledger} a WHERE id = $1`, [id])).rows[0]?.row
}

async function relaxConstraints() {
  const names = (await h.db.query("SELECT conname FROM pg_constraint WHERE conrelid = 'public.archive_assembly_attempts'::regclass AND contype = 'c'")).rows
  for (const { conname } of names) await h.db.query(`ALTER TABLE ${ledger} DROP CONSTRAINT "${conname}"`)
  await h.db.query(`ALTER TABLE ${ledger} DISABLE TRIGGER USER;
    ALTER TABLE ${ledger} ALTER COLUMN state DROP NOT NULL, ALTER COLUMN started_at DROP NOT NULL;`)
}

async function waitForLock(client) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const waiting = (await h.db.query("SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = $1", [client.processID])).rows[0]?.waiting
    if (waiting) { h.ok(true, 'concurrent real backend waits on row/unique constraint lock'); return }
    await delay(10)
  }
  h.ok(false, 'second real backend reached a database lock wait')
}

async function race(service, first, second) {
  const contender = await actor('service_role')
  await service.query('BEGIN')
  try {
    const winner = await first(service)
    const waiting = second(contender)
    await waitForLock(contender)
    await service.query('COMMIT')
    return [winner, await waiting]
  } finally {
    await service.query('ROLLBACK')
    await h.close(contender)
  }
}

try {
  await h.start()
  await setup()
  const oldDefinition = (await h.db.query("SELECT pg_get_functiondef('public.read_operational_snapshot()'::regprocedure) AS definition, proacl::text FROM pg_proc WHERE oid = 'public.read_operational_snapshot()'::regprocedure")).rows[0]
  if (mode !== 'red-without-migration' && await exists(join(root, migrationPath))) {
    migration = await source(migrationPath)
    await h.db.query(migration)
  }
  const service = await actor('service_role')
  await h.scenario('New v2 RPC exists; initial missing RPC is product RED', async () => {
    report.rpcProbeSqlstate = (await queryOutcome(service, 'SELECT public.read_operational_snapshot_v2()')).code
    h.eq(report.rpcProbeSqlstate, '00000', 'new v2 RPC must exist (42883 is expected missing-feature RED)')
    const value = await snapshot(service)
    exportsCounts(value.exports, 0, 0, 0)
    h.eq(value.exports.windowComplete, false, 'fresh installation is incomplete even with empty ledger')
    h.eq(value.processing, { stalledJobsCount: 1, maxRunnableBacklogAgeSeconds: 0, invalidJobCount: 0 }, 'populated v1 processing group preserved')
    h.eq(value.costs, { maxProjectKnownExposureCents: 25, unknownAttemptCostsCount: 0 }, 'populated v1 cost group preserved')
    h.eq(value.deletions, { overdueRequestsCount: 1, invalidRequestCount: 0 }, 'populated v1 deletion group preserved')
  })

  await h.scenario('Exact ledger columns and fixed function security; old v1 unchanged', async () => {
    const columns = (await h.db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'archive_assembly_attempts' ORDER BY ordinal_position")).rows.map((item) => item.column_name)
    h.eq(columns, ['id', 'state', 'started_at', 'finished_at'], 'ledger stores no family/user/path/error/ZIP data')
    for (const [signature, definer, language, volatility, args] of [
      ['begin_archive_assembly_attempt(uuid)', true, 'plpgsql', 'v', 1],
      ['finish_archive_assembly_attempt(uuid,text)', true, 'plpgsql', 'v', 2],
      ['read_operational_snapshot_v2()', false, 'sql', 's', 0],
    ]) {
      const metadata = (await h.db.query(`SELECT p.prosecdef, l.lanname, p.provolatile, p.proconfig, p.pronargs
        FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.oid = $1::regprocedure`, [`public.${signature}`])).rows[0]
      h.eq(metadata, { prosecdef: definer, lanname: language, provolatile: volatility, proconfig: ['search_path=pg_catalog, public, pg_temp'], pronargs: args }, 'fixed trusted search path and narrow function signature')
    }
    h.eq((await h.db.query("SELECT pg_get_functiondef('public.read_operational_snapshot()'::regprocedure) AS definition, proacl::text FROM pg_proc WHERE oid = 'public.read_operational_snapshot()'::regprocedure")).rows[0], oldDefinition, 'new migration leaves old definition and ACL byte-identical')
    h.eq((await h.db.query("SELECT relrowsecurity FROM pg_class WHERE oid IN ('public.archive_assembly_attempts'::regclass, 'public.archive_observation_coverage'::regclass)")).rows, [{ relrowsecurity: true }, { relrowsecurity: true }], 'RLS on both tables')
  })

  await h.scenario('Real clients including forged claims denied; service SELECT but no direct DML', async () => {
    for (const role of ['anon', 'authenticated', 'metadata_reader']) {
      for (const claim of [role, 'service_role']) {
        const client = await actor(role, claim)
        for (const sql of [
          'SELECT public.read_operational_snapshot_v2()',
          'SELECT public.read_operational_snapshot()',
          `SELECT public.begin_archive_assembly_attempt('${randomUUID()}')`,
          `SELECT public.finish_archive_assembly_attempt('${randomUUID()}', 'verified')`,
          `SELECT * FROM ${ledger}`, `SELECT * FROM ${coverage}`,
        ]) await denied(client, sql, '42501', `${role}/${claim} has no observation access`)
        await h.close(client)
      }
    }
    for (const table of [ledger, coverage]) {
      h.eq((await service.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, table === ledger ? 0 : 1, 'service read allowed')
      for (const sql of [`DELETE FROM ${table}`, `TRUNCATE ${table}`, `UPDATE ${table} SET ${table === ledger ? "state = 'failed'" : 'singleton = true'}`, `INSERT INTO ${table} DEFAULT VALUES`]) {
        await denied(service, sql, '42501', 'even BYPASSRLS service cannot directly mutate ledger/coverage')
      }
    }
  })

  await h.scenario('Database times, all outcomes, replay and parameter rejection', async () => {
    for (const terminal of terminals) {
      const id = randomUUID()
      const started = (await service.query('SELECT public.begin_archive_assembly_attempt($1) AS receipt, statement_timestamp()::text AS at', [id])).rows[0]
      receipt(started.receipt, id, 'started')
      const initial = await row(id)
      h.eq(Date.parse(initial.started_at), Date.parse(started.at), 'start is database statement time')
      receipt(await begin(service, id), id, 'started')
      h.eq(await row(id), initial, 'idempotent start preserves start time')
      const ended = (await service.query('SELECT public.finish_archive_assembly_attempt($1, $2) AS receipt, statement_timestamp()::text AS at', [id, terminal])).rows[0]
      receipt(ended.receipt, id, terminal)
      const finished = await row(id)
      h.eq(Date.parse(finished.finished_at), Date.parse(ended.at), 'finish is database statement time')
      receipt(await finish(service, id, terminal), id, terminal)
      receipt(await begin(service, id), id, terminal)
      h.eq(await row(id), finished, 'all terminal replay paths immutable and never reopen')
      for (const conflict of terminals.filter((state) => state !== terminal)) {
        await denied(service, 'SELECT public.finish_archive_assembly_attempt($1, $2)', '22023', 'conflicting terminal rejected', [id, conflict])
      }
    }
    for (const sql of [
      'SELECT public.begin_archive_assembly_attempt(NULL)',
      "SELECT public.finish_archive_assembly_attempt(NULL, 'verified')",
      `SELECT public.finish_archive_assembly_attempt('${randomUUID()}', NULL)`,
      `SELECT public.finish_archive_assembly_attempt('${randomUUID()}', 'started')`,
      `SELECT public.finish_archive_assembly_attempt('${randomUUID()}', '${SENTINEL}')`,
      `SELECT public.finish_archive_assembly_attempt('${randomUUID()}', 'verified')`,
    ]) await denied(service, sql, '22023', 'null/illegal/missing-start parameters fail closed')
    await denied(service, "SELECT public.begin_archive_assembly_attempt('not-uuid')", '22P02', 'malformed event ID rejected by UUID type')
    await denied(service, `SELECT public.finish_archive_assembly_attempt('${randomUUID()}', 'verified', statement_timestamp())`, '42883', 'no client time argument accepted')
    await denied(service, "SELECT public.read_operational_snapshot_v2('2000-01-01'::timestamptz)", '42883', 'aggregate cannot accept client observation time')
    exportsCounts((await snapshot(service)).exports, 1, 0, 0)
  })

  await h.scenario('Owner-level structure prevents delete, identity mutation and terminal rewrites', async () => {
    const id = randomUUID()
    await begin(service, id)
    for (const sql of [
      `DELETE FROM ${ledger} WHERE id = '${id}'`,
      `UPDATE ${ledger} SET id = '${randomUUID()}' WHERE id = '${id}'`,
      `UPDATE ${ledger} SET started_at = started_at - interval '1 second' WHERE id = '${id}'`,
      `UPDATE ${ledger} SET state = 'started' WHERE id = '${id}'`,
    ]) await denied(h.db, sql, '23514', 'structural guard rejects owner mutation of an existing start')
    await finish(service, id, 'verified')
    for (const sql of [`DELETE FROM ${ledger} WHERE id = '${id}'`, `UPDATE ${ledger} SET state = 'verified' WHERE id = '${id}'`, `UPDATE ${ledger} SET state = 'failed' WHERE id = '${id}'`, `UPDATE ${ledger} SET finished_at = statement_timestamp() WHERE id = '${id}'`]) {
      await denied(h.db, sql, '23514', 'terminal row cannot be rewritten even by owner DML')
    }
    for (const [state, start, end] of [
      ['started', 'statement_timestamp()', 'statement_timestamp()'],
      ['verified', 'statement_timestamp()', 'NULL'],
      ['unknown', 'statement_timestamp()', 'NULL'],
      ['started', "'infinity'::timestamptz", 'NULL'],
      ['started', "'-infinity'::timestamptz", 'NULL'],
      ['verified', 'statement_timestamp()', "'infinity'::timestamptz"],
      ['verified', 'statement_timestamp()', "statement_timestamp() - interval '1 second'"],
    ]) await denied(h.db, `INSERT INTO ${ledger} VALUES ('${randomUUID()}', '${state}', ${start}, ${end})`, '23514', 'state/time check constraints reject malformed rows')
  })

  await h.scenario('Real concurrent start and same/conflicting finish have one immutable terminal', async () => {
    const id = randomUUID()
    const beginSql = 'SELECT public.begin_archive_assembly_attempt($1) AS receipt'
    const finishSql = 'SELECT public.finish_archive_assembly_attempt($1, $2) AS receipt'
    const starts = await race(service, (client) => queryOutcome(client, beginSql, [id]), (client) => queryOutcome(client, beginSql, [id]))
    for (const result of starts) { h.eq(result.code, '00000', 'both concurrent begins succeed'); receipt(result.result.rows[0].receipt, id, 'started') }
    const finishes = await race(service, (client) => queryOutcome(client, finishSql, [id, 'verified']), (client) => queryOutcome(client, finishSql, [id, 'verified']))
    for (const result of finishes) { h.eq(result.code, '00000', 'same concurrent terminal is idempotent'); receipt(result.result.rows[0].receipt, id, 'verified') }
    const other = randomUUID()
    await begin(service, other)
    const conflicting = await race(service, (client) => queryOutcome(client, finishSql, [other, 'integrity_failed']), (client) => queryOutcome(client, finishSql, [other, 'failed']))
    h.eq(conflicting.map((result) => result.code), ['00000', '22023'], 'conflicting loser fails after actual row lock wait')
    h.eq((await row(other)).state, 'integrity_failed', 'only winning outcome persisted')
    h.eq((await h.db.query(`SELECT count(*)::int AS n FROM ${ledger} WHERE id IN ($1, $2)`, [id, other])).rows[0].n, 2, 'one row per attempt after races')
  })

  await h.scenario('Repeat migration keeps original coverage epoch and restores least privileges', async () => {
    const before = (await h.db.query(`SELECT to_jsonb(c) AS row FROM ${coverage} c`)).rows
    await h.db.query(`GRANT ALL ON ${ledger}, ${coverage} TO PUBLIC, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION public.begin_archive_assembly_attempt(uuid), public.finish_archive_assembly_attempt(uuid,text), public.read_operational_snapshot_v2() TO PUBLIC, anon, authenticated;`)
    await h.db.query(migration)
    await h.db.query(migration)
    h.eq((await h.db.query(`SELECT to_jsonb(c) AS row FROM ${coverage} c`)).rows, before, 'reapplying migration never resets coverage epoch')
    for (const role of ['anon', 'authenticated', 'metadata_reader', 'service_role']) {
      for (const signature of ['begin_archive_assembly_attempt(uuid)', 'finish_archive_assembly_attempt(uuid,text)', 'read_operational_snapshot_v2()']) {
        h.eq((await h.db.query('SELECT has_function_privilege($1, $2, \'EXECUTE\') AS allowed', [role, `public.${signature}`])).rows[0].allowed, role === 'service_role', 'migration repairs effective execute ACL')
      }
      for (const table of [ledger, coverage]) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) {
          h.eq((await h.db.query('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, table, privilege])).rows[0].allowed, role === 'service_role' && privilege === 'SELECT', 'migration repairs exact SELECT-only ACL')
        }
      }
    }
  })

  await h.scenario('Finished-time inclusive boundary, stale pending and all non-integrity outcomes', async () => {
    await reset()
    const results = await h.db.query(`BEGIN;
      UPDATE ${coverage} SET coverage_started_at = statement_timestamp() - interval '60 minutes';
      INSERT INTO ${ledger} (id, state, started_at, finished_at)
        SELECT gen_random_uuid(), state, statement_timestamp() - interval '1 day', CASE WHEN age IS NULL THEN NULL ELSE statement_timestamp() - age END
        FROM (VALUES ('integrity_failed', interval '60 minutes'), ('integrity_failed', interval '60 minutes 0.000001 seconds'),
          ('integrity_failed', interval '0 seconds'), ('verified', interval '1 second'), ('failed', interval '1 second'),
          ('cancelled', interval '1 second'), ('limit_exceeded', interval '1 second'), ('started', NULL::interval)) AS fixture(state, age);
      SELECT public.read_operational_snapshot_v2() AS snapshot;
      ROLLBACK;`)
    const value = results[3].rows[0].snapshot
    exportsCounts(value.exports, 2, 1, 0)
    h.eq(value.exports.windowComplete, true, 'coverage at exact 60 minutes is complete')
    h.eq(Date.parse(value.observedAt) - Date.parse(value.exports.coverageStartedAt), 3600000, 'exact shared statement-time boundary')
    for (const [age, complete] of [["interval '60 minutes' - interval '1 microsecond'", false], ["interval '60 minutes 1 second'", true]]) {
      const rows = await h.db.query(`BEGIN; UPDATE ${coverage} SET coverage_started_at = statement_timestamp() - (${age}); SELECT public.read_operational_snapshot_v2() AS snapshot; ROLLBACK;`)
      h.eq(rows[2].rows[0].snapshot.exports.windowComplete, complete, 'coverage exact microsecond boundary, not rounded minutes')
    }
  })

  await h.scenario('Corrupted observations counted globally and excluded from normal counters', async () => {
    await reset()
    await h.db.query('BEGIN')
    try {
      await relaxConstraints()
      const states = [
        ['unknown', "statement_timestamp() - interval '2 days'", 'NULL'],
        [null, 'statement_timestamp()', 'NULL'],
        ['started', 'NULL', 'NULL'],
        ['started', "'infinity'::timestamptz", 'NULL'],
        ['started', "'-infinity'::timestamptz", 'NULL'],
        ['started', "statement_timestamp() + interval '1 second'", 'NULL'],
        ['started', 'statement_timestamp()', 'statement_timestamp()'],
        ['integrity_failed', 'statement_timestamp()', 'NULL'],
        ['integrity_failed', 'NULL', 'statement_timestamp()'],
        ['integrity_failed', 'statement_timestamp()', "'infinity'::timestamptz"],
        ['integrity_failed', 'statement_timestamp()', "'-infinity'::timestamptz"],
        ['integrity_failed', 'statement_timestamp()', "statement_timestamp() + interval '1 second'"],
        ['integrity_failed', 'statement_timestamp()', "statement_timestamp() - interval '2 days'"],
      ]
      for (const [state, start, end] of states) {
        await h.db.query(`INSERT INTO ${ledger} VALUES ($1, $2, ${start}, ${end})`, [randomUUID(), state])
      }
      await h.db.query(`INSERT INTO ${ledger} VALUES ('${randomUUID()}', 'started', statement_timestamp() - interval '10 days', NULL),
        ('${randomUUID()}', 'integrity_failed', statement_timestamp() - interval '1 day', statement_timestamp())`)
      exportsCounts((await snapshot(h.db)).exports, 1, 1, states.length)
    } finally { await h.db.query('ROLLBACK') }
  })

  await h.scenario('Missing, nonfinite, future and null coverage fail closed', async () => {
    await h.db.query('BEGIN')
    try {
      await h.db.query(`DELETE FROM ${coverage}`)
      await snapshot(h.db, false)
    } finally { await h.db.query('ROLLBACK') }
    await h.db.query('BEGIN')
    try {
      const checks = (await h.db.query("SELECT conname FROM pg_constraint WHERE conrelid = 'public.archive_observation_coverage'::regclass AND contype = 'c'")).rows
      for (const { conname } of checks) await h.db.query(`ALTER TABLE ${coverage} DROP CONSTRAINT "${conname}"`)
      await h.db.query(`ALTER TABLE ${coverage} ALTER COLUMN coverage_started_at DROP NOT NULL`)
      for (const value of ["'infinity'::timestamptz", "'-infinity'::timestamptz", "statement_timestamp() + interval '1 day'", 'NULL']) {
        await h.db.query(`UPDATE ${coverage} SET coverage_started_at = ${value}`)
        await snapshot(h.db, false)
      }
    } finally { await h.db.query('ROLLBACK') }
  })

  await h.scenario('Timezone, DST and hostile search path cannot change elapsed-hour scope', async () => {
    await reset()
    for (const timezone of ['UTC', 'Europe/Berlin', 'America/New_York', 'Pacific/Auckland']) {
      const results = await h.db.query(`BEGIN; SET LOCAL TIME ZONE '${timezone}'; SET LOCAL DateStyle = 'SQL, DMY';
        UPDATE ${coverage} SET coverage_started_at = statement_timestamp() - interval '60 minutes';
        INSERT INTO ${ledger} VALUES ('${randomUUID()}', 'integrity_failed', statement_timestamp() - interval '2 hours', statement_timestamp() - interval '60 minutes'),
          ('${randomUUID()}', 'integrity_failed', statement_timestamp() - interval '2 hours', statement_timestamp() - interval '60 minutes 1 microsecond');
        SELECT public.read_operational_snapshot_v2() AS snapshot; ROLLBACK;`)
      const value = results[5].rows[0].snapshot
      exportsCounts(value.exports, 1, 0, 0)
      h.eq(value.exports.windowComplete, true, `elapsed-hour coverage in ${timezone}`)
      h.ok(value.exports.coverageStartedAt.endsWith('Z'), 'UTC serialization under local session settings')
    }
    await service.query(`CREATE TEMP TABLE archive_assembly_attempts (fake text);
      CREATE TEMP TABLE archive_observation_coverage (fake text);
      SET search_path = pg_temp; SET TIME ZONE 'Pacific/Auckland'; SET DateStyle = 'SQL, DMY';`)
    const id = randomUUID()
    receipt(await begin(service, id), id, 'started')
    receipt(await finish(service, id, 'verified'), id, 'verified')
    exportsCounts((await snapshot(service)).exports, 0, 0, 0)
  })

  await h.scenario('SQL aggregation is READ ONLY, stable MVCC and leaves both ledgers unchanged', async () => {
    await reset()
    const before = (await h.db.query(`SELECT jsonb_build_object('attempts', (SELECT jsonb_agg(a) FROM ${ledger} a), 'coverage', (SELECT jsonb_agg(c) FROM ${coverage} c)) AS state`)).rows[0]
    await service.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ')
    try {
      exportsCounts((await snapshot(service)).exports, 0, 0, 0)
      const writer = await actor('service_role')
      try { await begin(writer, randomUUID()) } finally { await h.close(writer) }
      exportsCounts((await snapshot(service)).exports, 0, 0, 0)
    } finally { await service.query('ROLLBACK') }
    exportsCounts((await snapshot(service)).exports, 0, 1, 0)
    await reset()
    await snapshot(service)
    h.eq((await h.db.query(`SELECT jsonb_build_object('attempts', (SELECT jsonb_agg(a) FROM ${ledger} a), 'coverage', (SELECT jsonb_agg(c) FROM ${coverage} c)) AS state`)).rows[0], before, 'read-only functions do not mutate ledgers or epoch')
    await service.query('BEGIN')
    try {
      await delay(20)
      const row = (await service.query('SELECT public.read_operational_snapshot_v2() AS snapshot, floor(extract(epoch FROM transaction_timestamp()) * 1000)::text AS tx')).rows[0]
      h.ok(Date.parse(row.snapshot.observedAt) > Number(row.tx), 'observation clock is statement time, not transaction start')
    } finally { await service.query('ROLLBACK') }
  })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failure = { code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'UNEXPECTED_FAILURE', label: error.label ?? 'runner or SQL failure; raw error omitted' }
  report.failureKind = report.rpcProbeSqlstate === '42883' && report.scenarios.length === 1 ? 'expected_product_red_missing_rpc' : 'runner_or_implementation_failure_not_product_red'
} finally {
  await h.cleanup()
  if (report.cleanup) {
    report.cleanup.socketRemoved = !h.scratch || !await exists(join(h.scratch, 'socket/.s.PGSQL.5432'))
    report.cleanup.parentDirectoryRemoved = !h.scratch || !await exists(h.scratch)
    if (!Number.isInteger(report.runtime.serverPid)) report.cleanup.serverPidGone = true
    else {
      try { process.kill(report.runtime.serverPid, 0); report.cleanup.serverPidGone = false }
      catch (error) { report.cleanup.serverPidGone = error.code === 'ESRCH' }
    }
    if (!report.cleanup.socketRemoved || !report.cleanup.parentDirectoryRemoved || !report.cleanup.serverPidGone) report.status = 'failed'
  }
  report.completedAt = new Date().toISOString()
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ status: report.status, scenarios: report.scenarios.length, assertions: report.assertions, failureKind: report.failureKind, failure: report.failure, cleanup: report.cleanup, output }))
  process.exitCode = report.status === 'passed' ? 0 : 1
}
