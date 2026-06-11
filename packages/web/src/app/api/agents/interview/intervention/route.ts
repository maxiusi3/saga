import { NextRequest, NextResponse } from 'next/server'
import {
  INTERVENTION_LEVELS,
  type InterventionLevel,
} from '@saga/shared/types/agents'
import {
  generateInterviewIntervention,
  type InterviewPhase,
} from '@/lib/agents/interview-agent'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import {
  completeAgentRun,
  createAgentRun,
  createInterviewEvent,
  failAgentRun,
} from '@/lib/server/agent-store'

const INTERVIEW_PHASES = [
  'opening',
  'warmup',
  'prior_story_recap',
  'story_listening',
  'transition',
  'closing',
] as const

interface InterviewInterventionRequest {
  projectId?: unknown
  interviewSessionId?: unknown
  storytellerId?: unknown
  interventionLevel?: unknown
  phase?: unknown
  storytellerName?: unknown
  currentPrompt?: unknown
  recentTranscript?: unknown
  previousStorySummary?: unknown
  previousPrompts?: unknown
  silenceMs?: unknown
  transcriptStartOffset?: unknown
  transcriptEndOffset?: unknown
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const parsed = await parseRequest(request)
  if (!parsed.ok) {
    return invalidRequest(auth.headers)
  }

  const input = parsed.input
  const access = await requireProjectAccess(input.projectId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  let intervention
  try {
    intervention = generateInterviewIntervention({
      interventionLevel: input.interventionLevel,
      phase: input.phase,
      storytellerName: input.storytellerName,
      currentPrompt: input.currentPrompt,
      recentTranscript: input.recentTranscript,
      previousStorySummary: input.previousStorySummary,
      previousPrompts: input.previousPrompts,
      silenceMs: input.silenceMs,
    })
  } catch {
    console.error('Failed to generate interview intervention')
    return NextResponse.json({ error: 'Unable to generate interview intervention' }, { status: 500, headers: auth.headers })
  }

  if (!intervention.shouldIntervene) {
    return NextResponse.json({ intervention, event: null }, { headers: auth.headers })
  }

  let agentRunId: string | null = null
  try {
    if (!intervention.eventKind) {
      throw new Error('Intervention event kind is required')
    }

    const agentRun = await createAgentRun({
      agentType: 'interview',
      projectId: input.projectId,
      storyId: null,
      interviewSessionId: input.interviewSessionId,
      createdBy: auth.user.id,
      input: {
        interventionLevel: input.interventionLevel,
        phase: input.phase,
        storytellerName: input.storytellerName,
        currentPrompt: input.currentPrompt,
        recentTranscript: input.recentTranscript,
        previousStorySummary: input.previousStorySummary,
        previousPrompts: input.previousPrompts,
        silenceMs: input.silenceMs,
      },
      model: 'deterministic-interview-agent',
    })
    agentRunId = String(agentRun.id)

    const event = await createInterviewEvent({
      interviewSessionId: input.interviewSessionId,
      projectId: input.projectId,
      storytellerId: input.storytellerId,
      eventKind: intervention.eventKind,
      interventionLevel: input.interventionLevel,
      triggerReason: intervention.triggerReason,
      promptText: intervention.promptText,
      transcriptWindow: input.recentTranscript,
      transcriptStartOffset: input.transcriptStartOffset,
      transcriptEndOffset: input.transcriptEndOffset,
      accepted: null,
    })

    await completeAgentRun(agentRunId, {
      intervention,
      eventId: event.id,
    })

    return NextResponse.json({ intervention, event }, { headers: auth.headers })
  } catch (error) {
    if (agentRunId) {
      await failAgentRun(agentRunId, error instanceof Error ? error.message : 'Interview intervention failed')
    }
    console.error('Failed to store interview intervention')
    return NextResponse.json({ error: 'Unable to store interview intervention' }, { status: 500, headers: auth.headers })
  }
}

async function parseRequest(request: NextRequest) {
  let body: InterviewInterventionRequest
  try {
    body = await request.json()
  } catch {
    return { ok: false as const }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false as const }
  }

  const {
    projectId,
    interviewSessionId,
    storytellerId,
    interventionLevel,
    phase,
    storytellerName,
    currentPrompt,
    recentTranscript,
    previousStorySummary,
    previousPrompts,
    silenceMs,
    transcriptStartOffset,
    transcriptEndOffset,
  } = body

  if (
    typeof projectId !== 'string' ||
    typeof interviewSessionId !== 'string' ||
    typeof storytellerId !== 'string' ||
    !isInterventionLevel(interventionLevel) ||
    !isInterviewPhase(phase) ||
    !isOptionalString(storytellerName) ||
    !isOptionalString(currentPrompt) ||
    typeof recentTranscript !== 'string' ||
    !isNullableString(previousStorySummary) ||
    !isStringArray(previousPrompts) ||
    typeof silenceMs !== 'number' ||
    !Number.isFinite(silenceMs) ||
    silenceMs < 0 ||
    !isOptionalNumber(transcriptStartOffset) ||
    !isOptionalNumber(transcriptEndOffset)
  ) {
    return { ok: false as const }
  }

  return {
    ok: true as const,
    input: {
      projectId,
      interviewSessionId,
      storytellerId,
      interventionLevel,
      phase,
      storytellerName,
      currentPrompt,
      recentTranscript,
      previousStorySummary,
      previousPrompts,
      silenceMs,
      transcriptStartOffset: transcriptStartOffset ?? null,
      transcriptEndOffset: transcriptEndOffset ?? null,
    },
  }
}

function invalidRequest(headers: Headers) {
  return NextResponse.json({ error: 'Invalid interview intervention request' }, { status: 400, headers })
}

function isInterventionLevel(value: unknown): value is InterventionLevel {
  return INTERVENTION_LEVELS.includes(value as InterventionLevel)
}

function isInterviewPhase(value: unknown): value is InterviewPhase {
  return INTERVIEW_PHASES.includes(value as InterviewPhase)
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isOptionalNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value))
}

function withAuthHeaders(response: NextResponse, authHeaders: Headers) {
  authHeaders.forEach((value, key) => response.headers.set(key, value))
  return response
}
