import {
  createAgentRun,
  completeAgentRun,
  failAgentRun,
  createInterviewSession,
  completeInterviewSession,
  createInterviewEvent,
  createAgentArtifact,
  createStoryElements,
  getAgentArtifactsForStory,
  getStoryElementsForStory,
} from '../agent-store'

const insertSingle = jest.fn()
const insertSingleSelect = jest.fn(() => ({ single: insertSingle }))
const insertSingleRows = jest.fn(() => ({ select: insertSingleSelect }))

const insertRowsSelect = jest.fn()
const insertRows = jest.fn(() => ({ select: insertRowsSelect }))

const updateSingle = jest.fn()
const updateSelect = jest.fn(() => ({ single: updateSingle }))
const updateEq = jest.fn(() => ({ select: updateSelect }))
const update = jest.fn(() => ({ eq: updateEq }))

const order = jest.fn()
const queryEq = jest.fn(() => ({ order }))
const querySelect = jest.fn(() => ({ eq: queryEq }))

const from = jest.fn((table: string) => ({
  insert: table === 'story_elements' ? insertRows : insertSingleRows,
  update,
  select: querySelect,
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

describe('agent-store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    insertSingle.mockResolvedValue({ data: { id: 'row-1' }, error: null })
    insertRowsSelect.mockResolvedValue({ data: [{ id: 'element-1' }], error: null })
    updateSingle.mockResolvedValue({ data: { id: 'run-1', status: 'completed' }, error: null })
    order.mockResolvedValue({ data: [{ id: 'result-1' }], error: null })
  })

  it('creates agent runs and returns inserted row', async () => {
    const result = await createAgentRun({
      agentType: 'interview',
      projectId: 'project-1',
      storyId: null,
      interviewSessionId: null,
      createdBy: 'user-1',
      input: { phase: 'opening' },
      model: 'deterministic-v1',
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('agent_runs')
    expect(insertSingleRows).toHaveBeenCalledWith({
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

  it('completes agent runs and filters by id', async () => {
    const result = await completeAgentRun('run-1', { prompt: 'Welcome.' })

    expect(result).toEqual({ id: 'run-1', status: 'completed' })
    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      output: { prompt: 'Welcome.' },
      completed_at: expect.any(String),
      error: null,
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'run-1')
  })

  it('fails agent runs and filters by id', async () => {
    updateSingle.mockResolvedValueOnce({ data: { id: 'run-1', status: 'failed' }, error: null })

    const result = await failAgentRun('run-1', 'model timed out')

    expect(result).toEqual({ id: 'run-1', status: 'failed' })
    expect(update).toHaveBeenCalledWith({
      status: 'failed',
      error: 'model timed out',
      completed_at: expect.any(String),
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'run-1')
  })

  it('creates interview sessions preserving empty prompt text', async () => {
    const result = await createInterviewSession({
      projectId: 'project-1',
      storytellerId: 'user-1',
      promptText: '',
      recordingMode: 'deep_dive',
      interventionLevel: 'low',
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('interview_sessions')
    expect(insertSingleRows).toHaveBeenCalledWith({
      project_id: 'project-1',
      storyteller_id: 'user-1',
      prompt_text: '',
      recording_mode: 'deep_dive',
      intervention_level: 'low',
      status: 'active',
    })
  })

  it('completes interview sessions and filters by id', async () => {
    updateSingle.mockResolvedValueOnce({ data: { id: 'session-1', status: 'completed' }, error: null })

    const result = await completeInterviewSession('session-1')

    expect(result).toEqual({ id: 'session-1', status: 'completed' })
    expect(from).toHaveBeenCalledWith('interview_sessions')
    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      completed_at: expect.any(String),
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'session-1')
  })

  it('creates interview events preserving empty transcript windows', async () => {
    const result = await createInterviewEvent({
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

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('interview_events')
    expect(insertSingleRows).toHaveBeenCalledWith({
      interview_session_id: 'session-1',
      project_id: 'project-1',
      storyteller_id: 'user-1',
      event_kind: 'opening',
      intervention_level: 'low',
      trigger_reason: 'session_started',
      prompt_text: 'Welcome. Take your time.',
      transcript_window: '',
      transcript_start_offset: null,
      transcript_end_offset: null,
      accepted: null,
    })
  })

  it('creates artifacts preserving empty story ids', async () => {
    const result = await createAgentArtifact({
      agentRunId: 'run-1',
      projectId: 'project-1',
      storyId: '',
      artifactType: 'standalone_story',
      payload: { title: 'A Story' },
      sourceRefs: [],
      confidence: 0.85,
    })

    expect(result).toEqual({ id: 'row-1' })
    expect(from).toHaveBeenCalledWith('agent_artifacts')
    expect(insertSingleRows).toHaveBeenCalledWith({
      agent_run_id: 'run-1',
      project_id: 'project-1',
      story_id: '',
      artifact_type: 'standalone_story',
      payload: { title: 'A Story' },
      source_refs: [],
      confidence: 0.85,
      review_status: 'unreviewed',
    })
  })

  it('creates story elements with row-returning insert select', async () => {
    insertRowsSelect.mockResolvedValueOnce({
      data: [{ id: 'element-1', value: '1976' }],
      error: null,
    })

    const result = await createStoryElements([
      {
        projectId: 'project-1',
        storyId: 'story-1',
        agentRunId: 'run-1',
        elementType: 'time',
        value: '1976',
        normalizedValue: '',
        sourceQuote: 'In 1976',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        confidence: 0.9,
      },
    ])

    expect(result).toEqual([{ id: 'element-1', value: '1976' }])
    expect(from).toHaveBeenCalledWith('story_elements')
    expect(insertRows).toHaveBeenCalledWith([
      {
        project_id: 'project-1',
        story_id: 'story-1',
        agent_run_id: 'run-1',
        element_type: 'time',
        value: '1976',
        normalized_value: '',
        source_quote: 'In 1976',
        source_start_offset: 0,
        source_end_offset: 7,
        confidence: 0.9,
        review_status: 'unreviewed',
      },
    ])
    expect(insertRowsSelect).toHaveBeenCalledWith()
  })

  it('returns an empty array without calling supabase for empty story elements', async () => {
    await expect(createStoryElements([])).resolves.toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('gets agent artifacts for a story newest first', async () => {
    order.mockResolvedValueOnce({ data: [{ id: 'artifact-1' }], error: null })

    const result = await getAgentArtifactsForStory('story-1')

    expect(result).toEqual([{ id: 'artifact-1' }])
    expect(from).toHaveBeenCalledWith('agent_artifacts')
    expect(querySelect).toHaveBeenCalledWith('*')
    expect(queryEq).toHaveBeenCalledWith('story_id', 'story-1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('gets story elements for a story oldest first', async () => {
    order.mockResolvedValueOnce({ data: [{ id: 'element-1' }], error: null })

    const result = await getStoryElementsForStory('story-1')

    expect(result).toEqual([{ id: 'element-1' }])
    expect(from).toHaveBeenCalledWith('story_elements')
    expect(querySelect).toHaveBeenCalledWith('*')
    expect(queryEq).toHaveBeenCalledWith('story_id', 'story-1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('uses fallback error messages for supabase errors without messages', async () => {
    insertSingle.mockResolvedValueOnce({ data: null, error: {} })

    await expect(
      createAgentRun({
        agentType: 'interview',
        projectId: 'project-1',
        storyId: null,
        interviewSessionId: null,
        createdBy: 'user-1',
        input: {},
        model: 'deterministic-v1',
      }),
    ).rejects.toThrow('Supabase agent store operation failed')
  })
})
