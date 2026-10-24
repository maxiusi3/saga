/** @jest-environment node */

import { createHash } from 'crypto'
import {
  executeRecordingMergeJobAttempt,
  prepareRecordingSessionSeal,
} from '@/lib/server/recording-session-service'
import { RecordingProcessingError } from '@/lib/server/recording-processing-error'

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('T04 & T05 recording session seal and durable merge service', () => {
  const chunk0Bytes = Buffer.from('chunk-0-audio-bytes-')
  const chunk1Bytes = Buffer.from('chunk-1-audio-bytes!')
  const combinedBytes = Buffer.concat([chunk0Bytes, chunk1Bytes])

  const chunks = [
    {
      index: 0,
      chunkId: 'c-0',
      bucket: 'audio-recordings' as const,
      objectKey: 'projects/proj-alpha/sessions/sess-1/0',
      byteSize: chunk0Bytes.length,
      sha256: sha256(chunk0Bytes),
    },
    {
      index: 1,
      chunkId: 'c-1',
      bucket: 'audio-recordings' as const,
      objectKey: 'projects/proj-alpha/sessions/sess-1/1',
      byteSize: chunk1Bytes.length,
      sha256: sha256(chunk1Bytes),
    },
  ]

  it('seals an ordered chunk manifest, enforces byte quota, and produces deterministic idempotency keys', () => {
    const first = prepareRecordingSessionSeal({
      assetId: 'asset-rec-1',
      jobId: 'job-rec-1',
      projectId: 'proj-alpha',
      sessionId: 'sess-1',
      actorId: 'storyteller-1',
      actorRole: 'storyteller',
      actorActive: true,
      mimeType: 'audio/webm',
      chunks,
    })
    const second = prepareRecordingSessionSeal({
      assetId: 'asset-rec-1',
      jobId: 'job-rec-2',
      projectId: 'proj-alpha',
      sessionId: 'sess-1',
      actorId: 'storyteller-1',
      actorRole: 'storyteller',
      actorActive: true,
      mimeType: 'audio/webm',
      chunks: [chunks[1], chunks[0]],
    })

    expect(first.task.idempotencyKey).toBe(second.task.idempotencyKey)
    expect(first.assetRecord.state).toBe('verifying')
    expect(first.jobSnapshot.state).toBe('queued')

    expect(() =>
      prepareRecordingSessionSeal({
        projectId: 'proj-alpha',
        sessionId: 'sess-1',
        actorId: 'storyteller-1',
        actorRole: 'storyteller',
        actorActive: true,
        mimeType: 'audio/webm',
        chunks,
        maxInputBytes: 10,
      }),
    ).toThrow('recording_quota_exceeded')
  })

  it('merges valid chunks, verifies FFmpeg decode, uploads original audio, and marks ready with canClearLocalDrafts=true', async () => {
    const sealed = prepareRecordingSessionSeal({
      assetId: 'asset-rec-1',
      jobId: 'job-rec-1',
      projectId: 'proj-alpha',
      sessionId: 'sess-1',
      actorId: 'storyteller-1',
      actorRole: 'storyteller',
      actorActive: true,
      mimeType: 'audio/webm',
      chunks,
    })

    const uploaded: Array<{ objectKey: string; byteSize: number; sha256: string }> = []
    const outcome = await executeRecordingMergeJobAttempt(sealed.jobSnapshot, sealed.task, {
      workerId: 'worker-alpha',
      now: '2026-10-24T12:00:00.000Z',
      leaseMs: 30000,
      targetObjectKey: sealed.assetRecord.object_key,
      readChunk: async chunk => {
        const buf = chunk.index === 0 ? chunk0Bytes : chunk1Bytes
        return (async function* () {
          yield buf
        })()
      },
      decodeAudio: async () => ({ durationMs: 300000 }),
      uploadMergedObject: async artifact => {
        uploaded.push({
          objectKey: artifact.objectKey,
          byteSize: artifact.byteSize,
          sha256: artifact.sha256,
        })
      },
    })

    expect(outcome.status).toBe('ready')
    expect(outcome.canClearLocalDrafts).toBe(true)
    expect(outcome.job.state).toBe('succeeded')
    expect(uploaded).toEqual([
      {
        objectKey: sealed.assetRecord.object_key,
        byteSize: combinedBytes.length,
        sha256: sha256(combinedBytes),
      },
    ])
  })

  it('quarantines corrupted chunks or undecodable containers and never permits clearing local drafts', async () => {
    const sealed = prepareRecordingSessionSeal({
      assetId: 'asset-rec-corrupt',
      jobId: 'job-rec-corrupt',
      projectId: 'proj-alpha',
      sessionId: 'sess-1',
      actorId: 'storyteller-1',
      actorRole: 'storyteller',
      actorActive: true,
      mimeType: 'audio/webm',
      chunks,
    })

    const corruptHashOutcome = await executeRecordingMergeJobAttempt(sealed.jobSnapshot, sealed.task, {
      workerId: 'worker-alpha',
      now: '2026-10-24T12:00:00.000Z',
      leaseMs: 30000,
      targetObjectKey: sealed.assetRecord.object_key,
      readChunk: async chunk => {
        const buf = chunk.index === 0 ? Buffer.from('corrupted-twenty-byt') : chunk1Bytes
        return (async function* () {
          yield buf
        })()
      },
      decodeAudio: async () => ({ durationMs: 300000 }),
      uploadMergedObject: async () => {},
    })

    expect(corruptHashOutcome.status).toBe('quarantined')
    expect(corruptHashOutcome.errorCode).toBe('recording_source_hash_mismatch')
    expect(corruptHashOutcome.canClearLocalDrafts).toBe(false)
    expect(corruptHashOutcome.job.state).toBe('failed')

    const decodeFailOutcome = await executeRecordingMergeJobAttempt(sealed.jobSnapshot, sealed.task, {
      workerId: 'worker-alpha',
      now: '2026-10-24T12:00:00.000Z',
      leaseMs: 30000,
      targetObjectKey: sealed.assetRecord.object_key,
      readChunk: async chunk => {
        const buf = chunk.index === 0 ? chunk0Bytes : chunk1Bytes
        return (async function* () {
          yield buf
        })()
      },
      decodeAudio: async () => {
        throw new RecordingProcessingError('recording_decode_invalid_pcm', 'FFmpeg failed to decode container')
      },
      uploadMergedObject: async () => {},
    })

    expect(decodeFailOutcome.status).toBe('quarantined')
    expect(decodeFailOutcome.errorCode).toBe('recording_decode_invalid_pcm')
    expect(decodeFailOutcome.canClearLocalDrafts).toBe(false)
  })

  it('blocks late publication if the session/story is tombstoned or cancelled while merging', async () => {
    const sealed = prepareRecordingSessionSeal({
      assetId: 'asset-rec-cancel',
      jobId: 'job-rec-cancel',
      projectId: 'proj-alpha',
      sessionId: 'sess-1',
      actorId: 'storyteller-1',
      actorRole: 'storyteller',
      actorActive: true,
      mimeType: 'audio/webm',
      chunks,
    })

    const outcome = await executeRecordingMergeJobAttempt(sealed.jobSnapshot, sealed.task, {
      workerId: 'worker-alpha',
      now: '2026-10-24T12:00:00.000Z',
      leaseMs: 30000,
      targetObjectKey: sealed.assetRecord.object_key,
      readChunk: async chunk => {
        const buf = chunk.index === 0 ? chunk0Bytes : chunk1Bytes
        return (async function* () {
          yield buf
        })()
      },
      decodeAudio: async () => ({ durationMs: 300000 }),
      uploadMergedObject: async () => {},
      isCancelledOrTombstoned: async () => true,
    })

    expect(outcome.status).toBe('cancelled')
    expect(outcome.job.state).toBe('cancelled')
    expect(outcome.canClearLocalDrafts).toBe(false)
  })
})
