import { randomUUID } from 'crypto'
import { isActionAllowed, type ProjectRole } from './consent-deletion'
import {
  assertProcessingJobTransition,
  claimProcessingJob,
  completeProcessingJob,
  requestProcessingJobCancellation,
  retryProcessingJob,
  type ProcessingJobSnapshot,
} from './processing-jobs'
import {
  buildRecordingMergeTaskInput,
  verifyRecordingMergeCompletion,
  type RecordingMergeChunk,
  type RecordingMergeReadyResult,
  type RecordingMergeTaskInput,
} from './recording-merge'
import { withVerifiedRecordingMerge } from './recording-merge-executor'
import { isRecordingProcessingError } from './recording-processing-error'

export const DEFAULT_MAX_RECORDING_INPUT_BYTES = 100 * 1024 * 1024

export interface SealRecordingSessionInput {
  jobId?: string
  assetId?: string
  projectId: string
  sessionId: string
  storyId?: string | null
  actorId: string
  actorRole: ProjectRole
  actorActive: boolean
  isDeletionBlocked?: boolean
  mimeType: string
  chunks: RecordingMergeChunk[]
  inputVersion?: number
  processorVersion?: string
  parameterVersion?: string
  maxInputBytes?: number
  maxAttempts?: number
}

export interface SealedRecordingSessionBundle {
  task: RecordingMergeTaskInput
  assetRecord: {
    id: string
    project_id: string
    story_id: string | null
    created_by: string
    bucket: 'audio-recordings'
    object_key: string
    kind: 'original_audio'
    mime_type: string
    byte_size: number
    state: 'verifying'
    version: number
    idempotency_key: string
  }
  jobSnapshot: ProcessingJobSnapshot
}

export function prepareRecordingSessionSeal(input: SealRecordingSessionInput): SealedRecordingSessionBundle {
  const allowed = isActionAllowed('record_own_story', {
    actorId: input.actorId,
    active: input.actorActive,
    role: input.actorRole,
    storyOwnerId: input.actorId,
    isDeletionBlocked: input.isDeletionBlocked,
  })
  if (!allowed) {
    throw new Error('Actor is not permitted to seal a recording session in this project')
  }

  const assetId = input.assetId?.trim() || randomUUID()
  const jobId = input.jobId?.trim() || randomUUID()
  const inputVersion = input.inputVersion ?? 1
  const processorVersion = input.processorVersion ?? 'ffmpeg-merge-v1'
  const parameterVersion = input.parameterVersion ?? 'default'
  const maxInputBytes = input.maxInputBytes ?? DEFAULT_MAX_RECORDING_INPUT_BYTES

  const task = buildRecordingMergeTaskInput({
    projectId: input.projectId,
    sessionId: input.sessionId,
    assetId,
    inputVersion,
    processorVersion,
    parameterVersion,
    mimeType: input.mimeType,
    chunks: input.chunks,
  })

  if (task.totalInputBytes > maxInputBytes) {
    throw new Error('recording_quota_exceeded: total chunk bytes exceed project recording limit')
  }

  const objectKey = `${input.actorId}/projects/${task.projectId}/assets/${assetId}/original`
  const assetRecord = {
    id: assetId,
    project_id: task.projectId,
    story_id: input.storyId ?? null,
    created_by: input.actorId,
    bucket: 'audio-recordings' as const,
    object_key: objectKey,
    kind: 'original_audio' as const,
    mime_type: task.mimeType,
    byte_size: task.totalInputBytes,
    state: 'verifying' as const,
    version: inputVersion,
    idempotency_key: task.idempotencyKey,
  }

  const jobSnapshot: ProcessingJobSnapshot = {
    id: jobId,
    projectId: task.projectId,
    assetId,
    state: 'queued',
    inputVersion,
    jobType: 'recording_merge',
    processorVersion,
    modelConfigVersion: 'none',
    parameterVersion,
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 3,
    notBefore: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    cancelRequestedAt: null,
    deletionRequestedAt: input.isDeletionBlocked ? new Date().toISOString() : null,
    errorCode: null,
    resultRef: null,
  }

  return { task, assetRecord, jobSnapshot }
}

export type RecordingMergeAttemptOutcome =
  | {
      status: 'ready'
      readyResult: RecordingMergeReadyResult
      job: ProcessingJobSnapshot
      canClearLocalDrafts: true
    }
  | {
      status: 'quarantined'
      errorCode: string
      job: ProcessingJobSnapshot
      canClearLocalDrafts: false
    }
  | {
      status: 'retry_wait' | 'failed' | 'cancelled'
      errorCode: string
      job: ProcessingJobSnapshot
      canClearLocalDrafts: false
    }

export async function executeRecordingMergeJobAttempt(
  job: ProcessingJobSnapshot,
  task: RecordingMergeTaskInput,
  options: {
    workerId: string
    now: string
    leaseMs: number
    retryDelayMs?: number
    maxInputBytes?: number
    readChunk: (chunk: RecordingMergeChunk, signal?: AbortSignal) => Promise<AsyncIterable<Uint8Array>>
    decodeAudio: (filePath: string, mimeType: string, signal?: AbortSignal) => Promise<{ durationMs: number }>
    uploadMergedObject: (artifact: {
      bucket: 'audio-recordings'
      objectKey: string
      filePath: string
      mimeType: string
      byteSize: number
      sha256: string
    }) => Promise<void>
    isCancelledOrTombstoned?: () => Promise<boolean>
    targetObjectKey: string
    signal?: AbortSignal
  },
): Promise<RecordingMergeAttemptOutcome> {
  const leased = claimProcessingJob(job, {
    workerId: options.workerId,
    now: options.now,
    leaseMs: options.leaseMs,
  })
  assertProcessingJobTransition(leased.state, 'running')
  const running: ProcessingJobSnapshot = { ...leased, state: 'running' }

  try {
    const readyResult = await withVerifiedRecordingMerge(
      task,
      {
        readChunk: options.readChunk,
        decodeAudio: options.decodeAudio,
        maxInputBytes: options.maxInputBytes ?? DEFAULT_MAX_RECORDING_INPUT_BYTES,
        signal: options.signal,
      },
      async artifact => {
        if (await options.isCancelledOrTombstoned?.()) {
          throw new Error('recording_merge_cancelled_before_publish')
        }
        await options.uploadMergedObject({
          bucket: 'audio-recordings',
          objectKey: options.targetObjectKey,
          filePath: artifact.filePath,
          mimeType: artifact.mimeType,
          byteSize: artifact.completion.outputByteSize,
          sha256: artifact.completion.outputSha256,
        })
        if (await options.isCancelledOrTombstoned?.()) {
          throw new Error('recording_merge_cancelled_before_publish')
        }
        return verifyRecordingMergeCompletion(task, artifact.completion)
      },
    )

    const succeeded = completeProcessingJob(running, options.now, readyResult.assetId)
    return {
      status: 'ready',
      readyResult,
      job: succeeded,
      canClearLocalDrafts: true,
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'recording_merge_cancelled_before_publish') {
      const cancelled = requestProcessingJobCancellation(running, options.now)
      return {
        status: 'cancelled',
        errorCode: 'cancelled_or_tombstoned',
        job: cancelled,
        canClearLocalDrafts: false,
      }
    }
    if (isRecordingProcessingError(err) && err.disposition === 'permanent') {
      assertProcessingJobTransition(running.state, 'failed')
      const failed: ProcessingJobSnapshot = {
        ...running,
        state: 'failed',
        leaseOwner: null,
        leaseExpiresAt: null,
        notBefore: null,
        errorCode: err.code,
      }
      return {
        status: 'quarantined',
        errorCode: err.code,
        job: failed,
        canClearLocalDrafts: false,
      }
    }
    const retried = retryProcessingJob(running, {
      now: options.now,
      errorCode: isRecordingProcessingError(err)
        ? err.code
        : err instanceof Error && err.message
          ? err.message
          : 'transient_merge_error',
      delayMs: options.retryDelayMs ?? 5000,
    })
    return {
      status: retried.state === 'failed' ? 'failed' : 'retry_wait',
      errorCode: retried.errorCode ?? 'transient_merge_error',
      job: retried,
      canClearLocalDrafts: false,
    }
  }
}
