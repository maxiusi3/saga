'use client'

import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InvitationManagement } from './invitation-management'

interface ProjectMember {
  id: string
  user_id: string
  role: 'facilitator' | 'storyteller'
  status: 'active' | 'pending' | 'inactive' | 'declined' | 'removed'
}
interface InvitationManagerProps {
  projectId: string
  currentMembers?: ProjectMember[]
  currentUserId?: string
  isProjectOwner?: boolean
  onRemoveMember?: (memberId: string) => void
  className?: string
}
export function InvitationManager({
  projectId,
  currentMembers = [],
  currentUserId,
  isProjectOwner = false,
  onRemoveMember,
  className,
}: InvitationManagerProps) {
  const t = useTranslations('invitations.manager')
  return (
    <div className={className}>
      {currentMembers.length > 0 && (
        <Card className='mb-6 p-6 space-y-3'>
          <h3 className='font-semibold'>{t('currentMembers')}</h3>
          {currentMembers.map(member => (
            <div
              key={member.id}
              className='flex items-center justify-between rounded-md border p-4'
            >
              <div>
                <p>
                  {member.user_id === currentUserId ? 'You' : `User ${member.user_id.slice(0, 8)}`}
                </p>
                <p className='text-sm text-muted-foreground'>{member.role}</p>
                <Badge variant='outline'>{member.status}</Badge>
              </div>
              {member.user_id !== currentUserId && isProjectOwner && onRemoveMember && (
                <Button
                  variant='ghost'
                  aria-label='Remove member'
                  onClick={() => {
                    if (confirm('Are you sure you want to remove this member?'))
                      onRemoveMember(member.id)
                  }}
                >
                  Remove member
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}
      <InvitationManagement projectId={projectId} />
    </div>
  )
}
