import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isReviewUuid, parseReviewRequest } from '@/lib/story-review-contract'
import { readStoryReview, mutateStoryReview, StoryReviewError } from '@/lib/server/story-review-service'
export const runtime = 'nodejs'
type Context = { params: Promise<{ storyId: string }> }
function reply(body: unknown, status: number, headers?: Headers) {
  const response = NextResponse.json(body, {status})
  headers?.forEach((value,key)=>response.headers.set(key,value));response.headers.set('Cache-Control','no-store')
  return response
}
async function handle(request: NextRequest, context: Context, writing: boolean) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') return reply({error:'Review unavailable.'},404)
  const auth=await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const {storyId}=await context.params
  if (!isReviewUuid(storyId)) return reply({error:'Invalid story id.'},400,auth.headers)
  let operation
  if (writing) {
    try {
      const raw=await request.text()
      if (raw.length>650000) return reply({error:'Invalid review request.'},400,auth.headers)
      operation=parseReviewRequest(JSON.parse(raw))
    } catch { return reply({error:'Invalid review request.'},400,auth.headers) }
  }
  try {
    const options={admin:getSupabaseAdmin(),signal:request.signal}
    const review=operation?await mutateStoryReview(auth.user.id,storyId,operation,options):await readStoryReview(auth.user.id,storyId,options)
    return reply(operation ? {review,requestId:operation.requestId} : {review},200,auth.headers)
  } catch (error) {
    const safe=error instanceof StoryReviewError?error:new StoryReviewError(503)
    return reply({error:safe.message},safe.status,auth.headers)
  }
}
export function GET(request: NextRequest, context: Context) { return handle(request,context,false) }
export function POST(request: NextRequest, context: Context) { return handle(request,context,true) }
