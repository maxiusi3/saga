import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { safeExportFilename } from '@/lib/media-assets'
import { verifyMediaObjectStream } from '@/lib/server/media-asset-verifier'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status })
  headers.forEach((value, key) => response.headers.set(key, value))
  response.headers.set('Cache-Control', 'no-store')
  return response
}

function maxBytesFor(kind: string): number {
  return kind === 'original_audio' ? 100 * 1024 * 1024 : 5 * 1024 * 1024
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Media assets are not enabled' }, 404, auth.headers)

  const { assetId } = await params
  if (!assetId || !/^[A-Za-z0-9_-]{3,128}$/.test(assetId)) return reply({ error: 'Invalid asset id' }, 400, auth.headers)

  let admin: ReturnType<typeof getSupabaseAdmin>
  try { admin = getSupabaseAdmin() } catch { return reply({ error: 'Database service not configured' }, 503, auth.headers) }
  const { data: asset, error: loadError } = await admin.from('media_assets')
    .select('*').eq('id', assetId).maybeSingle()
  if (loadError) return reply({ error: 'Failed to load asset' }, 500, auth.headers)
  if (!asset) return reply({ error: 'Asset not found' }, 404, auth.headers)
  if (asset.state === 'deleted' || asset.state === 'deleting' || asset.state === 'quarantined') {
    return reply({ error: 'Asset is not eligible for verification' }, 409, auth.headers)
  }

  const access = await requireProjectAccess(asset.project_id, auth.user)
  if (!access.ok) {
    const body = await access.response.json()
    return reply(body, access.response.status, auth.headers)
  }

  const storage = admin.storage.from(asset.bucket)
  const { data: info, error: infoError } = await storage.info(asset.object_key)
  if (infoError || !info) return reply({ error: 'Uploaded object not found' }, 404, auth.headers)

  if (typeof info.size === 'number' && typeof asset.byte_size === 'number' && info.size !== asset.byte_size) {
    const { data: quarantined } = await admin.from('media_assets').update({
      state: 'quarantined',
      verification_error: 'integrity_mismatch',
      byte_size: info.size,
      verified_at: new Date().toISOString(),
    }).eq('id', asset.id).eq('state', asset.state).select('*').single()
    return reply({ error: 'Uploaded object failed verification', asset: quarantined ?? { ...asset, state: 'quarantined' } }, 409, auth.headers)
  }

  const { data: stream, error: streamError } = await storage.download(asset.object_key).asStream()
  if (streamError || !stream) return reply({ error: 'Failed to read uploaded object' }, 502, auth.headers)
  const result = await verifyMediaObjectStream(stream, {
    expectedBytes: typeof asset.byte_size === 'number' ? asset.byte_size : undefined,
    expectedSha256: typeof asset.sha256 === 'string' ? asset.sha256 : undefined,
    contentType: info.contentType,
    expectedMimeType: asset.mime_type,
    maxBytes: maxBytesFor(asset.kind),
  })
  if (!result.ok) {
    const { data: quarantined } = await admin.from('media_assets').update({
      state: 'quarantined',
      verification_error: result.reason,
      byte_size: result.byteSize,
      sha256: result.sha256 ?? null,
      verified_at: new Date().toISOString(),
    }).eq('id', asset.id).eq('state', asset.state).select('*').single()
    return reply({ error: 'Uploaded object failed verification', asset: quarantined ?? { ...asset, state: 'quarantined' } }, result.reason === 'too_large' ? 413 : 409, auth.headers)
  }

  const nextState = asset.kind === 'original_image' ? 'ready' : 'verifying'
  const { data: verified, error: updateError } = await admin.from('media_assets').update({
    state: nextState,
    byte_size: result.byteSize,
    sha256: result.sha256,
    original_filename: safeExportFilename(asset.original_filename),
    verified_at: new Date().toISOString(),
    content_verified_at: asset.kind === 'original_image' ? new Date().toISOString() : null,
    verification_error: null,
  }).eq('id', asset.id).eq('state', asset.state).select('*').single()
  if (updateError || !verified) return reply({ error: 'Asset changed while verification was running' }, 409, auth.headers)
  return reply({ asset: verified }, nextState === 'ready' ? 200 : 202, auth.headers)
}
