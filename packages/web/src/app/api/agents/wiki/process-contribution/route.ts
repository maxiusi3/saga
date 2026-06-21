import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireContributionOwner } from '@/lib/server/public-archive-access'
import { withAuthHeaders } from '@/lib/server/http'
import { processPublicContributionWithWikiAgent } from '@/lib/server/public-archive-wiki-runner'

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const contributionId = typeof body.contributionId === 'string' ? body.contributionId : null
  if (!contributionId) {
    return NextResponse.json({ error: 'A contributionId is required' }, { status: 400, headers: auth.headers })
  }

  // Only the contribution owner may trigger (re)processing of their own contribution.
  const access = await requireContributionOwner(contributionId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  try {
    const result = await processPublicContributionWithWikiAgent({ contributionId, actorUserId: auth.user.id })
    return NextResponse.json({ processed: true, result }, { headers: auth.headers })
  } catch (error) {
    console.error('Failed to process public contribution with Wiki Editor Agent', error)
    return NextResponse.json({ error: 'Unable to process contribution' }, { status: 500, headers: auth.headers })
  }
}
