'use client'

import { useParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InvitationManagement } from '@/components/invitations/invitation-management'

export default function InvitationsPage() {
  const params = useParams(),
    locale = useLocale()
  const projectId = params.id as string
  return (
    <div className='space-y-6'>
      <Link href={`/${locale}/dashboard/projects/${projectId}`}>
        <Button variant='ghost'>Back to project</Button>
      </Link>
      <div>
        <h1 className='text-3xl font-bold'>Project Invitations</h1>
        <p className='text-muted-foreground'>Manage project member invitations</p>
      </div>
      <InvitationManagement projectId={projectId} />
    </div>
  )
}
