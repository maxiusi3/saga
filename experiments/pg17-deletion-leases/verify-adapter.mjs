import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, fresh, capture, materialize, lease, snapshot, USER } from './fixture.mjs'

const require = createRequire(import.meta.url), ts = require('typescript')
const directory = join(root, 'docs/research/evidence/2026-11-06-g1-deletion-leases', `adapter-${Date.now()}-${randomUUID()}`)
const report = {
  status: 'running', assertions: 0, actorConnections: [], scenarios: [], sources: {},
  observations: [], transport: [], replays: [], expiries: [],
  command: 'node experiments/pg17-deletion-leases/verify-adapter.mjs',
  transportSubstitution: 'Only Supabase RPC transport is replaced by local pg; actual adapter is compiled unchanged.',
  livePostgrest: false, g1MilestoneSatisfied: false, canDeleteStorage: false, physicalDeletionComplete: false,
}
const h = new Harness(report)
await mkdir(directory, { recursive: true })
async function source(path) {
  const bytes = await readFile(join(root, path)); report.sources[path] = digest(bytes); return bytes.toString()
}
async function graph(path, seen = new Set()) {
  if (seen.has(path)) return
  seen.add(path)
  const text = await source(path)
  for (const [, dependency] of text.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+\.mjs)['"]/g)) {
    if (dependency.startsWith('.')) await graph(posix.normalize(posix.join(posix.dirname(path), dependency)), seen)
  }
}
function withoutLedger(rows) {
  return Object.fromEntries(Object.entries(rows).filter(([table]) => !['media_deletion_jobs', 'media_deletion_attempts'].includes(table)))
}

// This is a transport, not a model of lease behavior: every subscribed request
// executes the exact five-argument SQL helper on an actual service connection.
function applicationAdmin(service, loseAction = null) {
  return { rpc(name, args) {
    h.eq(name, 'media_deletion_job_lease', 'actual adapter selects lease RPC')
    h.eq(Object.keys(args).sort(), ['p_request_id', 'p_action', 'p_worker_id', 'p_attempt', 'p_lease_ms'].sort(), 'closed SQL arguments')
    const entry = { name, args: { ...args }, backendPid: service.processID, calls: 0, abortSignalCalls: 0, retryCalls: 0 }
    report.transport.push(entry)
    const query = {
      abortSignal(signal) {
        h.ok(signal instanceof AbortSignal, 'actual adapter supplies AbortSignal')
        entry.abortSignalCalls++; entry.signalInitiallyAborted = signal.aborted
        signal.addEventListener('abort', () => { entry.signalEventuallyAborted = true }, { once: true })
        return query
      },
      retry(enabled) {
        h.eq(enabled, false, 'actual adapter disables SDK retries')
        entry.retryCalls++; entry.retry = enabled; return query
      },
      then(resolve, reject) {
        entry.calls++
        return lease(service, args.p_request_id, args.p_action, args.p_worker_id, args.p_attempt, args.p_lease_ms)
          .then(data => {
            entry.sqlReceipt = data
            if (args.p_action === loseAction) {
              entry.responseLostAfterCommit = true
              throw new Error('synthetic response lost after SQL commit')
            }
            return { data, error: null }
          }, error => {
            entry.sqlError = { code: error.code, message: error.message }
            return { data: null, error: { code: error.code, message: error.message } }
          }).then(resolve, reject)
      },
    }
    return query
  } }
}
async function captured(service, prepare, subjectType = 'story') {
  const f = await fresh(h, service, prepare)
  await materialize(h, f)
  f.args = { requestId: randomUUID(), subjectId: subjectType === 'story' ? f.storyId : f.assetId, subjectType }
  f.capture = await capture(service, f.args); f.requestId = f.capture.id
  report.observations.push({ label: 'actual immutable capture', requestId: f.requestId, capture: f.capture, rows: await snapshot(h) })
  return f
}
async function replay(service, f) {
  const before = await snapshot(h), result = await capture(service, f.args), after = await snapshot(h)
  h.eq(result, f.capture, 'actual capture replays its original receipt')
  h.eq(after, before, 'capture replay preserves full ledger, source rows and synthetic bytes')
  report.replays.push({ requestId: f.requestId, result, before, after })
}
async function observed(label, f, fn, { error = false, readOnly = false } = {}) {
  const before = await snapshot(h), callsBefore = report.transport.length
  let result, caught
  try { result = await fn() } catch (exception) { caught = { message: exception.message } }
  const after = await snapshot(h)
  report.observations.push({ label, requestId: f.requestId, result, error: caught, callsBefore, callsAfter: report.transport.length, before, after })
  h.eq(caught, error ? { message: 'media_deletion_lease_unavailable' } : undefined, `${label}: generic failure or successful receipt`)
  h.eq(withoutLedger(after), withoutLedger(before), `${label}: complete capture, other rows and bytes unchanged`)
  if (readOnly) h.eq(after, before, `${label}: all rows unchanged`)
  if (result) {
    h.ok(Object.isFrozen(result), `${label}: actual adapter freezes receipt`)
    h.eq([result.canDeleteStorage, result.physicalDeletionComplete], [false, false], `${label}: no destructive capabilities`)
    const active = ['leased', 'running'].includes(result.state)
    h.eq(Object.keys(result).length, active ? 15 : 14, `${label}: closed application receipt`)
    if (active) h.ok(result.deadline > performance.now(), `${label}: local monotonic deadline live`)
    else h.ok(!Object.hasOwn(result, 'deadline'), `${label}: recovery has no deadline`)
  }
  return result
}
async function expire(f) {
  const rows = (await h.db.query(`SELECT clock_timestamp()::text AS before, lease_expires_at::text,
    pg_sleep(greatest(0,extract(epoch FROM lease_expires_at-clock_timestamp()))::double precision),
    clock_timestamp()::text AS after, lease_expires_at <= clock_timestamp() AS expired
    FROM public.media_deletion_jobs WHERE request_id=$1`, [f.requestId])).rows
  report.expiries.push({ requestId: f.requestId, rows })
  h.eq(rows.length, 1, 'one durable job waited on'); h.eq(rows[0].expired, true, 'real database clock reaches expiry')
}

try {
  await graph('experiments/pg17-deletion-leases/verify-adapter.mjs')
  await h.start(); await setup(h, source)
  const compiled = ts.transpileModule(await source('packages/web/src/lib/server/media-deletion-lease.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
  })
  h.eq(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, 'actual adapter transpiles without errors')
  h.ok(!/require\(/.test(compiled.outputText), 'actual adapter has no runtime dependency substitution')
  const artifact = join(directory, 'adapter.compiled.cjs')
  await writeFile(artifact, compiled.outputText)
  report.compiledAdapter = { artifact: 'adapter.compiled.cjs', sha256: digest(compiled.outputText), typescriptVersion: ts.version }
  const adapter = require(artifact)
  const { claimMediaDeletionJob: claim, startMediaDeletionJob: start, heartbeatMediaDeletionJob: heartbeat,
    checkMediaDeletionJobLease: check, recoverMediaDeletionJob: recover } = adapter
  const { prepareRecordingSessionSeal: prepare } = await compileModules(h, source)
  const service = await h.actorClient('service_role', USER), options = { admin: applicationAdmin(service) }

  await h.scenario('actual adapter claim/start/replay/heartbeat/check and conservative running recovery', async () => {
    const f = await captured(service, prepare)
    const owned = await observed('claim', f, () => claim(f.requestId, 'adapter-worker', 1500, options))
    h.eq([owned.state, owned.attempt], ['leased', 1], 'first claim')
    await observed('check leased', f, () => check(owned, options), { readOnly: true })
    const running = await observed('start', f, () => start(owned, options))
    h.eq(running.state, 'running', 'start runs')
    await observed('running start replay', f, () => start(running, options), { readOnly: true })
    const renewed = await observed('shorter heartbeat', f, () => heartbeat(running, 1000, options))
    h.eq(renewed.leaseExpiresAt, running.leaseExpiresAt, 'shorter heartbeat preserves server expiry')
    await observed('check running', f, () => check(renewed, options), { readOnly: true })
    await observed('premature recovery', f, () => recover(f.requestId, options), { error: true, readOnly: true })
    await replay(service, f); await expire(f)
    const recovered = await observed('expired running recovery', f, () => recover(f.requestId, options))
    h.eq(recovered.state, 'outcome_unknown', 'running cannot be retried')
    await observed('recovery replay', f, () => recover(f.requestId, options), { readOnly: true })
    await observed('unknown cannot claim', f, () => claim(f.requestId, 'new-worker', 1000, options), { error: true, readOnly: true })
    await replay(service, f)
  })

  await h.scenario('lost undispatched claim survives connection restart and new worker recovers', async () => {
    const oldService = await h.actorClient('service_role', USER)
    const f = await captured(oldService, prepare, 'media_asset')
    await observed('lost claim result', f, () => claim(f.requestId, 'old-process', 1000, { admin: applicationAdmin(oldService, 'claim') }), { error: true })
    const oldPid = oldService.processID
    await h.close(oldService); await expire(f)
    const restarted = await h.actorClient('service_role', USER), restartedOptions = { admin: applicationAdmin(restarted) }
    h.ok(restarted.processID !== oldPid, 'worker restart uses a new native connection')
    report.restart = { oldPid, newPid: restarted.processID, requestId: f.requestId }
    const recovered = await observed('new process recovers undispatched', f, () => recover(f.requestId, restartedOptions))
    h.eq([recovered.state, recovered.attempt], ['retry_wait', 1], 'undispatched claim becomes retryable')
    const next = await observed('new worker claims next attempt', f, () => claim(f.requestId, 'new-process', 1000, restartedOptions))
    h.eq([next.workerId, next.attempt, next.state], ['new-process', 2, 'leased'], 'attempt and worker advance')
    await observed('new worker checks', f, () => check(next, restartedOptions), { readOnly: true })
    const ledger = (await snapshot(h)).media_deletion_attempts.filter(row => row.request_id === f.requestId)
    h.eq(ledger.map(row => [row.attempt_no, row.state, row.worker_id]), [[1, 'expired', 'old-process'], [2, 'leased', 'new-process']], 'whole attempt history survives restart')
    await replay(restarted, f)
  })

  await h.scenario('lost start is observable as running and becomes outcome_unknown after expiry', async () => {
    const f = await captured(service, prepare)
    const owned = await observed('claim before lost start', f, () => claim(f.requestId, 'lost-start-worker', 1000, options))
    await observed('start committed response lost', f, () => start(owned, { admin: applicationAdmin(service, 'start') }), { error: true })
    const checked = await observed('old leased receipt observes running', f, () => check(owned, options), { readOnly: true })
    h.eq(checked.state, 'running', 'leased to running check reconciles a lost start response')
    await replay(service, f); await expire(f)
    const callsBefore = report.transport.length
    await observed('expired old local receipt rejected before transport', f, () => heartbeat(checked, 1000, options), { error: true, readOnly: true })
    h.eq(report.transport.length, callsBefore, 'expired local ownership starts no RPC')
    const recovered = await observed('lost start outcome unknown', f, () => recover(f.requestId, options))
    h.eq(recovered.state, 'outcome_unknown', 'lost start never returns to retry_wait')
    await observed('lost start cannot reclaim', f, () => claim(f.requestId, 'other-worker', 1000, options), { error: true, readOnly: true })
    await replay(service, f)
  })

  for (const entry of report.transport) {
    h.eq([entry.calls, entry.abortSignalCalls, entry.retryCalls, entry.retry], [1, 1, 1, false], 'one bounded no-retry RPC per operation')
    h.eq(entry.signalEventuallyAborted, true, 'operation disposes its transport signal')
  }
  report.finalRows = await snapshot(h)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message }
  process.exitCode = 1
} finally {
  await h.cleanup()
  if (report.status !== 'passed') process.exitCode = 1
  await writeFile(join(directory, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ directory, status: report.status, assertions: report.assertions, error: report.error, cleanup: report.cleanup }, null, 2))
}
