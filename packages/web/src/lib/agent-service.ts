import type {
  InterviewEvent,
  InterviewSession,
  InterventionLevel,
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

async function authHeaders(): Promise<Record<string, string>> {
  const token = await useAuthStore.getState().getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
