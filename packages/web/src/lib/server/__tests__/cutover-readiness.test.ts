import {
  evaluateOperationalAlerts,
  evaluateSyntheticProviderProbes,
  verifyShadowReadEquivalence,
} from '@/lib/server/cutover-readiness'

describe('Post-G4 Production Cutover, Shadow-Read Equivalence & §11 Operational Alerts', () => {
  it('verifies shadow-read equivalence between legacy story media URLs and unified media_assets (§5.4)', () => {
    const cleanReport = verifyShadowReadEquivalence({
      projectId: 'proj-cutover-1',
      legacyStories: [
        {
          storyId: 'story-1',
          projectId: 'proj-cutover-1',
          audioUrl: 'https://example.supabase.co/storage/v1/object/public/audio-recordings/story-1.webm',
          imageUrls: ['https://example.supabase.co/storage/v1/object/public/saga/photo-1.jpg'],
        },
      ],
      mappedAssets: [
        {
          assetId: 'asset-a1',
          storyId: 'story-1',
          projectId: 'proj-cutover-1',
          legacyUrl: 'https://example.supabase.co/storage/v1/object/public/audio-recordings/story-1.webm',
          bucket: 'audio-recordings',
          objectKey: 'story-1.webm',
          sha256: 'a'.repeat(64),
          state: 'ready',
        },
        {
          assetId: 'asset-i1',
          storyId: 'story-1',
          projectId: 'proj-cutover-1',
          legacyUrl: 'https://example.supabase.co/storage/v1/object/public/saga/photo-1.jpg',
          bucket: 'saga',
          objectKey: 'photo-1.jpg',
          sha256: 'b'.repeat(64),
          state: 'ready',
        },
      ],
    })

    expect(cleanReport.cutoverReady).toBe(true)
    expect(cleanReport.matchedReadyCount).toBe(2)
    expect(cleanReport.discrepancies).toHaveLength(0)

    const mismatchReport = verifyShadowReadEquivalence({
      projectId: 'proj-cutover-1',
      legacyStories: [
        {
          storyId: 'story-1',
          projectId: 'proj-cutover-1',
          audioUrl: 'https://example.supabase.co/storage/v1/object/public/audio-recordings/unmapped.webm',
        },
      ],
      mappedAssets: [],
    })
    expect(mismatchReport.cutoverReady).toBe(false)
    expect(mismatchReport.discrepancies[0].kind).toBe('unmapped_legacy_audio')
  })

  it('triggers §11 operational alerts without logging private family text', () => {
    const healthy = evaluateOperationalAlerts({
      windowMinutes: 60,
      uploadAttempts: 20,
      uploadFailures: 0,
      stalledProcessingJobsCount: 0,
      maxJobBacklogAgeSeconds: 30,
      activeProjectMaxCostCents: 262,
      projectCostBudgetCapCents: 500,
      overdueDeletionRequestsOver7dCount: 0,
      failedExportsCount: 0,
    })
    expect(healthy.status).toBe('healthy')
    expect(healthy.containsPrivateFamilyText).toBe(false)
    expect(healthy.alerts).toHaveLength(0)

    const critical = evaluateOperationalAlerts({
      windowMinutes: 60,
      uploadAttempts: 10,
      uploadFailures: 3,
      stalledProcessingJobsCount: 4,
      maxJobBacklogAgeSeconds: 1800,
      activeProjectMaxCostCents: 750,
      projectCostBudgetCapCents: 500,
      overdueDeletionRequestsOver7dCount: 1,
      failedExportsCount: 1,
    })
    expect(critical.status).toBe('critical')
    expect(critical.alerts.map(a => a.code)).toEqual([
      'upload_failure_spike',
      'job_backlog_stalled',
      'project_cost_anomaly',
      'deletion_sla_breach',
      'export_integrity_failure',
    ])
  })

  it('evaluates synthetic provider probes and blocks non-compliant data terms', () => {
    const probes = evaluateSyntheticProviderProbes([
      {
        capability: 'asr_transcribe',
        provider: 'elevenlabs',
        modelId: 'scribe_v2',
        region: 'us',
        trainingOptOutConfirmed: true,
        zeroDataRetentionConfirmed: true,
        apiKeyConfigured: true,
      },
      {
        capability: 'story_extract_edit',
        provider: 'anthropic',
        modelId: 'claude-opus-4-20250514',
        region: 'us',
        trainingOptOutConfirmed: false,
        zeroDataRetentionConfirmed: true,
        apiKeyConfigured: true,
      },
    ])

    expect(probes[0].status).toBe('ready_for_live_probe')
    expect(probes[0].readyForLiveProbe).toBe(true)
    expect(probes[1].status).toBe('blocked_by_policy')
    expect(probes[1].readyForLiveProbe).toBe(false)
  })
})
