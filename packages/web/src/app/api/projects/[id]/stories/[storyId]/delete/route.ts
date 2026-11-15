import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isDeletionUuid, MediaDeletionCaptureError, submitStoryDeletionRequest } from '@/lib/server/media-deletion-capture'
export const runtime = 'nodejs'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; storyId: string }> }) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) { auth.response.headers.set('Cache-Control', 'no-store'); return auth.response }
  const reply = (body: unknown, status: number) => {
    const response = NextResponse.json(body, { status })
    auth.headers.forEach((v,k)=>response.headers.set(k,v)); response.headers.set('Cache-Control','no-store')
    return response
  }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Story deletion is not enabled' },404)
  const { id: projectId, storyId } = await params
  let body: unknown
  try { body = await request.json() } catch { return reply({ error: 'Invalid request' },400) }
  if (!isDeletionUuid(projectId) || !isDeletionUuid(storyId) || !body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request' },400)
  const data = body as Record<string,unknown>
  if (Object.keys(data).some(k=>k!=='requestId') || ('requestId' in data && !isDeletionUuid(data.requestId))) return reply({ error: 'Invalid request' },400)
  try {
    // The single SQL transaction checks current owner/facilitator access, captures
    // immutable media targets, and clears text and relational derivatives.
    const deletionRequest = await submitStoryDeletionRequest({ actorId: auth.user.id, projectId, subjectId: storyId,
      requestId: typeof data.requestId === 'string' ? data.requestId : randomUUID(),
    }, { admin: getSupabaseAdmin(), signal: request.signal })
    return reply({ deletionRequest },202)
  } catch (error) {
    return reply({ error: 'Story deletion request could not be confirmed' },error instanceof MediaDeletionCaptureError ? error.status : 503)
  }
}
