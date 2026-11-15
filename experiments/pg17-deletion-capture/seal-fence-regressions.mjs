import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { digest } from '../pg17-routines/runtime.mjs'
import { save, METADATA } from '../pg17-recording-flow/fixture.mjs'
import { capture, snapshot, USER, OTHER, PROJECT } from './fixture.mjs'

const outcome = async fn => {
  try { return { code: '00000', value: await fn() } }
  catch (error) { return { code: error.code, message: error.message } }
}
const seal = async (client, manifest) => (await client.query(
  'SELECT public.seal_recording_manifest($1::jsonb) AS value', [JSON.stringify(manifest)],
)).rows[0].value

// Observe actual PostgreSQL waits, including the lock owner's granted locks.
async function wait(h, client, label, relation, mode, blocker) {
  for (let n = 0; n < 500; n++) {
    const activity = (await h.db.query(`SELECT pid,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers
      FROM pg_stat_activity WHERE pid=$1`, [client.processID])).rows[0]
    const locks = (await h.db.query(`SELECT pid,relation::regclass::text AS relation,locktype,mode,granted
      FROM pg_locks WHERE pid=ANY($1::int[]) ORDER BY pid,locktype,relation,mode`,
    [[client.processID, ...activity.blockers]])).rows
    if (activity.wait_event_type === 'Lock' && activity.blockers.includes(blocker.processID)
      && locks.some(row => row.pid === client.processID && row.relation === relation && row.mode === mode && !row.granted)) {
      const observed = { label, ...activity, locks }
      h.report.sealFence.waits.push(observed)
      h.ok(true, label)
      return observed
    }
    await delay(3)
  }
  throw new Error(`Missing actual lock wait: ${label}`)
}

async function unsealed(h, service, prepare) {
  const sessionId = randomUUID(), jobId = randomUUID()
  const storyId = (await save(service, sessionId, 'reserve', METADATA)).lookup.intent.storyId
  const bodies = [Buffer.from('synthetic-upload-before-seal-0'), Buffer.from('synthetic-upload-before-seal-1')]
  const chunks = bodies.map((body, index) => ({ index, chunkId: `chunk-${index}`, bucket: 'audio-recordings',
    objectKey: `projects/${PROJECT}/sessions/${sessionId}/${index}`, byteSize: body.length, sha256: digest(body) }))
  const prepared = prepare({ jobId, projectId: PROJECT, sessionId, actorId: USER, actorRole: 'storyteller',
    actorActive: true, storyId, mimeType: 'audio/webm', chunks })
  const manifest = { schemaVersion: 1, projectId: PROJECT, sessionId, userId: USER, storyId,
    assetId: prepared.task.assetId, mimeType: 'audio/webm', chunks: chunks.map(c => ({ ...c, storageObjectKey: `${USER}/${c.objectKey}` })) }
  h.syntheticFiles ??= new Map()
  await h.db.query("INSERT INTO storage.buckets(id,name) VALUES('audio-recordings','audio-recordings') ON CONFLICT DO NOTHING")
  for (const chunk of manifest.chunks) {
    const body = bodies[chunk.index], key = `${chunk.bucket}:${chunk.storageObjectKey}`, path = join(h.scratch, digest(key))
    await writeFile(path, body); h.syntheticFiles.set(key, path)
    await h.db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,$3::jsonb)',
      [chunk.bucket, chunk.storageObjectKey, JSON.stringify({ synthetic: true, byteSize: body.length, sha256: digest(body) })])
  }
  return manifest
}

async function captureView(client) {
  const rows = {}
  for (const table of ['deletion_requests', 'deletion_targets', 'recording_sessions', 'recording_chunks']) {
    rows[table] = (await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r => r.row)
  }
  return rows
}

export async function sealFenceRegressions(h, service, prepare, legacy = false) {
  const report = h.report.sealFence = { legacy, waits: [], observations: [] }
  const sealer = await h.actorClient('service_role', USER), deleter = await h.actorClient('service_role', OTHER), gate = await h.client()
  await h.scenario('queued seal/source race has no escaped chunk after immutable capture', async () => {
    const manifest = await unsealed(h, service, prepare)
    const entry = { name: 'queued seal first', manifest, before: await snapshot(h) }; report.observations.push(entry)
    await gate.query('BEGIN'); await gate.query('LOCK TABLE public.recording_sessions IN EXCLUSIVE MODE')
    const sealing = outcome(() => seal(sealer, manifest))
    await wait(h, sealer, 'seal queues actual SELECT session FOR UPDATE', 'recording_sessions', 'RowShareLock', gate)
    await deleter.query('BEGIN')
    const deleting = outcome(() => capture(deleter, { subjectId: manifest.storyId, requestId: randomUUID() }))
    if (legacy) {
      await wait(h, deleter, 'legacy capture queues compatible source lock', 'recording_sessions', 'ShareRowExclusiveLock', gate)
      await gate.query('COMMIT')
      entry.capture = await deleting
      h.eq(entry.capture.code, '00000', 'capture succeeds on historical SQL')
      await wait(h, sealer, 'legacy seal INSERT queues behind capture', 'recording_sessions', 'RowExclusiveLock', deleter)
    } else {
      await wait(h, deleter, 'capture waits on seal deletion SHARE fence', 'deletion_requests', 'ExclusiveLock', sealer)
      await gate.query('COMMIT')
      entry.seal = await sealing
      h.eq(entry.seal.code, '00000', 'seal commits first')
      entry.capture = await deleting
      h.eq(entry.capture.code, '00000', 'capture resumes after seal commits')
    }
    entry.captureBeforeCommit = await captureView(deleter)
    await deleter.query('COMMIT')
    entry.seal ??= await sealing
    entry.after = await snapshot(h)
    entry.replay = await capture(service, { subjectId: manifest.storyId, requestId: randomUUID() })
    entry.afterReplay = await snapshot(h)
    entry.uncapturedCoordinates = entry.after.recording_chunks.filter(c => c.session_id === manifest.sessionId)
      .filter(c => !entry.after.deletion_targets.some(t => t.deletion_request_id === entry.capture.value.id && t.bucket === c.bucket && t.object_key === c.object_key))
    h.eq(entry.seal.code, '00000', 'actual seal succeeds')
    h.eq(entry.replay, entry.capture.value, 'immutable capture replay receipt')
    h.eq(entry.afterReplay, entry.after, 'replay changes no full rows or synthetic bytes')
    h.eq(entry.after['storage.objects'], entry.before['storage.objects'], 'Storage metadata unchanged')
    h.eq(entry.after.synthetic_files, entry.before.synthetic_files, 'synthetic bytes unchanged')
    if (legacy) {
      h.eq(entry.capture.value.targetCount, 1, 'RED captures only story metadata')
      h.eq(entry.captureBeforeCommit.recording_sessions.filter(r => r.id === manifest.sessionId), [], 'RED capture sees no session')
      h.eq(entry.captureBeforeCommit.recording_chunks.filter(r => r.session_id === manifest.sessionId), [], 'RED capture sees no chunk')
      h.eq(entry.uncapturedCoordinates.length, 2, 'RED preserves concrete missed addresses')
    }
    // Same safety assertion in RED and GREEN; legacy mode must exit nonzero here.
    h.eq(entry.uncapturedCoordinates, [], 'no committed seal chunk may escape immutable deletion capture')
    h.eq(entry.capture.value.targetCount, 3, 'sealed before asset registration captures story and both actual chunks')
    h.eq(entry.after.media_assets, entry.before.media_assets, 'seal creates no asset')
    h.eq(entry.after.processing_jobs, entry.before.processing_jobs, 'seal creates no job')
  })
  await h.scenario('capture first makes waiting seal reject without source writes', async () => {
    const manifest = await unsealed(h, service, prepare)
    const entry = { name: 'capture first', manifest, before: await snapshot(h) }; report.observations.push(entry)
    await deleter.query('BEGIN')
    entry.capture = await capture(deleter, { subjectId: manifest.storyId, requestId: randomUUID() })
    const sealing = outcome(() => seal(sealer, manifest))
    const observed = await wait(h, sealer, 'seal waits on capture EXCLUSIVE fence', 'deletion_requests', 'ShareLock', deleter)
    h.eq(observed.locks.filter(row => row.pid === sealer.processID && (row.locktype === 'advisory'
      || ['projects', 'project_roles', 'stories', 'recording_sessions', 'recording_chunks', 'auth.users'].includes(row.relation))), [],
    'waiting seal has no advisory, authority or source-table locks')
    entry.captureBeforeCommit = await captureView(deleter)
    await deleter.query('COMMIT'); entry.afterCapture = await snapshot(h)
    entry.seal = await sealing; entry.after = await snapshot(h)
    h.eq(entry.seal.code, '23505', 'fresh post-wait tombstone rejects seal')
    h.eq(entry.after, entry.afterCapture, 'rejected seal changes no full row or byte')
    h.eq(entry.after.recording_sessions, entry.before.recording_sessions, 'no late session')
    h.eq(entry.after.recording_chunks, entry.before.recording_chunks, 'no late chunk')
    entry.replay = await capture(service, { subjectId: manifest.storyId, requestId: randomUUID() }); entry.afterReplay = await snapshot(h)
    h.eq(entry.replay, entry.capture, 'capture-first replay identical')
    h.eq(entry.afterReplay, entry.after, 'replay leaves all rows and bytes identical')
  })
  await h.scenario('pre-established repeatable read and serializable snapshots fail closed', async () => {
    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) {
      const manifest = await unsealed(h, service, prepare)
      const entry = { name: isolation, manifest, before: await snapshot(h) }; report.observations.push(entry)
      await sealer.query(`BEGIN ISOLATION LEVEL ${isolation}`)
      entry.snapshotEstablished = (await sealer.query('SELECT txid_current_snapshot()::text AS snapshot, count(*)::int AS tombstones FROM deletion_requests')).rows[0]
      entry.capture = await capture(deleter, { subjectId: manifest.storyId, requestId: randomUUID() })
      entry.afterCapture = await snapshot(h)
      entry.staleVisibleTombstones = (await sealer.query('SELECT count(*)::int AS count FROM deletion_requests')).rows[0].count
      h.eq(entry.staleVisibleTombstones, entry.snapshotEstablished.tombstones, 'transaction retains old snapshot after capture commits')
      entry.seal = await outcome(() => seal(sealer, manifest))
      h.eq(entry.seal.code, '22023', 'non-RC seal rejected before writes')
      await sealer.query('ROLLBACK'); entry.after = await snapshot(h)
      h.eq(entry.after, entry.afterCapture, 'non-RC rejection leaves all rows and bytes unchanged')
    }
  })
  await h.scenario('seal lock timeout rolls back and releases its locks; valid seal and replay survive', async () => {
    const manifest = await unsealed(h, service, prepare)
    const entry = { name: 'timeout and replay', manifest, before: await snapshot(h) }; report.observations.push(entry)
    await gate.query('BEGIN'); await gate.query('LOCK TABLE public.deletion_requests IN EXCLUSIVE MODE')
    await sealer.query('BEGIN'); const started = performance.now()
    const pending = outcome(() => seal(sealer, manifest))
    await wait(h, sealer, 'seal bounded wait on deletion fence', 'deletion_requests', 'ShareLock', gate)
    entry.timeout = await pending; entry.elapsedMs = performance.now() - started
    h.eq(entry.timeout.code, '55P03', 'actual lock timeout rejects seal')
    h.ok(entry.elapsedMs >= 2700 && entry.elapsedMs < 6000, 'three-second lock wait, not outer statement timeout')
    entry.abortedTransaction = await outcome(() => sealer.query('SELECT 1'))
    h.eq(entry.abortedTransaction.code, '25P02', 'timeout aborts enclosing transaction')
    await sealer.query('ROLLBACK'); await gate.query('COMMIT')
    entry.remainingLocks = (await h.db.query("SELECT locktype,mode,relation::regclass::text AS relation FROM pg_locks WHERE pid=$1 AND (locktype='advisory' OR relation IN ('deletion_requests'::regclass,'recording_sessions'::regclass,'recording_chunks'::regclass))", [sealer.processID])).rows
    h.eq(entry.remainingLocks, [], 'timeout and rollback leave no fence/source/advisory locks')
    entry.afterTimeout = await snapshot(h); h.eq(entry.afterTimeout, entry.before, 'timeout leaves all full rows and bytes unchanged')
    entry.seal = await seal(sealer, manifest); entry.afterSeal = await snapshot(h)
    h.eq(entry.seal.schemaVersion, 1, 'unchanged seal schema')
    h.eq(entry.seal.state, 'sealing', 'unchanged seal state')
    h.eq(entry.seal.manifest, manifest, 'unchanged manifest receipt')
    h.eq(entry.seal.canClearLocalDrafts, false, 'seal is not confirmation')
    entry.replay = await seal(sealer, manifest); entry.afterReplay = await snapshot(h)
    h.eq(entry.replay, entry.seal, 'valid seal replay receipt unchanged')
    h.eq(entry.afterReplay, entry.afterSeal, 'valid seal replay changes no rows or bytes')
    const conflict = { ...manifest, chunks: manifest.chunks.map((c, i) => i ? c : { ...c, sha256: 'b'.repeat(64) }) }
    entry.conflict = await outcome(() => seal(sealer, conflict))
    h.eq(entry.conflict.code, '23505', 'conflicting valid manifest still rejected')
    entry.invalid = await outcome(() => seal(sealer, { ...manifest, userId: 'not-a-uuid' }))
    h.eq(entry.invalid.code, '22023', 'invalid identity still rejected')
    entry.afterRejectedInputs = await snapshot(h); h.eq(entry.afterRejectedInputs, entry.afterSeal, 'invalid/rebound seal does not mutate')
  })
  await h.scenario('replacement seal remains volatile with fixed settings and service-only execute', async () => {
    report.routine = (await h.db.query(`SELECT provolatile,prosecdef,proconfig,proacl::text FROM pg_proc WHERE oid='public.seal_recording_manifest(jsonb)'::regprocedure`)).rows[0]
    h.eq(report.routine.provolatile, 'v', 'seal VOLATILE')
    h.eq(report.routine.prosecdef, true, 'seal SECURITY DEFINER')
    h.ok(report.routine.proconfig.includes('search_path=pg_catalog, pg_temp'), 'fixed safe search path')
    h.ok(report.routine.proconfig.includes('lock_timeout=3s'), 'function lock_timeout 3s')
    report.acl = []
    for (const role of ['anon', 'authenticated', 'metadata_reader', 'service_role']) {
      const allowed = (await h.db.query("SELECT has_function_privilege($1,'public.seal_recording_manifest(jsonb)','EXECUTE') AS allowed", [role])).rows[0].allowed
      h.eq(allowed, role === 'service_role', `${role} execute ACL`)
      const result = await h.actor(role, USER, 'SELECT public.seal_recording_manifest($1::jsonb)', ['{}'])
      h.eq(result.sqlstate, role === 'service_role' ? '22023' : '42501', `${role} actual invocation privilege`)
      report.acl.push({ role, allowed, result })
    }
  })
  await h.close(sealer); await h.close(deleter); await h.close(gate)
}
