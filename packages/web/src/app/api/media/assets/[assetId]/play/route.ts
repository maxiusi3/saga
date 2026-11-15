import { NextRequest, NextResponse } from 'next/server'
import { GET as accessAsset } from '../access/route'
import { isRecordingSaveUuid } from '@/lib/recording-save-contract'
import { withMediaHeaders } from '@/lib/server/media-access'
export const runtime = 'nodejs'
/** A stable story URL. The access route owns all authorization and final revalidation. */
export async function GET(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params
  if (!isRecordingSaveUuid(assetId)) return withMediaHeaders(NextResponse.json({ error: 'Invalid asset id' }, { status: 400 }), {})
  const access = await accessAsset(request, { params: Promise.resolve({ assetId }) })
  if (!access.ok) return withMediaHeaders(access, {})
  try {
    const body = await access.json()
    if (typeof body.signedUrl !== 'string' || !['https:', 'http:'].includes(new URL(body.signedUrl).protocol)) throw new Error()
    const redirect = NextResponse.redirect(body.signedUrl, 307)
    // JSON response headers (notably Content-Type) do not describe this redirect.
    for (const cookie of access.headers.getSetCookie()) redirect.headers.append('Set-Cookie', cookie)
    return withMediaHeaders(redirect, {})
  } catch { return withMediaHeaders(NextResponse.json({ error: 'Asset is unavailable' }, { status: 503 }), access.headers) }
}
