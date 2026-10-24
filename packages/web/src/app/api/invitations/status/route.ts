import { handleInvitationStatus } from '@/lib/server/invitation-acceptance'

export async function POST(request: Request) {
  return handleInvitationStatus(request)
}
