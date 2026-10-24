export type ProjectAction =
  | 'read_project'
  | 'manage_project'
  | 'record_own_story'
  | 'edit_own_story'
  | 'run_ai_for_own_story'
  | 'public_contribution'
  | 'family_share'
  | 'delete_story'

export type ProjectRole = 'facilitator' | 'storyteller' | 'member' | (string & {})

export interface ActionSubject {
  actorId: string
  active: boolean
  role: ProjectRole
  isProjectOwner?: boolean
  storyOwnerId?: string
  isDeletionBlocked?: boolean
}

export function isActionAllowed(action: ProjectAction, subject: ActionSubject): boolean {
  if (!subject.actorId.trim() || !subject.active || subject.isDeletionBlocked) return false
  const isManager = subject.role === 'facilitator' || subject.isProjectOwner === true
  switch (action) {
    case 'read_project':
      return subject.role === 'facilitator' || subject.role === 'storyteller' || subject.role === 'member'
    case 'manage_project':
    case 'family_share':
    case 'delete_story':
      return isManager
    case 'record_own_story':
    case 'edit_own_story':
    case 'run_ai_for_own_story':
    case 'public_contribution':
      return subject.role === 'storyteller' && subject.storyOwnerId === subject.actorId
    default:
      return false
  }
}

export type ConsentPurpose = 'recording' | 'cloud_ai' | 'family_share' | 'public_archive' | (string & {})

export interface ConsentRecord {
  id: string
  grantorId: string
  subjectId: string
  purpose: ConsentPurpose
  policyVersion: string
  provider: string
  region: string
  grantedAt: string
  withdrawnAt: string | null
}

function timestamp(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function hasActiveConsent(
  records: readonly ConsentRecord[],
  query: Omit<ConsentRecord, 'id' | 'grantedAt' | 'withdrawnAt'> & { at: string },
): boolean {
  const at = timestamp(query.at)
  if (at === null) return false
  return records.some(record => {
    const granted = timestamp(record.grantedAt)
    const withdrawn = record.withdrawnAt === null ? null : timestamp(record.withdrawnAt)
    if (granted === null || (record.withdrawnAt !== null && withdrawn === null)) return false
    return record.grantorId === query.grantorId
      && record.subjectId === query.subjectId
      && record.purpose === query.purpose
      && record.policyVersion === query.policyVersion
      && record.provider === query.provider
      && record.region === query.region
      && granted <= at
      && (withdrawn === null || at < withdrawn)
  })
}

export type DeletionTargetState = 'pending' | 'processing' | 'failed' | 'deleted' | 'not_found'

export interface DeletionTarget {
  id: string
  kind: string
  state: DeletionTargetState
  errorCode?: string | null
}

export type DeletionRequestState = 'requested' | 'processing' | 'failed' | 'completed'

export interface DeletionRequest {
  id: string
  subjectId: string
  requestedBy: string
  state: DeletionRequestState
  tombstoneAt: string | null
  attempt: number
  requestedAt: string
  processingAt: string | null
  completedAt: string | null
  errorCode: string | null
  targets: DeletionTarget[]
}

function requireText(value: string, label: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
}

function requireTime(value: string, label: string): void {
  if (timestamp(value) === null) throw new Error(`Invalid ${label}`)
}

function cloneRequest(request: DeletionRequest): DeletionRequest {
  return { ...request, targets: request.targets.map(target => ({ ...target })) }
}

export function createDeletionRequest(input: {
  id: string
  subjectId: string
  requestedBy: string
  targets: readonly DeletionTarget[]
  now: string
}): DeletionRequest {
  requireText(input.id, 'Deletion request id')
  requireText(input.subjectId, 'Deletion subject')
  requireText(input.requestedBy, 'Deletion requester')
  requireTime(input.now, 'deletion request time')
  if (input.targets.length === 0) throw new Error('At least one deletion target is required')
  const ids = input.targets.map(target => {
    requireText(target.id, 'Deletion target id')
    requireText(target.kind, 'Deletion target kind')
    return target.id
  })
  if (new Set(ids).size !== ids.length) throw new Error('Deletion targets must not contain duplicate ids')
  return {
    id: input.id,
    subjectId: input.subjectId,
    requestedBy: input.requestedBy,
    state: 'requested',
    tombstoneAt: input.now,
    attempt: 0,
    requestedAt: input.now,
    processingAt: null,
    completedAt: null,
    errorCode: null,
    targets: input.targets.map(target => ({ ...target, state: 'pending', errorCode: null })),
  }
}

export function isDeletionBlocking(request: Pick<DeletionRequest, 'tombstoneAt'>): boolean {
  return request.tombstoneAt !== null
}

export function beginDeletionRequest(request: DeletionRequest, now: string): DeletionRequest {
  requireTime(now, 'deletion processing time')
  if (request.state !== 'requested' && request.state !== 'failed') throw new Error('Deletion request is not ready for processing')
  const next = cloneRequest(request)
  next.state = 'processing'
  next.attempt += 1
  next.processingAt = now
  next.completedAt = null
  next.errorCode = null
  next.targets = next.targets.map(target => target.state === 'failed' ? { ...target, state: 'pending', errorCode: null } : target)
  return next
}

export function recordDeletionFailure(request: DeletionRequest, now: string, errorCode: string): DeletionRequest {
  requireTime(now, 'deletion failure time')
  requireText(errorCode, 'Deletion error code')
  if (request.state !== 'processing') throw new Error('Deletion request is not processing')
  return { ...cloneRequest(request), state: 'failed', errorCode, completedAt: null }
}

export function completeDeletionRequest(request: DeletionRequest, now: string): DeletionRequest {
  requireTime(now, 'deletion completion time')
  if (request.state !== 'processing') throw new Error('Deletion request is not processing')
  if (request.targets.some(target => target.state !== 'deleted' && target.state !== 'not_found')) {
    throw new Error('All deletion targets must be confirmed before completion')
  }
  return { ...cloneRequest(request), state: 'completed', completedAt: now, errorCode: null }
}

export function reapplyDeletionTombstone(request: DeletionRequest, now: string): DeletionRequest {
  requireTime(now, 'tombstone time')
  const next = cloneRequest(request)
  next.tombstoneAt = now
  if (next.state === 'completed') next.state = 'failed'
  next.completedAt = null
  next.errorCode = 'tombstone_reapplied_after_restore'
  return next
}
