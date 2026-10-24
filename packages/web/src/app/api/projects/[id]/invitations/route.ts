import { handleInvitationSend, invitationSenderUnavailable } from '@/lib/server/invitation-sender'
export async function GET(_request: Request) { return invitationSenderUnavailable() }
export async function DELETE(_request: Request) { return invitationSenderUnavailable() }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.INVITATION_TRANSACTIONS_ENABLED !== 'true') return invitationSenderUnavailable()
  const { id } = await params
  return handleInvitationSend(request, id)
}
