import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createFixedWindowLimiter, rateLimitHeaders } from './rate-limit'
import { getAuthenticatedUser } from './auth'

const aiLimiter = createFixedWindowLimiter({ max: 30, windowMs: 60 * 60 * 1000 })
const realtimeLimiter = createFixedWindowLimiter({ max: 120, windowMs: 60 * 60 * 1000 })

export type AiAction =
  | 'generate-content'
  | 'process-stories'
  | 'transcribe'
  | 'realtime-prompt'

export type AiGuardResult =
  | { ok: true; user: User; headers: HeadersInit }
  | { ok: false; response: NextResponse }

export async function requireAiRequest(request: NextRequest, action: AiAction): Promise<AiGuardResult> {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth

  const limiter = action === 'realtime-prompt' ? realtimeLimiter : aiLimiter
  const result = limiter.check(`${action}:${auth.user.id}`)
  const headers = rateLimitHeaders(result)

  if (!result.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers },
      ),
    }
  }

  return { ok: true, user: auth.user, headers }
}

export function jsonWithRateLimit(body: unknown, headers: HeadersInit, status = 200) {
  return NextResponse.json(body, { status, headers })
}
