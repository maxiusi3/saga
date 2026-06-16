import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { getApprovedEventSummariesForContributor } from '@/lib/server/public-archive-store'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const events = await getApprovedEventSummariesForContributor(auth.user.id)
  return NextResponse.json({ events }, { headers: auth.headers })
}
