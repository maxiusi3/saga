import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { InterventionLevel } from '@saga/shared/types/agents'

const mockCreateInterviewSession = jest.fn()
const mockSmartRecorder = jest.fn(() => <div data-testid="smart-recorder" />)

jest.mock('@/components/recording/RecorderHub', () => ({
  RecorderHub: ({
    onModeSelect,
    onInterventionLevelChange,
  }: {
    onModeSelect: (mode: 'deep_dive' | 'chat') => void
    interventionLevel: InterventionLevel
    onInterventionLevelChange: (level: InterventionLevel) => void
  }) => (
    <>
      <button type="button" onClick={() => onInterventionLevelChange('high')}>
        Set high intervention
      </button>
      <button type="button" onClick={() => onModeSelect('deep_dive')}>
        Start recording
      </button>
    </>
  ),
}))

jest.mock('@/components/recording/SmartRecorder', () => ({
  SmartRecorder: (props: unknown) => mockSmartRecorder(props),
}))

jest.mock('@/lib/agent-service', () => ({
  agentService: {
    createInterviewSession: (...args: unknown[]) => mockCreateInterviewSession(...args),
  },
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
  beforeEach(() => {
    mockCreateInterviewSession.mockReset()
    mockSmartRecorder.mockClear()
  })

  it('uses SmartRecorder on the main recording path', async () => {
    mockCreateInterviewSession.mockResolvedValue({ id: 'interview-session-1' })
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default

    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    expect(await screen.findByTestId('smart-recorder')).toBeInTheDocument()
  })

  it('passes the selected intervention level and created session to SmartRecorder', async () => {
    mockCreateInterviewSession.mockResolvedValue({ id: 'interview-session-123' })
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default

    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: /set high intervention/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    await waitFor(() => {
      expect(mockCreateInterviewSession).toHaveBeenCalledWith({
        projectId: 'test-project-id',
        storytellerId: 'user-1',
        promptText: expect.any(String),
        recordingMode: 'deep_dive',
        interventionLevel: 'high',
      })
    })

    await screen.findByTestId('smart-recorder')
    expect(mockSmartRecorder).toHaveBeenLastCalledWith(expect.objectContaining({
      projectId: 'test-project-id',
      storytellerId: 'user-1',
      interviewSessionId: 'interview-session-123',
      interventionLevel: 'high',
    }))
  })
})
