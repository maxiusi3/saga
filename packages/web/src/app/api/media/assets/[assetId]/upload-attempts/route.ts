import { createHash, randomBytes, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isUuid } from '@/lib/invitation-acceptance-protocol'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireCurrentMediaAsset } from '@/lib/server/media-asset-guard'
import { withMediaHeaders } from '@/lib/server/media-access'
import { hasExactKeys } from '@/lib/server/operational-rpc'
import { beginBrowserUploadAttempt, finishBrowserUploadAttempt, isBrowserUploadOutcome, type BrowserUploadOutcome } from '@/lib/server/upload-observations'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

type UploadReport = { action: 'begin' } | { action: 'finish'; attemptId: string; reportToken: string; outcome: BrowserUploadOutcome }

function parseBody(body: unknown): UploadReport | null {
  if (hasExactKeys(body, ['action']) && body.action === 'begin') return { action: 'begin' }
  if (hasExactKeys(body, ['action', 'attemptId', 'reportToken', 'outcome']) && body.action === 'finish' &&
    isUuid(body.attemptId) && typeof body.reportToken === 'string' && body.reportToken.length === 43 &&
    /^[A-Za-z0-9_-]{43}$/.test(body.reportToken) && isBrowserUploadOutcome(body.outcome)) {
    return { action: 'finish', attemptId: body.attemptId, reportToken: body.reportToken, outcome: body.outcome }
  }
  return null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }
  const reply = (body: unknown, status: number) => withMediaHeaders(NextResponse.json(body, { status }), auth.headers)
  const guardFailure = (response: NextResponse) => [401, 403, 404, 409].includes(response.status)
    ? withMediaHeaders(response, auth.headers)
    : reply({ error: 'Upload observation is unavailable' }, 503)
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Media assets are not enabled' }, 404)
  const { assetId } = await params
  if (!assetId || !/^[A-Za-z0-9_-]{3,128}$/.test(assetId)) return reply({ error: 'Invalid asset id' }, 400)
  let body: UploadReport | null
  try { body = parseBody(await request.json()) } catch { body = null }
  if (!body) return reply({ error: 'Invalid upload report' }, 400)

  try {
    const admin = getSupabaseAdmin()
    const { data: asset, error } = await admin.from('media_assets').select('*').eq('id', assetId).maybeSingle()
    if (error) return reply({ error: 'Upload observation is unavailable' }, 503)
    if (!asset) return reply({ error: 'Asset not found' }, 404)
    const states = body.action === 'begin' ? ['pending_upload'] : ['pending_upload', 'uploaded', 'verifying', 'ready', 'quarantined']
    const access = await requireCurrentMediaAsset(admin, auth.user, asset, states)
    if (!access.ok) return guardFailure(access.response)
    if (asset.kind !== 'original_audio') return reply({ error: 'Asset is not eligible for upload reporting' }, 409)

    const attemptId = body.action === 'begin' ? randomUUID() : body.attemptId
    const reportToken = body.action === 'begin' ? randomBytes(32).toString('base64url') : body.reportToken
    const bindingHash = createHash('sha256').update(JSON.stringify([asset.id, auth.user.id, reportToken])).digest('hex')
    const receipt = body.action === 'begin'
      ? await beginBrowserUploadAttempt(attemptId, bindingHash, request.signal)
      : await finishBrowserUploadAttempt(attemptId, bindingHash, body.outcome)
    if (!receipt) return reply({ error: 'Upload observation is unavailable' }, 503)

    // This recheck is not an atomic authorization barrier; do not await again before publication.
    const final = await requireCurrentMediaAsset(admin, auth.user, asset, states)
    if (!final.ok) return guardFailure(final.response)
    return reply(body.action === 'begin' ? { ...receipt, reportToken } : receipt, 200)
  } catch {
    return reply({ error: 'Upload observation is unavailable' }, 503)
  }
}
