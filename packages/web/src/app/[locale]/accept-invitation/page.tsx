'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { InvitationRecipient } from '@/components/invitations/invitation-recipient'
import { isInvitationToken } from '@/lib/invitation-acceptance-protocol'

function AcceptInvitationContent() {
  const searchParams = useSearchParams()
  const locale = useLocale()
  const tokens = searchParams.getAll('token')
  const token = tokens.length === 1 && isInvitationToken(tokens[0]) ? tokens[0] : null
  return <InvitationRecipient token={token} locale={locale} linkKind="query" />
}

export default function AcceptInvitationPage() {
  return <Suspense fallback={<p role="status">Loading invitation…</p>}><AcceptInvitationContent /></Suspense>
}
