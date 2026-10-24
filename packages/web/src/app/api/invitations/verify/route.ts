import { handleInvitationStatus } from '@/lib/server/invitation-acceptance'

export async function GET(request: Request) {
  const tokens = new URL(request.url).searchParams.getAll('token')
  // URLSearchParams has already decoded once; duplicates and missing values are invalid.
  return handleInvitationStatus(request, tokens.length === 1 ? tokens[0] : '')
}
