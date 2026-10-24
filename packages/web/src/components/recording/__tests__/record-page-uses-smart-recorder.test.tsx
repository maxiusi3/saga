import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { InterventionLevel } from '@saga/shared/types/agents'

const mockCreateInterviewSession = jest.fn()
const mockSmartRecorder = jest.fn(() => <div data-testid="smart-recorder" />)
const mockRecoveryPanel = jest.fn(() => <div data-testid="recording-recovery" />)
const mockCreateStory = jest.fn()
const mockUpdateStory = jest.fn()
const mockProcessStoryWithEditorAgent = jest.fn()
const mockGenerateContent = jest.fn()
const mockUploadStoryAudio = jest.fn()

jest.setTimeout(30000)

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

jest.mock('@/components/recording/RecordingRecoveryPanel', () => ({
  RecordingRecoveryPanel: (props: unknown) => mockRecoveryPanel(props),
}))

jest.mock('@/lib/agent-service', () => ({
  agentService: {
    createInterviewSession: (...args: unknown[]) => mockCreateInterviewSession(...args),
    processStoryWithEditorAgent: (...args: unknown[]) => mockProcessStoryWithEditorAgent(...args),
  },
}))

jest.mock('@/lib/ai-service', () => ({
  aiService: {
    generateContentFromTranscript: (...args: unknown[]) => mockGenerateContent(...args),
  },
}))

jest.mock('@/lib/storage', () => ({
  uploadStoryAudio: (...args: unknown[]) => mockUploadStoryAudio(...args),
  StorageService: jest.fn(),
}))

jest.mock('@/lib/stories', () => ({
  storyService: {
    createStory: (...args: unknown[]) => mockCreateStory(...args),
    updateStory: (...args: unknown[]) => mockUpdateStory(...args),
  },
}))

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ user: { id: 'user-1' } }),
}))

describe('record page V1.8 recorder selection', () => {
  beforeEach(() => {
    mockCreateInterviewSession.mockReset()
    mockSmartRecorder.mockClear()
    mockRecoveryPanel.mockClear()
    mockCreateStory.mockReset()
    mockUpdateStory.mockReset()
    mockProcessStoryWithEditorAgent.mockReset()
    mockGenerateContent.mockReset()
    mockUploadStoryAudio.mockReset()
  })

  it('offers scoped local recovery in the hub and removes it when recording starts', async () => {
    mockCreateInterviewSession.mockResolvedValue({ id: 'recovery-test-interview' })
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default
    render(<Page />)
    expect(await screen.findByTestId('recording-recovery')).toBeInTheDocument()
    expect(mockRecoveryPanel).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'user-1', projectId: expect.any(String) }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    expect(screen.queryByTestId('recording-recovery')).not.toBeInTheDocument()
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

  it('offers a text story fallback when browser recording permission is denied', async () => {
    mockCreateInterviewSession.mockResolvedValue({ id: 'interview-session-1' })
    mockCreateStory.mockResolvedValue({ id: 'story-1' })
    mockProcessStoryWithEditorAgent.mockResolvedValue({})
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default

    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    await screen.findByTestId('smart-recorder')
    const recorderProps = mockSmartRecorder.mock.lastCall?.[0] as { onError: (message: string) => void }

    act(() => {
      recorderProps.onError('Permission denied')
    })

    expect(await screen.findByRole('heading', { name: /write this story instead/i })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Smoke test typed story' },
    })
    fireEvent.change(screen.getByLabelText(/story text/i), {
      target: { value: 'This story was typed because browser microphone permission was denied.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save text story/i }))

    await waitFor(() => {
      expect(mockCreateStory).toHaveBeenCalledWith(expect.objectContaining({
        project_id: 'test-project-id',
        storyteller_id: 'user-1',
        title: 'Smoke test typed story',
        content: 'This story was typed because browser microphone permission was denied.',
        transcript: 'This story was typed because browser microphone permission was denied.',
        audio_duration: 0,
        recording_mode: 'chat',
      }))
    })
  })
})

describe('recording review truthfulness', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const originalResizeObserver = global.ResizeObserver
  type Completion = (result: { audioBlob: Blob; transcript?: string; duration: number }) => Promise<void>

  beforeEach(() => {
    mockCreateInterviewSession.mockResolvedValue({ id: 'interview-1' })
    mockSmartRecorder.mockClear()
    mockGenerateContent.mockReset()
    mockUploadStoryAudio.mockReset().mockResolvedValue({ success: true, url: 'user-1/projects/test-project-id/stories/temp/audio.webm' })
    mockCreateStory.mockReset().mockResolvedValue({ id: 'saved-story' })
    mockProcessStoryWithEditorAgent.mockResolvedValue({})
    URL.createObjectURL = jest.fn(() => 'blob:recorded-audio')
    URL.revokeObjectURL = jest.fn()
    global.ResizeObserver = jest.fn().mockImplementation(() => ({ observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }))
    jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    global.ResizeObserver = originalResizeObserver
  })

  async function startRecording() {
    fireEvent.click(screen.getByRole('button', { name: /^start recording$/i }))
    await screen.findByTestId('smart-recorder')
    return (mockSmartRecorder.mock.lastCall?.[0] as { onRecordingComplete: Completion }).onRecordingComplete
  }

  it('shows draft failure and still saves the original recording without AI content', async () => {
    mockGenerateContent.mockRejectedValue(new Error('provider unavailable'))
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default
    render(<Page />)
    const finish = await startRecording()
    const audio = new Blob(['first recording'])
    await act(async () => { await finish({ audioBlob: audio, transcript: 'The actual words.', duration: 12 }) })

    expect(screen.getByRole('alert')).toHaveTextContent(/draft could not be prepared/i)
    expect(screen.getByText(/original recording/i)).toBeInTheDocument()
    expect(screen.queryByText(/auto-leveling applied/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /save to timeline/i }))

    await waitFor(() => expect(mockCreateStory).toHaveBeenCalledWith(expect.objectContaining({
      transcript: 'The actual words.',
      content: '',
      audio_url: 'user-1/projects/test-project-id/stories/temp/audio.webm',
      ai_summary: undefined,
      ai_confidence_score: undefined,
    })))
    expect(mockUploadStoryAudio).toHaveBeenCalledWith(audio, 'test-project-id')
  })

  it('does not save old transcript or late AI content into the next recording', async () => {
    let resolveOld!: (content: unknown) => void
    mockGenerateContent.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default
    render(<Page />)
    const finishOld = await startRecording()
    let oldProcessing!: Promise<void>
    act(() => { oldProcessing = finishOld({ audioBlob: new Blob(['old audio']), transcript: 'Old transcript', duration: 10 }) })
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    const finishNew = await startRecording()
    const newAudio = new Blob(['new audio'])
    await act(async () => { await finishNew({ audioBlob: newAudio, duration: 15 }) })
    expect(screen.getByRole('status')).toHaveTextContent(/no transcript is available/i)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveOld({ title: 'Old title', summary: 'Old summary', transcript: 'Old transcript', followUpQuestions: [], confidence: 0.9 })
      await oldProcessing
    })
    fireEvent.click(screen.getByRole('button', { name: /save to timeline/i }))

    await waitFor(() => expect(mockCreateStory).toHaveBeenCalledWith(expect.objectContaining({
      transcript: '', content: '', ai_summary: undefined, ai_generated_title: undefined,
    })))
    expect(mockUploadStoryAudio).toHaveBeenCalledWith(newAudio, 'test-project-id')
  })

  it('ignores an old failed request while the current draft is still processing', async () => {
    let rejectOld!: (reason: Error) => void
    let resolveNew!: (content: unknown) => void
    mockGenerateContent
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve }))
    const Page = (await import('@/app/[locale]/dashboard/projects/[id]/record/page')).default
    render(<Page />)
    const finishOld = await startRecording()
    let oldProcessing!: Promise<void>
    act(() => { oldProcessing = finishOld({ audioBlob: new Blob(['old']), transcript: 'Old words', duration: 10 }) })
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    const finishNew = await startRecording()
    let newProcessing!: Promise<void>
    act(() => { newProcessing = finishNew({ audioBlob: new Blob(['new']), transcript: 'New words', duration: 12 }) })
    await act(async () => { rejectOld(new Error('old failure')); await oldProcessing })

    expect(screen.getByRole('status')).toHaveTextContent(/preparing a draft/i)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await act(async () => {
      resolveNew({ title: 'New title', summary: 'New account', followUpQuestions: [], transcript: 'New words' })
      await newProcessing
    })
    fireEvent.click(screen.getByRole('button', { name: /save to timeline/i }))
    await waitFor(() => expect(mockCreateStory).toHaveBeenCalledWith(expect.objectContaining({ transcript: 'New words', ai_summary: 'New account' })))
  })
})
