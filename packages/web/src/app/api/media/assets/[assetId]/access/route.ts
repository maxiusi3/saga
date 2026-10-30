import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireCurrentMediaAsset } from '@/lib/server/media-asset-guard'
import { withMediaHeaders } from '@/lib/server/media-access'

export const runtime = 'nodejs'

function reply(body: unknown, status: number, headers: Headers) {
  return withMediaHeaders(NextResponse.json(body, { status }), headers)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Media assets are not enabled' }, 404, auth.headers)

  const { assetId } = await params
  if (!assetId || !/^[A-Za-z0-9_-]{3,128}$/.test(assetId)) return reply({ error: 'Invalid asset id' }, 400, auth.headers)

  let admin: ReturnType<typeof getSupabaseAdmin>
  try { admin = getSupabaseAdmin() } catch { return reply({ error: 'Database service not configured' }, 503, auth.headers) }
  try {
    const { data: asset, error: loadError } = await admin.from('media_assets')
      .select('*').eq('id', assetId).maybeSingle()
    if (loadError) return reply({ error: 'Failed to load asset' }, 500, auth.headers)
    if (!asset) return reply({ error: 'Asset not found' }, 404, auth.headers)
    const access = await requireProjectAccess(asset.project_id, auth.user)
    if (!access.ok) {
      const body = await access.response.json()
      return reply(body, access.response.status, auth.headers)
    }

    if (asset.state !== 'ready' || asset.tombstone_at != null) {
      return reply({ error: 'Asset is not ready for access' }, 409, auth.headers)
    }
    const subjects = [asset.id, asset.story_id].filter((id): id is string => typeof id === 'string')
    const { data: tombstones, error: tombstoneError } = await admin.from('deletion_requests')
      .select('subject_id, tombstone_at').eq('project_id', asset.project_id)
      .in('subject_id', subjects).not('tombstone_at', 'is', null)
    if (tombstoneError || !Array.isArray(tombstones)) {
      return reply({ error: 'Failed to verify deletion status' }, 500, auth.headers)
    }
    if (tombstones.length) return reply({ error: 'Asset is not ready for access' }, 409, auth.headers)

    const { data, error } = await admin.storage.from(asset.bucket).createSignedUrl(asset.object_key, 300)
    if (error || !data?.signedUrl) return reply({ error: 'Asset is unavailable' }, 404, auth.headers)
    const current = await requireCurrentMediaAsset(admin, auth.user, asset, ['ready'])
    if (!current.ok) return withMediaHeaders(current.response, auth.headers)
    return reply({ signedUrl: data.signedUrl }, 200, auth.headers)
  } catch {
    return reply({ error: 'Asset access is unavailable' }, 500, auth.headers)
  }
}
