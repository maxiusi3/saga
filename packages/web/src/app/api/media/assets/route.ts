import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { safeExportFilename } from '@/lib/media-assets'

export const runtime = 'nodejs'

type AssetKind = 'original_audio' | 'original_image'

function response(body: unknown, status: number, headers: Headers) {
  const result = NextResponse.json(body, { status })
  headers.forEach((value, key) => result.headers.set(key, value))
  result.headers.set('Cache-Control', 'no-store')
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isAssetKind(value: unknown): value is AssetKind {
  return value === 'original_audio' || value === 'original_image'
}

function isAllowedMime(kind: AssetKind, value: unknown): value is string {
  return typeof value === 'string' && (
    kind === 'original_audio' ? value.startsWith('audio/') : value.startsWith('image/')
  )
}

function maxBytesFor(kind: AssetKind): number {
  return kind === 'original_audio' ? 100 * 1024 * 1024 : 5 * 1024 * 1024
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }

  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return response({ error: 'Media assets are not enabled' }, 404, auth.headers)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return response({ error: 'Invalid request' }, 400, auth.headers)
  }
  if (!isRecord(body)) return response({ error: 'Invalid request' }, 400, auth.headers)

  if (Object.prototype.hasOwnProperty.call(body, 'bucket') ||
      Object.prototype.hasOwnProperty.call(body, 'state') ||
      Object.prototype.hasOwnProperty.call(body, 'sha256')) {
    return response({ error: 'Server-owned asset fields cannot be supplied' }, 400, auth.headers)
  }

  const projectId = body.projectId
  const storyId = body.storyId
  const kind = body.kind
  const mimeType = body.mimeType
  const originalFilename = body.originalFilename
  const expectedBytes = body.expectedBytes
  const idempotencyKey = body.idempotencyKey
  if (typeof projectId !== 'string' || !projectId.trim() || !isAssetKind(kind) || !isAllowedMime(kind, mimeType)) {
    return response({ error: 'Invalid asset metadata' }, 400, auth.headers)
  }
  if (storyId !== undefined && (typeof storyId !== 'string' || !storyId.trim())) {
    return response({ error: 'Invalid story id' }, 400, auth.headers)
  }
  if (expectedBytes !== undefined && (typeof expectedBytes !== 'number' || !Number.isInteger(expectedBytes) || expectedBytes < 0 || expectedBytes > maxBytesFor(kind))) {
    return response({ error: 'Invalid expected byte size' }, 400, auth.headers)
  }
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200)) {
    return response({ error: 'Invalid idempotency key' }, 400, auth.headers)
  }
  if (originalFilename !== undefined && typeof originalFilename !== 'string') {
    return response({ error: 'Invalid original filename' }, 400, auth.headers)
  }

  const access = await requireProjectAccess(projectId, auth.user)
  if (!access.ok) return response(await access.response.json(), access.response.status, auth.headers)

  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch {
    return response({ error: 'Database service not configured' }, 503, auth.headers)
  }

  const checkDeletion = async (subjects: string[]) => {
    const { data, error } = await admin.from('deletion_requests')
      .select('subject_id, tombstone_at').eq('project_id', projectId)
      .in('subject_id', subjects).not('tombstone_at', 'is', null)
    if (error || !Array.isArray(data)) return response({ error: 'Failed to verify deletion status' }, 500, auth.headers)
    return data.length ? response({ error: 'Asset or story is being deleted' }, 409, auth.headers) : null
  }

  try {
    if (typeof storyId === 'string') {
      const { data: story, error: storyError } = await admin.from('stories')
        .select('id, project_id')
        .eq('id', storyId)
        .maybeSingle()
      if (storyError) return response({ error: 'Failed to check story' }, 500, auth.headers)
      if (!story) return response({ error: 'Story not found' }, 404, auth.headers)
      if (story.project_id !== projectId) {
        return response({ error: 'Story does not belong to project' }, 400, auth.headers)
      }
      const deleted = await checkDeletion([storyId])
      if (deleted) return deleted
    }

    const bucket = kind === 'original_audio' ? 'audio-recordings' : 'saga'
    const replay = async (existing: Record<string, any>) => {
      // Verification fills byte_size even when registration supplied no expectation.
      const byteSizeConflict = expectedBytes !== undefined && existing.byte_size !== expectedBytes
      if (existing.created_by !== auth.user.id || existing.project_id !== projectId || existing.kind !== kind ||
          existing.mime_type !== mimeType || byteSizeConflict ||
          existing.original_filename !== safeExportFilename(originalFilename) || (existing.story_id ?? null) !== (storyId ?? null)) {
        return response({ error: 'Idempotency key conflicts with an existing request' }, 409, auth.headers)
      }
      if (existing.tombstone_at != null || !['pending_upload', 'uploaded', 'verifying', 'ready'].includes(existing.state)) {
        return response({ error: 'Asset is not eligible for upload' }, 409, auth.headers)
      }
      const deleted = await checkDeletion([existing.id, ...(typeof storyId === 'string' ? [storyId] : [])])
      if (deleted) return deleted
      if (existing.state !== 'pending_upload') return response({ asset: existing }, 200, auth.headers)
      const { data: upload, error } = await admin.storage.from(existing.bucket)
        .createSignedUploadUrl(existing.object_key, { upsert: false })
      if (error || !upload) return response({ error: 'Failed to create upload target' }, 502, auth.headers)
      return response({ asset: existing, upload }, 200, auth.headers)
    }
    const findExisting = () => admin.from('media_assets').select('*')
      .eq('project_id', projectId).eq('idempotency_key', idempotencyKey).maybeSingle()
    if (typeof idempotencyKey === 'string') {
      const { data: existing, error: existingError } = await findExisting()
      if (existingError) return response({ error: 'Failed to check existing asset' }, 500, auth.headers)
      if (existing) return await replay(existing)
    }

    const assetId = randomUUID()
    const objectKey = `${auth.user.id}/projects/${projectId}/assets/${assetId}/original`
    const payload = {
      id: assetId,
      project_id: projectId,
      story_id: typeof storyId === 'string' ? storyId : null,
      created_by: auth.user.id,
      bucket,
      object_key: objectKey,
      kind,
      mime_type: mimeType,
      byte_size: expectedBytes ?? null,
      original_filename: safeExportFilename(originalFilename),
      state: 'pending_upload',
      version: 1,
      idempotency_key: idempotencyKey ?? null,
    }
    const { data: asset, error: insertError } = await admin.from('media_assets')
      .insert(payload)
      .select('*')
      .single()
    if (insertError?.code === '23505' && typeof idempotencyKey === 'string') {
      const { data: existing, error } = await findExisting()
      if (!error && existing) return await replay(existing)
    }
    if (insertError || !asset) return response({ error: 'Failed to create asset' }, 500, auth.headers)

    const { data: upload, error: uploadError } = await admin.storage.from(bucket)
      .createSignedUploadUrl(objectKey, { upsert: false })
    if (uploadError || !upload) return response({ error: 'Failed to create upload target' }, 502, auth.headers)
    return response({ asset, upload }, 200, auth.headers)
  } catch {
    return response({ error: 'Asset registration is unavailable' }, 500, auth.headers)
  }
}
