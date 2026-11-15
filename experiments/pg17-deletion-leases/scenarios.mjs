import { randomUUID } from 'node:crypto'
import { fresh, capture, materialize, lease, snapshot } from './fixture.mjs'
import { lifecycle } from './lifecycle.mjs'
import { faults } from './faults.mjs'
import { locks } from './locks.mjs'

export const WORKER = 'delete-worker'
export const ledgerTables = ['media_deletion_jobs', 'media_deletion_attempts']
export function withoutLedger(rows) { return Object.fromEntries(Object.entries(rows).filter(([name]) => !ledgerTables.includes(name))) }
export async function captured(h, service, prepare, subjectType = 'story') {
  const f = await fresh(h, service, prepare)
  await materialize(h, f)
  f.args = { subjectId: subjectType === 'story' ? f.storyId : f.assetId, subjectType, requestId: randomUUID() }
  f.capture = await capture(service, f.args)
  f.requestId = f.capture.id
  h.report.captures ??= []
  h.report.captures.push({ fixture: { requestId: f.requestId, storyId: f.storyId, assetId: f.assetId }, capture: f.capture, rows: await snapshot(h) })
  return f
}
export async function replay(h, service, f) {
  const before = await snapshot(h), result = await capture(service, f.args), after = await snapshot(h)
  h.eq(result, f.capture, 'accepted actual capture receipt replays identically')
  h.eq(after, before, 'capture replay leaves all rows and synthetic files unchanged')
  h.report.replays ??= []; h.report.replays.push({ requestId: f.requestId, result, before, after })
}
export function receipt(h, result, state, attempt, worker = WORKER) {
  h.eq(Object.keys(result).sort(), ['schemaVersion', 'requestId', 'projectId', 'subjectId', 'subjectType', 'captureTargetsSha256', 'targetCount', 'state', 'attempt', 'workerId', 'leaseExpiresAt', 'serverNow', 'canDeleteStorage', 'physicalDeletionComplete'].sort(), 'closed receipt keys')
  h.eq([result.schemaVersion, result.state, result.attempt, result.canDeleteStorage, result.physicalDeletionComplete], [1, state, attempt, false, false], 'lease state and capabilities')
  if (['leased', 'running'].includes(state)) {
    h.eq(result.workerId, worker, 'active worker')
    h.ok(Date.parse(result.leaseExpiresAt) > Date.parse(result.serverNow), 'active expiry after server clock')
    h.ok(Date.parse(result.leaseExpiresAt) - Date.parse(result.serverNow) <= 120000, 'bounded TTL')
  } else h.eq([result.workerId, result.leaseExpiresAt], [null, null], 'inactive receipt has no owner or expiry')
}
export async function step(h, service, f, action, worker = WORKER, attempt = 1, ms = null) {
  const before = await snapshot(h)
  const result = await lease(service, f.requestId, action, worker, attempt, ms), after = await snapshot(h)
  h.eq(withoutLedger(after), withoutLedger(before), `${action} preserves complete capture/other rows and bytes`)
  if (action === 'check') h.eq(after, before, 'check writes nothing')
  h.report.steps ??= []; h.report.steps.push({ requestId: f.requestId, action, result, before, after })
  return result
}
export async function rejected(h, fn, expected = '23505', label = 'conflicting operation', connection = h.db) {
  const before = await snapshot({ ...h, db: connection })
  let outcome, diagnostic
  try { await fn(); outcome = '00000' } catch (error) { outcome = error.code ?? 'ERROR'; diagnostic = { message: error.message, where: error.where, detail: error.detail } }
  const after = await snapshot({ ...h, db: connection })
  h.report.rejections ??= []; h.report.rejections.push({ label, expected, outcome, diagnostic, before, after })
  h.eq(outcome, expected, label)
  h.eq(after, before, `${label} rolls back all row and byte changes`)
}
export async function expire(h, f) {
  const result = await h.db.query('SELECT clock_timestamp() AS before, lease_expires_at, pg_sleep(greatest(0,extract(epoch FROM lease_expires_at-clock_timestamp()))::double precision),clock_timestamp() AS after FROM media_deletion_jobs WHERE request_id=$1', [f.requestId])
  h.report.realExpiries ??= []; h.report.realExpiries.push({ requestId: f.requestId, ...result.rows[0] })
  h.ok(result.rows[0].after >= result.rows[0].lease_expires_at, 'actual PostgreSQL clock reaches expiry')
}
export async function scenarios(h, service, prepare, source) {
  for (const file of ['lifecycle.mjs', 'faults.mjs', 'locks.mjs']) await source(`experiments/pg17-deletion-leases/${file}`)
  await lifecycle(h, service, prepare)
  await faults(h, service, prepare)
  await locks(h, service, prepare)
}
