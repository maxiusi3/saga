import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { withMediaHeaders } from '@/lib/server/media-access'
import { readRecordingSessionStatus } from '@/lib/server/recording-session-status'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
function reply(body: unknown, status: number, headers: Headers) {
  return withMediaHeaders(NextResponse.json(body, { status }), headers)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'recording_status_disabled' }, 404, auth.headers)
  const { sessionId } = await params
  const query = request.nextUrl.searchParams
  const projectId = query.get('projectId'), manifestSha256 = query.get('manifestSha256')
  if (!UUID.test(sessionId) || typeof projectId !== 'string' || !UUID.test(projectId) ||
    typeof manifestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(manifestSha256) ||
    query.getAll('projectId').length !== 1 || query.getAll('manifestSha256').length !== 1 ||
    [...query.keys()].some(key => key !== 'projectId' && key !== 'manifestSha256')) {
    return reply({ error: 'invalid_recording_status_arguments' }, 400, auth.headers)
  }
  try {
    const status = await readRecordingSessionStatus({ actorId: auth.user.id, projectId, sessionId, manifestSha256 },
      { admin: getSupabaseAdmin(), signal: request.signal })
    return reply(status, status.state === 'unresolved' ? 202 : 200, auth.headers)
  } catch { return reply({ error: 'recording_status_unavailable' }, 503, auth.headers) }
}
