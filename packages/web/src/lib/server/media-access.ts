import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { MediaReference } from '@/lib/media-reference'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireProjectAccess } from './project-access'

type MediaAccessResult =
  | { ok: true; admin: ReturnType<typeof getSupabaseAdmin> }
  | { ok: false; response: NextResponse }

export function withMediaHeaders(response: NextResponse, headers: HeadersInit): NextResponse {
  const source = new Headers(headers)
  source.forEach((value, key) => {
    if (key !== 'set-cookie') response.headers.set(key, value)
  })
  for (const cookie of source.getSetCookie()) response.headers.append('Set-Cookie', cookie)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/** Project/story permissions take precedence over the uploader prefix, including after removal. */
export async function requireMediaAccess(reference: MediaReference, user: User): Promise<MediaAccessResult> {
  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Database service not configured' }, { status: 503 }) }
  }
  try {
    if (reference.scope.kind === 'private') {
      return reference.ownerId === user.id
        ? { ok: true, admin }
        : { ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
    }

    let projectId: string
    if (reference.scope.kind === 'story') {
      const { data: story, error } = await admin.from('stories').select('id, project_id')
        .eq('id', reference.scope.storyId).maybeSingle()
      if (error) return { ok: false, response: NextResponse.json({ error: 'Unable to verify media access' }, { status: 500 }) }
      if (!story) return { ok: false, response: NextResponse.json({ error: 'Story not found' }, { status: 404 }) }
      if (typeof story.project_id !== 'string' || !story.project_id) {
        return { ok: false, response: NextResponse.json({ error: 'Unable to verify media access' }, { status: 500 }) }
      }
      projectId = story.project_id
    } else {
      projectId = reference.scope.projectId
    }
    const access = await requireProjectAccess(projectId, user)
    return access.ok ? { ok: true, admin } : access
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Unable to verify media access' }, { status: 500 }) }
  }
}
