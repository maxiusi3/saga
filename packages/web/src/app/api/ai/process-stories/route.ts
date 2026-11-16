import { NextRequest, NextResponse } from 'next/server'
import {
  chapterDraftTask,
  projectQuestionsTask,
  projectSummaryTask,
  type AiProjectContext,
  type AiStorySource,
} from '@saga/shared/ai'
import { resolveRouteAiAudit } from '@/lib/server/ai-audit'
import { jsonWithRateLimit, requireAiRequest } from '@/lib/server/ai-guard'
import { AiTaskError, aiTaskErrorResponse, runAiTask } from '@/lib/server/ai-runner'
import { getTextAiConfigForTier } from '@/lib/server/text-ai-config'

const ACTIONS = {
  generate_chapter: chapterDraftTask,
  generate_summary: projectSummaryTask,
  suggest_questions: projectQuestionsTask,
} as const

type StoryAction = keyof typeof ACTIONS

const MAX_STORIES = 100

function isAction(value: unknown): value is StoryAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACTIONS, value)
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function toStorySource(value: unknown): AiStorySource {
  const story = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    title: optionalString(story.title),
    content: optionalString(story.content),
    transcript: optionalString(story.transcript),
    createdAt: optionalString(story.createdAt),
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAiRequest(request, 'process-stories')
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const {
      stories,
      action,
      language = 'zh-CN',
      projectTitle,
      storytellerName,
      projectId,
      storyId,
      interviewSessionId,
    } = body ?? {}

    if (!Array.isArray(stories) || stories.length === 0) {
      return jsonWithRateLimit({ error: 'No stories provided' }, guard.headers, 400)
    }
    if (stories.length > MAX_STORIES) {
      return jsonWithRateLimit({ error: `Too many stories (max ${MAX_STORIES})` }, guard.headers, 400)
    }
    if (!action) {
      return jsonWithRateLimit({ error: 'No action specified' }, guard.headers, 400)
    }
    if (!isAction(action)) {
      return jsonWithRateLimit({ error: 'Invalid action specified' }, guard.headers, 400)
    }

    const auditResult = await resolveRouteAiAudit(guard.user, guard.headers, {
      projectId,
      storyId,
      interviewSessionId,
      inputSummary: {
        action,
        storiesCount: stories.length,
        locale: typeof language === 'string' ? language : 'zh-CN',
      },
    })
    if (!auditResult.ok) return auditResult.response

    const context: AiProjectContext = {
      stories: stories.map(toStorySource),
      locale: language,
      projectTitle: optionalString(projectTitle),
      storytellerName: optionalString(storytellerName),
    }

    const { output, metadata } = action === 'generate_chapter'
      ? await runAiTask(chapterDraftTask, context, { audit: auditResult.audit })
      : action === 'generate_summary'
        ? await runAiTask(projectSummaryTask, context, { audit: auditResult.audit })
        : await runAiTask(projectQuestionsTask, context, { audit: auditResult.audit })

    return jsonWithRateLimit({
      ...output,
      processedAt: new Date().toISOString(),
      action,
      storiesCount: stories.length,
      model: metadata.model,
      taskVersion: metadata.taskVersion,
      ...(metadata.agentRunId ? { agentRunId: metadata.agentRunId } : {}),
    }, guard.headers)
  } catch (error) {
    if (error instanceof AiTaskError) {
      const mapped = aiTaskErrorResponse(error)
      if (mapped.status >= 500) console.error('Story processing failed:', error.code, error.cause)
      return jsonWithRateLimit({ error: mapped.error }, guard.headers, mapped.status)
    }
    console.error('Story processing error:', error)
    return jsonWithRateLimit({ error: 'Failed to process stories' }, guard.headers, 500)
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'Story processing API is running',
    supportedActions: Object.keys(ACTIONS),
    model: getTextAiConfigForTier('long_form')?.model ?? null,
  })
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  const origin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
