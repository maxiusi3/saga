import { isUuid } from '@/lib/invitation-acceptance-protocol'
import { callOperationalRpc, hasExactKeys } from './operational-rpc'

const outcomes = ['verified', 'integrity_failed', 'failed', 'cancelled', 'limit_exceeded'] as const
export type ArchiveAssemblyOutcome = typeof outcomes[number]

function confirmed(data: unknown, id: string, state: string): boolean {
  return hasExactKeys(data, ['schemaVersion', 'attemptId', 'state']) &&
    data.schemaVersion === 1 && data.attemptId === id && data.state === state
}

export async function beginArchiveAssemblyAttempt(id: string, signal?: AbortSignal): Promise<boolean> {
  if (!isUuid(id)) return false
  const result = await callOperationalRpc('begin_archive_assembly_attempt', { p_attempt_id: id }, signal)
  return result.ok && confirmed(result.data, id, 'started')
}

export async function finishArchiveAssemblyAttempt(id: string, outcome: ArchiveAssemblyOutcome): Promise<boolean> {
  if (!isUuid(id) || !outcomes.includes(outcome)) return false
  // Do not inherit a cancelled HTTP signal: persist cancellation with its own bounded request.
  const result = await callOperationalRpc('finish_archive_assembly_attempt', { p_attempt_id: id, p_outcome: outcome })
  return result.ok && confirmed(result.data, id, outcome)
}
