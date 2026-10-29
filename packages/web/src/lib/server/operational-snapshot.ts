import { getSupabaseAdmin } from '@/lib/supabase'
import { evaluateOperationalAlerts, type OperationalHealthReport } from './cutover-readiness'

export interface OperationalSnapshot {
  schemaVersion: 1
  observedAt: string
  processing: { stalledJobsCount: number; maxRunnableBacklogAgeSeconds: number; invalidJobCount: number }
  costs: { maxProjectKnownExposureCents: number; unknownAttemptCostsCount: number }
  deletions: { overdueRequestsCount: number; invalidRequestCount: number }
}

export type OperationalSnapshotResult =
  | { ok: true; snapshot: OperationalSnapshot }
  | { ok: false; reason: 'invalid_snapshot' | 'database_unavailable' | 'not_configured' | 'request_interrupted' }

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseSnapshot(value: unknown): OperationalSnapshot | null {
  if (!hasExactKeys(value, ['schemaVersion', 'observedAt', 'processing', 'costs', 'deletions']) ||
      value.schemaVersion !== 1 || typeof value.observedAt !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.observedAt)) return null
  const observed = Date.parse(value.observedAt)
  const age = Date.now() - observed
  if (!Number.isFinite(observed) || age > 60_000 || age < -5_000) return null
  const { processing, costs, deletions } = value
  if (!hasExactKeys(processing, ['stalledJobsCount', 'maxRunnableBacklogAgeSeconds', 'invalidJobCount']) ||
      !hasExactKeys(costs, ['maxProjectKnownExposureCents', 'unknownAttemptCostsCount']) ||
      !hasExactKeys(deletions, ['overdueRequestsCount', 'invalidRequestCount'])) return null
  if (!validCount(processing.stalledJobsCount) || !validCount(processing.maxRunnableBacklogAgeSeconds) ||
      !validCount(processing.invalidJobCount) || !validCount(costs.maxProjectKnownExposureCents) ||
      !validCount(costs.unknownAttemptCostsCount) || !validCount(deletions.overdueRequestsCount) ||
      !validCount(deletions.invalidRequestCount)) return null
  return {
    schemaVersion: 1,
    observedAt: new Date(observed).toISOString(),
    processing: {
      stalledJobsCount: processing.stalledJobsCount,
      maxRunnableBacklogAgeSeconds: processing.maxRunnableBacklogAgeSeconds,
      invalidJobCount: processing.invalidJobCount,
    },
    costs: {
      maxProjectKnownExposureCents: costs.maxProjectKnownExposureCents,
      unknownAttemptCostsCount: costs.unknownAttemptCostsCount,
    },
    deletions: {
      overdueRequestsCount: deletions.overdueRequestsCount,
      invalidRequestCount: deletions.invalidRequestCount,
    },
  }
}

export async function loadOperationalSnapshot(caller?: AbortSignal): Promise<OperationalSnapshotResult> {
  if (caller?.aborted) return { ok: false, reason: 'request_interrupted' }
  let admin: ReturnType<typeof getSupabaseAdmin>
  try { admin = getSupabaseAdmin() }
  catch { return { ok: false, reason: 'not_configured' } }

  const controller = new AbortController()
  const abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true })
  let onAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('Operational snapshot interrupted'))
    controller.signal.addEventListener('abort', onAbort, { once: true })
  })
  const timer = setTimeout(abort, 5000)
  try {
    // Race the whole RPC, even if a transport does not honor its AbortSignal.
    const result = await Promise.race([
      admin.rpc('read_operational_snapshot').abortSignal(controller.signal).retry(false),
      interrupted,
    ])
    if (controller.signal.aborted) return { ok: false, reason: 'request_interrupted' }
    if (!result || result.error) return { ok: false, reason: 'database_unavailable' }
    const snapshot = parseSnapshot(result.data)
    return snapshot ? { ok: true, snapshot } : { ok: false, reason: 'invalid_snapshot' }
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'request_interrupted' : 'database_unavailable' }
  } finally {
    clearTimeout(timer)
    caller?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', onAbort)
    controller.abort()
  }
}

function parseCostCap(value?: string): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return validCount(parsed) ? parsed : null
}

export function operationalHealthFromSnapshot(result: OperationalSnapshotResult, budget?: string) {
  const snapshot = result.ok ? result.snapshot : null
  const processing = snapshot?.processing.invalidJobCount === 0 ? snapshot.processing : null
  const deletions = snapshot?.deletions.invalidRequestCount === 0 ? snapshot.deletions : null
  const health: OperationalHealthReport = evaluateOperationalAlerts({
    windowMinutes: null, uploadAttempts: null, uploadFailures: null,
    stalledProcessingJobsCount: processing?.stalledJobsCount ?? null,
    maxJobBacklogAgeSeconds: processing?.maxRunnableBacklogAgeSeconds ?? null,
    activeProjectMaxCostCents: snapshot?.costs.maxProjectKnownExposureCents ?? null,
    projectCostBudgetCapCents: parseCostCap(budget),
    overdueDeletionRequestsOver7dCount: deletions?.overdueRequestsCount ?? null,
    failedExportsCount: null,
  })
  if (snapshot && snapshot.costs.unknownAttemptCostsCount > 0) {
    health.unavailableMetrics.push('project_cost_completeness')
  }
  return {
    ...health,
    source: result.ok ? 'database_ledger' as const : 'unavailable' as const,
    ...(result.ok ? { observedAt: result.snapshot.observedAt } : { reason: result.reason }),
    snapshot,
  }
}
