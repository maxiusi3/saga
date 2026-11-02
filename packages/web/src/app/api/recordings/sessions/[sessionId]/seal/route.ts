import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { prepareRecordingSessionSeal, DEFAULT_MAX_RECORDING_INPUT_BYTES } from '@/lib/server/recording-session-service'
import { registerRecordingSeal, RecordingSealRegistrationError } from '@/lib/server/recording-seal-registration'
import { persistRecordingManifest } from '@/lib/server/recording-manifest-ledger'
import { requireCurrentMediaAsset } from '@/lib/server/media-asset-guard'
import { withMediaHeaders } from '@/lib/server/media-access'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function reply(body: unknown, status: number, headers: Headers) {
  return withMediaHeaders(NextResponse.json(body, { status }), headers)
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return reply({ error: 'Recording session seal is not enabled' }, 404, auth.headers)
  }
  const { sessionId } = await params
  if (!isId(sessionId) || sessionId.length < 3) return reply({ error: 'Invalid session id' }, 400, auth.headers)

  let body: unknown
  try { body = await request.json() }
  catch { return reply({ error: 'Invalid request' }, 400, auth.headers) }
  if (!isRecord(body)) return reply({ error: 'Invalid request' }, 400, auth.headers)
  const { projectId, mimeType } = body
  const storyId = body.storyId ?? null
  if (!isId(projectId) || (storyId !== null && !isId(storyId)) || typeof mimeType !== 'string' ||
    !/^audio\/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$/.test(mimeType) ||
    !Array.isArray(body.chunks) || body.chunks.length === 0 || body.chunks.length > 2000) {
    return reply({ error: 'Invalid recording manifest' }, 400, auth.headers)
  }
  const chunks = []
  for (const chunk of body.chunks) {
    if (!isRecord(chunk) || typeof chunk.index !== 'number' || !Number.isSafeInteger(chunk.index) || chunk.index < 0 ||
      !isId(chunk.chunkId) || chunk.bucket !== 'audio-recordings' || typeof chunk.objectKey !== 'string' || chunk.objectKey.length > 512 ||
      typeof chunk.byteSize !== 'number' || !Number.isSafeInteger(chunk.byteSize) || chunk.byteSize <= 0 ||
      chunk.byteSize > DEFAULT_MAX_RECORDING_INPUT_BYTES || typeof chunk.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(chunk.sha256)) {
      return reply({ error: 'Invalid recording manifest' }, 400, auth.headers)
    }
    chunks.push({ index: chunk.index, chunkId: chunk.chunkId, bucket: 'audio-recordings' as const,
      objectKey: chunk.objectKey, byteSize: chunk.byteSize, sha256: chunk.sha256 })
  }
  let admin: ReturnType<typeof getSupabaseAdmin>
  try { admin = getSupabaseAdmin() }
  catch { return reply({ error: 'Database service not configured' }, 503, auth.headers) }

  try {
    const checkScope = async (assetId?: string) => {
      const access = await requireProjectAccess(projectId, auth.user)
      if (!access.ok) throw new RecordingSealRegistrationError(access.response.status, 'Recording access denied or unavailable')
      const { data: role, error: roleError } = await admin.from('project_roles').select('role, status')
        .eq('project_id', projectId).eq('user_id', auth.user.id).maybeSingle()
      if (roleError) throw new RecordingSealRegistrationError(500, 'Failed to verify recording role')
      if (role?.role !== 'storyteller' || role.status !== 'active') {
        throw new RecordingSealRegistrationError(403, 'An active storyteller role is required')
      }
      if (storyId !== null) {
        const { data: story, error } = await admin.from('stories').select('id, project_id, storyteller_id').eq('id', storyId).maybeSingle()
        if (error) throw new RecordingSealRegistrationError(500, 'Failed to verify recording story')
        if (!story) throw new RecordingSealRegistrationError(404, 'Recording story not found')
        if (story.project_id !== projectId || story.storyteller_id !== auth.user.id) {
          throw new RecordingSealRegistrationError(403, 'Recording story ownership mismatch')
        }
      }
      const subjects = [sessionId, storyId, assetId].filter((id): id is string => typeof id === 'string')
      const { data: tombstones, error } = await admin.from('deletion_requests').select('subject_id, tombstone_at')
        .eq('project_id', projectId).in('subject_id', subjects).not('tombstone_at', 'is', null)
      if (error || !Array.isArray(tombstones)) throw new RecordingSealRegistrationError(500, 'Failed to verify recording deletion status')
      if (tombstones.length) throw new RecordingSealRegistrationError(409, 'Recording is being deleted')
      return role
    }
    const role = await checkScope()
    let sealed
    try {
      sealed = prepareRecordingSessionSeal({ projectId, sessionId, storyId, actorId: auth.user.id,
        actorRole: role.role, actorActive: role.status === 'active', mimeType, chunks })
    } catch (error) {
      const status = error instanceof Error && error.message.startsWith('recording_quota_exceeded') ? 413 : 400
      return reply({ error: 'Invalid recording manifest or recording quota exceeded' }, status, auth.headers)
    }
    await persistRecordingManifest(admin, sealed, request.signal)
    // The RPC may outlive a permission change; do not publish jobs on its receipt alone.
    await checkScope(sealed.assetRecord.id)
    const revalidate = async (asset: Record<string, unknown>) => {
      await checkScope(sealed.assetRecord.id)
      const current = await requireCurrentMediaAsset(admin, auth.user, asset, ['verifying', 'ready'])
      if (!current.ok) throw new RecordingSealRegistrationError(current.response.status, 'Recording asset changed or access is unavailable')
    }
    const registered = await registerRecordingSeal(admin, sealed, revalidate)
    await revalidate(registered.asset)
    return reply(registered, registered.asset.state === 'ready' ? 200 : 202, auth.headers)
  } catch (error) {
    if (error instanceof RecordingSealRegistrationError) return reply({ error: error.message }, error.status, auth.headers)
    return reply({ error: 'Recording registration is unavailable' }, 500, auth.headers)
  }
}
