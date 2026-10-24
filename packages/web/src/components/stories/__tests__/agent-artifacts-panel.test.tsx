/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { AgentArtifactsPanel } from '../AgentArtifactsPanel'

describe('AgentArtifactsPanel', () => {
  it('renders the standalone story and extracted elements for review', () => {
    render(
      <AgentArtifactsPanel
        standaloneStory={{
          title: 'A Market Morning',
          body: 'In 1976 my mother took me to Guangzhou. I learned courage.',
          summary: 'A memory about courage.',
        }}
        elements={[
          {
            id: 'element-1',
            project_id: 'project-1',
            story_id: 'story-1',
            agent_run_id: 'run-1',
            element_type: 'time',
            value: '1976',
            normalized_value: '1976',
            source_quote: '1976',
            source_start_offset: 3,
            source_end_offset: 7,
            confidence: 0.9,
            review_status: 'unreviewed',
            created_at: '2026-01-02T03:04:05.000Z',
            updated_at: '2026-01-02T03:04:05.000Z',
          },
          {
            id: 'element-2',
            project_id: 'project-1',
            story_id: 'story-1',
            agent_run_id: 'run-1',
            element_type: 'place',
            value: 'Guangzhou',
            normalized_value: 'Guangzhou',
            source_quote: 'Guangzhou',
            source_start_offset: 29,
            source_end_offset: 38,
            confidence: 0.75,
            review_status: 'unreviewed',
            created_at: '2026-01-02T03:04:05.000Z',
            updated_at: '2026-01-02T03:04:05.000Z',
          },
        ]}
        artifacts={[]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Editor Agent Review' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A Market Morning' })).toBeInTheDocument()
    expect(screen.getByText('A memory about courage.')).toBeInTheDocument()
    expect(screen.getByText('In 1976 my mother took me to Guangzhou. I learned courage.')).toBeInTheDocument()
    expect(screen.getByText('Extracted Story Elements')).toBeInTheDocument()
    expect(screen.getAllByText('2 elements')).toHaveLength(2)
    expect(screen.getByText('time')).toBeInTheDocument()
    expect(screen.getByText('place')).toBeInTheDocument()
    expect(screen.getAllByText('1976')).toHaveLength(2)
    expect(screen.getAllByText('Guangzhou')).toHaveLength(2)
    expect(screen.getByText('90% confidence')).toBeInTheDocument()
    expect(screen.getByText('75% confidence')).toBeInTheDocument()
    expect(screen.getByText('Offsets 3-7')).toBeInTheDocument()
    expect(screen.getByText('Offsets 29-38')).toBeInTheDocument()
  })

  it('renders nothing when there are no editor artifacts', () => {
    const { container } = render(
      <AgentArtifactsPanel standaloneStory={null} elements={[]} artifacts={[]} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('orders names/relations/dates first, supports audio seek playback, and preserves disputed memories', () => {
    const onSeekAudio = jest.fn()
    const onReviewDecision = jest.fn()

    render(
      <AgentArtifactsPanel
        standaloneStory={null}
        elements={[]}
        artifacts={[]}
        onSeekAudio={onSeekAudio}
        onReviewDecision={onReviewDecision}
        assertions={[
          {
            id: 'assert-event',
            projectId: 'proj-1',
            storyId: 'story-1',
            transcriptVersionId: 'tv-1',
            segmentId: 'seg-2',
            assertionType: 'event',
            subject: 'Rebuilt cedar boat',
            claimText: 'We rebuilt the cedar boat after the storm.',
            sourceQuote: 'rebuilt the cedar boat',
            startMs: 65000,
            endMs: 90000,
            datePrecision: 'exact',
            memoryAttribution: 'storyteller_memory',
            verificationStatus: 'verified',
            reviewDecision: 'unreviewed',
            isSevereFabrication: false,
            rejectionReason: null,
            disputedAlternativeText: null,
            disputedBy: null,
            reviewedBy: null,
            reviewerNote: null,
          },
          {
            id: 'assert-person',
            projectId: 'proj-1',
            storyId: 'story-1',
            transcriptVersionId: 'tv-1',
            segmentId: 'seg-1',
            assertionType: 'person',
            subject: 'Uncle Arthur',
            claimText: 'Uncle Arthur led the harbor repair in 1968.',
            sourceQuote: 'my maternal uncle Uncle Arthur',
            startMs: 5000,
            endMs: 25000,
            datePrecision: 'exact',
            memoryAttribution: 'disputed_memory',
            verificationStatus: 'disputed',
            reviewDecision: 'disputed',
            isSevereFabrication: false,
            rejectionReason: null,
            disputedAlternativeText: 'Aunt Clara remembers it was autumn 1969.',
            disputedBy: 'Aunt Clara',
            reviewedBy: 'Aunt Clara',
            reviewerNote: null,
          },
        ]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Fact & Provenance Check (Names, Relations & Dates First)' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Preserved Family Alternative \(Aunt Clara\):/)).toBeInTheDocument()

    const listenBtn = screen.getByRole('button', { name: 'Listen [00:05 - 00:25]' })
    fireEvent.click(listenBtn)
    expect(onSeekAudio).toHaveBeenCalledWith(5000, 25000, 'seg-1')

    const disputeButtons = screen.getAllByRole('button', { name: 'Keep Dispute' })
    fireEvent.click(disputeButtons[0])
    expect(onReviewDecision).toHaveBeenCalledWith('assert-person', 'dispute')
  })
})
