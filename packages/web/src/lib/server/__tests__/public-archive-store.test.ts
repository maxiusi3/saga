import {
  approvePublicEventDraft,
  createOrUpdatePublicEventCluster,
  createPublicArchiveAuditEvent,
  createPublicContribution,
  createPublicContributionElements,
  createPublicContributionInvitation,
  getActiveContributionWithElementsForWiki,
  getApprovedEventSummariesForContributor,
  getOwnContributionForStory,
  linkPublicEventContributions,
  listReviewerEventDrafts,
  withdrawPublicContribution,
} from '../public-archive-store'

const insertSingle = jest.fn()
const insertRowsSelect = jest.fn()
const insertRows = jest.fn(() => ({ select: insertRowsSelect }))
const updateSingle = jest.fn()
const updateSelect = jest.fn(() => ({ single: updateSingle }))
const updateEq = jest.fn(() => ({ eq: updateEq, select: updateSelect }))
const update = jest.fn(() => ({ eq: updateEq }))
const maybeSingle = jest.fn()
const queryEq = jest.fn(() => ({ eq: queryEq, maybeSingle }))
const querySelect = jest.fn(() => ({ eq: queryEq }))
const from = jest.fn((table: string) => ({
  insert: table === 'public_contribution_elements' ? insertRows : jest.fn((value) => ({ select: () => ({ single: () => insertSingle({ value }) }) })),
  update,
  select: querySelect,
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

describe('public-archive-store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    insertSingle.mockResolvedValue({ data: { id: 'row-1' }, error: null })
    insertRowsSelect.mockResolvedValue({ data: [{ id: 'element-1' }], error: null })
    updateSingle.mockResolvedValue({ data: { id: 'contribution-1', status: 'withdrawn' }, error: null })
    maybeSingle.mockResolvedValue({ data: { id: 'contribution-1' }, error: null })
  })

  it('creates public contributions from committed previews', async () => {
    const result = await createPublicContribution({
      sourceProjectId: 'project-1',
      sourceStoryId: 'story-1',
      sourceUserId: 'user-1',
      sourceStoryHash: 'story-hash',
      sourceContentHash: 'content-hash',
      consentCopyVersion: 'public-archive-consent-v1',
      anonymizedTitle: 'A market memory',
      anonymizedText: 'A child visited a market.',
      anonymizedSummary: 'A market memory.',
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('public_contributions')
  })

  it('creates contribution elements in bulk', async () => {
    const result = await createPublicContributionElements('contribution-1', [
      { elementType: 'time', value: '1976', normalizedValue: '1976', sourceQuote: '1976', confidence: 0.9 },
    ])

    expect(result).toEqual([{ id: 'element-1' }])
    expect(from).toHaveBeenCalledWith('public_contribution_elements')
  })

  it('creates facilitator invitations without creating contributions', async () => {
    const result = await createPublicContributionInvitation({
      storyId: 'story-1',
      projectId: 'project-1',
      invitedStorytellerId: 'storyteller-1',
      invitedBy: 'facilitator-1',
      message: 'This story may help others.',
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('public_contribution_invitations')
    expect(from).not.toHaveBeenCalledWith('public_contributions')
  })

  it('loads the current user contribution for a story', async () => {
    const result = await getOwnContributionForStory('story-1', 'user-1')

    expect(result).toEqual({ id: 'contribution-1' })
    expect(queryEq).toHaveBeenCalledWith('source_story_id', 'story-1')
    expect(queryEq).toHaveBeenCalledWith('source_user_id', 'user-1')
  })

  it('withdraws contributions by id', async () => {
    const result = await withdrawPublicContribution('contribution-1')

    expect(result).toEqual({ id: 'contribution-1', status: 'withdrawn' })
    expect(from).toHaveBeenCalledWith('public_contributions')
  })

  it('records audit events', async () => {
    const result = await createPublicArchiveAuditEvent({
      eventType: 'opted_in',
      actorUserId: 'user-1',
      publicContributionId: 'contribution-1',
      publicEventClusterId: null,
      consentCopyVersion: 'public-archive-consent-v1',
      metadata: { storyId: 'story-1' },
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('public_archive_audit_events')
  })

  it('loads active contribution with public elements for wiki processing', async () => {
    const result = await getActiveContributionWithElementsForWiki('contribution-1')
    expect(from).toHaveBeenCalledWith('public_contributions')
    expect(result).toEqual({ id: 'contribution-1' })
  })

  it('creates or updates public event clusters from wiki output', async () => {
    const result = await createOrUpdatePublicEventCluster({
      status: 'draft',
      eventLabel: '1976 Guangzhou market visit memories',
      timeframe: '1976',
      placeScope: 'Guangzhou',
      historicalContextSummary: 'Contributors described market visits.',
      perspectiveSummary: 'Two perspectives.',
      representativeExcerpts: ['A child remembered a market.'],
      uncertaintyNotes: 'Evidence-limited.',
      confidence: 0.8,
    })
    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('public_event_clusters')
  })

  it('updates an existing cluster when wiki output references one', async () => {
    await createOrUpdatePublicEventCluster({
      existingClusterId: 'event-1',
      status: 'draft',
      eventLabel: '1976 Guangzhou market visit memories',
      timeframe: '1976',
      placeScope: 'Guangzhou',
      historicalContextSummary: 'Contributors described market visits.',
      perspectiveSummary: 'Two perspectives.',
      representativeExcerpts: ['A child remembered a market.'],
      uncertaintyNotes: 'Evidence-limited.',
      confidence: 0.8,
    })
    expect(update).toHaveBeenCalled()
    expect(updateEq).toHaveBeenCalledWith('id', 'event-1')
  })

  it('lists reviewer drafts and approves drafts', async () => {
    await listReviewerEventDrafts()
    await approvePublicEventDraft('event-1', 'reviewer-1')
    expect(from).toHaveBeenCalledWith('public_event_clusters')
  })

  it('exposes contributor summary and event linking helpers', () => {
    expect(typeof getApprovedEventSummariesForContributor).toBe('function')
    expect(typeof linkPublicEventContributions).toBe('function')
  })
})
