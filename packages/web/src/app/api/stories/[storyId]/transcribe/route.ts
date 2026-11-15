import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isReviewUuid } from '@/lib/story-review-contract'
import { readStoryTranscriptionStatus, StoryReviewError } from '@/lib/server/story-review-service'
import { getTranscriptionConfiguration, parseTranscriptionRequest, StoryTranscriptionError, transcribeStory } from '@/lib/server/story-transcription'

export const runtime = 'nodejs'
type Context = { params: Promise<{ storyId: string }> }
function reply(body: unknown, status: number, headers?: Headers) {
  const response = NextResponse.json(body, { status })
  headers?.forEach((value, key) => response.headers.set(key, value))
  response.headers.set('Cache-Control', 'no-store')
  return response
}
async function readBody(request: NextRequest) {
  const reader = request.body?.getReader()
  if (!reader) throw new StoryTranscriptionError(400, 'invalid_request')
  const chunks: Uint8Array[] = []; let size = 0
  let rejectRead: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => { rejectRead = () => reject(new StoryTranscriptionError(400, 'invalid_request')) })
  request.signal.addEventListener('abort', rejectRead, { once: true })
  const timer = setTimeout(rejectRead, 5000)
  try {
    if (request.signal.aborted) throw new StoryTranscriptionError(400, 'invalid_request')
    while (true) {
      const item = await Promise.race([reader.read(), aborted])
      if (item.done) break
      size += item.value.byteLength
      if (size > 4096) throw new StoryTranscriptionError(400, 'invalid_request')
      chunks.push(item.value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return parseTranscriptionRequest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', rejectRead); void reader.cancel().catch(() => {}); reader.releaseLock() }
}
async function handle(request: NextRequest, context: Context, writing: boolean) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({ error: 'Transcription is unavailable.', code: 'unavailable' }, 404)
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const { storyId } = await context.params
  if (!isReviewUuid(storyId)) return reply({ error: 'Invalid story id.', code: 'invalid_request' }, 400, auth.headers)
  let input
  if (writing) {
    try { input = await readBody(request) }
    catch { return reply({ error: 'Invalid transcription request.', code: 'invalid_request' }, 400, auth.headers) }
  }
  try {
    const options = { admin: getSupabaseAdmin(), signal: request.signal }
    if (!input) {
      const status = await readStoryTranscriptionStatus(auth.user.id, storyId, options)
      return reply({ transcription: { ...getTranscriptionConfiguration(), pendingRequestId: status.pendingRequestId, retryableRequestId: status.retryableRequestId ?? null } }, 200, auth.headers)
    }
    const review = await transcribeStory(auth.user.id, storyId, input, options)
    return reply({ review }, 200, auth.headers)
  } catch (error) {
    if (error instanceof StoryReviewError) return reply({ error: error.message, code: error.status === 409 ? 'source_changed' : error.status === 403 ? 'access_denied' : 'unavailable' }, error.status, auth.headers)
    const safe = error instanceof StoryTranscriptionError ? error : new StoryTranscriptionError(503, 'unavailable')
    return reply({ error: safe.message, code: safe.code }, safe.status, auth.headers)
  }
}
export function GET(request: NextRequest, context: Context) { return handle(request, context, false) }
export function POST(request: NextRequest, context: Context) { return handle(request, context, true) }
