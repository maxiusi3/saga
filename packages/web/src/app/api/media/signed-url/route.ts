import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { parseMediaReference } from '@/lib/media-reference'
import { requireMediaAccess, withMediaHeaders } from '@/lib/server/media-access'

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const reply = (body: unknown, status = 200) => withMediaHeaders(NextResponse.json(body, { status }), auth.headers)
  let body
  try { body = await request.json() } catch { return reply({ error: 'Invalid request' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request' }, 400)
  const reference = parseMediaReference(body.bucket, body.path)
  const expiresIn = body.expiresIn === undefined ? 3600 : body.expiresIn
  if (!reference || typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return reply({ error: 'Invalid media reference or expiry' }, 400)
  }
  const access = await requireMediaAccess(reference, auth.user)
  if (!access.ok) return withMediaHeaders(access.response, auth.headers)
  try {
    const { data, error } = await access.admin.storage.from(reference.bucket)
      .createSignedUrl(reference.path, Math.min(Math.max(Math.floor(expiresIn), 60), 3600))
    if (error || !data?.signedUrl) return reply({ error: 'Failed to create signed URL' }, 500)
    return reply({ signedUrl: data.signedUrl })
  } catch {
    return reply({ error: 'Failed to create signed URL' }, 500)
  }
}
