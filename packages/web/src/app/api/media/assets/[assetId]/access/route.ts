import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status })
  headers.forEach((value, key) => response.headers.set(key, value))
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(
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
    .select('id, project_id, bucket, object_key, state').eq('id', assetId).maybeSingle()
  if (loadError) return reply({ error: 'Failed to load asset' }, 500, auth.headers)
  if (!asset) return reply({ error: 'Asset not found' }, 404, auth.headers)
  if (asset.state !== 'ready' || (asset as { tombstone_at?: string | null }).tombstone_at != null) {
    return reply({ error: 'Asset is not ready for access' }, 409, auth.headers)
  }

  const access = await requireProjectAccess(asset.project_id, auth.user)
  if (!access.ok) {
    const body = await access.response.json()
    return reply(body, access.response.status, auth.headers)
  }

  const { data, error } = await admin.storage.from(asset.bucket).createSignedUrl(asset.object_key, 3600)
  if (error || !data?.signedUrl) return reply({ error: 'Asset is unavailable' }, 404, auth.headers)
  return reply({ signedUrl: data.signedUrl }, 200, auth.headers)
}
