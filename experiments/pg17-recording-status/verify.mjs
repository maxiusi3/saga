import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { join, relative, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { gzipSync } from 'node:zlib'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, FINALIZATION } from '../pg17-recording-finalization/fixture.mjs'
import { SNAPSHOT, SIGNATURE, RPC } from './fixture.mjs'
import { databaseScenarios } from './database.mjs'

const require = createRequire(import.meta.url)
const mode = process.argv.includes('--without-migration') ? 'red-without-migration' : process.argv.includes('--http') ? 'native-http' : 'native-sql'
const evidence = join(root, 'docs/research/evidence/2026-11-05-g1-recording-status', `${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`)
const report = { startedAt: new Date().toISOString(), mode, command: `node experiments/pg17-recording-status/verify.mjs ${process.argv.slice(2).join(' ')}`.trim(), status: 'running', assertions: 0,
  actorConnections: [], scenarios: [], sources: {}, snapshots: {}, tuples: [],
  limits: ['Native isolated PostgreSQL 17.4 with synthetic prerequisites and candidate data. Local PostgREST-shaped HTTP substitute, not managed PostgREST/Storage, device or cloud G1 qualification.',
    'A receipt observes one statement snapshot. Later revoke/delete can change authorization; no access URL or cleanup permission.',
    'This slice reuses prior terminal worker byte verification and does not rerun FFmpeg.'],
  g1Item01Complete: false, g1MilestoneSatisfied: false, pushConditionSatisfied: false }
const h = new Harness(report)
await mkdir(evidence, { recursive: true })
async function source(path) {
  const bytes = await readFile(join(root, path))
  if (report.sources[path]) { h.eq(digest(bytes), report.sources[path], `source unchanged at reuse: ${path}`); return bytes.toString() }
  report.sources[path] = digest(bytes)
  const name = `${Object.keys(report.snapshots).length}-${path.split('/').at(-1)}.gz`, compressed = gzipSync(bytes)
  await writeFile(join(evidence, name), compressed, { flag: 'wx' })
  report.snapshots[path] = { path: name, sha256: digest(compressed), decodedSha256: digest(bytes) }
  return bytes.toString()
}
let http
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { h.signal ??= signal })
try {
  for (const path of ['verify.mjs', 'fixture.mjs', 'database.mjs', 'README.md']) await source(`experiments/pg17-recording-status/${path}`)
  for (const path of ['experiments/pg17-recording-finalization/fixture.mjs', 'experiments/pg17-recording-candidates/fixture.mjs',
    'experiments/pg17-recording-worker/fixture.mjs', 'experiments/pg17-routines/runtime.mjs', 'experiments/pg17-routines/runtime-pins.json']) await source(path)
  await h.start(); await setup(h, source)
  await h.db.query(await source(FINALIZATION)); report.fixture.fullMigrations.push(FINALIZATION)
  const tableAcls = async () => (await h.db.query("SELECT n.nspname,c.relname,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') AND c.relkind='r' ORDER BY 1,2")).rows
  const beforeAcls = await tableAcls()
  if (mode !== 'red-without-migration') { await h.db.query(await source(SNAPSHOT)); report.fixture.fullMigrations.push(SNAPSHOT) }
  h.eq(await tableAcls(), beforeAcls, 'snapshot migration never widens any table ACL')
  await h.scenario('Actual service role invocation proves snapshot RPC exists', async () => {
    const client = await h.actorClient('service_role')
    try {
      try { await client.query(RPC, [null, null, null, 'a'.repeat(64)]); report.rpcInvocationSqlstate = '00000' }
      catch (error) { report.rpcInvocationSqlstate = error.code; report.rpcInvocationMessage = error.message }
    } finally { await h.close(client) }
    report.rpcProbe = (await h.db.query('SELECT to_regprocedure($1)::text AS rpc', [SIGNATURE])).rows[0].rpc
    h.ok(report.rpcInvocationSqlstate !== '42883', 'actual service invocation must not be undefined-function 42883')
    h.eq(report.rpcProbe, 'read_recording_session_snapshot(uuid,uuid,uuid,text)', 'exact four argument signature')
  })
  const modules = await compileModules(h, source)
  if (mode === 'native-http') {
    for (const path of ['http.mjs', 'application.mjs']) await source(`experiments/pg17-recording-status/${path}`)
    const { applicationScenarios } = await import('./application.mjs')
    await applicationScenarios(h, modules, source, evidence, value => { http = value })
  } else await databaseScenarios(h, modules.prepareRecordingSessionSeal)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message }; process.exitCode = 1
} finally {
  if (http) try { await http.close() } catch (error) { report.status = 'failed'; report.httpCleanupError = error.label ?? error.message; process.exitCode = 1 }
  // Snapshot all actually loaded CommonJS dependencies and generated runtime.
  report.compiledRuntimeSnapshots = []
  // Node resolves macOS /tmp symlinks before adding modules to require.cache.
  const canonicalScratch = h.scratch ? await realpath(h.scratch) : null
  for (const file of Object.keys(require.cache)) {
    const path = relative(root, file)
    if (!path.startsWith('..') && !isAbsolute(path)) await source(path)
    else if (canonicalScratch && file.startsWith(`${join(canonicalScratch, 'compiled')}/`)) {
      const bytes = await readFile(file), compressed = gzipSync(bytes)
      const name = `runtime-${Object.keys(report.snapshots).length}-${file.split('/').at(-1)}.gz`
      await writeFile(join(evidence, name), compressed, { flag: 'wx' })
      report.snapshots[relative(canonicalScratch, file)] = { path: name, sha256: digest(compressed), decodedSha256: digest(bytes) }
      report.compiledRuntimeSnapshots.push(relative(canonicalScratch, file))
    }
  }
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
  if (mode !== 'red-without-migration' && (report.compiledRuntimeSnapshots.length === 0 ||
    report.productionCompilerGraph?.some(name => !report.compiledRuntimeSnapshots.includes(`compiled/${name}.js`)))) {
    report.status = 'failed'; process.exitCode = 1
    report.error = { code: 'ASSERT_FAILED', label: 'actual loaded compiled runtime must have retained source snapshots' }
  }
  report.sourcesChangedDuringRun = []
  for (const [path, hash] of Object.entries(report.sources)) if (digest(await readFile(join(root, path))) !== hash) report.sourcesChangedDuringRun.push(path)
  if (report.sourcesChangedDuringRun.length || !report.cleanup.socketDirectoryRemoved ||
    (report.runtime.serverPid && !report.cleanup.serverPidGone) || report.status !== 'passed') { report.status = 'failed'; process.exitCode = 1 }
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ evidence, status: report.status, assertions: report.assertions, scenarios: report.scenarios,
    cleanup: report.cleanup, httpCleanup: report.httpCleanup, error: report.error ?? null }, null, 2))
}
