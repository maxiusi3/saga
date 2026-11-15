import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { once } from 'node:events'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, CANDIDATE, CANDIDATE_SIGNATURE, CANDIDATE_RPC } from './fixture.mjs'
import { databaseScenarios } from './database.mjs'
import { compileCandidateModules } from './application-compiler.mjs'
import { applicationScenarios } from './application.mjs'

const mode = process.argv.includes('--without-migration') ? 'red-without-migration'
  : process.argv.includes('--sql-only') ? 'sql-only' : 'full-application'
const runId = `${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
const evidence = join(root, 'docs/research/evidence/2026-11-03-g1-worker-candidates', runId)
const report = {
  startedAt: new Date().toISOString(), mode, status: 'running', assertions: 0,
  actorConnections: [], scenarios: [], sources: {}, snapshots: {},
  limits: ['Real isolated PG17.4 and native Unix socket; synthetic Storage tables, not real Supabase Storage/PostgREST or full migration chain.',
    ...(mode === 'full-application' ? [] : ['SQL-only run: application upload/readback, native audio, managed ownership, deployment, backup qualification are not exercised.'])],
  g1Item01Complete: false, g1MilestoneSatisfied: false, pushConditionSatisfied: false,
}
const h = new Harness(report)
const children = new Set()
await mkdir(evidence, { recursive: true })
async function source(path) {
  const bytes = await readFile(join(root, path))
  if (report.sources[path]) {
    h.eq(digest(bytes), report.sources[path], 'snapshotted source stays unchanged during run')
    return bytes.toString('utf8')
  }
  report.sources[path] = digest(bytes)
  const name = `${Object.keys(report.snapshots).length}-${path.split('/').at(-1)}.gz`
  const compressed = gzipSync(bytes)
  await writeFile(join(evidence, name), compressed, { flag: 'wx' })
  report.snapshots[path] = { path: name, sha256: digest(compressed), decodedSha256: digest(bytes) }
  return bytes.toString('utf8')
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { h.signal ??= signal })
try {
  for (const file of ['verify.mjs', 'fixture.mjs', 'database.mjs', 'README.md']) await source(`experiments/pg17-recording-candidates/${file}`)
  if (mode === 'full-application') for (const file of ['application.mjs', 'application-compiler.mjs', 'application-client.mjs',
    'application-http.mjs', 'worker-child-application.mjs']) await source(`experiments/pg17-recording-candidates/${file}`)
  for (const file of ['experiments/pg17-recording-worker/fixture.mjs', 'experiments/pg17-routines/runtime.mjs',
    'experiments/pg17-routines/runtime-pins.json']) await source(file)
  await h.start()
  await setup(h, source)
  const modules = mode === 'full-application' ? await compileCandidateModules(h, source) : await compileModules(h, source)
  if (mode !== 'red-without-migration') {
    const migration = await source(CANDIDATE)
    await h.scenario('Incompatible existing buckets and disabled managed RLS fail transactionally without rewriting configuration', async () => {
      for (const [name, isPublic, limit, mime] of [
        ['recording-candidates', true, 104857600, null], ['recording-candidates', false, null, null],
        ['recording-candidates', false, 104857601, null], ['wrong-name', false, 104857600, null],
        ['recording-candidates', false, 104857600, ['audio/webm']],
      ]) {
        await h.db.query('INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES($1,$2,$3,$4,$5)',
          ['recording-candidates', name, isPublic, limit, mime])
        const before = (await h.db.query("SELECT to_jsonb(b) AS bucket FROM storage.buckets b WHERE id='recording-candidates'")).rows[0].bucket
        let code
        try { await h.db.query(migration) } catch (error) { code = error.code } finally { await h.db.query('ROLLBACK') }
        h.eq(code, '22023', 'incompatible preexisting bucket rejected')
        h.eq((await h.db.query("SELECT to_jsonb(b) AS bucket FROM storage.buckets b WHERE id='recording-candidates'")).rows[0].bucket, before, 'incompatible bucket configuration not rewritten')
        h.eq((await h.db.query("SELECT to_regclass('public.recording_output_candidates') AS candidate")).rows[0].candidate, null, 'failed migration creates no partial candidate table')
        await h.db.query("DELETE FROM storage.buckets WHERE id='recording-candidates'")
      }
      for (const table of ['objects', 'buckets']) {
        await h.db.query(`ALTER TABLE storage.${table} DISABLE ROW LEVEL SECURITY`)
        let code
        try { await h.db.query(migration) } catch (error) { code = error.code } finally { await h.db.query('ROLLBACK') }
        h.eq(code, '22023', 'missing managed RLS rejected rather than assuming restrictive policies will protect data')
        h.eq((await h.db.query("SELECT count(*)::int AS n FROM storage.buckets WHERE id='recording-candidates'")).rows[0].n, 0, 'unsafe RLS failure creates no bucket')
        await h.db.query(`ALTER TABLE storage.${table} ENABLE ROW LEVEL SECURITY`)
      }
      await h.db.query('BEGIN')
      await h.db.query("INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('recording-candidates','recording-candidates',false,104857600)")
      // Strip only transaction delimiters for this rollback-only compatible-path
      // probe, then apply the unchanged complete migration for the actual run.
      await h.db.query(migration.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, ''))
      h.eq((await h.db.query("SELECT count(*)::int AS n FROM storage.buckets WHERE id='recording-candidates'")).rows[0].n, 1, 'compatible bucket is reused without duplication')
      await h.db.query('ROLLBACK')
    })
    await h.db.query(migration)
    report.fixture.fullMigrations.push(CANDIDATE)
  }
  await h.scenario('Exact reserve/prepare RPC exists (real missing-feature RED)', async () => {
    const client = await h.actorClient('service_role')
    try {
      try { await client.query(CANDIDATE_RPC, [null, 'reserve', 'probe', 1, 'a'.repeat(64), randomUUID(), '{}']); report.rpcInvocationSqlstate = '00000' }
      catch (error) { report.rpcInvocationSqlstate = error.code }
    } finally { await h.close(client) }
    report.rpcProbe = (await h.db.query('SELECT to_regprocedure($1)::text AS rpc', [CANDIDATE_SIGNATURE])).rows[0].rpc
    h.ok(report.rpcInvocationSqlstate !== '42883', 'actual service RPC invocation must not be undefined-function 42883')
    h.eq(report.rpcProbe, 'recording_output_candidate(uuid,text,text,integer,text,uuid,jsonb)', 'exact candidate RPC must exist')
  })
  await databaseScenarios(h, modules.prepareRecordingSessionSeal, children, source)
  if (mode === 'full-application') await applicationScenarios(h, modules, children)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message }
  process.exitCode = 1
} finally {
  await Promise.all([...children].map(async child => { const exit = once(child, 'exit'); child.kill('SIGKILL'); await exit }))
  if (h.db && mode !== 'red-without-migration') {
    try {
      report.finalDatabase = (await h.db.query(`SELECT jsonb_build_object(
        'candidates',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.recording_output_candidates c),
        'readyAssets',(SELECT count(*) FROM public.media_assets WHERE state='ready'),
        'succeededJobs',(SELECT count(*) FROM public.processing_jobs WHERE state='succeeded' OR result_ref IS NOT NULL),
        'confirmedSessions',(SELECT count(*) FROM public.recording_sessions WHERE confirmed_at IS NOT NULL OR state='cloud_confirmed')
      ) AS state`)).rows[0].state
    } catch { report.finalDatabaseUnavailable = true }
  }
  if (h.scratch && await exists(join(h.scratch, 'postgres.log'))) {
    const log = await readFile(join(h.scratch, 'postgres.log'))
    const compressed = gzipSync(log)
    await writeFile(join(evidence, 'postgres.log.gz'), compressed, { flag: 'wx' })
    report.postgresLog = { path: 'postgres.log.gz', sha256: digest(compressed), decodedSha256: digest(log) }
  }
  await h.cleanup()
  report.cleanup.childrenRemaining = children.size
  report.cleanup.socketDirectoryRemoved = !h.config?.host || !await exists(h.config.host)
  try { process.kill(report.runtime.serverPid, 0); report.cleanup.serverPidGone = false }
  catch (error) { report.cleanup.serverPidGone = error.code === 'ESRCH' }
  const childPids = [...new Set((report.childEvents ?? []).map(event => event.pid))].filter(Boolean)
  report.cleanup.childPidsGone = childPids.every(pid => { try { process.kill(pid, 0); return false } catch (error) { return error.code === 'ESRCH' } })
  report.sourcesChangedDuringRun = []
  for (const [path, hash] of Object.entries(report.sources)) if (digest(await readFile(join(root, path))) !== hash) report.sourcesChangedDuringRun.push(path)
  if (report.sourcesChangedDuringRun.length || !report.cleanup.socketDirectoryRemoved || !report.cleanup.serverPidGone ||
    !report.cleanup.childPidsGone || children.size || report.status !== 'passed' ||
    (mode === 'full-application' && (!report.applicationCleanup?.observersRestored ||
      report.applicationCleanup.nativeChildrenRemaining || report.applicationCleanup.streamsRemaining ||
      report.applicationCleanup.handlesRemaining || report.nativeHttpCleanup?.listening ||
      report.nativeHttpCleanup?.socketsRemaining || report.nativeHttpCleanup?.handlersRemaining || report.nativeHttpCleanup?.fixtureErrors))) {
    report.status = 'failed'; process.exitCode = 1
  }
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ evidence, status: report.status, assertions: report.assertions, scenarios: report.scenarios,
    cleanup: report.cleanup, error: report.error ?? null }, null, 2))
}
