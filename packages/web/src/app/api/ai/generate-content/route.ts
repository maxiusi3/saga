import { NextRequest, NextResponse } from 'next/server'
import { storyMetadataTask } from '@saga/shared/ai'
import { resolveRouteAiAudit } from '@/lib/server/ai-audit'
import { jsonWithRateLimit, requireAiRequest } from '@/lib/server/ai-guard'
import { AiTaskError, aiTaskErrorResponse, runAiTask } from '@/lib/server/ai-runner'

export async function POST(request: NextRequest) {
  const guard = await requireAiRequest(request, 'generate-content')
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const {
      transcript,
      prompt,
      language = 'en',
      projectId,
      storyId,
      interviewSessionId,
      recordingSessionId,
    } = body ?? {}

    if (typeof transcript !== 'string' || transcript.trim().length === 0) {
      return jsonWithRateLimit({ error: 'No transcript provided' }, guard.headers, 400)
    }

    const auditResult = await resolveRouteAiAudit(guard.user, guard.headers, {
      projectId,
      storyId,
      interviewSessionId,
      recordingSessionId,
      inputSummary: {
        transcriptLength: transcript.length,
        locale: typeof language === 'string' ? language : 'en',
      },
    })
    if (!auditResult.ok) return auditResult.response

    const { output, metadata } = await runAiTask(
      storyMetadataTask,
      {
        transcript,
        promptContext: typeof prompt === 'string' ? prompt : null,
        locale: language,
      },
      { audit: auditResult.audit },
    )

    return jsonWithRateLimit(
      metadata.agentRunId ? { ...output, agentRunId: metadata.agentRunId } : output,
      guard.headers,
    )
  } catch (error) {
    if (error instanceof AiTaskError) {
      const mapped = aiTaskErrorResponse(error)
      if (mapped.status >= 500) console.error('AI content generation failed:', error.code, error.cause)
      return jsonWithRateLimit({ error: mapped.error }, guard.headers, mapped.status)
    }
    console.error('AI content generation error:', error)
    return jsonWithRateLimit(
      {
        error: 'AI content generation failed. Please try again.',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      },
      guard.headers,
      500
    )
  }
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
