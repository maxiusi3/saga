import { handleInvitationAcceptance } from '@/lib/server/invitation-acceptance'

export async function POST(request: Request) {
  return handleInvitationAcceptance(request)
}
