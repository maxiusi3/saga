import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import {
  getAgentArtifactsForStory,
  getStoryElementsForStory,
} from '@/lib/server/agent-store'
import { getSupabaseAdmin } from '@/lib/supabase'

interface StoryRow {
  id: string
  project_id: string
}

interface RouteContext {
  params: Promise<{
    storyId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { storyId } = await context.params
  const storyResult = await loadStory(storyId, auth.headers)
  if (!storyResult.ok) return storyResult.response

  const access = await requireProjectAccess(storyResult.story.project_id, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  try {
    const [artifacts, elements] = await Promise.all([
      getAgentArtifactsForStory(storyId),
      getStoryElementsForStory(storyId),
    ])
    const standaloneStory = getStandaloneStoryPayload(artifacts)

    return NextResponse.json(
      {
        standaloneStory,
        elements,
        artifacts,
      },
      { headers: auth.headers },
    )
  } catch {
    console.error('Failed to load story agent artifacts')
    return NextResponse.json(
      { error: 'Unable to load story agent artifacts' },
      { status: 500, headers: auth.headers },
    )
  }
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
    .select('id, project_id')
    .eq('id', storyId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load story for agent artifacts')
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

function getStandaloneStoryPayload(artifacts: Array<{ artifact_type?: string; payload?: unknown }>) {
  const artifact = artifacts.find(item => item.artifact_type === 'standalone_story')
  if (!artifact || !artifact.payload || typeof artifact.payload !== 'object' || Array.isArray(artifact.payload)) {
    return null
  }

  const payload = artifact.payload as Record<string, unknown>
  if (
    typeof payload.title !== 'string' ||
    typeof payload.body !== 'string' ||
    typeof payload.summary !== 'string'
  ) {
    return null
  }

  return {
    title: payload.title,
    body: payload.body,
    summary: payload.summary,
  }
}

function withAuthHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}
