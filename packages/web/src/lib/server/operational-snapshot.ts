import { evaluateOperationalAlerts, type OperationalHealthReport } from './cutover-readiness'
import { callOperationalRpc, hasExactKeys } from './operational-rpc'

export interface OperationalSnapshot {
  schemaVersion: 2
  observedAt: string
  processing: { stalledJobsCount: number; maxRunnableBacklogAgeSeconds: number; invalidJobCount: number }
  costs: { maxProjectKnownExposureCents: number; unknownAttemptCostsCount: number }
  deletions: { overdueRequestsCount: number; invalidRequestCount: number }
  exports: {
    scope: 'synchronous_archive_assembly'; windowMinutes: 60
    coverageStartedAt: string; windowComplete: boolean
    integrityFailuresCount: number; unsettledAttemptsCount: number; invalidAttemptsCount: number
  }
}

export type OperationalSnapshotResult =
  | { ok: true; snapshot: OperationalSnapshot }
  | { ok: false; reason: 'invalid_snapshot' | 'database_unavailable' | 'not_configured' | 'request_interrupted' }

function timestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/)
  if (!match || Number(match[1]) > 23) return null
  const millis = Date.parse(value)
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(millis) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) return null
  // Keep sub-millisecond precision for the database's exact coverage boundary.
  const remainder = Number((match[2] ?? '').padEnd(6, '0').slice(3))
  const iso = new Date(millis).toISOString()
  return { millis, remainder, iso: remainder ? iso.replace('Z', `${String(remainder).padStart(3, '0')}Z`) : iso }
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseSnapshot(value: unknown): OperationalSnapshot | null {
  if (!hasExactKeys(value, ['schemaVersion', 'observedAt', 'processing', 'costs', 'deletions', 'exports']) || value.schemaVersion !== 2) return null
  const observed = timestamp(value.observedAt)
  if (!observed) return null
  const age = Date.now() - observed.millis
  if (age > 60_000 || age < -5_000 || (age === -5_000 && observed.remainder > 0)) return null
  const { processing, costs, deletions, exports } = value
  if (!hasExactKeys(processing, ['stalledJobsCount', 'maxRunnableBacklogAgeSeconds', 'invalidJobCount']) ||
      !hasExactKeys(costs, ['maxProjectKnownExposureCents', 'unknownAttemptCostsCount']) ||
      !hasExactKeys(deletions, ['overdueRequestsCount', 'invalidRequestCount'])) return null
  if (!validCount(processing.stalledJobsCount) || !validCount(processing.maxRunnableBacklogAgeSeconds) ||
      !validCount(processing.invalidJobCount) || !validCount(costs.maxProjectKnownExposureCents) ||
      !validCount(costs.unknownAttemptCostsCount) || !validCount(deletions.overdueRequestsCount) ||
      !validCount(deletions.invalidRequestCount)) return null
  if (!hasExactKeys(exports, ['scope', 'windowMinutes', 'coverageStartedAt', 'windowComplete', 'integrityFailuresCount', 'unsettledAttemptsCount', 'invalidAttemptsCount']) ||
      exports.scope !== 'synchronous_archive_assembly' || exports.windowMinutes !== 60 || typeof exports.windowComplete !== 'boolean' ||
      !validCount(exports.integrityFailuresCount) || !validCount(exports.unsettledAttemptsCount) || !validCount(exports.invalidAttemptsCount)) return null
  const epoch = timestamp(exports.coverageStartedAt)
  if (!epoch) return null
  const elapsed = observed.millis - epoch.millis
  if (elapsed < 0 || (elapsed === 0 && observed.remainder < epoch.remainder)) return null
  const complete = elapsed > 3_600_000 || (elapsed === 3_600_000 && observed.remainder >= epoch.remainder)
  if (exports.windowComplete !== complete) return null
  return {
    schemaVersion: 2,
    observedAt: observed.iso,
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
    exports: {
      scope: exports.scope, windowMinutes: exports.windowMinutes, coverageStartedAt: epoch.iso,
      windowComplete: complete, integrityFailuresCount: exports.integrityFailuresCount,
      unsettledAttemptsCount: exports.unsettledAttemptsCount, invalidAttemptsCount: exports.invalidAttemptsCount,
    },
  }
}

export async function loadOperationalSnapshot(caller?: AbortSignal): Promise<OperationalSnapshotResult> {
  const result = await callOperationalRpc('read_operational_snapshot_v2', undefined, caller)
  if (!result.ok) return result
  const snapshot = parseSnapshot(result.data)
  return snapshot ? { ok: true, snapshot } : { ok: false, reason: 'invalid_snapshot' }
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
  const exports = snapshot?.exports.invalidAttemptsCount === 0 ? snapshot.exports : null
  const health: OperationalHealthReport = evaluateOperationalAlerts({
    windowMinutes: null, uploadAttempts: null, uploadFailures: null,
    stalledProcessingJobsCount: processing?.stalledJobsCount ?? null,
    maxJobBacklogAgeSeconds: processing?.maxRunnableBacklogAgeSeconds ?? null,
    activeProjectMaxCostCents: snapshot?.costs.maxProjectKnownExposureCents ?? null,
    projectCostBudgetCapCents: parseCostCap(budget),
    overdueDeletionRequestsOver7dCount: deletions?.overdueRequestsCount ?? null,
    failedExportsCount: exports?.integrityFailuresCount ?? null,
  })
  if (snapshot && snapshot.costs.unknownAttemptCostsCount > 0) {
    health.unavailableMetrics.push('project_cost_completeness')
  }
  if (exports && !exports.windowComplete) health.unavailableMetrics.push('export_observation_window')
  if (exports && exports.unsettledAttemptsCount > 0) health.unavailableMetrics.push('export_outcome_completeness')
  return {
    ...health,
    source: result.ok ? 'database_ledger' as const : 'unavailable' as const,
    ...(result.ok ? { observedAt: result.snapshot.observedAt } : { reason: result.reason }),
    snapshot,
  }
}
