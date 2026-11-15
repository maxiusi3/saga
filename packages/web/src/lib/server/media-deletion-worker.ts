import { randomUUID } from 'node:crypto'
import { createDeletionExecution, deletionBounded, deletionUuid, type DeletionExecutionOptions, type DeletionExecutionReceipt, type DeletionObject } from './media-deletion-execution'
import { createDeletionStorage, type DeletionStorageOptions } from './media-deletion-storage'

export type MediaDeletionWorkerOptions = DeletionExecutionOptions & DeletionStorageOptions

/** Each new run inspects objects before issuing a new uniquely logged delete.
 * An uncertain backend result remains sticky even if Storage metadata vanishes. */
export async function runMediaDeletion(requestId: string, options: MediaDeletionWorkerOptions): Promise<DeletionExecutionReceipt> {
  const snapshot = { ...options }, storage = createDeletionStorage(snapshot)
  const execute = createDeletionExecution(requestId, randomUUID(), snapshot)
  const plan = await execute('begin')
  if (plan.state === 'blocked_reference') return plan
  try {
    const objects = new Map(plan.objects.map(o => [o.bucket + ':' + o.objectKey, o]))
    const reconcile = async (object: DeletionObject) => {
      const present = await storage.exists(object)
      await execute('observe', { ...object, state: present ? 'present' : 'absent' })
      if (!present) return
      const dispatch = await execute('dispatch', { ...object })
      let state: 'deleted' | 'not_found' | 'unknown' = 'unknown'
      try { state = await storage.remove(object) } catch { /* persist uncertainty before stopping */ }
      await execute('result', { ...object, operationId: dispatch.operationId, state })
      if (state === 'unknown') throw new Error('unknown physical result')
      if (await storage.exists(object)) throw new Error('late object')
      await execute('observe', { ...object, state: 'absent' })
    }
    for (const object of objects.values()) await reconcile(object)
    for (const prefix of plan.prefixes) {
      // Always start at offset zero after deletion. A final empty first page
      // avoids declaring an offset-shifted inventory complete during deletes.
      let empty = false
      for (let pass = 0; pass < 100; pass++) {
        const found = await storage.list(prefix)
        if (!found.length) { empty = true; break }
        for (const object of found) {
          if (!objects.has(object.bucket + ':' + object.objectKey)) {
            await execute('discover', { ...object }); objects.set(object.bucket + ':' + object.objectKey, object)
          }
          await reconcile(object)
        }
      }
      if (!empty) throw new Error('prefix not quiescent')
      await execute('inventory', { ...prefix })
    }
    return await execute('finish')
  } catch {
    // A failed finish cannot be inferred as a rollback. A later run owns its
    // own observations; this call only attempts to persist a bounded retry state.
    try { return await execute('finish', { interrupted: true }) }
    catch { throw new Error('media_deletion_worker_unavailable') }
  }
}

export type DeletionWorkerIteration = { status: 'idle'; nextCursor: null } | {
  status: 'processed' | 'unavailable'; nextCursor: string; receipt?: DeletionExecutionReceipt
}

/** Select fairly across immutable requests, including previously successful
 * ones. The SQL lease is authoritative; selection cannot grant delete rights. */
export async function runMediaDeletionWorkerOnce(options: MediaDeletionWorkerOptions & { cursor?: string | null }): Promise<DeletionWorkerIteration> {
  const snapshot = { ...options }, cursor = snapshot.cursor ?? null
  if (cursor !== null && !deletionUuid(cursor)) throw new Error('media_deletion_worker_configuration')
  const result = await deletionBounded<{ error: unknown; data: { id: string }[] | null }>(snapshot.rpcTimeoutMs ?? 5000, snapshot.signal, signal => {
    let q = snapshot.admin.from('deletion_requests').select('id').eq('capture_version', 1).order('id', { ascending: true }).limit(1)
    if (cursor) q = q.gt('id', cursor)
    return q.abortSignal(signal).retry(false)
  })
  if (result.error || !Array.isArray(result.data) || result.data.length > 1) throw new Error('media_deletion_worker_unavailable')
  if (!result.data.length) return { status: 'idle', nextCursor: null }
  const id = result.data[0].id
  if (!deletionUuid(id) || (cursor !== null && id <= cursor)) throw new Error('media_deletion_worker_unavailable')
  const execution = await deletionBounded<{ error: unknown; data: { next_scan_at: string }[] | null }>(snapshot.rpcTimeoutMs ?? 5000, snapshot.signal, signal =>
    snapshot.admin.from('media_deletion_executions').select('next_scan_at').eq('request_id', id).limit(1).abortSignal(signal).retry(false))
  if (execution.error || !Array.isArray(execution.data) || execution.data.length > 1) throw new Error('media_deletion_worker_unavailable')
  if (execution.data.length && Number.isFinite(Date.parse(execution.data[0].next_scan_at)) && Date.parse(execution.data[0].next_scan_at) > Date.now()) return { status: 'processed', nextCursor: id }
  try { return { status: 'processed', nextCursor: id, receipt: await runMediaDeletion(id, snapshot) } }
  catch { return { status: 'unavailable', nextCursor: id } }
}
