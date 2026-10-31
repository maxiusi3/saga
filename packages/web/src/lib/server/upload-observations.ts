import { isUuid } from '@/lib/invitation-acceptance-protocol'
import { callOperationalRpc, hasExactKeys } from './operational-rpc'
import { readCollectorBuildHash } from './deployment-collection-coverage'

const outcomes = ['client_succeeded', 'client_failed', 'client_conflict', 'client_cancelled'] as const
export type BrowserUploadOutcome = typeof outcomes[number]
export type BrowserUploadReceipt = { schemaVersion: 1; attemptId: string; state: 'started' | BrowserUploadOutcome }

export function isBrowserUploadOutcome(value: unknown): value is BrowserUploadOutcome {
  return typeof value === 'string' && outcomes.some(outcome => outcome === value)
}

function validBinding(id: string, bindingHash: string): boolean {
  return isUuid(id) && typeof bindingHash === 'string' && bindingHash.length === 64 && /^[0-9a-f]{64}$/.test(bindingHash)
}

function confirmed(data: unknown, attemptId: string, state: BrowserUploadReceipt['state']): BrowserUploadReceipt | null {
  return hasExactKeys(data, ['schemaVersion', 'attemptId', 'state']) &&
    data.schemaVersion === 1 && data.attemptId === attemptId && data.state === state
    ? { schemaVersion: 1, attemptId, state } : null
}

export async function beginBrowserUploadAttempt(attemptId: string, bindingHash: string, signal?: AbortSignal): Promise<BrowserUploadReceipt | null> {
  if (!validBinding(attemptId, bindingHash)) return null
  const build = readCollectorBuildHash()
  if (build.configured && !build.valid) return null
  const result = build.configured
    ? await callOperationalRpc('begin_browser_upload_attempt_v2', {
      p_attempt_id: attemptId, p_binding_hash: bindingHash, p_build_hash: build.buildHash,
    }, signal)
    : await callOperationalRpc('begin_browser_upload_attempt', {
      p_attempt_id: attemptId, p_binding_hash: bindingHash,
    }, signal)
  return result.ok ? confirmed(result.data, attemptId, 'started') : null
}

export async function finishBrowserUploadAttempt(attemptId: string, bindingHash: string, outcome: BrowserUploadOutcome): Promise<BrowserUploadReceipt | null> {
  if (!validBinding(attemptId, bindingHash) || !isBrowserUploadOutcome(outcome)) return null
  // A cancelled HTTP request must not cancel its own bounded cancellation report.
  const result = await callOperationalRpc('finish_browser_upload_attempt', {
    p_attempt_id: attemptId, p_binding_hash: bindingHash, p_outcome: outcome,
  })
  return result.ok ? confirmed(result.data, attemptId, outcome) : null
}
