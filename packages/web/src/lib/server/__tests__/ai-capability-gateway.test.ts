/** @jest-environment node */

import {
  assertCapabilityGatewayGuard,
  buildVersionedTranscript,
  createAiUsageLedgerEntry,
} from '@/lib/server/ai-capability-gateway'

describe('T06 AI capability gateway and versioned transcript builder', () => {
  const validConsent = [
    {
      id: 'consent-1',
      projectId: 'proj-alpha',
      grantorId: 'user-1',
      subjectId: 'story-1',
      purpose: 'cloud_ai' as const,
      policyVersion: 'v1',
      provider: 'elevenlabs',
      region: 'us',
      grantedAt: '2026-10-24T00:00:00.000Z',
      withdrawnAt: null,
    },
  ]

  it('enforces zero-simulation on formal archive paths and checks cloud_ai consent and deletion tombstones', () => {
    expect(() =>
      assertCapabilityGatewayGuard('asr_transcribe', {
        projectId: 'proj-alpha',
        storyId: 'story-1',
        actorId: 'user-1',
        surface: 'formal_archive',
        isDemoMode: true,
        consentRecords: validConsent,
        policy: {
          provider: 'elevenlabs',
          model: 'scribe_v2',
          region: 'us',
          trainingOptOut: true,
          retentionDays: 0,
        },
      }),
    ).toThrow(/zero_simulation_violation/)

    expect(() =>
      assertCapabilityGatewayGuard('asr_transcribe', {
        projectId: 'proj-alpha',
        storyId: 'story-1',
        actorId: 'user-1',
        surface: 'formal_archive',
        isDeletionBlocked: true,
        consentRecords: validConsent,
        policy: {
          provider: 'elevenlabs',
          model: 'scribe_v2',
          region: 'us',
          trainingOptOut: true,
          retentionDays: 0,
        },
      }),
    ).toThrow(/deletion_tombstone_active/)

    expect(() =>
      assertCapabilityGatewayGuard('asr_transcribe', {
        projectId: 'proj-alpha',
        storyId: 'story-1',
        actorId: 'user-1',
        surface: 'formal_archive',
        consentRecords: [],
        policy: {
          provider: 'elevenlabs',
          model: 'scribe_v2',
          region: 'us',
          trainingOptOut: true,
          retentionDays: 0,
        },
      }),
    ).toThrow(/cloud_ai_consent_required/)

    expect(() =>
      assertCapabilityGatewayGuard('asr_transcribe', {
        projectId: 'proj-alpha',
        storyId: 'story-1',
        actorId: 'user-1',
        surface: 'formal_archive',
        consentRecords: validConsent,
        policy: {
          provider: 'elevenlabs',
          model: 'scribe_v2',
          region: 'us',
          trainingOptOut: true,
          retentionDays: 0,
        },
      }),
    ).not.toThrow()
  })

  it('builds aligned versioned transcripts and marks missing timestamps as legacy_unaligned without fabrication', () => {
    const aligned = buildVersionedTranscript({
      transcriptVersionId: 'tv-1',
      projectId: 'proj-alpha',
      storyId: 'story-1',
      version: 1,
      language: 'en',
      provider: 'elevenlabs',
      model: 'scribe_v2',
      createdBy: 'user-1',
      rawSegments: [
        { speakerLabel: 'Grandma', startMs: 0, endMs: 4500, text: 'In 1968 we moved to Portland.' },
        { speakerLabel: 'Grandma', startMs: 4500, endMs: 9200, text: 'Uncle Arthur helped us unpack.' },
      ],
    })

    expect(aligned.alignmentStatus).toBe('aligned')
    expect(aligned.segments).toHaveLength(2)
    expect(aligned.segments[0].startMs).toBe(0)
    expect(aligned.segments[1].endMs).toBe(9200)
    expect(aligned.contentSha256).toMatch(/^[a-f0-9]{64}$/)

    const unaligned = buildVersionedTranscript({
      transcriptVersionId: 'tv-legacy',
      projectId: 'proj-alpha',
      storyId: 'story-legacy',
      version: 1,
      language: 'en',
      provider: 'legacy',
      model: 'legacy-import',
      createdBy: 'user-1',
      rawSegments: [
        { speakerLabel: 'Grandma', startMs: null, endMs: null, text: 'Legacy tape without timecodes.' },
      ],
    })

    expect(unaligned.alignmentStatus).toBe('legacy_unaligned')
    expect(unaligned.segments[0].startMs).toBeNull()
    expect(unaligned.segments[0].endMs).toBeNull()
  })

  it('records usage and cost ledger entries accurately', () => {
    const entry = createAiUsageLedgerEntry({
      id: 'usage-1',
      projectId: 'proj-alpha',
      storyId: 'story-1',
      capability: 'asr_transcribe',
      policy: {
        provider: 'elevenlabs',
        model: 'scribe_v2',
        region: 'us',
        trainingOptOut: true,
        retentionDays: 0,
      },
      usageUnits: 20,
      unitRateUsd: 0.0067,
      providerRequestId: 'req-123',
      now: '2026-10-24T12:00:00.000Z',
    })

    expect(entry.estimatedCostUsd).toBe(0.134)
    expect(entry.providerRequestId).toBe('req-123')
  })
})
