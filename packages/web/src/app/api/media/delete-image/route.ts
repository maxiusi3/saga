import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { withMediaHeaders } from '@/lib/server/media-access'

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }

  // Legacy paths cannot implement the asset/tombstone deletion transaction.
  return withMediaHeaders(NextResponse.json({
    code: 'MEDIA_DELETION_UNAVAILABLE',
    error: 'Media deletion is temporarily unavailable.',
  }, { status: 503 }), auth.headers)
}
