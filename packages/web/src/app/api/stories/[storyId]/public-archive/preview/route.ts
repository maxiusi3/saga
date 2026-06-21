import { NextRequest, NextResponse } from 'next/server'
import { buildContributionPreview } from '@/lib/public-archive/anonymizer'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireStoryContributionOwner } from '@/lib/server/public-archive-access'
import { withAuthHeaders } from '@/lib/server/http'
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
    if (!editorRun) {
      // Without a completed biography analysis there are no structured person elements,
      // so names cannot be reliably removed. Refuse rather than publish un-anonymized text.
      await failAgentRun(runId, 'No completed biography analysis is available to anonymize this story')
      return NextResponse.json(
        {
          error:
            'Generate the biography for this story before contributing it to the public archive, so names and identifying details can be removed.',
        },
        { status: 409, headers: auth.headers },
      )
    }
    const elements = await getStoryElementsForRun(String(editorRun.id))
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
