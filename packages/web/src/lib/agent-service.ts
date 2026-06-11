import type {
  AgentArtifact,
  InterviewEvent,
  InterviewSession,
  InterventionLevel,
  StoryElement,
} from '@saga/shared/types/agents'
import type { InterviewPhase, InterviewInterventionResult } from '@/lib/agents/interview-agent'
import { useAuthStore } from '@/stores/auth-store'

export interface CreateInterviewSessionRequest {
  projectId: string
  storytellerId: string
  promptText?: string | null
  recordingMode: 'deep_dive' | 'chat'
  interventionLevel: InterventionLevel
}

export interface RequestInterviewInterventionRequest {
  projectId: string
  interviewSessionId: string
  storytellerId: string
  interventionLevel: InterventionLevel
  phase: InterviewPhase
  storytellerName?: string
  currentPrompt?: string
  recentTranscript: string
  previousStorySummary: string | null
  previousPrompts: string[]
  silenceMs: number
  transcriptStartOffset?: number | null
  transcriptEndOffset?: number | null
}

export interface InterviewInterventionResponse {
  intervention: InterviewInterventionResult
  event: InterviewEvent | null
}

export interface ProcessStoryWithEditorAgentRequest {
  storyId: string
}

export interface ProcessStoryWithEditorAgentResponse {
  processed: true
  agentRunId: string
  elementsCount: number
}

export interface StandaloneStoryArtifact {
  title: string
  body: string
  summary: string
}

export interface StoryAgentArtifactsResponse {
  standaloneStory: StandaloneStoryArtifact | null
  elements: StoryElement[]
  artifacts: AgentArtifact[]
}

export async function createInterviewSession(
  request: CreateInterviewSessionRequest,
): Promise<InterviewSession> {
  const response = await fetch('/api/agents/interview/session', {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('Failed to create interview session')
  }

  const data = await response.json()
  return data.session
}

export async function requestInterviewIntervention(
  request: RequestInterviewInterventionRequest,
): Promise<InterviewInterventionResponse> {
  const response = await fetch('/api/agents/interview/intervention', {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('Failed to request interview intervention')
  }

  return response.json()
}

export async function processStoryWithEditorAgent(
  request: ProcessStoryWithEditorAgentRequest,
): Promise<ProcessStoryWithEditorAgentResponse> {
  const response = await fetch('/api/agents/editor/process-story', {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('Failed to process story with editor agent')
  }

  return response.json()
}

export async function getStoryAgentArtifacts(storyId: string): Promise<StoryAgentArtifactsResponse> {
  const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/agent-artifacts`, {
    headers: await authHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to load story agent artifacts')
  }

  return response.json()
}

export const agentService = {
  createInterviewSession,
  requestInterviewIntervention,
  processStoryWithEditorAgent,
  getStoryAgentArtifacts,
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await useAuthStore.getState().getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
