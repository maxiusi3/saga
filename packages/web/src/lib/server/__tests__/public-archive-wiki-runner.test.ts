/**
 * @jest-environment node
 */

import { processPublicContributionWithWikiAgent } from '../public-archive-wiki-runner'

const createAgentRun = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()
const createAgentArtifact = jest.fn()
const getActiveContributionWithElementsForWiki = jest.fn()
const createOrUpdatePublicEventCluster = jest.fn()
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
  createOrUpdatePublicEventCluster: (...args: unknown[]) => createOrUpdatePublicEventCluster(...args),
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
      anonymized_title: '1976 Guangzhou memory',
      anonymized_text: 'A child remembered Guangzhou in 1976.',
      anonymized_summary: 'A Guangzhou memory.',
      elements: [{ element_type: 'time', value: '1976', normalized_value: '1976', confidence: 0.9 }],
    })
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
    }))
    expect(updateContributionWikiStatus).toHaveBeenCalledWith('contribution-1', 'processed')
  })
})
