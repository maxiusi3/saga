import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/server/auth'

const ALLOWED_BUCKETS = new Set(['saga', 'audio-recordings'])

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const bucket = String(body.bucket || '')
  const path = String(body.path || '')
  const expiresIn = Number(body.expiresIn || 3600)

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'Unsupported bucket' }, { status: 400 })
  }

  if (!path.startsWith(`${auth.user.id}/`) && !path.includes('/projects/')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(bucket)
    .createSignedUrl(path, Math.min(Math.max(expiresIn, 60), 3600))

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl })
}
