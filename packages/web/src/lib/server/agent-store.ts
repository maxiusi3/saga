import type {
  AgentType,
  AgentReviewStatus,
  InterviewEventKind,
  InterventionLevel,
  StoryElementType,
} from '@saga/shared/types/agents'
import { getSupabaseAdmin } from '@/lib/supabase'

type JsonObject = Record<string, unknown>
type SourceRefInput = Record<string, unknown>

function raise(error: { message?: string; code?: string } | null) {
  if (!error) return

  const storeError = new Error(error.message || 'Supabase agent store operation failed') as Error & {
    code?: string
  }
  storeError.code = error.code
  throw storeError
}

export async function createAgentRun(input: {
  agentType: AgentType
  projectId: string | null
  storyId: string | null
  interviewSessionId: string | null
  createdBy: string
  input: JsonObject
  contentHash?: string | null
  model: string
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .insert({
      agent_type: input.agentType,
      status: 'running',
      project_id: input.projectId,
      story_id: input.storyId,
      interview_session_id: input.interviewSessionId,
      created_by: input.createdBy,
      input: input.input,
      content_hash: input.contentHash ?? null,
      model: input.model,
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function completeAgentRun(agentRunId: string, output: JsonObject) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .update({
      status: 'completed',
      output,
      completed_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', agentRunId)
    .select()
    .single()

  raise(error)
  return data
}

export async function failAgentRun(agentRunId: string, errorMessage: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .update({
      status: 'failed',
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', agentRunId)
    .select()
    .single()

  raise(error)
  return data
}

export async function createInterviewSession(input: {
  projectId: string
  storytellerId: string
  promptText?: string | null
  recordingMode: 'deep_dive' | 'chat'
  interventionLevel: InterventionLevel
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('interview_sessions')
    .insert({
      project_id: input.projectId,
      storyteller_id: input.storytellerId,
      prompt_text: input.promptText ?? null,
      recording_mode: input.recordingMode,
      intervention_level: input.interventionLevel,
      status: 'active',
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function completeInterviewSession(interviewSessionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('interview_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', interviewSessionId)
    .select()
    .single()

  raise(error)
  return data
}

export async function createInterviewEvent(input: {
  interviewSessionId: string
  projectId: string
  storytellerId: string
  eventKind: InterviewEventKind
  interventionLevel: InterventionLevel
  triggerReason: string
  promptText: string
  transcriptWindow?: string | null
  transcriptStartOffset?: number | null
  transcriptEndOffset?: number | null
  accepted?: boolean | null
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('interview_events')
    .insert({
      interview_session_id: input.interviewSessionId,
      project_id: input.projectId,
      storyteller_id: input.storytellerId,
      event_kind: input.eventKind,
      intervention_level: input.interventionLevel,
      trigger_reason: input.triggerReason,
      prompt_text: input.promptText,
      transcript_window: input.transcriptWindow ?? null,
      transcript_start_offset: input.transcriptStartOffset ?? null,
      transcript_end_offset: input.transcriptEndOffset ?? null,
      accepted: input.accepted ?? null,
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function createAgentArtifact(input: {
  agentRunId: string
  projectId: string
  storyId?: string | null
  artifactType: 'host_intervention' | 'standalone_story' | 'story_summary' | 'follow_up_questions' | 'story_elements'
  payload: JsonObject
  sourceRefs: SourceRefInput[]
  confidence: number
  reviewStatus?: AgentReviewStatus
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_artifacts')
    .insert({
      agent_run_id: input.agentRunId,
      project_id: input.projectId,
      story_id: input.storyId ?? null,
      artifact_type: input.artifactType,
      payload: input.payload,
      source_refs: input.sourceRefs,
      confidence: input.confidence,
      review_status: input.reviewStatus || 'unreviewed',
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function createStoryElements(
  elements: Array<{
    projectId: string
    storyId: string
    agentRunId: string
    elementType: StoryElementType
    value: string
    normalizedValue?: string | null
    sourceQuote: string
    sourceStartOffset?: number | null
    sourceEndOffset?: number | null
    confidence: number
    reviewStatus?: AgentReviewStatus
  }>,
) {
  if (elements.length === 0) return []

  const { data, error } = await getSupabaseAdmin()
    .from('story_elements')
    .insert(
      elements.map(element => ({
        project_id: element.projectId,
        story_id: element.storyId,
        agent_run_id: element.agentRunId,
        element_type: element.elementType,
        value: element.value,
        normalized_value: element.normalizedValue ?? null,
        source_quote: element.sourceQuote,
        source_start_offset: element.sourceStartOffset ?? null,
        source_end_offset: element.sourceEndOffset ?? null,
        confidence: element.confidence,
        review_status: element.reviewStatus || 'unreviewed',
      })),
    )
    .select()

  raise(error)
  return data || []
}

export async function getAgentArtifactsForStory(storyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_artifacts')
    .select('*')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })

  raise(error)
  return data || []
}

export async function getStoryElementsForStory(storyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('story_elements')
    .select('*')
    .eq('story_id', storyId)
    .order('created_at', { ascending: true })

  raise(error)
  return data || []
}

export async function getAgentArtifactsForRun(agentRunId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_artifacts')
    .select('*')
    .eq('agent_run_id', agentRunId)
    .order('created_at', { ascending: false })

  raise(error)
  return (data || []).map(removeAgentRunJoinMetadata)
}

export async function getStoryElementsForRun(agentRunId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('story_elements')
    .select('*')
    .eq('agent_run_id', agentRunId)
    .order('created_at', { ascending: true })

  raise(error)
  return (data || []).map(removeAgentRunJoinMetadata)
}

export async function getCompletedEditorRunForStory(storyId: string, contentHash: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .select('*')
    .eq('story_id', storyId)
    .eq('agent_type', 'editor_librarian')
    .eq('status', 'completed')
    .eq('content_hash', contentHash)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  raise(error)
  return data || null
}

export async function getCompletedEditorArtifactsForStory(storyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_artifacts')
    .select('*, agent_runs!inner(agent_type, status)')
    .eq('story_id', storyId)
    .eq('agent_runs.agent_type', 'editor_librarian')
    .eq('agent_runs.status', 'completed')
    .order('created_at', { ascending: false })

  raise(error)
  return (data || []).map(removeAgentRunJoinMetadata)
}

export async function getCompletedEditorStoryElementsForStory(storyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('story_elements')
    .select('*, agent_runs!inner(agent_type, status)')
    .eq('story_id', storyId)
    .eq('agent_runs.agent_type', 'editor_librarian')
    .eq('agent_runs.status', 'completed')
    .order('created_at', { ascending: true })

  raise(error)
  return (data || []).map(removeAgentRunJoinMetadata)
}

function removeAgentRunJoinMetadata<T>(row: T) {
  const { agent_runs: _agentRuns, ...rest } = row as T & { agent_runs?: unknown }
  return rest
}
