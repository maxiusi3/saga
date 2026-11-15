import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { isDeletionUuid, MediaDeletionCaptureError, submitMediaDeletionRequest } from '@/lib/server/media-deletion-capture'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status })
  headers.forEach((value,key)=>response.headers.set(key,value))
  response.headers.set('Cache-Control','no-store')
  return response
}
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) { auth.response.headers.set('Cache-Control','no-store'); return auth.response }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Media asset deletion is not enabled' },404,auth.headers)
  let body: unknown
  try { body = await request.json() } catch { return reply({ error: 'Invalid request' },400,auth.headers) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request' },400,auth.headers)
  const value = body as Record<string,unknown>
  const hasAsset = Object.prototype.hasOwnProperty.call(value,'assetId'), hasStory = Object.prototype.hasOwnProperty.call(value,'storyId')
  const subjectId = hasAsset ? value.assetId : value.storyId
  if (hasAsset === hasStory || !isDeletionUuid(value.projectId) || !isDeletionUuid(subjectId) ||
    (Object.prototype.hasOwnProperty.call(value,'requestId') && !isDeletionUuid(value.requestId))) return reply({ error: 'Invalid request' },400,auth.headers)
  const access = await requireProjectAccess(value.projectId,auth.user)
  if (!access.ok) return reply(await access.response.json(),access.response.status,auth.headers)
  try {
    const deletionRequest = await submitMediaDeletionRequest({ actorId: auth.user.id, projectId: value.projectId,
      subjectId, subjectType: hasAsset ? 'media_asset' : 'story', requestId: typeof value.requestId === 'string' ? value.requestId : randomUUID(),
    }, { admin: getSupabaseAdmin(), signal: request.signal })
    return reply({ deletionRequest },202,auth.headers)
  } catch (error) {
    return reply({ error: 'Media deletion request is unavailable' },error instanceof MediaDeletionCaptureError ? error.status : 503,auth.headers)
  }
}
