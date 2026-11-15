import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, FINALIZATION, SIGNATURE, RPC } from './fixture.mjs'
import { databaseScenarios } from './database.mjs'

const mode = process.argv.includes('--without-migration') ? 'red-without-migration' : 'sql-only'
const runId = `${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
const evidence = join(root, 'docs/research/evidence/2026-11-04-g1-recording-finalization', runId)
const report = { startedAt: new Date().toISOString(), mode, status: 'running', assertions: 0,
  actorConnections: [], scenarios: [], sources: {}, snapshots: {}, tuples: [],
  limits: ['Native isolated PostgreSQL 17.4 over Unix socket. Synthetic prerequisites and Storage schema; not cloud Storage, PostgREST, full migration replay, worker wiring or G1 qualification.'],
  g1Item01Complete: false, g1MilestoneSatisfied: false, pushConditionSatisfied: false }
const h = new Harness(report)
await mkdir(evidence, { recursive: true })
async function source(path) {
  const bytes = await readFile(join(root, path))
  if (report.sources[path]) { h.eq(digest(bytes), report.sources[path], 'source unchanged at reuse'); return bytes.toString('utf8') }
  report.sources[path] = digest(bytes)
  const name = `${Object.keys(report.snapshots).length}-${path.split('/').at(-1)}.gz`, compressed = gzipSync(bytes)
  await writeFile(join(evidence, name), compressed, { flag: 'wx' })
  report.snapshots[path] = { path: name, sha256: digest(compressed), decodedSha256: digest(bytes) }
  return bytes.toString('utf8')
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { h.signal ??= signal })
try {
  for (const path of ['verify.mjs', 'fixture.mjs', 'database.mjs', 'README.md']) await source(`experiments/pg17-recording-finalization/${path}`)
  for (const path of ['experiments/pg17-recording-candidates/fixture.mjs', 'experiments/pg17-recording-worker/fixture.mjs',
    'experiments/pg17-routines/runtime.mjs', 'experiments/pg17-routines/runtime-pins.json']) await source(path)
  await h.start()
  await setup(h, source)
  if (mode !== 'red-without-migration') {
    await h.db.query(await source(FINALIZATION))
    report.fixture.fullMigrations.push(FINALIZATION)
  }
  await h.scenario('Native service invocation proves exact finalization RPC exists', async () => {
    const client = await h.actorClient('service_role')
    try {
      try { await client.query(RPC, [null, 'publish', 'probe', 1, 'a'.repeat(64), randomUUID(), '{}', null]); report.rpcInvocationSqlstate = '00000' }
      catch (error) { report.rpcInvocationSqlstate = error.code }
    } finally { await h.close(client) }
    report.rpcProbe = (await h.db.query('SELECT to_regprocedure($1)::text AS rpc', [SIGNATURE])).rows[0].rpc
    h.ok(report.rpcInvocationSqlstate !== '42883', 'actual service invocation must not be undefined-function 42883')
    h.eq(report.rpcProbe, 'finalize_recording_job(uuid,text,text,integer,text,uuid,jsonb,text)', 'exact finalization signature')
  })
  const modules = await compileModules(h, source)
  await databaseScenarios(h, modules.prepareRecordingSessionSeal)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message }
  process.exitCode = 1
} finally {
  // Capture log before Harness removes the cluster. All files use new UUID
  // paths and wx; failed runs are retained rather than rewritten as success.
  if (h.scratch && await exists(join(h.scratch, 'postgres.log'))) {
    const bytes = await readFile(join(h.scratch, 'postgres.log')), compressed = gzipSync(bytes)
    await writeFile(join(evidence, 'postgres.log.gz'), compressed, { flag: 'wx' })
    report.postgresLog = { path: 'postgres.log.gz', sha256: digest(compressed), decodedSha256: digest(bytes) }
  }
  await h.cleanup()
  report.cleanup.socketDirectoryRemoved = !h.config?.host || !await exists(h.config.host)
  if (report.runtime.serverPid) {
    try { process.kill(report.runtime.serverPid, 0); report.cleanup.serverPidGone = false }
    catch (error) { report.cleanup.serverPidGone = error.code === 'ESRCH' }
  }
  report.sourcesChangedDuringRun = []
  for (const [path, hash] of Object.entries(report.sources)) if (digest(await readFile(join(root, path))) !== hash) report.sourcesChangedDuringRun.push(path)
  if (report.sourcesChangedDuringRun.length || !report.cleanup.socketDirectoryRemoved ||
    (report.runtime.serverPid && !report.cleanup.serverPidGone) || report.status !== 'passed') {
    report.status = 'failed'; process.exitCode = 1
  }
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ evidence, status: report.status, assertions: report.assertions,
    scenarios: report.scenarios, cleanup: report.cleanup, error: report.error ?? null }, null, 2))
}
