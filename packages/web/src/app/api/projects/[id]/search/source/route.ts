import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { GET as accessMedia } from '@/app/api/media/assets/[assetId]/access/route'
import { parseSearchAudioCitation, resolveSearchAudioCitation, SourceSearchError } from '@/lib/server/authoritative-search'
function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status, headers })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
async function readCitation(request: NextRequest) {
  const reader = request.body?.getReader()
  if (!reader) throw new SourceSearchError(400, 'Invalid source audio citation')
  const chunks: Uint8Array[] = []; let size = 0
  let rejectRead: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => { rejectRead = () => reject(new SourceSearchError(400, 'Invalid source audio citation')) })
  request.signal.addEventListener('abort', rejectRead, { once: true })
  const timer = setTimeout(rejectRead, 5000)
  try {
    if (request.signal.aborted) throw new SourceSearchError(400, 'Invalid source audio citation')
    while (true) {
      const item = await Promise.race([reader.read(), aborted])
      if (item.done) break
      size += item.value.byteLength
      if (size > 8000) throw new SourceSearchError(400, 'Invalid source audio citation')
      chunks.push(item.value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return parseSearchAudioCitation(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } catch { throw new SourceSearchError(400, 'Invalid source audio citation') }
  finally { clearTimeout(timer); request.signal.removeEventListener('abort', rejectRead); void reader.cancel().catch(() => {}); reader.releaseLock() }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) { auth.response.headers.set('Cache-Control', 'no-store'); return auth.response }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Source search is not enabled' }, 503, auth.headers)
  try {
    const citation = await readCitation(request)
    const { id: projectId } = await params
    await resolveSearchAudioCitation(auth.user.id, projectId, citation)
    const access = await accessMedia(request, { params: Promise.resolve({ assetId: citation.mediaAssetId }) })
    const accessBody: unknown = await access.json()
    if (!access.ok) return reply(accessBody, access.status, auth.headers)
    // Storage signing and access checks may wait. Recheck both current authority
    // and membership before releasing the resulting URL to the client.
    await resolveSearchAudioCitation(auth.user.id, projectId, citation)
    return reply(accessBody, 200, auth.headers)
  } catch (error) {
    return reply({ error: error instanceof SourceSearchError ? error.message : 'Current source audio is unavailable' },
      error instanceof SourceSearchError ? error.status : 503, auth.headers)
  }
}
