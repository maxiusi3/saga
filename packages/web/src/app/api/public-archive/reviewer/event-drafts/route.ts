import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requirePublicArchiveReviewer } from '@/lib/server/public-archive-access'
import { listReviewerEventDrafts } from '@/lib/server/public-archive-store'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const access = await requirePublicArchiveReviewer(auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const drafts = await listReviewerEventDrafts()
  return NextResponse.json({ drafts }, { headers: auth.headers })
}

function withAuthHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}
