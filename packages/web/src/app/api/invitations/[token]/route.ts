import { handleInvitationStatus } from '@/lib/server/invitation-acceptance'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Next has already decoded this value once.
  return handleInvitationStatus(request, (await params).token)
}
