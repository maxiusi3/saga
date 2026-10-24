import { handleInvitationAcceptance } from '@/lib/server/invitation-acceptance'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  return handleInvitationAcceptance(request, (await params).token)
}
