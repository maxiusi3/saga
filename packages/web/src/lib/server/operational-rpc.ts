import { getSupabaseAdmin } from '@/lib/supabase'

type OperationalRpc = 'read_operational_snapshot_v4' | 'begin_archive_assembly_attempt' | 'finish_archive_assembly_attempt' |
  'begin_browser_upload_attempt' | 'finish_browser_upload_attempt' | 'begin_archive_assembly_attempt_v2' |
  'begin_browser_upload_attempt_v2' | 'seal_deployment_collection_coverage'
type RpcResult = { ok: true; data: unknown } | {
  ok: false; reason: 'database_unavailable' | 'not_configured' | 'request_interrupted'
}

export function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}

/** Bound the whole RPC, including transports that ignore cancellation; never replay unknown writes. */
export async function callOperationalRpc(name: OperationalRpc, args?: Record<string, string>, caller?: AbortSignal): Promise<RpcResult> {
  if (caller?.aborted) return { ok: false, reason: 'request_interrupted' }
  let admin: ReturnType<typeof getSupabaseAdmin>
  try { admin = getSupabaseAdmin() }
  catch { return { ok: false, reason: 'not_configured' } }
  const controller = new AbortController()
  const abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true })
  let onAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('Operational RPC interrupted'))
    controller.signal.addEventListener('abort', onAbort, { once: true })
  })
  const timer = setTimeout(abort, 5000)
  try {
    const query = args === undefined ? admin.rpc(name) : admin.rpc(name, args)
    const result = await Promise.race([query.abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted) return { ok: false, reason: 'request_interrupted' }
    if (!result || result.error) return { ok: false, reason: 'database_unavailable' }
    return { ok: true, data: result.data }
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'request_interrupted' : 'database_unavailable' }
  } finally {
    clearTimeout(timer)
    caller?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', onAbort)
    controller.abort()
  }
}
