import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'

const migrationPath = 'supabase/migrations/20261030000002_deployment_collection_coverage.sql'
const uploadMigrationPath = 'supabase/migrations/20261030000001_upload_observations.sql'
const exportMigrationPath = 'supabase/migrations/20261029000002_export_observations.sql'
const oldMigrationPath = 'supabase/migrations/20261029000001_operational_snapshot.sql'
const foundationPath = 'supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql'
const evidenceDir = join(root, 'docs/research/evidence/2026-10-30-deployment-collection-coverage')
const mode = process.argv.includes('--without-migration') ? 'red-without-migration' : 'verify'
const output = join(evidenceDir, `pg-${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)
const report = {
  startedAt: new Date().toISOString(), status: 'running', mode,
  scope: 'Synthetic local PG17.4 deployment collection coverage & build attribution ledger/RPC/v4 aggregate verification; not a full migration-chain, PostgREST, live fleet rollout or production qualification',
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
const BINDING_HASH = digest(JSON.stringify([ASSET, USER, 'synthetic-in-memory-report-credential']))
const OTHER_BINDING_HASH = digest('different-binding')
const RELEASE_HASH = digest('release-build-v1')
const STALE_BUILD_HASH = digest('release-build-v0-stale')
const NEXT_RELEASE_HASH = digest('release-build-v2-next')
const EXPORT_SCOPE = 'synchronous_archive_assembly'
const UPLOAD_SCOPE = 'project_hub_audio_put_reports'
const coverageTable = 'public.deployment_collection_coverage'
const exportBuildsTable = 'public.archive_attempt_builds'
const uploadBuildsTable = 'public.upload_attempt_builds'
const exportLedger = 'public.archive_assembly_attempts'
const uploadLedger = 'public.browser_upload_attempts'
const exportEpochTable = 'public.archive_observation_coverage'
const uploadEpochTable = 'public.upload_observation_coverage'
const signatures = [
  'seal_deployment_collection_coverage(text,text)',
  'begin_archive_assembly_attempt_v2(uuid,text)',
  'begin_browser_upload_attempt_v2(uuid,text,text)',
  'read_operational_snapshot_v4()',
]
let migration

async function source(path) {
  const content = await readFile(join(root, path), 'utf8')
  report.sources[path] = digest(content)
  return content
}

async function setup() {
  const foundation = await source(foundationPath)
  await source('experiments/pg17-routines/runtime.mjs')
  await source('experiments/pg17-deployment-collection-coverage/verify.mjs')
  await source('experiments/pg17-routines/runtime-pins.json')
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
  await h.db.query(await source(exportMigrationPath))
  await h.db.query(await source(uploadMigrationPath))
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

const sealSql = 'SELECT public.seal_deployment_collection_coverage($1::text, $2::text) AS receipt'
const beginExportV2Sql = 'SELECT public.begin_archive_assembly_attempt_v2($1::uuid, $2::text) AS receipt'
const beginUploadV2Sql = 'SELECT public.begin_browser_upload_attempt_v2($1::uuid, $2::text, $3::text) AS receipt'
const finishExportSql = 'SELECT public.finish_archive_assembly_attempt($1::uuid, $2::text) AS receipt'
const finishUploadSql = 'SELECT public.finish_browser_upload_attempt($1::uuid, $2::text, $3::text) AS receipt'

async function seal(client, scope, releaseHash = RELEASE_HASH) {
  return (await client.query(sealSql, [scope, releaseHash])).rows[0].receipt
}

async function beginExportV2(client, id, buildHash = RELEASE_HASH) {
  return (await client.query(beginExportV2Sql, [id, buildHash])).rows[0].receipt
}

async function beginUploadV2(client, id, bindingHash = BINDING_HASH, buildHash = RELEASE_HASH) {
  return (await client.query(beginUploadV2Sql, [id, bindingHash, buildHash])).rows[0].receipt
}

function attemptReceipt(actual, id, state) {
  h.eq(actual, { schemaVersion: 1, attemptId: id, state }, 'exact minimal write receipt; no build, binding, identity, time or provider fields')
}

function coverageCounts(actual, matching, unattributed, stale, invalid, complete) {
  h.eq([
    actual.matchingBuildAttemptsCount,
    actual.unattributedAttemptsCount,
    actual.staleBuildAttemptsCount,
    actual.invalidBuildAttemptsCount,
    actual.buildCoverageComplete,
  ], [matching, unattributed, stale, invalid, complete], 'exact build attribution and coverage completeness counters')
}

async function snapshot(client, expectValidCutover = { exports: false, uploads: false }) {
  const row = (await client.query(`SELECT public.read_operational_snapshot_v4() AS snapshot,
    public.read_operational_snapshot_v3() AS legacy_v3,
    public.read_operational_snapshot_v2() AS legacy_v2,
    floor(extract(epoch FROM statement_timestamp()) * 1000)::text AS statement_ms`)).rows[0]
  const value = row.snapshot
  h.eq(Object.keys(value).sort(), ['collectionCoverage', 'costs', 'deletions', 'exports', 'observedAt', 'processing', 'schemaVersion', 'uploads'], 'v4 exact root allowlist')
  const { collectionCoverage, ...oldV3 } = value
  h.eq({ ...oldV3, schemaVersion: 3 }, row.legacy_v3, 'v3 shape and all metrics preserved in same statement')
  const { uploads: _uploads, ...oldV2 } = oldV3
  h.eq({ ...oldV2, schemaVersion: 2 }, row.legacy_v2, 'v2 shape and all metrics preserved in same statement')
  h.eq(value.schemaVersion, 4, 'v4 schema version')
  h.eq(Date.parse(value.observedAt), Number(row.statement_ms), 'observedAt is current database statement time')
  h.eq(Object.keys(collectionCoverage).sort(), ['exports', 'uploads'], 'collectionCoverage exact group allowlist')
  for (const [group, expectedScope] of [['exports', EXPORT_SCOPE], ['uploads', UPLOAD_SCOPE]]) {
    const item = collectionCoverage[group]
    h.eq(Object.keys(item).sort(), [
      'buildCoverageComplete', 'cutoverAt', 'cutoverWindowComplete', 'invalidBuildAttemptsCount',
      'matchingBuildAttemptsCount', 'releaseHash', 'scope', 'staleBuildAttemptsCount',
      'unattributedAttemptsCount', 'windowMinutes',
    ], `${group} collectionCoverage exact field allowlist`)
    h.eq(item.scope, expectedScope, `${group} fixed scope`)
    h.eq(item.windowMinutes, 60, `${group} fixed 60 minute cutover window`)
    for (const key of ['matchingBuildAttemptsCount', 'unattributedAttemptsCount', 'staleBuildAttemptsCount', 'invalidBuildAttemptsCount']) {
      h.ok(Number.isSafeInteger(item[key]) && item[key] >= 0, `${group}.${key} safe nonnegative integer`)
    }
    if (expectValidCutover[group]) {
      h.ok(/^[0-9a-f]{64}$/.test(item.releaseHash), `${group} valid lowercase SHA-256 releaseHash`)
      h.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(item.cutoverAt), `${group} UTC cutoverAt has full microseconds`)
      const age = Date.parse(value.observedAt) - Date.parse(item.cutoverAt)
      h.ok(age >= 0, `${group} cutover cannot start in the future`)
      h.eq(item.cutoverWindowComplete, age >= 3600000, `${group} cutoverWindowComplete derived from cutover age`)
    } else {
      h.eq(item.releaseHash, null, `${group} unsealed or invalid releaseHash is null`)
      h.eq(item.cutoverAt, null, `${group} unsealed or invalid cutoverAt is null`)
      h.eq(item.cutoverWindowComplete, false, `${group} unsealed or invalid cutover never marks cutoverWindowComplete`)
      h.eq(item.matchingBuildAttemptsCount, 0, `${group} without valid cutover cannot claim matching build attempts`)
      h.eq(item.buildCoverageComplete, false, `${group} without valid cutover never marks buildCoverageComplete`)
    }
  }
  h.ok(![USER, PROJECT, ASSET, JOB, SENTINEL, BINDING_HASH, OTHER_BINDING_HASH].some((text) => JSON.stringify(value).includes(text)), 'aggregate never emits private fixtures or binding hashes')
  return value
}

async function reset() {
  await h.db.query(`TRUNCATE ${exportBuildsTable}, ${uploadBuildsTable}, ${exportLedger}, ${uploadLedger}, ${coverageTable}`)
}

async function definitions() {
  return (await h.db.query(`SELECT proname, pg_get_functiondef(oid) AS definition, proacl::text
    FROM pg_proc WHERE oid IN (
      'public.read_operational_snapshot()'::regprocedure,
      'public.read_operational_snapshot_v2()'::regprocedure,
      'public.read_operational_snapshot_v3()'::regprocedure,
      'public.begin_archive_assembly_attempt(uuid)'::regprocedure,
      'public.finish_archive_assembly_attempt(uuid,text)'::regprocedure,
      'public.begin_browser_upload_attempt(uuid,text)'::regprocedure,
      'public.finish_browser_upload_attempt(uuid,text,text)'::regprocedure
    ) ORDER BY proname`)).rows
}

async function waitForLock(client) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const waiting = (await h.db.query("SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = $1", [client.processID])).rows[0]?.waiting
    if (waiting) { h.ok(true, 'independent real backend demonstrably waits on database lock'); return }
    await delay(10)
  }
  h.ok(false, 'concurrent backend must reach actual database lock wait')
}

async function race(service, first, second) {
  const contender = await actor('service_role')
  await service.query('BEGIN')
  let waiting
  try {
    const winner = await first(service)
    waiting = second(contender)
    await waitForLock(contender)
    await service.query('COMMIT')
    return [winner, await waiting]
  } finally {
    await service.query('ROLLBACK')
    if (waiting) await waiting
    await h.close(contender)
  }
}

try {
  await h.start()
  await setup()
  const oldDefinitions = await definitions()
  if (mode !== 'red-without-migration' && await exists(join(root, migrationPath))) {
    migration = await source(migrationPath)
    await h.db.query(migration)
  }
  const service = await actor('service_role')
  await h.scenario('New v4 RPC exists; missing new RPC is genuine product RED; migration does not fabricate cutover seals', async () => {
    report.rpcProbeSqlstate = (await queryOutcome(service, 'SELECT public.read_operational_snapshot_v4()')).code
    h.eq(report.rpcProbeSqlstate, '00000', 'new v4 RPC must exist (42883 is expected missing-feature RED)')
    const value = await snapshot(service, { exports: false, uploads: false })
    coverageCounts(value.collectionCoverage.exports, 0, 0, 0, 0, false)
    coverageCounts(value.collectionCoverage.uploads, 0, 0, 0, 0, false)
    h.eq(value.exports.windowComplete, false, 'fresh export ledger epoch is incomplete')
    h.eq(value.uploads.windowComplete, false, 'fresh upload ledger epoch is incomplete')
    h.eq(value.processing, { stalledJobsCount: 1, maxRunnableBacklogAgeSeconds: 0, invalidJobCount: 0 }, 'nonempty v1 processing preserved')
    h.eq(value.costs, { maxProjectKnownExposureCents: 25, unknownAttemptCostsCount: 0 }, 'nonempty v1 costs preserved')
    h.eq(value.deletions, { overdueRequestsCount: 1, invalidRequestCount: 0 }, 'nonempty v1 deletions preserved')
  })

  await h.scenario('Minimal schema, preserved v1-v3 tables/functions, fixed search paths and RLS enabled', async () => {
    const covCols = (await h.db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deployment_collection_coverage' ORDER BY ordinal_position")).rows.map((r) => r.column_name)
    h.eq(covCols, ['scope', 'release_hash', 'cutover_at'], 'deployment_collection_coverage stores only scope, release_hash and cutover_at')
    const expBuildCols = (await h.db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'archive_attempt_builds' ORDER BY ordinal_position")).rows.map((r) => r.column_name)
    h.eq(expBuildCols, ['attempt_id', 'build_hash'], 'archive_attempt_builds stores only attempt_id and build_hash')
    const upBuildCols = (await h.db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'upload_attempt_builds' ORDER BY ordinal_position")).rows.map((r) => r.column_name)
    h.eq(upBuildCols, ['attempt_id', 'build_hash'], 'upload_attempt_builds stores only attempt_id and build_hash')
    const legacyExportCols = (await h.db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'archive_assembly_attempts' ORDER BY ordinal_position")).rows.map((r) => r.column_name)
    h.eq(legacyExportCols, ['id', 'state', 'started_at', 'finished_at'], 'legacy archive_assembly_attempts columns unchanged')
    const legacyUploadCols = (await h.db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'browser_upload_attempts' ORDER BY ordinal_position")).rows.map((r) => r.column_name)
    h.eq(legacyUploadCols, ['id', 'binding_hash', 'state', 'started_at', 'finished_at'], 'legacy browser_upload_attempts columns unchanged')
    for (const [signature, definer, language, volatility, args] of [
      [signatures[0], true, 'plpgsql', 'v', 2],
      [signatures[1], true, 'plpgsql', 'v', 2],
      [signatures[2], true, 'plpgsql', 'v', 3],
      [signatures[3], false, 'sql', 's', 0],
    ]) {
      const metadata = (await h.db.query(`SELECT p.prosecdef, l.lanname, p.provolatile, p.proconfig, p.pronargs
        FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.oid = $1::regprocedure`, [`public.${signature}`])).rows[0]
      h.eq(metadata, { prosecdef: definer, lanname: language, provolatile: volatility, proconfig: ['search_path=pg_catalog, public, pg_temp'], pronargs: args }, `exact metadata for ${signature}`)
    }
    h.eq(await definitions(), oldDefinitions, 'v1/v2/v3 definitions and ACLs byte-identical')
    h.eq((await h.db.query(`SELECT relrowsecurity FROM pg_class WHERE oid IN ('${coverageTable}'::regclass, '${exportBuildsTable}'::regclass, '${uploadBuildsTable}'::regclass)`)).rows,
      [{ relrowsecurity: true }, { relrowsecurity: true }, { relrowsecurity: true }], 'all three new tables enable RLS')
  })

  await h.scenario('Real login ACLs reject forged role claims and all direct application writes on new tables and RPCs', async () => {
    const newTables = [coverageTable, exportBuildsTable, uploadBuildsTable]
    for (const role of ['anon', 'authenticated', 'metadata_reader']) {
      for (const claim of [role, 'service_role']) {
        const client = await actor(role, claim)
        for (const sql of [
          'SELECT public.read_operational_snapshot_v4()',
          `SELECT public.seal_deployment_collection_coverage('${EXPORT_SCOPE}', '${RELEASE_HASH}')`,
          `SELECT public.begin_archive_assembly_attempt_v2('${randomUUID()}', '${RELEASE_HASH}')`,
          `SELECT public.begin_browser_upload_attempt_v2('${randomUUID()}', '${BINDING_HASH}', '${RELEASE_HASH}')`,
          `SELECT * FROM ${coverageTable}`, `SELECT * FROM ${exportBuildsTable}`, `SELECT * FROM ${uploadBuildsTable}`,
        ]) await denied(client, sql, '42501', `${role}/${claim} cannot use new tables or RPCs`)
        for (const table of newTables) {
          for (const sql of [`DELETE FROM ${table}`, `TRUNCATE ${table}`, `INSERT INTO ${table} DEFAULT VALUES`]) {
            await denied(client, sql, '42501', `${role}/${claim} cannot directly mutate ${table}`)
          }
        }
        await h.close(client)
      }
    }
    for (const table of newTables) {
      h.eq((await service.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0, `service SELECT is allowed on ${table}`)
      for (const sql of [`DELETE FROM ${table}`, `TRUNCATE ${table}`, `INSERT INTO ${table} DEFAULT VALUES`]) {
        await denied(service, sql, '42501', `service_role cannot directly mutate ${table}`)
      }
    }
  })

  await h.scenario('RLS independently hides rows in all three new tables even if SELECT ACL is accidentally granted', async () => {
    const expId = randomUUID()
    const upId = randomUUID()
    await seal(service, EXPORT_SCOPE, RELEASE_HASH)
    await beginExportV2(service, expId, RELEASE_HASH)
    await beginUploadV2(service, upId, BINDING_HASH, RELEASE_HASH)
    await h.db.query(`GRANT SELECT ON ${coverageTable}, ${exportBuildsTable}, ${uploadBuildsTable} TO anon, authenticated, metadata_reader`)
    try {
      for (const role of ['anon', 'authenticated', 'metadata_reader']) {
        const client = await actor(role, 'service_role')
        try {
          for (const table of [coverageTable, exportBuildsTable, uploadBuildsTable]) {
            h.eq((await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0, `RLS denies ${role} on ${table}`)
          }
        } finally { await h.close(client) }
      }
      for (const table of [coverageTable, exportBuildsTable, uploadBuildsTable]) {
        h.eq((await service.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 1, `service_role sees populated ${table}`)
      }
    } finally {
      await h.db.query(`REVOKE SELECT ON ${coverageTable}, ${exportBuildsTable}, ${uploadBuildsTable} FROM anon, authenticated, metadata_reader`)
      await reset()
    }
  })

  await h.scenario('Seal cutover, build-bound begins, idempotent replays, and prohibition on retroactive attribution', async () => {
    for (const scope of [EXPORT_SCOPE, UPLOAD_SCOPE]) {
      const first = (await service.query('SELECT public.seal_deployment_collection_coverage($1, $2) AS receipt, statement_timestamp()::text AS at', [scope, RELEASE_HASH])).rows[0]
      h.eq(first.receipt.schemaVersion, 1, 'seal receipt schemaVersion')
      h.eq(first.receipt.scope, scope, 'seal receipt scope')
      h.eq(first.receipt.releaseHash, RELEASE_HASH, 'seal receipt releaseHash')
      h.eq(Date.parse(first.receipt.cutoverAt), Date.parse(first.at), 'seal cutoverAt uses database statement_timestamp')
      await delay(15)
      const replay = await seal(service, scope, RELEASE_HASH)
      h.eq(replay, first.receipt, 'same releaseHash seal replay preserves original cutoverAt')
      const rotated = (await service.query('SELECT public.seal_deployment_collection_coverage($1, $2) AS receipt', [scope, NEXT_RELEASE_HASH])).rows[0].receipt
      h.eq(rotated.releaseHash, NEXT_RELEASE_HASH, 'new releaseHash updates active release')
      h.ok(Date.parse(rotated.cutoverAt) > Date.parse(first.receipt.cutoverAt), 'new releaseHash resets cutoverAt to fresh statement time')
      await seal(service, scope, RELEASE_HASH)
    }

    const expId = randomUUID()
    attemptReceipt(await beginExportV2(service, expId, RELEASE_HASH), expId, 'started')
    attemptReceipt(await beginExportV2(service, expId, RELEASE_HASH), expId, 'started')
    await denied(service, beginExportV2Sql, '22023', 'cannot change export buildHash on replay', [expId, STALE_BUILD_HASH])
    attemptReceipt((await service.query(finishExportSql, [expId, 'verified'])).rows[0].receipt, expId, 'verified')
    attemptReceipt(await beginExportV2(service, expId, RELEASE_HASH), expId, 'verified')
    await denied(service, beginExportV2Sql, '22023', 'cannot change export buildHash after terminal', [expId, STALE_BUILD_HASH])

    const legacyExpId = randomUUID()
    attemptReceipt((await service.query('SELECT public.begin_archive_assembly_attempt($1::uuid) AS receipt', [legacyExpId])).rows[0].receipt, legacyExpId, 'started')
    await denied(service, beginExportV2Sql, '22023', 'v2 cannot retroactively attach buildHash to unattributed v1 export attempt', [legacyExpId, RELEASE_HASH])
    attemptReceipt((await service.query(finishExportSql, [legacyExpId, 'verified'])).rows[0].receipt, legacyExpId, 'verified')

    const upId = randomUUID()
    attemptReceipt(await beginUploadV2(service, upId, BINDING_HASH, RELEASE_HASH), upId, 'started')
    attemptReceipt(await beginUploadV2(service, upId, BINDING_HASH, RELEASE_HASH), upId, 'started')
    await denied(service, beginUploadV2Sql, '22023', 'wrong bindingHash rejected on upload v2 replay', [upId, OTHER_BINDING_HASH, RELEASE_HASH])
    await denied(service, beginUploadV2Sql, '22023', 'wrong buildHash rejected on upload v2 replay', [upId, BINDING_HASH, STALE_BUILD_HASH])
    attemptReceipt((await service.query(finishUploadSql, [upId, BINDING_HASH, 'client_succeeded'])).rows[0].receipt, upId, 'client_succeeded')
    attemptReceipt(await beginUploadV2(service, upId, BINDING_HASH, RELEASE_HASH), upId, 'client_succeeded')
    await denied(service, beginUploadV2Sql, '22023', 'wrong buildHash rejected after upload terminal', [upId, BINDING_HASH, STALE_BUILD_HASH])

    const legacyUpId = randomUUID()
    attemptReceipt((await service.query('SELECT public.begin_browser_upload_attempt($1::uuid, $2::text) AS receipt', [legacyUpId, BINDING_HASH])).rows[0].receipt, legacyUpId, 'started')
    await denied(service, beginUploadV2Sql, '22023', 'v2 cannot retroactively attach buildHash to unattributed v1 upload attempt', [legacyUpId, BINDING_HASH, RELEASE_HASH])
    attemptReceipt((await service.query(finishUploadSql, [legacyUpId, BINDING_HASH, 'client_succeeded'])).rows[0].receipt, legacyUpId, 'client_succeeded')

    for (const badHash of [null, '', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), `${'a'.repeat(64)}\n`, SENTINEL]) {
      await denied(service, sealSql, '22023', 'malformed releaseHash rejected at seal', [EXPORT_SCOPE, badHash])
      await denied(service, beginExportV2Sql, '22023', 'malformed buildHash rejected at export v2 begin', [randomUUID(), badHash])
      await denied(service, beginUploadV2Sql, '22023', 'malformed buildHash rejected at upload v2 begin', [randomUUID(), BINDING_HASH, badHash])
      await denied(service, beginUploadV2Sql, '22023', 'malformed bindingHash rejected at upload v2 begin', [randomUUID(), badHash, RELEASE_HASH])
    }
    for (const badScope of [null, '', 'all', 'storage', SENTINEL]) {
      await denied(service, sealSql, '22023', 'invalid scope rejected at seal', [badScope, RELEASE_HASH])
    }
    await denied(service, beginExportV2Sql, '22023', 'null export attempt ID rejected', [null, RELEASE_HASH])
    await denied(service, beginUploadV2Sql, '22023', 'null upload attempt ID rejected', [null, BINDING_HASH, RELEASE_HASH])
    await denied(service, "SELECT public.read_operational_snapshot_v4('2000-01-01'::timestamptz)", '42883', 'v4 aggregate accepts no caller clock')
  })

  await h.scenario('Structural guards reject deletion and mutation of build attribution and coverage epochs', async () => {
    await reset()
    const expId = randomUUID()
    const upId = randomUUID()
    await seal(service, EXPORT_SCOPE, RELEASE_HASH)
    await beginExportV2(service, expId, RELEASE_HASH)
    await beginUploadV2(service, upId, BINDING_HASH, RELEASE_HASH)

    for (const sql of [
      `DELETE FROM ${coverageTable} WHERE scope = '${EXPORT_SCOPE}'`,
      `UPDATE ${coverageTable} SET scope = '${UPLOAD_SCOPE}' WHERE scope = '${EXPORT_SCOPE}'`,
      `UPDATE ${coverageTable} SET cutover_at = cutover_at + interval '1 second' WHERE scope = '${EXPORT_SCOPE}'`,
      `UPDATE ${coverageTable} SET release_hash = '${NEXT_RELEASE_HASH}', cutover_at = cutover_at - interval '1 second' WHERE scope = '${EXPORT_SCOPE}'`,
      `DELETE FROM ${exportBuildsTable} WHERE attempt_id = '${expId}'`,
      `UPDATE ${exportBuildsTable} SET build_hash = '${STALE_BUILD_HASH}' WHERE attempt_id = '${expId}'`,
      `DELETE FROM ${uploadBuildsTable} WHERE attempt_id = '${upId}'`,
      `UPDATE ${uploadBuildsTable} SET build_hash = '${STALE_BUILD_HASH}' WHERE attempt_id = '${upId}'`,
    ]) await denied(h.db, sql, '23514', 'guard trigger blocks deletion or illegal mutation')
  })

  await h.scenario('True concurrent seals and v2 begins serialize on database locks', async () => {
    await reset()
    const sameSeals = await race(service, (c) => queryOutcome(c, sealSql, [EXPORT_SCOPE, RELEASE_HASH]), (c) => queryOutcome(c, sealSql, [EXPORT_SCOPE, RELEASE_HASH]))
    for (const r of sameSeals) h.eq(r.code, '00000', 'concurrent same-release seals succeed')
    h.eq(sameSeals[0].result.rows[0].receipt, sameSeals[1].result.rows[0].receipt, 'concurrent same-release seals preserve identical cutoverAt')

    const rotateSeals = await race(service, (c) => queryOutcome(c, sealSql, [UPLOAD_SCOPE, RELEASE_HASH]), (c) => queryOutcome(c, sealSql, [UPLOAD_SCOPE, NEXT_RELEASE_HASH]))
    for (const r of rotateSeals) h.eq(r.code, '00000', 'concurrent release rotation serializes cleanly')
    h.eq((await h.db.query(`SELECT release_hash FROM ${coverageTable} WHERE scope = $1`, [UPLOAD_SCOPE])).rows[0].release_hash, NEXT_RELEASE_HASH, 'second contender releaseHash persists after lock wait')

    const expId = randomUUID()
    const sameExp = await race(service, (c) => queryOutcome(c, beginExportV2Sql, [expId, RELEASE_HASH]), (c) => queryOutcome(c, beginExportV2Sql, [expId, RELEASE_HASH]))
    for (const r of sameExp) { h.eq(r.code, '00000', 'same-build concurrent export v2 begins succeed'); attemptReceipt(r.result.rows[0].receipt, expId, 'started') }

    const conflictExpId = randomUUID()
    const conflictExp = await race(service, (c) => queryOutcome(c, beginExportV2Sql, [conflictExpId, RELEASE_HASH]), (c) => queryOutcome(c, beginExportV2Sql, [conflictExpId, STALE_BUILD_HASH]))
    h.eq(conflictExp.map((r) => r.code), ['00000', '22023'], 'conflicting export buildHash rejected after lock wait')

    const upId = randomUUID()
    const conflictUp = await race(service, (c) => queryOutcome(c, beginUploadV2Sql, [upId, BINDING_HASH, RELEASE_HASH]), (c) => queryOutcome(c, beginUploadV2Sql, [upId, BINDING_HASH, STALE_BUILD_HASH]))
    h.eq(conflictUp.map((r) => r.code), ['00000', '22023'], 'conflicting upload buildHash rejected after lock wait')
  })

  await h.scenario('Ledger age (windowComplete) is strictly distinguished from cutoverWindowComplete and buildCoverageComplete', async () => {
    await reset()
    const results = await h.db.query(`BEGIN;
      UPDATE ${exportEpochTable} SET coverage_started_at = statement_timestamp() - interval '60 minutes';
      UPDATE ${uploadEpochTable} SET coverage_started_at = statement_timestamp() - interval '60 minutes';
      SELECT public.seal_deployment_collection_coverage('${EXPORT_SCOPE}', '${RELEASE_HASH}');
      SELECT public.seal_deployment_collection_coverage('${UPLOAD_SCOPE}', '${RELEASE_HASH}');
      SELECT public.read_operational_snapshot_v4() AS fresh_cutover;
      ALTER TABLE ${coverageTable} DISABLE TRIGGER USER;
      UPDATE ${coverageTable} SET cutover_at = statement_timestamp() - interval '60 minutes';
      ALTER TABLE ${coverageTable} ENABLE TRIGGER USER;
      SELECT public.read_operational_snapshot_v4() AS mature_cutover;
      ROLLBACK;`)
    const fresh = results[5].rows[0].fresh_cutover
    h.eq(fresh.exports.windowComplete, true, 'export ledger migration epoch is 60m old')
    h.eq(fresh.uploads.windowComplete, true, 'upload ledger migration epoch is 60m old')
    h.eq(fresh.collectionCoverage.exports.cutoverWindowComplete, false, 'fresh cutover is not yet 60m old despite mature ledger')
    h.eq(fresh.collectionCoverage.uploads.cutoverWindowComplete, false, 'fresh upload cutover is not yet 60m old despite mature ledger')
    coverageCounts(fresh.collectionCoverage.exports, 0, 0, 0, 0, false)
    coverageCounts(fresh.collectionCoverage.uploads, 0, 0, 0, 0, false)

    const mature = results[9].rows[0].mature_cutover
    h.eq(mature.collectionCoverage.exports.cutoverWindowComplete, true, '60m cutover qualifies at exact microsecond boundary')
    h.eq(mature.collectionCoverage.uploads.cutoverWindowComplete, true, '60m upload cutover qualifies at exact microsecond boundary')
    coverageCounts(mature.collectionCoverage.exports, 0, 0, 0, 0, true)
    coverageCounts(mature.collectionCoverage.uploads, 0, 0, 0, 0, true)

    for (const [age, complete] of [["interval '60 minutes' - interval '1 microsecond'", false], ["interval '60 minutes'", true]]) {
      const boundary = await h.db.query(`BEGIN;
        UPDATE ${exportEpochTable} SET coverage_started_at = statement_timestamp() - interval '2 hours';
        UPDATE ${uploadEpochTable} SET coverage_started_at = statement_timestamp() - interval '2 hours';
        SELECT public.seal_deployment_collection_coverage('${EXPORT_SCOPE}', '${RELEASE_HASH}');
        ALTER TABLE ${coverageTable} DISABLE TRIGGER USER;
        UPDATE ${coverageTable} SET cutover_at = statement_timestamp() - (${age});
        ALTER TABLE ${coverageTable} ENABLE TRIGGER USER;
        SELECT public.read_operational_snapshot_v4() AS snapshot;
        ROLLBACK;`)
      const snap = boundary[7].rows[0].snapshot
      h.eq(snap.collectionCoverage.exports.cutoverWindowComplete, complete, `exact microsecond cutover boundary for ${age}`)
      h.eq(snap.collectionCoverage.exports.buildCoverageComplete, complete, `buildCoverageComplete tracks cutover boundary for ${age}`)
    }
  })

  await h.scenario('Unattributed, stale-build, out-of-window and unsettled attempts partition accurately', async () => {
    await reset()
    const results = await h.db.query(`BEGIN;
      UPDATE ${exportEpochTable} SET coverage_started_at = statement_timestamp() - interval '2 hours';
      UPDATE ${uploadEpochTable} SET coverage_started_at = statement_timestamp() - interval '2 hours';
      SELECT public.seal_deployment_collection_coverage('${EXPORT_SCOPE}', '${RELEASE_HASH}');
      SELECT public.seal_deployment_collection_coverage('${UPLOAD_SCOPE}', '${RELEASE_HASH}');
      ALTER TABLE ${coverageTable} DISABLE TRIGGER USER;
      UPDATE ${coverageTable} SET cutover_at = statement_timestamp() - interval '60 minutes';
      ALTER TABLE ${coverageTable} ENABLE TRIGGER USER;

      INSERT INTO ${exportLedger} (id, state, started_at, finished_at) VALUES
        ('10000000-0000-4000-8000-000000000001', 'verified', statement_timestamp() - interval '30 minutes', statement_timestamp() - interval '20 minutes'),
        ('10000000-0000-4000-8000-000000000002', 'verified', statement_timestamp() - interval '30 minutes', statement_timestamp() - interval '10 minutes'),
        ('10000000-0000-4000-8000-000000000003', 'verified', statement_timestamp() - interval '30 minutes', statement_timestamp() - interval '5 minutes'),
        ('10000000-0000-4000-8000-000000000004', 'verified', statement_timestamp() - interval '2 hours', statement_timestamp() - interval '60 minutes 1 microsecond');
      INSERT INTO ${exportBuildsTable} (attempt_id, build_hash) VALUES
        ('10000000-0000-4000-8000-000000000001', '${RELEASE_HASH}'),
        ('10000000-0000-4000-8000-000000000002', '${STALE_BUILD_HASH}'),
        ('10000000-0000-4000-8000-000000000004', '${STALE_BUILD_HASH}');

      INSERT INTO ${uploadLedger} (id, binding_hash, state, started_at, finished_at) VALUES
        ('20000000-0000-4000-8000-000000000001', '${BINDING_HASH}', 'client_succeeded', statement_timestamp() - interval '30 minutes', statement_timestamp() - interval '20 minutes'),
        ('20000000-0000-4000-8000-000000000002', '${BINDING_HASH}', 'client_cancelled', statement_timestamp() - interval '30 minutes', statement_timestamp() - interval '10 minutes'),
        ('20000000-0000-4000-8000-000000000003', '${BINDING_HASH}', 'started', statement_timestamp() - interval '3 hours', NULL),
        ('20000000-0000-4000-8000-000000000004', '${BINDING_HASH}', 'client_failed', statement_timestamp() - interval '2 hours', statement_timestamp() - interval '60 minutes 1 microsecond');
      INSERT INTO ${uploadBuildsTable} (attempt_id, build_hash) VALUES
        ('20000000-0000-4000-8000-000000000001', '${RELEASE_HASH}'),
        ('20000000-0000-4000-8000-000000000002', '${STALE_BUILD_HASH}'),
        ('20000000-0000-4000-8000-000000000004', '${STALE_BUILD_HASH}');

      SELECT public.read_operational_snapshot_v4() AS snapshot;
      ROLLBACK;`)
    const snap = results[12].rows[0].snapshot
    coverageCounts(snap.collectionCoverage.exports, 1, 1, 1, 0, false)
    coverageCounts(snap.collectionCoverage.uploads, 1, 1, 1, 0, false)
  })

  await h.scenario('Corrupted coverage or build rows increment invalidBuildAttemptsCount and never claim coverage', async () => {
    await reset()
    await h.db.query('BEGIN')
    try {
      const expId = randomUUID()
      const upId = randomUUID()
      await seal(service, EXPORT_SCOPE, RELEASE_HASH)
      await seal(service, UPLOAD_SCOPE, RELEASE_HASH)
      await beginExportV2(service, expId, RELEASE_HASH)
      await beginUploadV2(service, upId, BINDING_HASH, RELEASE_HASH)
      for (const table of [coverageTable, exportBuildsTable, uploadBuildsTable]) {
        const checks = (await h.db.query(`SELECT conname FROM pg_constraint WHERE conrelid = '${table}'::regclass AND contype = 'c'`)).rows
        for (const { conname } of checks) await h.db.query(`ALTER TABLE ${table} DROP CONSTRAINT "${conname}"`)
        await h.db.query(`ALTER TABLE ${table} DISABLE TRIGGER USER`)
      }
      await h.db.query(`ALTER TABLE ${exportBuildsTable} ALTER COLUMN build_hash DROP NOT NULL`)
      await h.db.query(`ALTER TABLE ${uploadBuildsTable} ALTER COLUMN build_hash DROP NOT NULL`)
      await h.db.query(`UPDATE ${exportBuildsTable} SET build_hash = 'INVALID_HASH'`)
      await h.db.query(`UPDATE ${uploadBuildsTable} SET build_hash = NULL`)
      for (const badTime of ["'infinity'::timestamptz", "'-infinity'::timestamptz", "statement_timestamp() + interval '1 day'", "'0001-01-01 BC'::timestamptz"]) {
        await h.db.query(`UPDATE ${coverageTable} SET cutover_at = ${badTime} WHERE scope = '${EXPORT_SCOPE}'`)
        await h.db.query(`UPDATE ${coverageTable} SET release_hash = 'BAD' WHERE scope = '${UPLOAD_SCOPE}'`)
        const snap = await snapshot(h.db, { exports: false, uploads: false })
        coverageCounts(snap.collectionCoverage.exports, 0, 0, 0, 2, false)
        coverageCounts(snap.collectionCoverage.uploads, 0, 0, 0, 2, false)
      }
    } finally {
      await h.db.query('ROLLBACK')
    }
  })

  await h.scenario('Migration replay preserves cutover epochs and restores least-privilege ACLs', async () => {
    await reset()
    await seal(service, EXPORT_SCOPE, RELEASE_HASH)
    await seal(service, UPLOAD_SCOPE, RELEASE_HASH)
    const before = (await h.db.query(`SELECT to_jsonb(c) AS row FROM ${coverageTable} c ORDER BY scope`)).rows
    await h.db.query(`GRANT ALL ON ${coverageTable}, ${exportBuildsTable}, ${uploadBuildsTable} TO PUBLIC, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION public.${signatures.join(', public.')} TO PUBLIC, anon, authenticated;`)
    await h.db.query(migration)
    await h.db.query(migration)
    h.eq((await h.db.query(`SELECT to_jsonb(c) AS row FROM ${coverageTable} c ORDER BY scope`)).rows, before, 'cutover rows preserved across migration replay')
    h.eq(await definitions(), oldDefinitions, 'replay leaves v1-v3 definitions and ACLs byte-identical')
    for (const role of ['anon', 'authenticated', 'metadata_reader', 'service_role']) {
      for (const signature of signatures) {
        h.eq((await h.db.query("SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed", [role, `public.${signature}`])).rows[0].allowed, role === 'service_role', `exact RPC ACL for ${role} on ${signature}`)
      }
      for (const table of [coverageTable, exportBuildsTable, uploadBuildsTable]) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) {
          h.eq((await h.db.query('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, table, privilege])).rows[0].allowed, role === 'service_role' && privilege === 'SELECT', `exact table ACL for ${role} on ${table}/${privilege}`)
        }
      }
    }
  })

  await h.scenario('Timezone, hostile temp shadows and read-only MVCC do not alter v4 results or mutate tables', async () => {
    await reset()
    await seal(service, EXPORT_SCOPE, RELEASE_HASH)
    await seal(service, UPLOAD_SCOPE, RELEASE_HASH)
    await service.query(`CREATE TEMP TABLE deployment_collection_coverage (fake text);
      CREATE TEMP TABLE archive_attempt_builds (fake text);
      CREATE TEMP TABLE upload_attempt_builds (fake text);
      SET search_path = pg_temp; SET TIME ZONE 'Pacific/Auckland'; SET DateStyle = 'SQL, DMY';`)
    const expId = randomUUID()
    const upId = randomUUID()
    attemptReceipt(await beginExportV2(service, expId, RELEASE_HASH), expId, 'started')
    attemptReceipt((await service.query(finishExportSql, [expId, 'verified'])).rows[0].receipt, expId, 'verified')
    attemptReceipt(await beginUploadV2(service, upId, BINDING_HASH, RELEASE_HASH), upId, 'started')
    attemptReceipt((await service.query(finishUploadSql, [upId, BINDING_HASH, 'client_succeeded'])).rows[0].receipt, upId, 'client_succeeded')
    const snap = await snapshot(service, { exports: true, uploads: true })
    coverageCounts(snap.collectionCoverage.exports, 1, 0, 0, 0, false)
    coverageCounts(snap.collectionCoverage.uploads, 1, 0, 0, 0, false)
    h.ok(snap.collectionCoverage.exports.cutoverAt.endsWith('Z'), 'UTC cutoverAt under non-UTC session')
    h.ok(snap.collectionCoverage.uploads.cutoverAt.endsWith('Z'), 'UTC upload cutoverAt under non-UTC session')
    const stateSql = `SELECT jsonb_build_object(
      'coverage', (SELECT jsonb_agg(c ORDER BY c.scope) FROM ${coverageTable} c),
      'exportBuilds', (SELECT jsonb_agg(b ORDER BY b.attempt_id) FROM ${exportBuildsTable} b),
      'uploadBuilds', (SELECT jsonb_agg(b ORDER BY b.attempt_id) FROM ${uploadBuildsTable} b)
    ) AS state`
    const beforeState = (await h.db.query(stateSql)).rows[0]
    await service.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ')
    try {
      coverageCounts((await snapshot(service, { exports: true, uploads: true })).collectionCoverage.exports, 1, 0, 0, 0, false)
      const writer = await actor('service_role')
      try {
        await beginExportV2(writer, randomUUID(), RELEASE_HASH)
      } finally {
        await h.close(writer)
      }
      coverageCounts((await snapshot(service, { exports: true, uploads: true })).collectionCoverage.exports, 1, 0, 0, 0, false)
    } finally {
      await service.query('ROLLBACK')
    }
    coverageCounts((await snapshot(service, { exports: true, uploads: true })).collectionCoverage.exports, 2, 0, 0, 0, false)
    await reset()
    await snapshot(service, { exports: false, uploads: false })
    h.eq((await h.db.query(stateSql)).rows[0], { state: { coverage: null, exportBuilds: null, uploadBuilds: null } }, 'reading v4 snapshot never mutates coverage or build tables')
    await service.query('BEGIN')
    try {
      await delay(20)
      const clockRow = (await service.query('SELECT public.read_operational_snapshot_v4() AS snapshot, floor(extract(epoch FROM transaction_timestamp()) * 1000)::text AS tx')).rows[0]
      h.ok(Date.parse(clockRow.snapshot.observedAt) > Number(clockRow.tx), 'v4 observedAt uses statement_timestamp rather than transaction_timestamp')
    } finally {
      await service.query('ROLLBACK')
    }
    void beforeState
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
