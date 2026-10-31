import { evaluateOperationalAlerts, type OperationalHealthReport } from './cutover-readiness'
import { callOperationalRpc, hasExactKeys } from './operational-rpc'
import { isSha256Hex, readCollectorBuildHash } from './deployment-collection-coverage'

export interface CollectionCoverage<Scope extends string> {
  scope: Scope; windowMinutes: 60
  releaseHash: string | null; cutoverAt: string | null; cutoverWindowComplete: boolean
  matchingBuildAttemptsCount: number; unattributedAttemptsCount: number
  staleBuildAttemptsCount: number; invalidBuildAttemptsCount: number; buildCoverageComplete: boolean
}

export interface OperationalSnapshot {
  schemaVersion: 4
  observedAt: string
  processing: { stalledJobsCount: number; maxRunnableBacklogAgeSeconds: number; invalidJobCount: number }
  costs: { maxProjectKnownExposureCents: number; unknownAttemptCostsCount: number }
  deletions: { overdueRequestsCount: number; invalidRequestCount: number }
  exports: {
    scope: 'synchronous_archive_assembly'; windowMinutes: 60
    coverageStartedAt: string; windowComplete: boolean
    integrityFailuresCount: number; unsettledAttemptsCount: number; invalidAttemptsCount: number
  }
  uploads: {
    scope: 'project_hub_audio_put_reports'; windowMinutes: 60
    coverageStartedAt: string; windowComplete: boolean
    evaluatedAttemptsCount: number; reportedFailuresCount: number; reportedCancellationsCount: number
    unsettledAttemptsCount: number; invalidAttemptsCount: number
  }
  collectionCoverage: {
    exports: CollectionCoverage<'synchronous_archive_assembly'>
    uploads: CollectionCoverage<'project_hub_audio_put_reports'>
  }
}

export type OperationalSnapshotResult =
  | { ok: true; snapshot: OperationalSnapshot }
  | { ok: false; reason: 'invalid_snapshot' | 'database_unavailable' | 'not_configured' | 'request_interrupted' }

function timestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/)
  if (!match || value.startsWith('0000-') || Number(match[1]) > 23) return null
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

type Instant = NonNullable<ReturnType<typeof timestamp>>

/** Elapsed >= 60 minutes with PostgreSQL microsecond precision; null if `start` is after `observed`. */
function hourElapsed(observed: Instant, start: Instant): boolean | null {
  const elapsed = observed.millis - start.millis
  if (elapsed < 0 || (elapsed === 0 && observed.remainder < start.remainder)) return null
  return elapsed > 3_600_000 || (elapsed === 3_600_000 && observed.remainder >= start.remainder)
}

const coverageKeys = ['scope', 'windowMinutes', 'releaseHash', 'cutoverAt', 'cutoverWindowComplete', 'matchingBuildAttemptsCount',
  'unattributedAttemptsCount', 'staleBuildAttemptsCount', 'invalidBuildAttemptsCount', 'buildCoverageComplete'] as const

/**
 * Validate one deployment collection coverage group against its v3 ledger group. Contradictions
 * (an unsealed group claiming matches, a stale cutover flag, a complete flag with gaps, or
 * attributed totals that disagree with the ledger) reject the whole snapshot.
 */
function parseCoverage<Scope extends string>(
  value: unknown, scope: Scope, observed: Instant,
  ledger: { windowComplete: boolean; unsettledAttemptsCount: number; invalidAttemptsCount: number },
  attemptsInScope: { exact: number } | { atLeast: number },
): CollectionCoverage<Scope> | null {
  if (!hasExactKeys(value, coverageKeys) || value.scope !== scope || value.windowMinutes !== 60 ||
      typeof value.cutoverWindowComplete !== 'boolean' || typeof value.buildCoverageComplete !== 'boolean' ||
      !validCount(value.matchingBuildAttemptsCount) || !validCount(value.unattributedAttemptsCount) ||
      !validCount(value.staleBuildAttemptsCount) || !validCount(value.invalidBuildAttemptsCount)) return null
  let cutoverAt: string | null = null
  let cutoverComplete = false
  if (value.releaseHash === null) {
    if (value.cutoverAt !== null || value.matchingBuildAttemptsCount !== 0) return null
  } else {
    if (!isSha256Hex(value.releaseHash)) return null
    const cutover = timestamp(value.cutoverAt)
    if (!cutover) return null
    const complete = hourElapsed(observed, cutover)
    if (complete === null) return null
    cutoverAt = cutover.iso
    cutoverComplete = complete
  }
  if (value.cutoverWindowComplete !== cutoverComplete) return null
  const attributed = value.matchingBuildAttemptsCount + value.unattributedAttemptsCount + value.staleBuildAttemptsCount
  if (!Number.isSafeInteger(attributed)) return null
  if ('exact' in attemptsInScope ? attributed !== attemptsInScope.exact : attributed < attemptsInScope.atLeast) return null
  const buildComplete = ledger.windowComplete && ledger.unsettledAttemptsCount === 0 && ledger.invalidAttemptsCount === 0 &&
    cutoverComplete && value.unattributedAttemptsCount === 0 && value.staleBuildAttemptsCount === 0 &&
    value.invalidBuildAttemptsCount === 0
  if (value.buildCoverageComplete !== buildComplete) return null
  return {
    scope, windowMinutes: 60, releaseHash: value.releaseHash, cutoverAt, cutoverWindowComplete: cutoverComplete,
    matchingBuildAttemptsCount: value.matchingBuildAttemptsCount, unattributedAttemptsCount: value.unattributedAttemptsCount,
    staleBuildAttemptsCount: value.staleBuildAttemptsCount, invalidBuildAttemptsCount: value.invalidBuildAttemptsCount,
    buildCoverageComplete: buildComplete,
  }
}

function parseSnapshot(value: unknown): OperationalSnapshot | null {
  if (!hasExactKeys(value, ['schemaVersion', 'observedAt', 'processing', 'costs', 'deletions', 'exports', 'uploads', 'collectionCoverage']) || value.schemaVersion !== 4) return null
  const observed = timestamp(value.observedAt)
  if (!observed) return null
  const age = Date.now() - observed.millis
  if (age > 60_000 || age < -5_000 || (age === -5_000 && observed.remainder > 0)) return null
  const { processing, costs, deletions, exports, uploads } = value
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
  if (!hasExactKeys(uploads, ['scope', 'windowMinutes', 'coverageStartedAt', 'windowComplete', 'evaluatedAttemptsCount',
    'reportedFailuresCount', 'reportedCancellationsCount', 'unsettledAttemptsCount', 'invalidAttemptsCount']) ||
    uploads.scope !== 'project_hub_audio_put_reports' || uploads.windowMinutes !== 60 || typeof uploads.windowComplete !== 'boolean' ||
    !validCount(uploads.evaluatedAttemptsCount) || !validCount(uploads.reportedFailuresCount) ||
    !validCount(uploads.reportedCancellationsCount) || !validCount(uploads.unsettledAttemptsCount) ||
    !validCount(uploads.invalidAttemptsCount) || uploads.reportedFailuresCount > uploads.evaluatedAttemptsCount) return null
  const uploadEpoch = timestamp(uploads.coverageStartedAt)
  if (!uploadEpoch) return null
  const uploadElapsed = observed.millis - uploadEpoch.millis
  if (uploadElapsed < 0 || (uploadElapsed === 0 && observed.remainder < uploadEpoch.remainder)) return null
  const uploadComplete = uploadElapsed > 3_600_000 || (uploadElapsed === 3_600_000 && observed.remainder >= uploadEpoch.remainder)
  if (uploads.windowComplete !== uploadComplete) return null
  const { collectionCoverage } = value
  if (!hasExactKeys(collectionCoverage, ['exports', 'uploads'])) return null
  // Export v3 exposes only failures/unsettled, so attributed export attempts are a lower bound.
  const exportCoverage = parseCoverage(collectionCoverage.exports, 'synchronous_archive_assembly', observed,
    { windowComplete: complete, unsettledAttemptsCount: exports.unsettledAttemptsCount, invalidAttemptsCount: exports.invalidAttemptsCount },
    { atLeast: exports.integrityFailuresCount + exports.unsettledAttemptsCount })
  const uploadCoverage = parseCoverage(collectionCoverage.uploads, 'project_hub_audio_put_reports', observed,
    { windowComplete: uploadComplete, unsettledAttemptsCount: uploads.unsettledAttemptsCount, invalidAttemptsCount: uploads.invalidAttemptsCount },
    { exact: uploads.evaluatedAttemptsCount + uploads.reportedCancellationsCount + uploads.unsettledAttemptsCount })
  if (!exportCoverage || !uploadCoverage) return null
  return {
    schemaVersion: 4,
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
    uploads: {
      scope: uploads.scope, windowMinutes: uploads.windowMinutes, coverageStartedAt: uploadEpoch.iso,
      windowComplete: uploadComplete, evaluatedAttemptsCount: uploads.evaluatedAttemptsCount,
      reportedFailuresCount: uploads.reportedFailuresCount, reportedCancellationsCount: uploads.reportedCancellationsCount,
      unsettledAttemptsCount: uploads.unsettledAttemptsCount, invalidAttemptsCount: uploads.invalidAttemptsCount,
    },
    collectionCoverage: { exports: exportCoverage, uploads: uploadCoverage },
  }
}

export async function loadOperationalSnapshot(caller?: AbortSignal): Promise<OperationalSnapshotResult> {
  const result = await callOperationalRpc('read_operational_snapshot_v4', undefined, caller)
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
  // Coverage describes one sealed release. A reader with no (or a different) build identity
  // cannot vouch that it is that release, so it never claims complete coverage.
  const runtime = readCollectorBuildHash()
  const sameBuild = (releaseHash: string | null) => runtime.configured && runtime.valid && releaseHash !== null && runtime.buildHash === releaseHash
  const exportCollected = !!snapshot && snapshot.collectionCoverage.exports.buildCoverageComplete &&
    sameBuild(snapshot.collectionCoverage.exports.releaseHash)
  const uploadCollected = !!snapshot && snapshot.collectionCoverage.uploads.buildCoverageComplete &&
    sameBuild(snapshot.collectionCoverage.uploads.releaseHash)
  const uploads = uploadCollected && snapshot.uploads.invalidAttemptsCount === 0 && snapshot.uploads.unsettledAttemptsCount === 0 &&
    snapshot.uploads.windowComplete ? snapshot.uploads : null
  const health: OperationalHealthReport = evaluateOperationalAlerts({
    windowMinutes: uploads?.windowMinutes ?? null,
    uploadAttempts: uploads?.evaluatedAttemptsCount ?? null, uploadFailures: uploads?.reportedFailuresCount ?? null,
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
  // Known integrity failures still alert above; incomplete build coverage only withholds "complete".
  if (snapshot && !exportCollected) health.unavailableMetrics.push('export_collection_coverage')
  // Even full build attribution covers only project-hub PUT reports after begin; other upload
  // channels, pre-begin crashes and real fleet retirement remain unproven.
  health.unavailableMetrics.push('upload_collection_coverage')
  if (snapshot && !snapshot.uploads.windowComplete) health.unavailableMetrics.push('upload_observation_window')
  if (snapshot && (snapshot.uploads.unsettledAttemptsCount > 0 || snapshot.uploads.invalidAttemptsCount > 0)) {
    health.unavailableMetrics.push('upload_outcome_completeness')
  }
  health.coverage = health.unavailableMetrics.length > 0 ? 'partial' : 'complete'
  health.status = health.alerts.some(alert => alert.severity === 'critical') ? 'critical' :
    health.alerts.length > 0 ? 'degraded' : health.coverage === 'partial' ? 'unavailable' : 'healthy'
  return {
    ...health,
    source: result.ok ? 'database_ledger' as const : 'unavailable' as const,
    ...(result.ok ? { observedAt: result.snapshot.observedAt } : { reason: result.reason }),
    snapshot,
  }
}
