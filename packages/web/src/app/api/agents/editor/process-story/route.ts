import { NextRequest, NextResponse } from 'next/server'
import { processStoryForBiography } from '@/lib/agents/editor-agent'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import {
  completeAgentRun,
  createAgentArtifact,
  createAgentRun,
  createStoryElements,
  failAgentRun,
} from '@/lib/server/agent-store'
import { getSupabaseAdmin } from '@/lib/supabase'

interface ProcessStoryRequest {
  storyId?: unknown
}

interface StoryRow {
  id: string
  project_id: string
  title: string | null
  transcript: string | null
  created_at: string
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const parsed = await parseRequest(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'Invalid editor process story request' },
      { status: 400, headers: auth.headers },
    )
  }

  const storyResult = await loadStory(parsed.storyId, auth.headers)
  if (!storyResult.ok) return storyResult.response

  const story = storyResult.story
  const access = await requireProjectAccess(story.project_id, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const transcript = story.transcript || ''
  let agentRunId: string | null = null
  try {
    const agentRun = await createAgentRun({
      agentType: 'editor_librarian',
      projectId: story.project_id,
      storyId: story.id,
      interviewSessionId: null,
      createdBy: auth.user.id,
      input: {
        storyId: story.id,
        title: story.title,
        transcriptLength: transcript.length,
      },
      model: 'deterministic-editor-agent',
    })
    const runId = String(agentRun.id)
    agentRunId = runId

    const output = processStoryForBiography({
      storyId: story.id,
      projectId: story.project_id,
      title: story.title,
      transcript,
      createdAt: story.created_at,
    })

    await createAgentArtifact({
      agentRunId: runId,
      projectId: story.project_id,
      storyId: story.id,
      artifactType: 'standalone_story',
      payload: output.standaloneStory,
      sourceRefs: [
        {
          source_type: 'transcript',
          source_id: story.id,
          start_offset: 0,
          end_offset: transcript.length,
        },
      ],
      confidence: 0.8,
    })

    const elementSourceRefs = output.elements.map(element => ({
      source_type: 'transcript',
      source_id: story.id,
      start_offset: element.sourceStartOffset,
      end_offset: element.sourceEndOffset,
      quote: element.sourceQuote,
    }))

    await createAgentArtifact({
      agentRunId: runId,
      projectId: story.project_id,
      storyId: story.id,
      artifactType: 'story_elements',
      payload: {
        elements: output.elements,
      },
      sourceRefs: elementSourceRefs,
      confidence: averageConfidence(output.elements.map(element => element.confidence)),
    })

    await createStoryElements(output.elements.map(element => ({
      projectId: story.project_id,
      storyId: story.id,
      agentRunId: runId,
      elementType: element.elementType,
      value: element.value,
      normalizedValue: element.normalizedValue,
      sourceQuote: element.sourceQuote,
      sourceStartOffset: element.sourceStartOffset,
      sourceEndOffset: element.sourceEndOffset,
      confidence: element.confidence,
    })))

    await completeAgentRun(runId, {
      processed: true,
      standaloneStoryTitle: output.standaloneStory.title,
      elementsCount: output.elements.length,
    })

    return NextResponse.json(
      {
        processed: true,
        agentRunId: runId,
        elementsCount: output.elements.length,
      },
      { headers: auth.headers },
    )
  } catch (error) {
    if (agentRunId) {
      try {
        await failAgentRun(
          agentRunId,
          error instanceof Error ? error.message : 'Editor story processing failed',
        )
      } catch {
        console.error('Failed to mark editor agent run as failed')
      }
    }
    console.error('Failed to process story with editor agent')
    return NextResponse.json(
      { error: 'Unable to process story with editor agent' },
      { status: 500, headers: auth.headers },
    )
  }
}

async function parseRequest(request: NextRequest) {
  let body: ProcessStoryRequest
  try {
    body = await request.json()
  } catch {
    return { ok: false as const }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false as const }
  }

  if (typeof body.storyId !== 'string' || body.storyId.trim().length === 0) {
    return { ok: false as const }
  }

  return { ok: true as const, storyId: body.storyId }
}

async function loadStory(storyId: string, headers: Headers) {
  let db: ReturnType<typeof getSupabaseAdmin>
  try {
    db = getSupabaseAdmin()
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Database service not configured' }, { status: 503, headers }),
    }
  }

  const { data, error } = await db
    .from('stories')
    .select('id, project_id, title, transcript, created_at')
    .eq('id', storyId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load story for editor processing')
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unable to load story' }, { status: 500, headers }),
    }
  }

  if (!data) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Story not found' }, { status: 404, headers }),
    }
  }

  return { ok: true as const, story: data as StoryRow }
}

function averageConfidence(confidences: number[]) {
  if (confidences.length === 0) return 0
  return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
}

function withAuthHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}
