import { randomUUID } from 'crypto'
import {
  beginDeletionRequest,
  completeDeletionRequest,
  createDeletionRequest,
  isActionAllowed,
  reapplyDeletionTombstone,
  recordDeletionFailure,
  type DeletionRequest,
  type DeletionTarget,
  type ProjectRole,
} from './consent-deletion'
import { assertAssetTransition, type MediaAssetState } from '@/lib/media-assets'
import { requestProcessingJobCancellation, type ProcessingJobSnapshot } from './processing-jobs'

export interface DeletableAssetRecord {
  id: string
  project_id: string
  story_id?: string | null
  bucket: 'audio-recordings' | 'saga'
  object_key: string
  state: MediaAssetState
}

export interface SubmitDeletionInput {
  requestId?: string
  projectId: string
  subjectId: string
  actorId: string
  actorRole: ProjectRole
  actorActive: boolean
  isProjectOwner?: boolean
  now: string
  assets: readonly DeletableAssetRecord[]
  activeJobs?: readonly ProcessingJobSnapshot[]
}

export interface SubmitDeletionOutcome {
  request: DeletionRequest
  transitionedAssets: Array<{ id: string; previousState: MediaAssetState; nextState: 'deleting' }>
  cancelledJobs: ProcessingJobSnapshot[]
}

export function prepareDeletionTombstone(input: SubmitDeletionInput): SubmitDeletionOutcome {
  const allowed = isActionAllowed('delete_story', {
    actorId: input.actorId,
    active: input.actorActive,
    role: input.actorRole,
    isProjectOwner: input.isProjectOwner,
  })
  if (!allowed) {
    throw new Error('Actor is not permitted to request deletion for this project')
  }
  if (!input.projectId.trim()) throw new Error('Project id is required')
  if (input.assets.length === 0) throw new Error('At least one target asset is required for deletion')

  const targets: DeletionTarget[] = []
  const transitionedAssets: Array<{ id: string; previousState: MediaAssetState; nextState: 'deleting' }> = []

  for (const asset of input.assets) {
    if (asset.project_id !== input.projectId) {
      throw new Error(`Asset ${asset.id} does not belong to project ${input.projectId}`)
    }
    if (asset.state !== 'deleted' && asset.state !== 'deleting') {
      assertAssetTransition(asset.state, 'deleting')
    }
    transitionedAssets.push({
      id: asset.id,
      previousState: asset.state,
      nextState: 'deleting',
    })
    targets.push({
      id: `asset:${asset.id}`,
      kind: 'media_asset',
      state: 'pending',
    })
    targets.push({
      id: `storage:${asset.bucket}:${asset.object_key}`,
      kind: 'storage_object',
      state: 'pending',
    })
  }

  const request = createDeletionRequest({
    id: input.requestId ?? randomUUID(),
    subjectId: input.subjectId,
    requestedBy: input.actorId,
    targets,
    now: input.now,
  })

  const assetIds = new Set(input.assets.map(a => a.id))
  const cancelledJobs: ProcessingJobSnapshot[] = []
  for (const job of input.activeJobs ?? []) {
    if (assetIds.has(job.assetId) && job.state !== 'succeeded' && job.state !== 'failed' && job.state !== 'cancelled') {
      cancelledJobs.push(requestProcessingJobCancellation(job, input.now))
    }
  }

  return {
    request,
    transitionedAssets,
    cancelledJobs,
  }
}

export type StorageDeleteStatus = 'deleted' | 'not_found' | { errorCode: string }

export async function executeDeletionRequestTargets(
  request: DeletionRequest,
  now: string,
  removeTarget: (target: DeletionTarget) => Promise<StorageDeleteStatus>,
): Promise<DeletionRequest> {
  const started = beginDeletionRequest(request, now)
  let firstErrorCode: string | null = null

  for (const target of started.targets) {
    if (target.state === 'deleted' || target.state === 'not_found') continue
    target.state = 'processing'
    try {
      const outcome = await removeTarget({ ...target })
      if (outcome === 'deleted' || outcome === 'not_found') {
        target.state = outcome
        target.errorCode = null
      } else {
        target.state = 'failed'
        target.errorCode = outcome.errorCode || 'storage_delete_failed'
        if (!firstErrorCode) firstErrorCode = target.errorCode
      }
    } catch {
      target.state = 'failed'
      target.errorCode = 'storage_delete_exception'
      if (!firstErrorCode) firstErrorCode = target.errorCode
    }
  }

  if (firstErrorCode) {
    return recordDeletionFailure(started, now, firstErrorCode)
  }
  return completeDeletionRequest(started, now)
}

export { reapplyDeletionTombstone }
