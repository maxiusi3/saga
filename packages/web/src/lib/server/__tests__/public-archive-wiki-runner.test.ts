/**
 * @jest-environment node
 */

import { processPublicContributionWithWikiAgent, reprocessPublicEventCluster } from '../public-archive-wiki-runner'

const createAgentRun = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()
const createAgentArtifact = jest.fn()
const getActiveContributionWithElementsForWiki = jest.fn()
const getActiveContributionsWithElementsForCluster = jest.fn()
const listClusterableEventClusters = jest.fn()
const createOrUpdatePublicEventCluster = jest.fn()
const emptyPublicEventCluster = jest.fn()
const linkPublicEventContributions = jest.fn()
const updateContributionWikiStatus = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()
const processWikiEventDraft = jest.fn()

jest.mock('@/lib/server/agent-store', () => ({
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
  createAgentArtifact: (...args: unknown[]) => createAgentArtifact(...args),
}))
jest.mock('@/lib/server/public-archive-store', () => ({
  getActiveContributionWithElementsForWiki: (...args: unknown[]) => getActiveContributionWithElementsForWiki(...args),
  getActiveContributionsWithElementsForCluster: (...args: unknown[]) => getActiveContributionsWithElementsForCluster(...args),
  listClusterableEventClusters: (...args: unknown[]) => listClusterableEventClusters(...args),
  createOrUpdatePublicEventCluster: (...args: unknown[]) => createOrUpdatePublicEventCluster(...args),
  emptyPublicEventCluster: (...args: unknown[]) => emptyPublicEventCluster(...args),
  linkPublicEventContributions: (...args: unknown[]) => linkPublicEventContributions(...args),
  updateContributionWikiStatus: (...args: unknown[]) => updateContributionWikiStatus(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
}))
jest.mock('@/lib/public-archive/wiki-editor-agent', () => ({
  processWikiEventDraft: (...args: unknown[]) => processWikiEventDraft(...args),
}))

describe('processPublicContributionWithWikiAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createAgentRun.mockResolvedValue({ id: 'run-1' })
    getActiveContributionWithElementsForWiki.mockResolvedValue({
      id: 'contribution-1',
      source_project_id: 'project-1',
      anonymized_title: '1976 Guangzhou memory',
      anonymized_text: 'A child remembered Guangzhou in 1976.',
      anonymized_summary: 'A Guangzhou memory.',
      elements: [{ element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 }],
    })
    getActiveContributionsWithElementsForCluster.mockResolvedValue([])
    listClusterableEventClusters.mockResolvedValue([])
    processWikiEventDraft.mockReturnValue({
      status: 'candidate',
      eventLabel: '1976 Guangzhou shared event memories',
      timeframe: '1976',
      placeScope: 'Guangzhou',
      historicalContextSummary: 'Contributor described a memory.',
      perspectiveSummary: 'A Guangzhou memory.',
      representativeExcerpts: ['A child remembered Guangzhou in 1976.'],
      uncertaintyNotes: 'Evidence-limited.',
      confidence: 0.65,
      activeContributionIds: ['contribution-1'],
    })
    createOrUpdatePublicEventCluster.mockResolvedValue({ id: 'event-1' })
    emptyPublicEventCluster.mockResolvedValue({ id: 'event-1', status: 'rejected' })
    linkPublicEventContributions.mockResolvedValue([{ id: 'link-1' }])
    createAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
    completeAgentRun.mockResolvedValue({ id: 'run-1', status: 'completed' })
    updateContributionWikiStatus.mockResolvedValue({ id: 'contribution-1', wiki_status: 'processed' })
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
  })

  it('processes a contribution through Wiki Editor and records artifacts', async () => {
    const result = await processPublicContributionWithWikiAgent({
      contributionId: 'contribution-1',
      actorUserId: 'user-1',
    })

    expect(result).toEqual({ eventClusterId: 'event-1', status: 'candidate' })
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentType: 'wiki_editor',
      projectId: null,
      storyId: null,
      interviewSessionId: null,
      model: 'deterministic-wiki-editor-agent',
    }))
    expect(createAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'wiki_event_candidate',
      projectId: 'project-1',
    }))
    expect(updateContributionWikiStatus).toHaveBeenCalledWith('contribution-1', 'processed')
  })

  it('re-clusters against an existing cluster\'s members when it joins one', async () => {
    listClusterableEventClusters.mockResolvedValueOnce([
      { id: 'event-1', timeframe: '1976', place_scope: 'Guangzhou', event_label: 'x', status: 'candidate' },
    ])
    processWikiEventDraft
      .mockReturnValueOnce({
        status: 'candidate', eventLabel: 'x', timeframe: '1976', placeScope: 'Guangzhou',
        historicalContextSummary: 'x', perspectiveSummary: 'x', representativeExcerpts: [], uncertaintyNotes: 'x',
        confidence: 0.65, activeContributionIds: ['contribution-1'], existingClusterId: 'event-1',
      })
      .mockReturnValueOnce({
        status: 'draft', eventLabel: 'x', timeframe: '1976', placeScope: 'Guangzhou',
        historicalContextSummary: 'x', perspectiveSummary: 'x', representativeExcerpts: [], uncertaintyNotes: 'x',
        confidence: 0.8, activeContributionIds: ['contribution-1', 'contribution-2'], existingClusterId: 'event-1',
      })
    getActiveContributionsWithElementsForCluster.mockResolvedValueOnce([{ id: 'contribution-2', elements: [] }])

    const result = await processPublicContributionWithWikiAgent({ contributionId: 'contribution-1', actorUserId: 'user-1' })

    expect(getActiveContributionsWithElementsForCluster).toHaveBeenCalledWith('event-1')
    expect(result.status).toBe('draft')
    expect(createAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({ artifactType: 'wiki_event_draft' }))
  })

  it('marks the contribution failed when no active contribution is found', async () => {
    getActiveContributionWithElementsForWiki.mockResolvedValueOnce(null)

    await expect(
      processPublicContributionWithWikiAgent({ contributionId: 'contribution-1', actorUserId: 'user-1' }),
    ).rejects.toThrow(/not found/)

    expect(createOrUpdatePublicEventCluster).not.toHaveBeenCalled()
    expect(updateContributionWikiStatus).toHaveBeenCalledWith('contribution-1', 'failed')
  })
})

describe('reprocessPublicEventCluster', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getActiveContributionsWithElementsForCluster.mockResolvedValue([{ id: 'contribution-1', elements: [] }])
    processWikiEventDraft.mockReturnValue({
      status: 'candidate', eventLabel: 'x', timeframe: '1976', placeScope: 'Guangzhou',
      historicalContextSummary: 'x', perspectiveSummary: 'x', representativeExcerpts: [], uncertaintyNotes: 'x',
      confidence: 0.65, activeContributionIds: ['contribution-1'],
    })
    createOrUpdatePublicEventCluster.mockResolvedValue({ id: 'event-1' })
    emptyPublicEventCluster.mockResolvedValue({ id: 'event-1', status: 'rejected' })
    linkPublicEventContributions.mockResolvedValue([])
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
  })

  it('recomputes a cluster from its remaining active contributions', async () => {
    const result = await reprocessPublicEventCluster('event-1', 'reviewer-1')

    expect(createOrUpdatePublicEventCluster).toHaveBeenCalledWith(expect.objectContaining({ existingClusterId: 'event-1' }))
    expect(result.eventClusterId).toBe('event-1')
    expect(result.activeContributions).toBe(1)
    expect(emptyPublicEventCluster).not.toHaveBeenCalled()
  })

  it('empties the cluster when no active contributions remain', async () => {
    getActiveContributionsWithElementsForCluster.mockResolvedValueOnce([])

    const result = await reprocessPublicEventCluster('event-1', 'reviewer-1')

    expect(emptyPublicEventCluster).toHaveBeenCalledWith('event-1')
    expect(result.status).toBe('rejected')
    expect(createOrUpdatePublicEventCluster).not.toHaveBeenCalled()
  })
})
