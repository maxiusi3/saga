import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/recording/RecorderHub', () => ({
  RecorderHub: ({ onModeSelect }: { onModeSelect: (mode: 'deep_dive' | 'chat') => void }) => (
    <button type="button" onClick={() => onModeSelect('deep_dive')}>
      Start recording
    </button>
  ),
}))

jest.mock('@/components/recording/SmartRecorder', () => ({
  SmartRecorder: () => <div data-testid="smart-recorder" />,
}))

jest.mock('@/lib/ai-service', () => ({
  aiService: {
    generateContentFromTranscript: jest.fn(),
  },
}))

jest.mock('@/lib/storage', () => ({
  uploadStoryAudio: jest.fn(),
  StorageService: jest.fn(),
}))

jest.mock('@/lib/stories', () => ({
  storyService: {
    createStory: jest.fn(),
    updateStory: jest.fn(),
  },
}))

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ user: { id: 'user-1' } }),
}))

describe('record page V1.8 recorder selection', () => {
  it('uses SmartRecorder on the main recording path', async () => {
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default

    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    expect(await screen.findByTestId('smart-recorder')).toBeInTheDocument()
  })
})
