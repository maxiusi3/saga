import { invitationSenderUnavailable } from '@/lib/server/invitation-sender'
export async function GET(_request: Request) { return invitationSenderUnavailable() }
export async function POST(_request: Request) { return invitationSenderUnavailable() }
