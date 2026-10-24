'use client'

import { useParams } from 'next/navigation'
import { InvitationRecipient } from '@/components/invitations/invitation-recipient'
import { isInvitationToken } from '@/lib/invitation-acceptance-protocol'

export default function InvitationLandingPage() {
  const params = useParams()
  // Next supplies the path segment after one decode; never decode or trim it again.
  const token = isInvitationToken(params.token) ? params.token : null
  const locale = typeof params.locale === 'string' ? params.locale : 'en'
  return <InvitationRecipient token={token} locale={locale} linkKind="path" />
}
