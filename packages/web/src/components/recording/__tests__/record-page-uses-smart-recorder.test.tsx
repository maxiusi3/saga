import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      <button type="button" onClick={() => onModeSelect('chat')}>
        Start chat recording
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

  it('renders SmartRecorder immediately while interview session creation continues in the background', async () => {
    let resolveSession!: (session: { id: string }) => void
    mockCreateInterviewSession.mockImplementation(() => new Promise<{ id: string }>(resolve => {
      resolveSession = resolve
    }))
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default

    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    expect(screen.getByTestId('smart-recorder')).toBeInTheDocument()
    expect(mockSmartRecorder).toHaveBeenLastCalledWith(expect.objectContaining({
      interviewSessionId: null,
      interventionLevel: 'low',
    }))

    await act(async () => {
      resolveSession({ id: 'interview-session-background' })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockSmartRecorder).toHaveBeenLastCalledWith(expect.objectContaining({
        interviewSessionId: 'interview-session-background',
      }))
    })
  })

  it('does not apply a stale interview session after the selected mode changes', async () => {
    const sessionResolvers: Array<(session: { id: string }) => void> = []
    mockCreateInterviewSession.mockImplementation(() => new Promise<{ id: string }>(resolve => {
      sessionResolvers.push(resolve)
    }))
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default

    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    expect(screen.getByTestId('smart-recorder')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back to mode selection/i }))
    fireEvent.click(screen.getByRole('button', { name: /start chat recording/i }))
    expect(screen.getByTestId('smart-recorder')).toBeInTheDocument()
    expect(mockCreateInterviewSession).toHaveBeenCalledTimes(2)

    await act(async () => {
      sessionResolvers[0]({ id: 'stale-session' })
      await Promise.resolve()
    })

    expect(mockSmartRecorder).not.toHaveBeenLastCalledWith(expect.objectContaining({
      interviewSessionId: 'stale-session',
    }))

    await act(async () => {
      sessionResolvers[1]({ id: 'current-session' })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockSmartRecorder).toHaveBeenLastCalledWith(expect.objectContaining({
        interviewSessionId: 'current-session',
      }))
    })
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
