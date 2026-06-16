import { useState } from 'react'
import type { PublicArchiveApprovedEventSummary, PublicArchiveContributionPreview } from '@saga/shared/types/public-archive'
import { Badge } from '@/components/ui/badge'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'

interface ContributionStatus {
  id: string
  status: string
  wiki_status: string
  anonymized_text: string
}

export function PublicArchivePanel(props: {
  storyId: string
  userRole: 'facilitator' | 'storyteller' | null
  isStoryteller: boolean
  contribution: ContributionStatus | null
  approvedEvents: PublicArchiveApprovedEventSummary[]
  onGeneratePreview: () => Promise<PublicArchiveContributionPreview>
  onCommit: (previewId: string) => Promise<unknown>
  onInvite: () => Promise<unknown>
  onWithdraw: (contributionId: string) => Promise<unknown>
}) {
  const [preview, setPreview] = useState<PublicArchiveContributionPreview | null>(null)
  const [busy, setBusy] = useState(false)

  async function run<T>(operation: () => Promise<T>) {
    setBusy(true)
    try {
      return await operation()
    } finally {
      setBusy(false)
    }
  }

  if (props.contribution?.status === 'active') {
    return (
      <EnhancedCard>
        <EnhancedCardHeader>
          <EnhancedCardTitle>My Public Contribution</EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent className="space-y-4">
          <Badge variant="outline">Anonymized contribution</Badge>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{props.contribution.anonymized_text}</p>
          {props.approvedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">Wiki summary pending review</p>
          ) : (
            props.approvedEvents.map(event => (
              <section key={event.id} className="rounded-lg border border-sage-200 bg-white p-4">
                <h3 className="font-semibold text-gray-900">{event.eventLabel}</h3>
                <p className="text-sm text-gray-600">{event.perspectiveSummary}</p>
              </section>
            ))
          )}
          <EnhancedButton variant="outline" disabled={busy} onClick={() => run(() => props.onWithdraw(props.contribution!.id))}>
            Withdraw contribution
          </EnhancedButton>
        </EnhancedCardContent>
      </EnhancedCard>
    )
  }

  return (
    <EnhancedCard>
      <EnhancedCardHeader>
        <EnhancedCardTitle>Collective Archive</EnhancedCardTitle>
      </EnhancedCardHeader>
      <EnhancedCardContent className="space-y-4">
        {props.isStoryteller ? (
          <>
            <p className="text-sm text-gray-600">Contribute an anonymized text and structured elements snapshot. Audio, photos, generated media, and exact identity are excluded.</p>
            {!preview && (
              <EnhancedButton disabled={busy} onClick={() => run(async () => setPreview(await props.onGeneratePreview()))}>
                Anonymously add this story to the Collective Archive
              </EnhancedButton>
            )}
            {preview && (
              <section className="space-y-3 rounded-lg border border-sage-200 bg-white p-4">
                <h3 className="font-semibold text-gray-900">{preview.anonymizedTitle}</h3>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{preview.anonymizedText}</p>
                <p className="text-xs text-gray-500">Not included: voice, audio, photos, generated media, exact identity</p>
                <EnhancedButton disabled={busy} onClick={() => run(() => props.onCommit(preview.previewId))}>
                  Join Collective Archive
                </EnhancedButton>
              </section>
            )}
          </>
        ) : props.userRole === 'facilitator' ? (
          <EnhancedButton disabled={busy} onClick={() => run(props.onInvite)}>
            Invite storyteller to contribute
          </EnhancedButton>
        ) : null}
      </EnhancedCardContent>
    </EnhancedCard>
  )
}
