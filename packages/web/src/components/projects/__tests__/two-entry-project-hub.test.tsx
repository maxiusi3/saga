import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TwoEntryProjectHub } from '../TwoEntryProjectHub'

describe('TwoEntryProjectHub (T01/T09/T10 Two-Entry, Provenance Search & Offline Export UI)', () => {
  it('disables unavailable actions instead of presenting silent no-op buttons', () => {
    render(<TwoEntryProjectHub projectId="project-1" projectName="Family archive" />)
    for (const id of ['entry-upload-existing-btn', 'entry-record-or-invite-btn', 'provenance-search-submit-btn', 'export-complete-archive-btn']) {
      expect(screen.getByTestId(id)).toBeDisabled()
    }
  })

  it('shows recoverable search and export errors without displaying provider details', async () => {
    render(<TwoEntryProjectHub projectId="project-1" projectName="Family archive"
      onSearch={jest.fn().mockRejectedValue(new Error('private details'))}
      onTriggerExport={jest.fn().mockRejectedValue(new Error('private details'))} />)
    fireEvent.click(screen.getByTestId('provenance-search-submit-btn'))
    await waitFor(() => expect(screen.getByText('Search is unavailable. Please try again.')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-complete-archive-btn'))
    await waitFor(() => expect(screen.getByText('The archive could not be verified or downloaded. Please try again.')).toBeInTheDocument())
    expect(screen.queryByText('private details')).not.toBeInTheDocument()
  })

  it('renders both primary entries (Upload Existing Audio & Record/Invite) and triggers callbacks', () => {
    const onUpload = jest.fn()
    const onRecord = jest.fn()

    render(
      <TwoEntryProjectHub
        projectId="proj-hub-1"
        projectName="Grandma Eleanor Family Saga"
        hostingExpiresAt="2027-10-24"
        onSelectUploadExisting={onUpload}
        onSelectRecordOrInvite={onRecord}
      />,
    )

    fireEvent.click(screen.getByTestId('entry-upload-existing-btn'))
    expect(onUpload).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('entry-record-or-invite-btn'))
    expect(onRecord).toHaveBeenCalledTimes(1)
  })

  it('executes provenance search, displays grounded audio citations, and seeks audio on click', async () => {
    const onSeek = jest.fn()
    const onSearch = jest.fn().mockResolvedValue({
      status: 'grounded_answer',
      answerText: 'Found 1 verified source segment(s)',
      citations: [
        {
          entryId: 'entry-1',
          storyId: 'story-1',
          storyTitle: 'Moving to Chicago in 1968',
          transcriptVersionId: 'tv-1',
          mediaAssetId: 'asset-1',
          segmentId: 'seg-1968',
          startMs: 0,
          endMs: 4800,
          quotedText: 'In 1968 Grandma Eleanor moved to Chicago with Uncle Bob.',
          matchedPeople: ['Grandma Eleanor'],
          matchedDates: ['1968'],
          matchedPlaces: ['Chicago'],
          score: 10,
        },
      ],
    })

    render(
      <TwoEntryProjectHub
        projectId="proj-hub-1"
        projectName="Grandma Eleanor Family Saga"
        onSearch={onSearch}
        onSeekAudioCitation={onSeek}
      />,
    )

    fireEvent.change(screen.getByTestId('provenance-search-query-input'), {
      target: { value: 'Chicago 1968' },
    })
    fireEvent.click(screen.getByTestId('provenance-search-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('provenance-search-answer')).toHaveTextContent(
        'Found 1 verified source segment(s)',
      )
    })

    fireEvent.click(screen.getByTestId('seek-citation-seg-1968'))
    expect(onSeek).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: 'seg-1968',
        startMs: 0,
        endMs: 4800,
      }),
    )
  })
})
