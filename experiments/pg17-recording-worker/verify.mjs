import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'
import { once } from 'node:events'
import { setup, LEASE, RPC, USER, compileModules, fixture, state } from './fixture.mjs'
import { databaseScenarios } from './database.mjs'
import { applicationScenarios } from './application.mjs'

const mode = process.argv.includes('--without-migration') ? 'red-without-migration' : process.argv.includes('--sql-only') ? 'sql-only' : 'verify'
const runId = `${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
const evidence = join(root, 'docs/research/evidence/2026-11-03-g1-worker-lease', runId)
const report = {
  startedAt: new Date().toISOString(), mode, status: 'running', assertions: 0,
  actorConnections: [], scenarios: [], sources: {}, snapshots: {},
  limits: ['Synthetic isolated PG17.4 cluster; selected exact foundation DDL and full seal/lease migrations, not full migration chain or live Supabase.'],
  g1Item01Complete: false, g1MilestoneSatisfied: false, pushConditionSatisfied: false,
}
const h = new Harness(report)
const children = new Set()
await mkdir(evidence, { recursive: true })
async function source(path) {
  const bytes = await readFile(join(root, path))
  if (report.sources[path]) {
    h.eq(digest(bytes), report.sources[path], 'previously snapshotted source stays unchanged during run')
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
  for (const file of ['experiments/pg17-recording-worker/verify.mjs', 'experiments/pg17-recording-worker/fixture.mjs',
    'experiments/pg17-recording-worker/database.mjs', 'experiments/pg17-recording-worker/worker-child.mjs',
    'experiments/pg17-recording-worker/application.mjs',
    'experiments/pg17-recording-worker/README.md',
    'experiments/pg17-routines/runtime.mjs', 'experiments/pg17-routines/runtime-pins.json']) await source(file)
  await h.start()
  await setup(h, source)
  const modules = await compileModules(h, source)
  const service = await h.actorClient('service_role', USER)
  const legacy = await fixture(h, service, modules.prepareRecordingSessionSeal)
  await service.query("INSERT INTO processing_attempts(job_id,attempt_no,worker_id) VALUES($1,1,'legacy-default')", [legacy.jobId])
  const legacyBefore = await state(h, legacy.jobId)
  await h.close(service)
  if (mode !== 'red-without-migration') { await h.db.query(await source(LEASE)); report.fixture.fullMigrations.push(LEASE) }
  await h.scenario('Exact five-action lease RPC exists (missing-feature RED before migration)', async () => {
    const client = await h.actorClient('service_role')
    try {
      try { await client.query(RPC, [null, 'claim', 'probe', null, 1000]); report.rpcInvocationSqlstate = '00000' }
      catch (error) { report.rpcInvocationSqlstate = error.code }
    } finally { await h.close(client) }
    const result = await h.db.query("SELECT to_regprocedure('public.recording_job_lease(uuid,text,text,integer,integer)')::text AS rpc")
    report.rpcProbe = result.rows[0].rpc
    h.ok(report.rpcInvocationSqlstate !== '42883', 'actual service RPC invocation must not be undefined-function 42883')
    h.eq(result.rows[0].rpc, 'recording_job_lease(uuid,text,text,integer,integer)', 'lease RPC must exist')
  })
  await h.scenario('Lease migration preserves old attempts and nonlease dispatched_at default', async () => {
    h.eq(await state(h, legacy.jobId), legacyBefore, 'existing legacy rows remain byte-for-byte equal')
    const defaultExpression = (await h.db.query(`SELECT pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='public.processing_attempts'::regclass AND a.attname='dispatched_at'`)).rows[0].expression
    h.eq(defaultExpression, 'now()', 'existing nonlease callers retain dispatched_at default now()')
  })
  await databaseScenarios(h, modules.prepareRecordingSessionSeal, children)
  if (mode === 'verify') await applicationScenarios(h, source)
  else report.limits.push('SQL-only or RED invocation: application, transport and native FFmpeg integration not exercised in this run.')
  h.eq((await h.db.query("SELECT count(*)::int AS n FROM media_assets WHERE state='ready'")).rows[0].n,0,'including application: zero ready assets')
  h.eq((await h.db.query("SELECT count(*)::int AS n FROM processing_jobs WHERE state='succeeded' OR result_ref IS NOT NULL")).rows[0].n,0,'including application: zero published success')
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message }
  process.exitCode = 1
} finally {
  await Promise.all([...children].map(async child => { const exit=once(child,'exit');child.kill('SIGKILL');await exit }))
  if(h.db){
    try { report.finalDatabase=(await h.db.query(`SELECT jsonb_build_object(
      'jobs',(SELECT jsonb_agg(to_jsonb(j) ORDER BY j.id) FROM public.processing_jobs j),
      'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.job_id,a.attempt_no) FROM public.processing_attempts a),
      'readyAssets',(SELECT count(*) FROM public.media_assets WHERE state='ready'),
      'confirmedSessions',(SELECT count(*) FROM public.recording_sessions WHERE confirmed_at IS NOT NULL OR state='cloud_confirmed')) AS state`)).rows[0].state }
    catch { report.finalDatabaseUnavailable=true }
  }
  if (h.scratch && await exists(join(h.scratch, 'postgres.log'))) {
    const log = await readFile(join(h.scratch, 'postgres.log'))
    const compressed=gzipSync(log)
    await writeFile(join(evidence, 'postgres.log.gz'), compressed, { flag: 'wx' })
    report.postgresLog = { path:'postgres.log.gz', sha256:digest(compressed), decodedSha256:digest(log) }
  }
  await h.cleanup()
  report.cleanup.childrenRemaining = children.size
  report.cleanup.socketDirectoryRemoved = !h.config?.host || !await exists(h.config.host)
  try { process.kill(report.runtime.serverPid,0);report.cleanup.serverPidGone=false } catch(error) { report.cleanup.serverPidGone=error.code==='ESRCH' }
  const childPids=[...new Set([...(report.childEvents??[]).map(event=>event.pid),...(report.nativeDecoders??[]).map(event=>event.pid)])].filter(Boolean)
  report.cleanup.childPidsGone=childPids.every(pid=>{try{process.kill(pid,0);return false}catch(error){return error.code==='ESRCH'}})
  report.sourcesChangedDuringRun=[]
  for(const [path,hash] of Object.entries(report.sources))if(digest(await readFile(join(root,path)))!==hash)report.sourcesChangedDuringRun.push(path)
  if(report.sourcesChangedDuringRun.length||!report.cleanup.socketDirectoryRemoved||!report.cleanup.serverPidGone||!report.cleanup.childPidsGone||children.size){report.status='failed';process.exitCode=1}
  if(report.status!=='passed')process.exitCode=1
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ evidence, status: report.status, assertions: report.assertions, scenarios: report.scenarios,
    cleanup: report.cleanup, error: report.error ?? null }, null, 2))
}
