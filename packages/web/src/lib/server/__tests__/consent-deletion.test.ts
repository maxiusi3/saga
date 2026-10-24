import {
  beginDeletionRequest,
  completeDeletionRequest,
  createDeletionRequest,
  hasActiveConsent,
  isActionAllowed,
  isDeletionBlocking,
  recordDeletionFailure,
  reapplyDeletionTombstone,
} from '../consent-deletion'

const now = '2026-10-14T12:00:00.000Z'

describe('T03 action, consent, and deletion contracts', () => {
  describe('project actions', () => {
    it('allows only active members to read, and keeps management actions role-scoped', () => {
      expect(isActionAllowed('read_project', { actorId: 'user-1', active: true, role: 'member' })).toBe(true)
      expect(isActionAllowed('read_project', { actorId: 'user-1', active: false, role: 'member' })).toBe(false)
      expect(isActionAllowed('manage_project', { actorId: 'user-1', active: true, role: 'facilitator' })).toBe(true)
      expect(isActionAllowed('manage_project', { actorId: 'user-1', active: true, role: 'member' })).toBe(false)
      expect(isActionAllowed('manage_project', { actorId: 'user-1', active: true, role: 'member', isProjectOwner: true })).toBe(true)
    })

    it('limits own-story actions to the storyteller who owns the story', () => {
      const ownStory = { actorId: 'storyteller-1', active: true, role: 'storyteller' as const, storyOwnerId: 'storyteller-1' }
      expect(isActionAllowed('record_own_story', ownStory)).toBe(true)
      expect(isActionAllowed('edit_own_story', ownStory)).toBe(true)
      expect(isActionAllowed('run_ai_for_own_story', ownStory)).toBe(true)
      expect(isActionAllowed('public_contribution', ownStory)).toBe(true)
      expect(isActionAllowed('edit_own_story', { ...ownStory, storyOwnerId: 'storyteller-2' })).toBe(false)
      expect(isActionAllowed('record_own_story', { ...ownStory, role: 'facilitator' })).toBe(false)
      expect(isActionAllowed('public_contribution', { ...ownStory, isDeletionBlocked: true })).toBe(false)
    })

    it('keeps sharing and deletion management separate from storyteller editing', () => {
      const facilitator = { actorId: 'facilitator-1', active: true, role: 'facilitator' as const }
      expect(isActionAllowed('family_share', facilitator)).toBe(true)
      expect(isActionAllowed('delete_story', facilitator)).toBe(true)
      expect(isActionAllowed('edit_own_story', { ...facilitator, storyOwnerId: 'facilitator-1' })).toBe(false)
      expect(isActionAllowed('family_share', { ...facilitator, isDeletionBlocked: true })).toBe(false)
    })

    it('fails closed for unknown roles, missing membership, and blocked subjects', () => {
      expect(isActionAllowed('read_project', { actorId: 'user-1', active: true, role: 'unknown' })).toBe(false)
      expect(isActionAllowed('read_project', { actorId: 'user-1', active: true, role: 'member', isDeletionBlocked: true })).toBe(false)
      expect(isActionAllowed('manage_project', { actorId: 'user-1', active: true, role: 'facilitator', isDeletionBlocked: true })).toBe(false)
    })
  })

  describe('purpose consent', () => {
    const consent = {
      id: 'consent-1', grantorId: 'storyteller-1', subjectId: 'asset-1', purpose: 'cloud_ai' as const,
      policyVersion: 'policy-v2', provider: 'scribe', region: 'us', grantedAt: '2026-10-14T11:00:00.000Z', withdrawnAt: null,
    }

    it('matches active consent by exact subject, purpose, policy, provider, region, and time', () => {
      expect(hasActiveConsent([consent], {
        grantorId: 'storyteller-1', subjectId: 'asset-1', purpose: 'cloud_ai', policyVersion: 'policy-v2', provider: 'scribe', region: 'us', at: now,
      })).toBe(true)
      expect(hasActiveConsent([consent], { ...consent, at: now, provider: 'other' })).toBe(false)
      expect(hasActiveConsent([consent], { ...consent, at: now, purpose: 'family_share' })).toBe(false)
      expect(hasActiveConsent([consent], { ...consent, at: now, subjectId: 'asset-2' })).toBe(false)
      expect(hasActiveConsent([consent], { ...consent, at: '2026-10-14T10:59:59.000Z' })).toBe(false)
    })

    it('treats withdrawal as effective at its timestamp and allows a later grant', () => {
      const withdrawn = { ...consent, withdrawnAt: '2026-10-14T12:00:00.000Z' }
      expect(hasActiveConsent([withdrawn], { ...consent, at: '2026-10-14T11:59:59.999Z' })).toBe(true)
      expect(hasActiveConsent([withdrawn], { ...consent, at: now })).toBe(false)
      expect(hasActiveConsent([
        withdrawn,
        { ...consent, id: 'consent-2', grantedAt: '2026-10-14T12:01:00.000Z' },
      ], { ...consent, at: '2026-10-14T12:02:00.000Z' })).toBe(true)
    })

    it('fails closed for malformed timestamps and does not mutate records', () => {
      const malformed = { ...consent, grantedAt: 'invalid' }
      const before = JSON.parse(JSON.stringify(malformed))
      expect(hasActiveConsent([malformed], { ...consent, at: now })).toBe(false)
      expect(malformed).toEqual(before)
    })
  })

  describe('deletion requests', () => {
    const targets = [
      { id: 'asset-1', kind: 'original', state: 'pending' as const },
      { id: 'artifact-1', kind: 'derived', state: 'pending' as const },
    ]

    it('creates a tombstone that blocks access and processing immediately', () => {
      const request = createDeletionRequest({ id: 'delete-1', subjectId: 'project-1', requestedBy: 'user-1', targets, now })
      expect(request).toMatchObject({ id: 'delete-1', state: 'requested', tombstoneAt: now, attempt: 0 })
      expect(isDeletionBlocking(request)).toBe(true)
    })

    it('retries a failed request without clearing its tombstone', () => {
      const request = createDeletionRequest({ id: 'delete-1', subjectId: 'project-1', requestedBy: 'user-1', targets, now })
      const running = beginDeletionRequest(request, '2026-10-14T12:01:00.000Z')
      const failed = recordDeletionFailure(running, '2026-10-14T12:02:00.000Z', 'storage_timeout')
      expect(failed).toMatchObject({ state: 'failed', attempt: 1, tombstoneAt: now, errorCode: 'storage_timeout' })
      expect(beginDeletionRequest(failed, '2026-10-14T12:03:00.000Z')).toMatchObject({ state: 'processing', attempt: 2, tombstoneAt: now })
    })

    it('requires every target to be deleted or confirmed absent before completion', () => {
      const request = createDeletionRequest({ id: 'delete-1', subjectId: 'project-1', requestedBy: 'user-1', targets, now })
      const running = beginDeletionRequest(request, now)
      expect(() => completeDeletionRequest(running, now)).toThrow('targets')
      const partial = { ...running, targets: [{ ...targets[0], state: 'deleted' as const }, targets[1]] }
      expect(() => completeDeletionRequest(partial, now)).toThrow('targets')
      const complete = completeDeletionRequest({ ...running, targets: [
        { ...targets[0], state: 'deleted' as const }, { ...targets[1], state: 'not_found' as const },
      ] }, now)
      expect(complete).toMatchObject({ state: 'completed', completedAt: now, tombstoneAt: now })
      expect(isDeletionBlocking(complete)).toBe(true)
    })

    it('reapplies the tombstone after a restore without reopening access', () => {
      const request = createDeletionRequest({ id: 'delete-1', subjectId: 'project-1', requestedBy: 'user-1', targets, now })
      const restored = reapplyDeletionTombstone({ ...request, tombstoneAt: null }, '2026-10-15T08:00:00.000Z')
      expect(restored).toMatchObject({ tombstoneAt: '2026-10-15T08:00:00.000Z' })
      expect(isDeletionBlocking(restored)).toBe(true)
    })

    it('rejects duplicate targets, empty IDs, invalid transitions, and mutating callers', () => {
      expect(() => createDeletionRequest({ id: 'delete-1', subjectId: 'project-1', requestedBy: 'user-1', targets: [], now })).toThrow('target')
      expect(() => createDeletionRequest({ id: 'delete-1', subjectId: 'project-1', requestedBy: 'user-1', targets: [targets[0], targets[0]], now })).toThrow('duplicate')
      const request = createDeletionRequest({ id: 'delete-1', subjectId: 'project-1', requestedBy: 'user-1', targets, now })
      const before = JSON.parse(JSON.stringify(request))
      Object.freeze(request)
      expect(beginDeletionRequest(request, now)).not.toBe(request)
      expect(request).toEqual(before)
      expect(() => recordDeletionFailure(request, now, 'error')).toThrow('processing')
      expect(() => completeDeletionRequest(request, now)).toThrow('processing')
    })
  })
})
