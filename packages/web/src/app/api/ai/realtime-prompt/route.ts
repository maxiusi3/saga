import { NextRequest, NextResponse } from 'next/server'
import { fallbackRealtimeFollowup, realtimeFollowupTask } from '@saga/shared/ai'
import { resolveRouteAiAudit } from '@/lib/server/ai-audit'
import { jsonWithRateLimit, requireAiRequest } from '@/lib/server/ai-guard'
import { AiTaskError, isTextAiConfigured, runAiTask } from '@/lib/server/ai-runner'

const MIN_TRANSCRIPT_CHARS = 6

export async function POST(request: NextRequest) {
    const guard = await requireAiRequest(request, 'realtime-prompt')
    if (!guard.ok) return guard.response

    try {
        const body = await request.json()
        const transcript = typeof body?.transcript === 'string' ? body.transcript : ''
        const language = typeof body?.language === 'string' ? body.language : 'en'
        const previousPrompts: string[] = Array.isArray(body?.previousPrompts)
            ? body.previousPrompts.filter((item: unknown): item is string => typeof item === 'string')
            : []

        const auditResult = await resolveRouteAiAudit(guard.user, guard.headers, {
            projectId: body?.projectId,
            storyId: body?.storyId,
            interviewSessionId: body?.interviewSessionId,
            recordingSessionId: body?.recordingSessionId,
            inputSummary: {
                transcriptLength: transcript.length,
                previousPromptsCount: previousPrompts.length,
                locale: language,
            },
        })
        if (!auditResult.ok) return auditResult.response

        // 1. Model suggestion when configured and there is something to respond to.
        if (isTextAiConfigured(realtimeFollowupTask.tier) && transcript.trim().length >= MIN_TRANSCRIPT_CHARS) {
            try {
                const { output, metadata } = await runAiTask(
                    realtimeFollowupTask,
                    { transcript, locale: language, previousPrompts },
                    { audit: auditResult.audit },
                )
                return jsonWithRateLimit(
                    metadata.agentRunId
                        ? { prompt: output, source: 'ai', agentRunId: metadata.agentRunId }
                        : { prompt: output, source: 'ai' },
                    guard.headers,
                )
            } catch (error) {
                if (!(error instanceof AiTaskError)) throw error
                console.warn('Realtime follow-up model call failed, using fallback:', error.code)
            }
        }

        // 2. Deterministic interviewer nudge (suggestion only, never archive content).
        return jsonWithRateLimit({
            prompt: fallbackRealtimeFollowup(transcript, language, previousPrompts),
            source: 'fallback',
        }, guard.headers)
    } catch (error) {
        console.error('Real-time prompt generation error:', error)
        return jsonWithRateLimit({ error: 'Failed to generate prompt' }, guard.headers, 500)
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
