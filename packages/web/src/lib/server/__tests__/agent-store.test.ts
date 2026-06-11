import {
  createAgentRun,
  completeAgentRun,
  createInterviewSession,
  createInterviewEvent,
  createAgentArtifact,
  createStoryElements,
} from '../agent-store'

const single = jest.fn()
const select = jest.fn(() => ({ single }))
const insert = jest.fn(() => ({ select }))
const updateSingle = jest.fn()
const updateSelect = jest.fn(() => ({ single: updateSingle }))
const eq = jest.fn(() => ({ select: updateSelect }))
const update = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ insert, update }))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

describe('agent-store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    single.mockResolvedValue({ data: { id: 'row-1' }, error: null })
    updateSingle.mockResolvedValue({ data: { id: 'run-1', status: 'completed' }, error: null })
  })

  it('creates agent runs', async () => {
    await createAgentRun({
      agentType: 'interview',
      projectId: 'project-1',
      storyId: null,
      interviewSessionId: null,
      createdBy: 'user-1',
      input: { phase: 'opening' },
      model: 'deterministic-v1',
    })

    expect(from).toHaveBeenCalledWith('agent_runs')
    expect(insert).toHaveBeenCalledWith({
      agent_type: 'interview',
      status: 'running',
      project_id: 'project-1',
      story_id: null,
      interview_session_id: null,
      created_by: 'user-1',
      input: { phase: 'opening' },
      model: 'deterministic-v1',
    })
  })

  it('completes agent runs', async () => {
    await completeAgentRun('run-1', { prompt: 'Welcome.' })

    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      output: { prompt: 'Welcome.' },
      completed_at: expect.any(String),
      error: null,
    })
  })

  it('creates interview sessions and events', async () => {
    await createInterviewSession({
      projectId: 'project-1',
      storytellerId: 'user-1',
      promptText: 'Tell me about your childhood.',
      recordingMode: 'deep_dive',
      interventionLevel: 'low',
    })

    await createInterviewEvent({
      interviewSessionId: 'session-1',
      projectId: 'project-1',
      storytellerId: 'user-1',
      eventKind: 'opening',
      interventionLevel: 'low',
      triggerReason: 'session_started',
      promptText: 'Welcome. Take your time.',
      transcriptWindow: '',
      transcriptStartOffset: null,
      transcriptEndOffset: null,
    })

    expect(from).toHaveBeenCalledWith('interview_sessions')
    expect(from).toHaveBeenCalledWith('interview_events')
  })

  it('creates artifacts and story elements', async () => {
    await createAgentArtifact({
      agentRunId: 'run-1',
      projectId: 'project-1',
      storyId: 'story-1',
      artifactType: 'standalone_story',
      payload: { title: 'A Story' },
      sourceRefs: [],
      confidence: 0.85,
    })

    await createStoryElements([
      {
        projectId: 'project-1',
        storyId: 'story-1',
        agentRunId: 'run-1',
        elementType: 'time',
        value: '1976',
        normalizedValue: '1976',
        sourceQuote: 'In 1976',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        confidence: 0.9,
      },
    ])

    expect(from).toHaveBeenCalledWith('agent_artifacts')
    expect(from).toHaveBeenCalledWith('story_elements')
  })
})
