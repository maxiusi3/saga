import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireStoryFacilitatorForInvitation } from '@/lib/server/public-archive-access'
import { createPublicContributionInvitation } from '@/lib/server/public-archive-store'

interface RouteContext {
  params: Promise<{ storyId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { storyId } = await context.params
  const access = await requireStoryFacilitatorForInvitation(storyId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const body = await request.json().catch(() => ({}))
  const invitation = await createPublicContributionInvitation({
    storyId,
    projectId: access.story.project_id,
    invitedStorytellerId: access.story.storyteller_id,
    invitedBy: auth.user.id,
    message: typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null,
  })

  return NextResponse.json({ invitation }, { headers: auth.headers })
}

function withAuthHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}
