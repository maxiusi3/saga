/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicArchivePanel } from '../PublicArchivePanel'

describe('PublicArchivePanel', () => {
  it('shows storyteller contribution action and preview confirmation', async () => {
    const onGeneratePreview = jest.fn().mockResolvedValue({
      previewId: 'preview-1',
      anonymizedTitle: 'A market memory',
      anonymizedText: 'An anonymized story.',
      anonymizedSummary: 'Summary.',
      elements: [{ elementType: 'time', value: '1976', normalizedValue: '1976', sourceQuote: '1976', confidence: 0.9 }],
      excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
    })
    const onCommit = jest.fn().mockResolvedValue({ id: 'contribution-1' })

    render(
      <PublicArchivePanel
        storyId="story-1"
        userRole="storyteller"
        isStoryteller
        contribution={null}
        approvedEvents={[]}
        onGeneratePreview={onGeneratePreview}
        onCommit={onCommit}
        onInvite={jest.fn()}
        onWithdraw={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Anonymously add this story to the Collective Archive' }))

    await waitFor(() => expect(screen.getByText('An anonymized story.')).toBeInTheDocument())
    expect(screen.getByText('Not included: voice, audio, photos, generated media, exact identity')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Join Collective Archive' }))
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('preview-1'))
  })

  it('shows facilitator invitation action without consent controls', async () => {
    const onInvite = jest.fn().mockResolvedValue({ id: 'invitation-1' })

    render(
      <PublicArchivePanel
        storyId="story-1"
        userRole="facilitator"
        isStoryteller={false}
        contribution={null}
        approvedEvents={[]}
        onGeneratePreview={jest.fn()}
        onCommit={jest.fn()}
        onInvite={onInvite}
        onWithdraw={jest.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Join Collective Archive' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Invite storyteller to contribute' }))
    await waitFor(() => expect(onInvite).toHaveBeenCalled())
  })

  it('shows committed contribution and withdrawal action', async () => {
    const onWithdraw = jest.fn().mockResolvedValue(undefined)

    render(
      <PublicArchivePanel
        storyId="story-1"
        userRole="storyteller"
        isStoryteller
        contribution={{ id: 'contribution-1', status: 'active', anonymized_text: 'Anonymized text', wiki_status: 'pending' }}
        approvedEvents={[]}
        onGeneratePreview={jest.fn()}
        onCommit={jest.fn()}
        onInvite={jest.fn()}
        onWithdraw={onWithdraw}
      />,
    )

    expect(screen.getByText('Anonymized text')).toBeInTheDocument()
    expect(screen.getByText('Wiki summary pending review')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw contribution' }))
    await waitFor(() => expect(onWithdraw).toHaveBeenCalledWith('contribution-1'))
  })
})
