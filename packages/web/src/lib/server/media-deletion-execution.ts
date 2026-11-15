import type { getSupabaseAdmin } from '@/lib/supabase'

export type DeletionObject = Readonly<{ bucket: string; objectKey: string }>
export type DeletionExecutionOptions = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; rpcTimeoutMs?: number }
export type DeletionExecutionReceipt = Readonly<{
  requestId: string; runId: string; state: 'scanning' | 'blocked_reference' | 'reconcile' | 'observed_absent'
  serverNow: string; leaseExpiresAt: string | null; lastVerifiedAt: string | null; nextScanAt: string
  operationId: string | null; physicalDeletionComplete: false; unresolvedPhysicalCount: number
  objects: readonly DeletionObject[]; prefixes: readonly DeletionObject[]
}>
export const deletionUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
export function validateDeletionObject(value: unknown): DeletionObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('media_deletion_object_invalid')
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== 2 || !['saga', 'audio-recordings', 'recording-candidates'].includes(String(row.bucket)) ||
    typeof row.objectKey !== 'string' || row.objectKey.length > 1024 || !/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)+$/.test(row.objectKey) ||
    /(^|\/)\.{1,2}(\/|$)/.test(row.objectKey)) throw new Error('media_deletion_object_invalid')
  return Object.freeze({ bucket: row.bucket as string, objectKey: row.objectKey })
}

/** A transport that ignores AbortSignal still cannot keep the worker waiting.
 * The caller records uncertainty; this helper never retries a mutation. */
export async function deletionBounded<T>(timeoutMs: number, signal: AbortSignal | undefined, operation: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  if (typeof window !== 'undefined' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || signal?.aborted) throw new Error('media_deletion_unavailable')
  const controller = new AbortController(), abort = () => controller.abort()
  const started = performance.now()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  let rejectAbort = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error('media_deletion_unavailable'))
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  try {
    const result = await Promise.race([operation(controller.signal), interrupted])
    if (controller.signal.aborted || signal?.aborted || performance.now() - started >= timeoutMs) throw new Error('media_deletion_unavailable')
    return result
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort); abort()
  }
}

function timestamp(value: unknown): bigint {
  if (typeof value !== 'string') throw new Error('media_deletion_receipt_invalid')
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(value)
  if (!m || !Number.isFinite(Date.parse(m[1] + 'Z')) || new Date(m[1] + 'Z').toISOString().slice(0, 19) !== m[1]) throw new Error('media_deletion_receipt_invalid')
  return BigInt(Date.parse(m[1] + 'Z')) * BigInt(1000) + BigInt((m[2] ?? '').padEnd(6, '0'))
}

export function createDeletionExecution(requestId: string, runId: string, options: DeletionExecutionOptions) {
  if (!deletionUuid(requestId) || !deletionUuid(runId)) throw new Error('media_deletion_execution_unavailable')
  const { admin, signal, rpcTimeoutMs = 5000 } = options
  let deadline = Infinity
  return async (action: 'begin' | 'discover' | 'inventory' | 'observe' | 'dispatch' | 'result' | 'finish', payload: Record<string, unknown> = {}): Promise<DeletionExecutionReceipt> => {
    try {
      const started = performance.now()
      if (started >= deadline) throw new Error('expired')
      const result = await deletionBounded<{ data: unknown; error: unknown }>(Math.min(rpcTimeoutMs, Math.floor(deadline - started)), signal, abort =>
        admin.rpc('media_deletion_execute', { p_request_id: requestId, p_run_id: runId, p_action: action, p_payload: { ...payload } }).abortSignal(abort).retry(false))
      if (!result || result.error) throw new Error('rpc')
      const row = result.data as Record<string, unknown>
      const keys = ['requestId', 'runId', 'state', 'serverNow', 'leaseExpiresAt', 'lastVerifiedAt', 'nextScanAt', 'operationId', 'physicalDeletionComplete', 'unresolvedPhysicalCount', 'objects', 'prefixes']
      if (!row || typeof row !== 'object' || Object.keys(row).length !== keys.length || keys.some(k => !Object.prototype.hasOwnProperty.call(row, k)) ||
        row.requestId !== requestId || row.runId !== runId || row.physicalDeletionComplete !== false ||
        !['scanning', 'blocked_reference', 'reconcile', 'observed_absent'].includes(String(row.state)) ||
        !Array.isArray(row.objects) || !Array.isArray(row.prefixes) || row.objects.length > 100000 || row.prefixes.length > 10000 ||
        (row.operationId !== null && !deletionUuid(row.operationId)) || !Number.isSafeInteger(row.unresolvedPhysicalCount) || Number(row.unresolvedPhysicalCount) < 0) throw new Error('receipt')
      const now = timestamp(row.serverNow)
      timestamp(row.nextScanAt)
      if (row.lastVerifiedAt !== null && timestamp(row.lastVerifiedAt) > now) throw new Error('future observation')
      if (row.state === 'scanning') {
        const ttl = timestamp(row.leaseExpiresAt) - now
        if (ttl <= BigInt(0) || ttl > BigInt(120000000)) throw new Error('lease')
        deadline = started + Number(ttl) / 1000
        if (deadline <= performance.now()) throw new Error('expired')
      } else if (row.leaseExpiresAt !== null) throw new Error('lease')
      if ((action === 'dispatch') !== (row.operationId !== null) && action !== 'result') throw new Error('operation')
      if ((action !== 'begin' && (row.objects.length || row.prefixes.length)) ||
        (action === 'begin' && !['scanning', 'blocked_reference'].includes(String(row.state))) ||
        (!['begin', 'finish'].includes(action) && row.state !== 'scanning') ||
        (action === 'finish' && row.state !== (payload.interrupted || Number(row.unresolvedPhysicalCount) > 0 ? 'reconcile' : 'observed_absent'))) throw new Error('state')
      if (row.state === 'observed_absent' && row.lastVerifiedAt === null) throw new Error('missing observation')
      const objects = row.objects.map(validateDeletionObject), prefixes = row.prefixes.map(validateDeletionObject)
      for (const list of [objects, prefixes]) if (new Set(list.map(o => o.bucket + ':' + o.objectKey)).size !== list.length) throw new Error('duplicate')
      for (const prefix of prefixes) if (prefix.bucket !== 'audio-recordings' || !/^[0-9a-f-]{36}\/projects\/[0-9a-f-]{36}\/sessions\/[0-9a-f-]{36}$/.test(prefix.objectKey)) throw new Error('prefix')
      return Object.freeze({ ...row, objects: Object.freeze(objects), prefixes: Object.freeze(prefixes) }) as DeletionExecutionReceipt
    } catch { throw new Error('media_deletion_execution_unavailable') }
  }
}
