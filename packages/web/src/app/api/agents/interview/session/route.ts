import { NextRequest, NextResponse } from 'next/server'
import {
  INTERVENTION_LEVELS,
  type InterventionLevel,
} from '@saga/shared/types/agents'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { createInterviewSession } from '@/lib/server/agent-store'

const RECORDING_MODES = ['deep_dive', 'chat'] as const
type RecordingMode = (typeof RECORDING_MODES)[number]

interface InterviewSessionRequest {
  projectId?: unknown
  storytellerId?: unknown
  promptText?: unknown
  recordingMode?: unknown
  interventionLevel?: unknown
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  let body: InterviewSessionRequest
  try {
    body = await request.json()
  } catch {
    return invalidRequest(auth.headers)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return invalidRequest(auth.headers)
  }

  const { projectId, storytellerId, promptText, recordingMode, interventionLevel } = body
  if (
    typeof projectId !== 'string' ||
    typeof storytellerId !== 'string' ||
    !isRecordingMode(recordingMode) ||
    !isInterventionLevel(interventionLevel) ||
    (promptText !== undefined && promptText !== null && typeof promptText !== 'string')
  ) {
    return invalidRequest(auth.headers)
  }

  const access = await requireProjectAccess(projectId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  try {
    const session = await createInterviewSession({
      projectId,
      storytellerId,
      promptText: promptText ?? null,
      recordingMode,
      interventionLevel,
    })

    return NextResponse.json({ session }, { headers: auth.headers })
  } catch {
    console.error('Failed to create interview session')
    return NextResponse.json({ error: 'Unable to create interview session' }, { status: 500, headers: auth.headers })
  }
}

function invalidRequest(headers: Headers) {
  return NextResponse.json({ error: 'Invalid interview session request' }, { status: 400, headers })
}

function isRecordingMode(value: unknown): value is RecordingMode {
  return RECORDING_MODES.includes(value as RecordingMode)
}

function isInterventionLevel(value: unknown): value is InterventionLevel {
  return INTERVENTION_LEVELS.includes(value as InterventionLevel)
}

function withAuthHeaders(response: NextResponse, authHeaders: Headers) {
  authHeaders.forEach((value, key) => response.headers.set(key, value))
  return response
}
