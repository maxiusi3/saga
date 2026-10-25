import { createHash } from 'crypto'

export interface LegacyStoryMediaRecord {
  storyId: string
  projectId: string
  audioUrl?: string | null
  imageUrls?: readonly string[]
  transcriptText?: string | null
}

export interface UnifiedMediaAssetMapping {
  assetId: string
  storyId: string
  projectId: string
  legacyUrl: string
  bucket: 'saga' | 'audio-recordings'
  objectKey: string
  sha256: string
  state: 'ready' | 'pending_upload' | 'quarantined' | 'deleted'
  tombstoned?: boolean
}

export interface ShadowReadDiscrepancy {
  storyId: string
  kind: 'unmapped_legacy_audio' | 'unmapped_legacy_image' | 'asset_not_ready' | 'tombstone_mismatch'
  legacyUrl: string
  detail: string
}

export interface ShadowReadComparisonReport {
  projectId: string
  totalStoriesChecked: number
  totalLegacyUrlsChecked: number
  matchedReadyCount: number
  discrepancies: ShadowReadDiscrepancy[]
  cutoverReady: boolean
}

/**
 * Verifies shadow-read equivalence between legacy story media URLs and unified media_assets
 * per docs/2026-10-10-integrated-upgrade-plan.md §5.4 (新增结构 → 回填 → 影子读取比较 → 小批切换 → 观察 → 关闭旧写入).
 */
export function verifyShadowReadEquivalence(params: {
  projectId: string
  legacyStories: readonly LegacyStoryMediaRecord[]
  mappedAssets: readonly UnifiedMediaAssetMapping[]
  tombstonedSubjectIds?: ReadonlySet<string>
}): ShadowReadComparisonReport {
  const tombstones = params.tombstonedSubjectIds ?? new Set<string>()
  const byStoryAndUrl = new Map<string, UnifiedMediaAssetMapping>()
  for (const m of params.mappedAssets) {
    if (m.projectId === params.projectId) {
      byStoryAndUrl.set(`${m.storyId}::${m.legacyUrl}`, m)
    }
  }

  const discrepancies: ShadowReadDiscrepancy[] = []
  let totalLegacyUrlsChecked = 0
  let matchedReadyCount = 0

  const projectStories = params.legacyStories.filter(s => s.projectId === params.projectId)

  for (const story of projectStories) {
    const storyTombstoned = tombstones.has(story.storyId)
    const urls: Array<{ url: string; type: 'audio' | 'image' }> = []
    if (story.audioUrl && story.audioUrl.trim().length > 0) {
      urls.push({ url: story.audioUrl.trim(), type: 'audio' })
    }
    for (const img of story.imageUrls ?? []) {
      if (img && img.trim().length > 0) {
        urls.push({ url: img.trim(), type: 'image' })
      }
    }

    for (const item of urls) {
      totalLegacyUrlsChecked += 1
      const mapped = byStoryAndUrl.get(`${story.storyId}::${item.url}`)
      if (!mapped) {
        discrepancies.push({
          storyId: story.storyId,
          kind: item.type === 'audio' ? 'unmapped_legacy_audio' : 'unmapped_legacy_image',
          legacyUrl: item.url,
          detail: `No unified media_assets mapping found for legacy ${item.type} URL`,
        })
        continue
      }

      const isAssetTombstoned =
        Boolean(mapped.tombstoned) || tombstones.has(mapped.assetId) || storyTombstoned
      if (isAssetTombstoned && mapped.state !== 'deleted') {
        discrepancies.push({
          storyId: story.storyId,
          kind: 'tombstone_mismatch',
          legacyUrl: item.url,
          detail: `Asset ${mapped.assetId} has an active deletion tombstone but state is ${mapped.state}`,
        })
        continue
      }

      if (!isAssetTombstoned && mapped.state !== 'ready') {
        discrepancies.push({
          storyId: story.storyId,
          kind: 'asset_not_ready',
          legacyUrl: item.url,
          detail: `Mapped asset ${mapped.assetId} is in state "${mapped.state}" instead of "ready"`,
        })
        continue
      }

      matchedReadyCount += 1
    }
  }

  return {
    projectId: params.projectId,
    totalStoriesChecked: projectStories.length,
    totalLegacyUrlsChecked,
    matchedReadyCount,
    discrepancies,
    cutoverReady: discrepancies.length === 0,
  }
}

export interface OperationalMetricsSnapshot {
  windowMinutes: number
  uploadAttempts: number
  uploadFailures: number
  stalledProcessingJobsCount: number
  maxJobBacklogAgeSeconds: number
  activeProjectMaxCostCents: number
  projectCostBudgetCapCents: number
  overdueDeletionRequestsOver7dCount: number
  failedExportsCount: number
}

export interface OperationalAlertItem {
  code:
    | 'upload_failure_spike'
    | 'job_backlog_stalled'
    | 'project_cost_anomaly'
    | 'deletion_sla_breach'
    | 'export_integrity_failure'
  severity: 'warning' | 'critical'
  responderRole: 'primary_developer_oncall'
  summary: string
}

export interface OperationalHealthReport {
  status: 'healthy' | 'degraded' | 'critical'
  containsPrivateFamilyText: false
  alerts: OperationalAlertItem[]
}

/**
 * Evaluates §11 operational alerts without logging private family text.
 */
export function evaluateOperationalAlerts(
  snapshot: OperationalMetricsSnapshot,
): OperationalHealthReport {
  const alerts: OperationalAlertItem[] = []

  const uploadFailureRate =
    snapshot.uploadAttempts > 0 ? snapshot.uploadFailures / snapshot.uploadAttempts : 0
  if (snapshot.uploadAttempts >= 5 && uploadFailureRate >= 0.1) {
    alerts.push({
      code: 'upload_failure_spike',
      severity: uploadFailureRate >= 0.25 ? 'critical' : 'warning',
      responderRole: 'primary_developer_oncall',
      summary: `Upload failure rate ${(uploadFailureRate * 100).toFixed(1)}% (${snapshot.uploadFailures}/${snapshot.uploadAttempts}) in ${snapshot.windowMinutes}m window`,
    })
  }

  if (snapshot.stalledProcessingJobsCount > 0 || snapshot.maxJobBacklogAgeSeconds > 900) {
    alerts.push({
      code: 'job_backlog_stalled',
      severity: snapshot.stalledProcessingJobsCount > 3 ? 'critical' : 'warning',
      responderRole: 'primary_developer_oncall',
      summary: `Stalled jobs=${snapshot.stalledProcessingJobsCount}, maxBacklogAge=${snapshot.maxJobBacklogAgeSeconds}s`,
    })
  }

  if (snapshot.activeProjectMaxCostCents > snapshot.projectCostBudgetCapCents) {
    alerts.push({
      code: 'project_cost_anomaly',
      severity: 'critical',
      responderRole: 'primary_developer_oncall',
      summary: `Project AI cost ${snapshot.activeProjectMaxCostCents}c exceeded cap ${snapshot.projectCostBudgetCapCents}c`,
    })
  }

  if (snapshot.overdueDeletionRequestsOver7dCount > 0) {
    alerts.push({
      code: 'deletion_sla_breach',
      severity: 'critical',
      responderRole: 'primary_developer_oncall',
      summary: `${snapshot.overdueDeletionRequestsOver7dCount} deletion request(s) exceeded 7-day active storage purge target`,
    })
  }

  if (snapshot.failedExportsCount > 0) {
    alerts.push({
      code: 'export_integrity_failure',
      severity: 'critical',
      responderRole: 'primary_developer_oncall',
      summary: `${snapshot.failedExportsCount} archival export(s) failed SHA-256 or package verification`,
    })
  }

  const hasCritical = alerts.some(a => a.severity === 'critical')
  return {
    status: hasCritical ? 'critical' : alerts.length > 0 ? 'degraded' : 'healthy',
    containsPrivateFamilyText: false,
    alerts,
  }
}

export interface ProviderProbeTarget {
  capability: 'asr_transcribe' | 'story_extract_edit' | 'semantic_retrieval'
  provider: 'elevenlabs' | 'anthropic' | 'voyage'
  modelId: string
  region: string
  trainingOptOutConfirmed: boolean
  zeroDataRetentionConfirmed: boolean
  apiKeyConfigured: boolean
}

export interface SyntheticProbeResult {
  capability: ProviderProbeTarget['capability']
  provider: ProviderProbeTarget['provider']
  modelId: string
  mode: 'dry_run_contract_check' | 'live_synthetic_probe'
  syntheticSampleSha256: string
  policyCompliant: boolean
  readyForLiveProbe: boolean
  status: 'ready_for_live_probe' | 'blocked_by_policy' | 'missing_api_key'
}

const SYNTHETIC_SHORT_SAMPLE =
  'SYNTHETIC_PROBE_ONLY: In 1968 fictional narrator Arthur tested a cedar boat in Portland.'

export function evaluateSyntheticProviderProbes(
  targets: readonly ProviderProbeTarget[],
): SyntheticProbeResult[] {
  const sampleSha = createHash('sha256').update(SYNTHETIC_SHORT_SAMPLE, 'utf8').digest('hex')

  return targets.map(t => {
    const policyCompliant = t.trainingOptOutConfirmed && t.zeroDataRetentionConfirmed
    if (!policyCompliant) {
      return {
        capability: t.capability,
        provider: t.provider,
        modelId: t.modelId,
        mode: 'dry_run_contract_check',
        syntheticSampleSha256: sampleSha,
        policyCompliant: false,
        readyForLiveProbe: false,
        status: 'blocked_by_policy',
      }
    }
    if (!t.apiKeyConfigured) {
      return {
        capability: t.capability,
        provider: t.provider,
        modelId: t.modelId,
        mode: 'dry_run_contract_check',
        syntheticSampleSha256: sampleSha,
        policyCompliant: true,
        readyForLiveProbe: false,
        status: 'missing_api_key',
      }
    }
    return {
      capability: t.capability,
      provider: t.provider,
      modelId: t.modelId,
      mode: 'dry_run_contract_check',
      syntheticSampleSha256: sampleSha,
      policyCompliant: true,
      readyForLiveProbe: true,
      status: 'ready_for_live_probe',
    }
  })
}
