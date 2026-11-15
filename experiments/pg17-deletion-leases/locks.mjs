import { performance } from 'node:perf_hooks'
import { randomUUID } from 'node:crypto'
import { lease, snapshot, fresh, materialize, capture, USER, PROJECT } from './fixture.mjs'
import { captured, replay, receipt, WORKER, withoutLedger } from './scenarios.mjs'
const settle = promise => promise.then(value => ({ code: '00000', value }), error => ({ code: error.code ?? 'ERROR' }))
async function observedWait(h, client, type, relation = null) {
  const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
  return async () => {
    const start = performance.now()
    while (performance.now() - start < 2000) {
      const rows = (await h.db.query(`SELECT a.pid,a.wait_event_type,a.wait_event,l.locktype,l.mode,l.granted,l.relation::regclass::text AS relation,l.classid,l.objid,pg_blocking_pids(a.pid) AS blockers
        FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid WHERE a.pid=$1 AND NOT l.granted`, [pid])).rows
      const row = rows.find(r => r.wait_event_type === 'Lock' && r.locktype === type && (relation === null || r.relation === relation))
      if (row) { h.report.lockObservations ??= []; h.report.lockObservations.push({ ...row, observedAt: new Date().toISOString() }); h.ok(row.blockers.length > 0, 'actual PostgreSQL blocking PID observed'); return row }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw Object.assign(new Error('expected actual lock wait'), { code: 'WAIT_NOT_OBSERVED' })
  }
}
export async function locks(h, service, prepare) {
  await h.scenario('same-request competing claims serialize but different requests proceed', async () => {
    const f = await captured(h, service, prepare), other = await captured(h, service, prepare)
    await replay(h, service, f); await replay(h, service, other)
    const owner = await h.actorClient('service_role', USER), contender = await h.actorClient('service_role', USER)
    const waiting = await observedWait(h, contender, 'advisory'), before = await snapshot(h)
    await owner.query('BEGIN')
    try {
      const first = await lease(owner, f.requestId, 'claim', WORKER, null, 120000)
      const pending = settle(lease(contender, f.requestId, 'claim', 'competing-worker', null, 120000))
      await waiting()
      const independent = await lease(service, other.requestId, 'claim', 'independent-worker', null, 120000)
      receipt(h, independent, 'leased', 1, 'independent-worker')
      await owner.query('COMMIT')
      const result = await pending
      h.eq(result.code, '23505', 'second same-request claim loses after first commits')
      const after = await snapshot(h)
      h.eq(withoutLedger(after), withoutLedger(before), 'concurrent claims preserve capture and bytes')
      h.eq(after.media_deletion_jobs.filter(j => j.request_id === f.requestId).length, 1, 'one job owner')
      h.eq(after.media_deletion_attempts.filter(a => a.request_id === f.requestId).length, 1, 'one claimed attempt')
      h.report.concurrent = { before, after, first, independent, contender: result }
    } finally { await owner.query('ROLLBACK'); await h.close(owner); await h.close(contender) }
    await replay(h, service, f); await replay(h, service, other)
  })
  await h.scenario('lease waits behind actual capture and sees newly committed capture', async () => {
    const f = await fresh(h, service, prepare); await materialize(h, f)
    f.args = { subjectId: f.storyId, requestId: randomUUID() }; f.requestId = f.args.requestId
    // Admin lock holder can snapshot all uncommitted private prerequisite rows;
    // the contender remains a real unprivileged service-role connection.
    const blocker = await h.client(), contender = await h.actorClient('service_role', USER)
    const waiting = await observedWait(h, contender, 'relation', 'deletion_requests'), before = await snapshot(h)
    await blocker.query('BEGIN')
    try {
      f.capture = await capture(blocker, f.args)
      const captureRows = await snapshot({ ...h, db: blocker })
      const pending = settle(lease(contender, f.requestId, 'claim', WORKER, null, 120000))
      const lock = await waiting()
      h.eq(lock.mode, 'ShareLock', 'first requested capture fence is SHARE')
      await blocker.query('COMMIT')
      const outcome = await pending
      h.eq(outcome.code, '00000', 'post-wait request snapshot is fresh')
      receipt(h, outcome.value, 'leased', 1)
      const after = await snapshot(h)
      h.report.captureWait = { before, captureRows, outcome, after }
      h.eq(withoutLedger(after), withoutLedger(captureRows), 'waiting claim preserves newly committed actual capture')
    } finally { await blocker.query('ROLLBACK'); await h.close(blocker); await h.close(contender) }
    await replay(h, service, f)
  })
  await h.scenario('target SHARE wait and queued capture tampering fail without a job', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    for (const relation of ['deletion_requests', 'deletion_targets']) {
      const blocker = await h.client(), contender = await h.actorClient('service_role', USER)
      const waiting = await observedWait(h, contender, 'relation', relation)
      await blocker.query('BEGIN')
      try {
        await blocker.query(`LOCK TABLE ${relation} IN EXCLUSIVE MODE`)
        const pending = settle(lease(contender, f.requestId, 'claim', WORKER, null, 120000))
        const lock = await waiting(); h.eq(lock.mode, 'ShareLock', 'capture tables use SHARE fence')
        if (relation === 'deletion_requests') await blocker.query("UPDATE deletion_requests SET error_code='changed-during-wait' WHERE id=$1", [f.requestId])
        else await blocker.query("UPDATE deletion_targets SET error_code='changed-during-wait' WHERE deletion_request_id=$1", [f.requestId])
        const before = await snapshot({ ...h, db: blocker })
        await blocker.query('COMMIT')
        const outcome = await pending, after = await snapshot(h)
        h.eq(outcome.code, '23505', 'fresh validation rejects committed queued tamper')
        h.eq(after, before, 'rejected queued claim preserves full tampered state and all bytes')
        h.report.queuedTamper ??= []; h.report.queuedTamper.push({ relation, before, after, outcome })
      } finally { await blocker.query('ROLLBACK'); await h.close(blocker); await h.close(contender) }
      await h.db.query('UPDATE deletion_requests SET error_code=NULL WHERE id=$1', [f.requestId])
      await h.db.query('UPDATE deletion_targets SET error_code=NULL WHERE deletion_request_id=$1', [f.requestId])
      await replay(h, service, f)
    }
  })
  await h.scenario('requester membership removal during wait does not revoke persistent deletion work order', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    const blocker = await h.client(), contender = await h.actorClient('service_role', USER)
    const waiting = await observedWait(h, contender, 'relation', 'deletion_requests')
    const original = (await h.db.query('SELECT facilitator_id FROM projects WHERE id=$1', [PROJECT])).rows[0].facilitator_id
    await blocker.query('BEGIN')
    try {
      await blocker.query('LOCK TABLE deletion_requests IN EXCLUSIVE MODE')
      const pending = settle(lease(contender, f.requestId, 'claim', WORKER, null, 120000))
      await waiting()
      await blocker.query('UPDATE projects SET facilitator_id=$1 WHERE id=$2', [USER, PROJECT])
      const before = await snapshot({ ...h, db: blocker })
      await blocker.query('COMMIT')
      const outcome = await pending, after = await snapshot(h)
      h.eq(outcome.code, '00000', 'persisted capture needs no current requester membership')
      receipt(h, outcome.value, 'leased', 1)
      h.eq(withoutLedger(after), withoutLedger(before), 'claim preserves all rows after membership removal')
      h.report.requesterRevocation = { before, after, outcome }
    } finally {
      await blocker.query('ROLLBACK'); await h.close(blocker); await h.close(contender)
      await h.db.query('UPDATE projects SET facilitator_id=$1 WHERE id=$2', [original, PROJECT])
    }
    await replay(h, service, f)
  })
  await h.scenario('real three-second lock timeout retains all rows and files', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    const blocker = await h.client(), contender = await h.actorClient('service_role', USER)
    const waiting = await observedWait(h, contender, 'relation', 'deletion_requests'), before = await snapshot(h)
    await blocker.query('BEGIN')
    try {
      await blocker.query('LOCK TABLE deletion_requests IN EXCLUSIVE MODE')
      const started = performance.now(), pending = settle(lease(contender, f.requestId, 'claim', WORKER, null, 120000))
      await waiting()
      const outcome = await pending, elapsedMs = performance.now() - started, after = await snapshot(h)
      h.eq(outcome.code, '55P03', 'actual database lock timeout SQLSTATE')
      h.ok(elapsedMs >= 2800 && elapsedMs < 6000, 'three-second function lock timeout observed')
      h.eq(after, before, 'timeout cannot change any rows or bytes')
      h.report.timeout = { outcome, elapsedMs, before, after }
    } finally { await blocker.query('ROLLBACK'); await h.close(blocker); await h.close(contender) }
    await replay(h, service, f)
  })
}
