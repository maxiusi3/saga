import { NextRequest, NextResponse } from 'next/server'
import { buildContributionPreview } from '@/lib/public-archive/anonymizer'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireStoryContributionOwner } from '@/lib/server/public-archive-access'
import { createStoryContentHash } from '@/lib/server/story-content-hash'
import {
  completeAgentRun,
  createAgentArtifact,
  createAgentRun,
  failAgentRun,
  getCompletedEditorRunForStory,
  getStoryElementsForRun,
} from '@/lib/server/agent-store'

interface RouteContext {
  params: Promise<{ storyId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { storyId } = await context.params
  const access = await requireStoryContributionOwner(storyId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const story = access.story
  const sourceContentHash = createStoryContentHash({
    storyId: story.id,
    title: story.title,
    transcript: story.transcript || '',
    createdAt: story.created_at,
  })

  let runId: string | null = null
  try {
    const run = await createAgentRun({
      agentType: 'wiki_editor',
      projectId: story.project_id,
      storyId: story.id,
      interviewSessionId: null,
      createdBy: auth.user.id,
      input: { storyId: story.id, sourceContentHash, phase: 'contribution_preview' },
      contentHash: sourceContentHash,
      model: 'deterministic-public-archive-anonymizer',
    })
    runId = String(run.id)

    const editorRun = await getCompletedEditorRunForStory(story.id, sourceContentHash)
    const elements = editorRun ? await getStoryElementsForRun(String(editorRun.id)) : []
    const temporaryPreview = buildContributionPreview({
      previewId: 'pending',
      story,
      sourceContentHash,
      elements: elements as any[],
    })

    const artifact = await createAgentArtifact({
      agentRunId: runId,
      projectId: story.project_id,
      storyId: story.id,
      artifactType: 'anonymized_contribution_preview',
      payload: temporaryPreview as unknown as Record<string, unknown>,
      sourceRefs: [{ source_type: 'story', source_id: story.id }],
      confidence: 0.8,
    })

    const preview = { ...temporaryPreview, previewId: String(artifact.id) }
    await completeAgentRun(runId, { previewCreated: true, previewId: preview.previewId })

    return NextResponse.json({ preview }, { headers: auth.headers })
  } catch (error) {
    if (runId) {
      await failAgentRun(runId, error instanceof Error ? error.message : 'Preview generation failed')
    }
    return NextResponse.json({ error: 'Unable to generate public archive preview' }, { status: 500, headers: auth.headers })
  }
}

function withAuthHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}
