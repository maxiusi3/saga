import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { USER, PROJECT, STORY, OTHER, rpc as leaseRpc } from '../pg17-recording-worker/fixture.mjs'
import { args as finalArgs, rpc as finalize, state, PERMANENT_CODES } from '../pg17-recording-finalization/fixture.mjs'
import { fresh, input, allState } from './fixture.mjs'
import { statusHttp } from './http.mjs'
import { digest } from '../pg17-routines/runtime.mjs'

const require = createRequire(import.meta.url), ts = require('typescript')
async function compileTree(h, source) {
  const compiled = new Set(), compiledRoot = join(h.scratch, 'compiled')
  async function compile(name) {
    if (compiled.has(name)) return
    compiled.add(name)
    const text = await source(`packages/web/src/${name}.ts`)
    const result = ts.transpileModule(text, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    }, reportDiagnostics: true })
    h.eq(result.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${name} transpiles`)
    for (const match of result.outputText.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const target = match[1]
      if (target.startsWith('@/')) await compile(target.slice(2))
      else if (target.startsWith('.')) await compile(posix.normalize(posix.join(posix.dirname(name), target)))
    }
    const output = result.outputText.replace(/require\((['"])@\/([^'"]+)\1\)/g,
      (_match, _quote, alias) => `require(${JSON.stringify(join(compiledRoot, alias))})`)
    const destination = join(compiledRoot, `${name}.js`)
    await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, output)
  }
  for (const name of ['recording-session-status', 'recording-job-finalization']) await compile(`lib/server/${name}`)
  h.report.productionCompilerGraph = [...compiled].sort()
  return { ...require(join(compiledRoot, 'lib/server/recording-session-status.js')),
    ...require(join(compiledRoot, 'lib/server/recording-job-finalization.js')) }
}

export async function applicationScenarios(h, base, source, evidence, ownHttp) {
  for (const path of ['package-lock.json', 'node_modules/@supabase/supabase-js/package.json', 'node_modules/@supabase/postgrest-js/package.json']) await source(path)
  h.report.sdkVersions = { supabase: require('@supabase/supabase-js/package.json').version, postgrest: require('@supabase/postgrest-js/package.json').version, typescript: ts.version }
  const modules = await compileTree(h, source), service = await h.actorClient('service_role', USER)
  const http = await statusHttp(h); ownHttp(http)
  const make = async options => {
    const f = await fresh(h, service, base.prepareRecordingSessionSeal, options)
    const copies = join(h.scratch, 'retained-copies', f.sessionId)
    await mkdir(copies, { recursive: true })
    f.copyPaths = ['local-draft.bin', 'source-object.bin', ...(f.candidateId ? ['candidate-object.bin'] : [])].map(name => join(copies, name))
    for (const path of f.copyPaths) await writeFile(path, f.bytes, { flag: 'wx' })
    const artifact = `synthetic-${f.sessionId}.bin`
    await writeFile(join(evidence, artifact), f.bytes, { flag: 'wx' })
    ;(h.report.copyFixtures ??= []).push({ sessionId: f.sessionId, artifact, byteSize: f.bytes.length, sha256: digest(f.bytes),
      roles: f.copyPaths.map(path => path.split('/').at(-1)), synthetic: true })
    return f
  }
  async function copyState(f) {
    return Promise.all(f.copyPaths.map(async path => {
      const bytes = await readFile(path)
      return { role: path.split('/').at(-1), byteSize: bytes.length, sha256: digest(bytes) }
    }))
  }
  async function read(f, { name = 'normal', mode = 'normal', expected = 'succeeded', values = input(f), timeoutMs = 2000, preAborted = false } = {}) {
    const controller = new AbortController()
    if (preAborted) controller.abort()
    http.configure({ name, mode, checkpoint: () => controller.abort() })
    const before = await allState(h), copiesBefore = await copyState(f), first = http.events.length, firstTransport = http.transports.length, began = performance.now()
    let receipt, error
    try { receipt = await modules.readRecordingSessionStatus(values, { admin: http.admin, signal: controller.signal, timeoutMs }) }
    catch (caught) { error = caught }
    const elapsedMs = performance.now() - began
    await http.drain()
    const count = http.events.length
    await delay(30)
    const after = await allState(h), copiesAfter = await copyState(f), events = http.events.slice(first)
    h.eq(after, before, 'actual production read leaves all full tuples and retained copies unchanged')
    h.eq(copiesAfter, copiesBefore, 'all actual synthetic local/source/candidate files retain exact bytes')
    h.eq(http.events.length, count, 'no delayed fallback, replay or retry after status returns')
    h.eq(events.length, preAborted ? 0 : 1, 'at most one actual status RPC request')
    h.eq(http.transports.length - firstTransport, preAborted ? 0 : 1, 'actual installed SDK performs at most one native fetch')
    h.ok(events.every(event => event.path === '/rest/v1/rpc/read_recording_session_snapshot' && event.readOnly), 'status only enters actual READ ONLY transaction')
    if (expected === 'unavailable') {
      h.eq(receipt, undefined, 'untrusted or unavailable observation never returns receipt')
      h.eq(error?.message, 'recording_status_unavailable', 'SDK/SQL/body diagnostics stay non-disclosing')
    } else {
      h.eq(error?.message ?? null, null, 'production strict validator accepts actual native snapshot')
      h.eq(receipt.state, expected, 'compact receipt classifies persisted outcome')
      h.eq(Object.keys(receipt).sort(), ['schemaVersion', 'projectId', 'sessionId', 'assetId', 'jobId', 'manifestSha256', 'observedAt', 'state', 'content', 'errorCode', 'finishedAt', 'canClearLocalDrafts'].sort(), 'exact compact 12-key receipt')
      h.eq(receipt.canClearLocalDrafts, false, 'every status retains local drafts')
      h.ok(!/bucket|objectKey|candidateId|workerId|https?:|SECRET/.test(JSON.stringify(receipt)), 'no private location, raw row or diagnostics escape')
      if (expected === 'succeeded') h.eq(receipt.content, f.output, 'content uses exact verified candidate metadata')
      else h.eq([receipt.content, receipt.finishedAt, receipt.errorCode], expected === 'unresolved' ? [null, null, null] : [null, receipt.finishedAt, f.failureCode], 'non-success receipt keeps bounded content/error fields')
    }
    if (mode === 'timeout' || mode === 'abort') {
      ;(h.report.interruptionObservations ??= []).push({ mode, elapsedMs, timeoutMs, callerAborted: controller.signal.aborted,
        fetchAborted: http.transports.at(-1).aborted, peerClosed: events[0].peerClosed, responseFinished: events[0].responseFinished })
      if (mode === 'timeout') {
        h.eq(controller.signal.aborted, false, 'timeout must occur without caller cancellation')
        h.ok(elapsedMs >= timeoutMs - 10, 'native timeout consumes configured deadline within scheduling tolerance')
      } else h.eq(controller.signal.aborted, true, 'explicit abort uses caller cancellation')
      h.ok(elapsedMs < 1500, 'abort/timeout returns within bounded wall clock')
      h.eq(http.transports.at(-1).aborted, true, 'caller or timeout abort reaches native fetch signal')
      h.eq(events[0].peerClosed, true, 'native peer observes abort')
      h.eq(events[0].responseFinished, false, 'peer never finished a normal response before interruption')
    }
    h.report.tuples.push({ label: name, before, after, copiesBefore, copiesAfter, receipt, error: error?.message ?? null, elapsedMs, requests: events.length })
    return { receipt, error }
  }
  await h.scenario('Committed publish with lost native response reconciles through actual reader without a new mutation', async () => {
    const f = await make(), before = await state(h, f)
    http.configure({ name: 'publish-response-loss', mode: 'publish-response-loss' })
    let error
    try { await modules.publishRecordingJob(f.lease, f.candidate, { admin: http.admin, timeoutMs: 2000 }) }
    catch (caught) { error = caught }
    await http.drain()
    h.eq(error?.message, 'recording_finalization_unavailable', 'actual finalizer cannot claim success after lost response')
    h.eq(http.events.length, 1, 'lost publication performs exactly one mutation request')
    h.eq(http.events[0].committed, true, 'native server commits actual atomic publication before destroying response')
    const published = await state(h, f)
    h.eq([published.job.state, published.asset.state, published.session.state], ['succeeded', 'ready', 'cloud_confirmed'], 'real PG holds full success tuple')
    h.eq([published.chunks, published.candidates], [before.chunks, before.candidates], 'publication retains immutable source and candidate evidence')
    await read(f, { name: 'reconcile-lost-publish' })
    h.eq(http.events.filter(event => event.path.includes('finalize_recording_job')).length, 1, 'explicit read never replays terminal mutation')
  })
  await h.scenario('Every permanent failure and legitimate nonterminal checkpoint classifies without mutation', async () => {
    for (const code of PERMANENT_CODES) {
      const f = await make({ candidate: false }); f.failureCode = code
      await finalize(service, finalArgs(f, 'fail', code))
      await read(f, { name: code, expected: 'failed' })
    }
    const queued = await make({ running: false, candidate: false })
    await read(queued, { name: 'queued', expected: 'unresolved' })
    await h.db.query('DELETE FROM processing_jobs WHERE id=$1', [queued.jobId])
    await read(queued, { name: 'asset-before-job', expected: 'unresolved' })
    await h.db.query('DELETE FROM media_assets WHERE id=$1', [queued.assetId])
    const sealed = await read(queued, { name: 'sealed-before-registration', expected: 'unresolved' })
    h.eq(sealed.receipt.jobId, null, 'no registered job returns null jobId')
    const running = await make({ candidate: false, ttl: 1000 })
    await read(running, { name: 'running-live', expected: 'unresolved' })
    await delay(1050)
    h.eq((await h.db.query('SELECT lease_expires_at < clock_timestamp() AS expired FROM processing_jobs WHERE id=$1', [running.jobId])).rows[0].expired, true, 'actual database lease expires')
    await read(running, { name: 'running-expired', expected: 'unresolved' })
    await leaseRpc(service, running.jobId, 'recover')
    await read(running, { name: 'explicit-outcome-unknown', expected: 'unresolved' })
  })
  await h.scenario('Malformed receipts, read errors, abort and timeout remain bounded and non-disclosing', async () => {
    const f = await make(); await finalize(service, finalArgs(f))
    for (const mode of ['bad-envelope', 'bad-identity', 'read-error', 'abort', 'timeout']) await read(f, { name: mode, mode, expected: 'unavailable', timeoutMs: mode === 'timeout' ? 100 : 2000 })
    await read(f, { name: 'already-aborted', expected: 'unavailable', preAborted: true })
    for (const [field, value] of [['actorId', OTHER], ['projectId', OTHER], ['manifestSha256', 'f'.repeat(64)]]) await read(f, { name: `wrong-${field}`, expected: 'unavailable', values: { ...input(f), [field]: value } })
    await h.db.query("UPDATE project_roles SET status='inactive' WHERE user_id=$1 AND project_id=$2", [USER, PROJECT])
    await read(f, { name: 'revoked-role', expected: 'unavailable' })
    await h.db.query("UPDATE project_roles SET status='active' WHERE user_id=$1 AND project_id=$2", [USER, PROJECT])
    await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)', [PROJECT, STORY, USER])
    await read(f, { name: 'story-tombstone', expected: 'unavailable' })
    await h.db.query('DELETE FROM deletion_requests WHERE project_id=$1 AND subject_id=$2', [PROJECT, STORY])
    for (const [name, sql, values, restore] of [
      ['foreign-candidate', 'UPDATE recording_output_candidates SET session_id=$1 WHERE id=$2', [OTHER, f.candidateId], [f.sessionId, f.candidateId]],
      ['partial-terminal', 'UPDATE recording_sessions SET confirmed_at=$1 WHERE id=$2', [null, f.sessionId], [(await state(h, f)).session.confirmed_at, f.sessionId]],
      ['wrong-job-owner', 'UPDATE processing_jobs SET created_by=$1 WHERE id=$2', [OTHER, f.jobId], [USER, f.jobId]],
    ]) { await h.db.query(sql, values); await read(f, { name, expected: 'unavailable' }); await h.db.query(sql, restore) }
  })
  h.eq(http.events.filter(event => event.path.includes('finalize_recording_job')).length, 1, 'only explicit lost publication request mutates across HTTP scenarios')
  h.eq(h.clients.size, 2, 'all HTTP request PG clients drained')
  await h.close(service)
}
