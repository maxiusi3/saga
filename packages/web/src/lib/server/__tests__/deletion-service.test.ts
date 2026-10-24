/** @jest-environment node */

import {
  executeDeletionRequestTargets,
  prepareDeletionTombstone,
  reapplyDeletionTombstone,
} from '@/lib/server/deletion-service'
import type { ProcessingJobSnapshot } from '@/lib/server/processing-jobs'

const sampleAsset = {
  id: 'asset-audio-1',
  project_id: 'project-alpha',
  story_id: 'story-1',
  bucket: 'audio-recordings' as const,
  object_key: 'user-1/projects/project-alpha/assets/asset-audio-1/original',
  state: 'ready' as const,
}

const runningJob: ProcessingJobSnapshot = {
  id: 'job-1',
  projectId: 'project-alpha',
  assetId: 'asset-audio-1',
  state: 'running',
  inputVersion: 1,
  jobType: 'asr_transcribe',
  processorVersion: 'scribe-v2',
  modelConfigVersion: '2026-10',
  parameterVersion: 'default',
  attemptCount: 1,
  maxAttempts: 3,
  notBefore: null,
  leaseOwner: 'worker-1',
  leaseExpiresAt: '2026-10-24T12:05:00.000Z',
  cancelRequestedAt: null,
  deletionRequestedAt: null,
  errorCode: null,
  resultRef: null,
}

describe('T03 deletion tombstone service', () => {
  it('denies non-facilitator members from requesting deletion', () => {
    expect(() =>
      prepareDeletionTombstone({
        projectId: 'project-alpha',
        subjectId: 'asset-audio-1',
        actorId: 'member-1',
        actorRole: 'member',
        actorActive: true,
        now: '2026-10-24T12:00:00.000Z',
        assets: [sampleAsset],
      }),
    ).toThrow('Actor is not permitted to request deletion for this project')
  })

  it('creates a tombstone, transitions assets to deleting, and cancels active processing jobs', () => {
    const outcome = prepareDeletionTombstone({
      requestId: 'del-req-1',
      projectId: 'project-alpha',
      subjectId: 'story-1',
      actorId: 'owner-1',
      actorRole: 'facilitator',
      actorActive: true,
      isProjectOwner: true,
      now: '2026-10-24T12:00:00.000Z',
      assets: [sampleAsset],
      activeJobs: [runningJob],
    })

    expect(outcome.request.id).toBe('del-req-1')
    expect(outcome.request.tombstoneAt).toBe('2026-10-24T12:00:00.000Z')
    expect(outcome.request.targets).toHaveLength(2)
    expect(outcome.transitionedAssets).toEqual([
      { id: 'asset-audio-1', previousState: 'ready', nextState: 'deleting' },
    ])
    expect(outcome.cancelledJobs).toHaveLength(1)
    expect(outcome.cancelledJobs[0].state).toBe('cancelled')
    expect(outcome.cancelledJobs[0].leaseOwner).toBeNull()
  })

  it('keeps the request in failed state for retry when physical Storage removal fails, then completes on retry', async () => {
    const { request } = prepareDeletionTombstone({
      requestId: 'del-req-2',
      projectId: 'project-alpha',
      subjectId: 'asset-audio-1',
      actorId: 'owner-1',
      actorRole: 'facilitator',
      actorActive: true,
      now: '2026-10-24T12:00:00.000Z',
      assets: [sampleAsset],
    })

    const failed = await executeDeletionRequestTargets(
      request,
      '2026-10-24T12:01:00.000Z',
      async target => (target.kind === 'storage_object' ? { errorCode: 'storage_timeout' } : 'deleted'),
    )
    expect(failed.state).toBe('failed')
    expect(failed.errorCode).toBe('storage_timeout')
    expect(failed.tombstoneAt).toBe('2026-10-24T12:00:00.000Z')

    const completed = await executeDeletionRequestTargets(
      failed,
      '2026-10-24T12:02:00.000Z',
      async () => 'not_found',
    )
    expect(completed.state).toBe('completed')
    expect(completed.completedAt).toBe('2026-10-24T12:02:00.000Z')

    const restored = reapplyDeletionTombstone(completed, '2026-10-24T13:00:00.000Z')
    expect(restored.state).toBe('failed')
    expect(restored.errorCode).toBe('tombstone_reapplied_after_restore')
    expect(restored.tombstoneAt).toBe('2026-10-24T13:00:00.000Z')
  })
})
