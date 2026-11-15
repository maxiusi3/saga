import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { withMediaHeaders } from '@/lib/server/media-access'
import { isRecordingSaveUuid, validateRecordingSaveMetadata } from '@/lib/recording-save-contract'
import { lookupRecordingStorySave, reserveRecordingStorySave, confirmRecordingStorySave, RecordingStorySaveError } from '@/lib/server/recording-story-save'
export const runtime = 'nodejs'
type Context = { params: Promise<{ sessionId: string }> }
async function handle(request: NextRequest, { params }: Context, method: 'GET' | 'POST') {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) { auth.response.headers.set('Cache-Control', 'no-store'); return auth.response }
  const reply = (body: unknown, status = 200) => withMediaHeaders(NextResponse.json(body, { status }), auth.headers)
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Recording save is not enabled' }, 404)
  const { sessionId } = await params
  if (!isRecordingSaveUuid(sessionId)) return reply({ error: 'Invalid recording save request' }, 400)
  let projectId: string, action: 'lookup' | 'reserve' | 'confirm' = 'lookup', metadata, manifestSha256: string | undefined
  try {
    if (method === 'GET') {
      const query = request.nextUrl.searchParams
      if (Array.from(query.keys()).length !== 1 || !isRecordingSaveUuid(query.get('projectId'))) throw new Error()
      projectId = query.get('projectId')!
    } else {
      if (request.nextUrl.search) throw new Error()
      const body: unknown = await request.json()
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
      const value = body as Record<string, unknown>
      if (!isRecordingSaveUuid(value.projectId) || (value.action !== 'reserve' && value.action !== 'confirm')) throw new Error()
      const keys = ['action', 'projectId', value.action === 'reserve' ? 'metadata' : 'manifestSha256']
      if (Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) throw new Error()
      projectId = value.projectId; action = value.action
      if (action === 'reserve') { validateRecordingSaveMetadata(value.metadata); metadata = value.metadata }
      else {
        if (typeof value.manifestSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.manifestSha256)) throw new Error()
        manifestSha256 = value.manifestSha256
      }
    }
  } catch { return reply({ error: 'Invalid recording save request' }, 400) }
  try {
    const access = await requireProjectAccess(projectId, auth.user)
    if (!access.ok) return reply({ error: 'Recording access denied or unavailable' }, access.response.status)
    const options = { admin: getSupabaseAdmin(), signal: request.signal }
    const identity = { actorId: auth.user.id, projectId, sessionId }
    const result = action === 'reserve' ? await reserveRecordingStorySave(identity, metadata!, options) : action === 'confirm'
      ? await confirmRecordingStorySave({ ...identity, manifestSha256: manifestSha256! }, options) : await lookupRecordingStorySave(identity, options)
    const current = await requireProjectAccess(projectId, auth.user)
    if (!current.ok) return reply({ error: 'Recording access denied or unavailable' }, current.response.status)
    if (request.signal.aborted) return reply({ error: 'Recording save is unavailable' }, 503)
    return reply(result)
  } catch (error) { return reply({ error: 'Recording save is unavailable' }, error instanceof RecordingStorySaveError ? error.status : 503) }
}
export const GET = (request: NextRequest, context: Context) => handle(request, context, 'GET')
export const POST = (request: NextRequest, context: Context) => handle(request, context, 'POST')
