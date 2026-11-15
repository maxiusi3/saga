import { randomUUID } from 'node:crypto'
import { lease, snapshot, USER, OTHER, PROJECT, RPC } from './fixture.mjs'
import { captured, replay, step, receipt, rejected, expire, WORKER } from './scenarios.mjs'
export async function lifecycle(h, service, prepare) {
  await h.scenario('all live actions, start replay, monotone heartbeat and explicit recovery fence', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    const claim = await step(h, service, f, 'claim', WORKER, null, 120000)
    receipt(h, claim, 'leased', 1)
    h.eq([claim.requestId, claim.projectId, claim.subjectId, claim.subjectType, claim.targetCount], [f.requestId, PROJECT, f.storyId, 'story', f.capture.targetCount], 'capture receipt binds identities and count')
    await rejected(h, () => lease(service, f.requestId, 'claim', WORKER, null, 1000), '23505', 'same worker cannot reclaim live ownership')
    await rejected(h, () => lease(service, f.requestId, 'heartbeat', WORKER, 1, 1000), '23505', 'undispatched attempt cannot heartbeat')
    await rejected(h, () => lease(service, f.requestId, 'recover'), '23505', 'live lease cannot recover')
    receipt(h, await step(h, service, f, 'check'), 'leased', 1)
    receipt(h, await step(h, service, f, 'start'), 'running', 1)
    const before = await snapshot(h)
    receipt(h, await step(h, service, f, 'start'), 'running', 1)
    h.eq(await snapshot(h), before, 'repeated start preserves original start timestamp and complete ledger')
    const heartbeat = await step(h, service, f, 'heartbeat', WORKER, 1, 1000)
    receipt(h, heartbeat, 'running', 1)
    h.eq(heartbeat.leaseExpiresAt, claim.leaseExpiresAt, 'shorter heartbeat does not shorten expiry')
    h.ok(Date.parse(heartbeat.leaseExpiresAt) - Date.parse(heartbeat.serverNow) > 1000, 'retained TTL may exceed new request duration')
    receipt(h, await step(h, service, f, 'check'), 'running', 1)
    await replay(h, service, f)
  })
  await h.scenario('three actual undispatched expiries retain all attempts and exhaust into failed', async () => {
    const f = await captured(h, service, prepare, 'media_asset')
    await replay(h, service, f)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const worker = `${WORKER}-${attempt}`
      const previous = (await snapshot(h)).media_deletion_attempts.filter(a => a.request_id === f.requestId)
      receipt(h, await step(h, service, f, 'claim', worker, null, 1000), 'leased', attempt, worker)
      h.eq((await snapshot(h)).media_deletion_attempts.filter(a => a.request_id === f.requestId && a.attempt_no < attempt), previous, 'claim preserves complete prior attempt rows')
      if (attempt > 1) for (const action of ['start', 'heartbeat', 'check']) {
        await rejected(h, () => lease(service, f.requestId, action, `${WORKER}-${attempt - 1}`, attempt - 1, action === 'heartbeat' ? 1000 : null), '23505', `old worker/attempt fenced for ${action}`)
      }
      await expire(h, f)
      await rejected(h, () => lease(service, f.requestId, 'claim', worker, null, 1000), '23505', 'expired lease still requires explicit recovery')
      for (const action of ['start', 'heartbeat', 'check']) await rejected(h, () => lease(service, f.requestId, action, worker, attempt, action === 'heartbeat' ? 1000 : null), '23505', `expired ownership cannot ${action}`)
      const reconnected = await h.actorClient('service_role', USER)
      const state = attempt === 3 ? 'failed' : 'retry_wait'
      receipt(h, await step(h, reconnected, f, 'recover', null, null), state, attempt)
      await h.close(reconnected)
      const before = await snapshot(h)
      receipt(h, await step(h, service, f, 'recover', null, null), state, attempt)
      h.eq(await snapshot(h), before, 'repeated recover retains full stable ledger')
      await replay(h, service, f)
    }
    await rejected(h, () => lease(service, f.requestId, 'claim', WORKER, null, 1000), '23505', 'failed job never reclaims')
  })
  await h.scenario('lost start response persists running and real expiry becomes outcome_unknown', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    receipt(h, await step(h, service, f, 'claim', WORKER, null, 1000), 'leased', 1)
    const disconnected = await h.actorClient('service_role', USER)
    await step(h, disconnected, f, 'start') // The caller deliberately discards its receipt.
    await h.close(disconnected)
    receipt(h, await step(h, service, f, 'check'), 'running', 1)
    const heartbeat = await step(h, service, f, 'heartbeat', WORKER, 1, 1000)
    receipt(h, heartbeat, 'running', 1)
    await expire(h, f)
    await rejected(h, () => lease(service, f.requestId, 'heartbeat', WORKER, 1, 1000), '23505', 'running expiry cannot renew')
    receipt(h, await step(h, service, f, 'recover', null, null), 'outcome_unknown', 1)
    const before = await snapshot(h)
    receipt(h, await step(h, service, f, 'recover', null, null), 'outcome_unknown', 1)
    h.eq(await snapshot(h), before, 'unknown recovery replay is read-only')
    await rejected(h, () => lease(service, f.requestId, 'claim', WORKER, null, 1000), '23505', 'unknown outcome never retries')
    await replay(h, service, f)
  })
  await h.scenario('strict arguments, missing capture, actual role denial and READ COMMITTED requirement', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    const bad = [
      [null, 'claim', WORKER, null, 1000], [f.requestId, null, WORKER, null, 1000],
      ...['delete', 'complete', 'finish', 'succeeded', 'CLAIM'].map(action => [f.requestId, action, WORKER, null, 1000]),
      ...[null, '', 'worker bad', 'w'.repeat(129)].map(w => [f.requestId, 'claim', w, null, 1000]),
      ...[null, 999, 120001, -1].map(ms => [f.requestId, 'claim', WORKER, null, ms]),
      [f.requestId, 'claim', WORKER, 1, 1000], [f.requestId, 'start', WORKER, 0, null],
      [f.requestId, 'check', WORKER, 4, null], [f.requestId, 'start', WORKER, null, null],
      [f.requestId, 'start', WORKER, 1, 1000], [f.requestId, 'check', WORKER, 1, 1000],
      [f.requestId, 'recover', WORKER, null, null], [f.requestId, 'recover', null, 1, null],
      [f.requestId, 'recover', null, null, 1000], [f.requestId, 'heartbeat', WORKER, 1, 999],
    ]
    for (const args of bad) await rejected(h, () => service.query(RPC, args), '22023', `malformed input ${JSON.stringify(args.slice(1))}`)
    await rejected(h, () => lease(service, randomUUID(), 'claim', WORKER, null, 1000), '23505', 'absent request rejected')
    for (const role of ['anon', 'authenticated']) {
      const client = await h.actorClient(role, OTHER)
      await rejected(h, () => lease(client, f.requestId, 'claim', WORKER, null, 1000), '42501', `${role} cannot call RPC`)
      for (const table of ['media_deletion_jobs', 'media_deletion_attempts']) await rejected(h, () => client.query(`SELECT * FROM ${table}`), '42501', `${role} cannot read ${table}`)
      await h.close(client)
    }
    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) {
      await service.query(`BEGIN ISOLATION LEVEL ${isolation}`)
      let outcome
      try { await lease(service, f.requestId, 'claim', WORKER, null, 1000); outcome = '00000' } catch (error) { outcome = error.code }
      await service.query('ROLLBACK')
      h.eq(outcome, '22023', `${isolation} rejected`)
      h.report.isolation ??= []; h.report.isolation.push({ isolation, outcome })
    }
    const functionRecord = (await h.db.query("SELECT prosecdef,provolatile,proconfig,proacl::text FROM pg_proc WHERE oid='public.media_deletion_job_lease(uuid,text,text,integer,integer)'::regprocedure")).rows[0]
    h.eq([functionRecord.prosecdef, functionRecord.provolatile], [true, 'v'], 'volatile SECURITY DEFINER')
    h.eq(functionRecord.proconfig, ['search_path=pg_catalog, pg_temp', 'TimeZone=UTC', 'lock_timeout=3s'], 'fixed function execution settings')
    h.report.functionRecord = functionRecord
    receipt(h, await step(h, service, f, 'claim', WORKER, null, 120000), 'leased', 1)
    for (const table of ['media_deletion_jobs', 'media_deletion_attempts']) {
      h.ok((await service.query(`SELECT * FROM ${table} WHERE request_id=$1`, [f.requestId])).rowCount > 0, 'service can read own ledger')
      for (const sql of [`UPDATE ${table} SET worker_id='tamper' WHERE request_id=$1`, `DELETE FROM ${table} WHERE request_id=$1`, `INSERT INTO ${table} SELECT * FROM ${table} WHERE request_id=$1`]) {
        await rejected(h, () => service.query(sql, [f.requestId]), '42501', `service lacks direct ${sql.split(' ')[0]} on ${table}`)
      }
    }
    await replay(h, service, f)
  })
}
