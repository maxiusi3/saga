import type { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'
import { jsonWithRateLimit } from './ai-guard'
import type { AiTaskAuditContext } from './ai-runner'
import { requireProjectAccess } from './project-access'

export interface RawAiAuditScope {
  projectId?: unknown
  storyId?: unknown
  interviewSessionId?: unknown
  recordingSessionId?: unknown
  inputSummary?: Record<string, unknown>
}

export type ResolveAiAuditResult =
  | { ok: true; audit?: AiTaskAuditContext }
  | { ok: false; response: NextResponse }

function parseOptionalId(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim()
  return { ok: true, value: trimmed.length > 0 ? trimmed : null }
}

function withRateLimitHeaders(response: NextResponse, headers: HeadersInit): NextResponse {
  new Headers(headers).forEach((value, key) => response.headers.set(key, value))
  return response
}

/**
 * Resolves and authorizes optional `projectId` / `storyId` / `interviewSessionId` audit scope
 * for AI routes. Returns `{ ok: true, audit: undefined }` without hitting Supabase when no scope
 * identifier was provided.
 */
export async function resolveRouteAiAudit(
  user: User,
  headers: HeadersInit,
  raw: RawAiAuditScope,
): Promise<ResolveAiAuditResult> {
  const projectParsed = parseOptionalId(raw.projectId)
  const storyParsed = parseOptionalId(raw.storyId)
  const sessionParsed = parseOptionalId(raw.interviewSessionId)
  const recordingParsed = parseOptionalId(raw.recordingSessionId)

  if (!projectParsed.ok || !storyParsed.ok || !sessionParsed.ok || !recordingParsed.ok) {
    return {
      ok: false,
      response: jsonWithRateLimit({ error: 'Invalid audit scope identifier' }, headers, 400),
    }
  }

  let projectId = projectParsed.value
  const storyId = storyParsed.value
  const interviewSessionId = sessionParsed.value
  const recordingSessionId = recordingParsed.value

  if (!projectId && !storyId && !interviewSessionId) {
    return { ok: true, audit: undefined }
  }

  if (storyId || interviewSessionId) {
    let db: ReturnType<typeof getSupabaseAdmin>
    try {
      db = getSupabaseAdmin()
    } catch {
      return {
        ok: false,
        response: jsonWithRateLimit({ error: 'Database service not configured' }, headers, 503),
      }
    }

    if (storyId) {
      const { data, error } = await db
        .from('stories')
        .select('id, project_id')
        .eq('id', storyId)
        .maybeSingle()

      if (error) {
        return {
          ok: false,
          response: jsonWithRateLimit({ error: 'Unable to verify story access' }, headers, 500),
        }
      }
      if (!data) {
        return {
          ok: false,
          response: jsonWithRateLimit({ error: 'Story not found' }, headers, 404),
        }
      }
      const storyProjectId = String((data as { project_id: string }).project_id)
      if (projectId && projectId !== storyProjectId) {
        return {
          ok: false,
          response: jsonWithRateLimit({ error: 'Story does not belong to project' }, headers, 403),
        }
      }
      projectId = projectId ?? storyProjectId
    }

    if (interviewSessionId) {
      const { data, error } = await db
        .from('interview_sessions')
        .select('id, project_id')
        .eq('id', interviewSessionId)
        .maybeSingle()

      if (error) {
        return {
          ok: false,
          response: jsonWithRateLimit({ error: 'Unable to verify interview session access' }, headers, 500),
        }
      }
      if (!data) {
        return {
          ok: false,
          response: jsonWithRateLimit({ error: 'Interview session not found' }, headers, 404),
        }
      }
      const sessionProjectId = String((data as { project_id: string }).project_id)
      if (projectId && projectId !== sessionProjectId) {
        return {
          ok: false,
          response: jsonWithRateLimit({ error: 'Interview session does not belong to project' }, headers, 403),
        }
      }
      projectId = projectId ?? sessionProjectId
    }
  }

  const access = await requireProjectAccess(projectId!, user)
  if (!access.ok) {
    return { ok: false, response: withRateLimitHeaders(access.response, headers) }
  }

  return {
    ok: true,
    audit: {
      actorId: user.id,
      projectId,
      storyId,
      interviewSessionId,
      recordingSessionId,
      inputSummary: raw.inputSummary,
    },
  }
}
