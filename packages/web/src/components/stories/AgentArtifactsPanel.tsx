import type { AgentArtifact, StoryElement } from '@saga/shared/types/agents'
import type { VerifiedStoryAssertion } from '@/lib/server/provenance-editor'
import { Badge } from '@/components/ui/badge'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'

export interface StandaloneStoryArtifact {
  title: string
  body: string
  summary: string
}

export interface AgentArtifactsPanelProps {
  standaloneStory: StandaloneStoryArtifact | null
  elements: StoryElement[]
  artifacts: AgentArtifact[]
  assertions?: VerifiedStoryAssertion[]
  onSeekAudio?: (startMs: number, endMs: number | null, segmentId: string | null) => void
  onReviewDecision?: (assertionId: string, action: 'accept' | 'modify' | 'dispute' | 'skip') => void
}

const PRIORITY_ORDER: Record<string, number> = {
  person: 1,
  relation: 2,
  year_date: 3,
  place: 4,
  event: 5,
  quote: 6,
}

function formatAudioTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function attributionLabel(attribution: VerifiedStoryAssertion['memoryAttribution']): string {
  switch (attribution) {
    case 'storyteller_memory':
      return 'Storyteller Memory'
    case 'external_corroborated':
      return 'External Corroborated'
    case 'family_supplement':
      return 'Family Supplement'
    case 'disputed_memory':
      return 'Disputed Memory'
  }
}

export function AgentArtifactsPanel({
  standaloneStory,
  elements,
  assertions = [],
  onSeekAudio,
  onReviewDecision,
}: AgentArtifactsPanelProps) {
  if (!standaloneStory && elements.length === 0 && assertions.length === 0) return null

  const sortedAssertions = [...assertions].sort(
    (a, b) => (PRIORITY_ORDER[a.assertionType] ?? 99) - (PRIORITY_ORDER[b.assertionType] ?? 99),
  )

  return (
    <EnhancedCard>
      <EnhancedCardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EnhancedCardTitle>Editor Agent Review</EnhancedCardTitle>
          <Badge variant="outline">{elements.length} elements</Badge>
        </div>
      </EnhancedCardHeader>
      <EnhancedCardContent className="space-y-6">
        {sortedAssertions.length > 0 && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Fact & Provenance Check (Names, Relations & Dates First)
              </h3>
              <span className="text-sm text-gray-500">{sortedAssertions.length} assertions</span>
            </div>
            <div className="grid gap-3">
              {sortedAssertions.map(assertion => (
                <div
                  key={assertion.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{assertion.assertionType}</Badge>
                    <Badge variant="outline">{attributionLabel(assertion.memoryAttribution)}</Badge>
                    <Badge variant="outline">{assertion.verificationStatus}</Badge>
                    {assertion.isSevereFabrication && (
                      <Badge variant="destructive">Needs Human Resolution</Badge>
                    )}
                    <span className="font-medium text-gray-900">{assertion.subject}</span>
                  </div>
                  <p className="mb-2 text-sm text-gray-800">{assertion.claimText}</p>
                  {assertion.sourceQuote && (
                    <blockquote className="mb-2 border-l-2 border-sage-300 pl-3 text-sm text-gray-700">
                      {assertion.sourceQuote}
                    </blockquote>
                  )}
                  {assertion.disputedAlternativeText && (
                    <div className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
                      Preserved Family Alternative ({assertion.disputedBy ?? 'family member'}):{' '}
                      {assertion.disputedAlternativeText}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {typeof assertion.startMs === 'number' ? (
                      <button
                        type="button"
                        onClick={() => onSeekAudio?.(assertion.startMs!, assertion.endMs, assertion.segmentId)}
                        className="rounded border border-sage-300 px-2.5 py-1 text-xs font-medium text-sage-800 hover:bg-sage-50"
                      >
                        Listen [{formatAudioTime(assertion.startMs)}
                        {typeof assertion.endMs === 'number' ? ` - ${formatAudioTime(assertion.endMs)}` : ''}]
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">No aligned audio timestamp</span>
                    )}
                    {onReviewDecision && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onReviewDecision(assertion.id, 'accept')}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => onReviewDecision(assertion.id, 'modify')}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Modify
                        </button>
                        <button
                          type="button"
                          onClick={() => onReviewDecision(assertion.id, 'dispute')}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Keep Dispute
                        </button>
                        <button
                          type="button"
                          onClick={() => onReviewDecision(assertion.id, 'skip')}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {standaloneStory && (
          <section className="rounded-lg border border-sage-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-sage-700">
                Standalone Story
              </div>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">{standaloneStory.title}</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">{standaloneStory.summary}</p>
            <div className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
              {standaloneStory.body}
            </div>
          </section>
        )}

        {elements.length > 0 && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Extracted Story Elements</h3>
              <span className="text-sm text-gray-500">{elements.length} elements</span>
            </div>
            <div className="grid gap-3">
              {elements.map(element => (
                <div
                  key={element.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{element.element_type}</Badge>
                    <span className="font-medium text-gray-900">{element.value}</span>
                    <span className="text-xs text-gray-500">
                      {Math.round(element.confidence * 100)}% confidence
                    </span>
                  </div>
                  {element.normalized_value && element.normalized_value !== element.value && (
                    <div className="mb-2 text-xs text-gray-500">
                      Normalized: {element.normalized_value}
                    </div>
                  )}
                  <blockquote className="border-l-2 border-sage-300 pl-3 text-sm text-gray-700">
                    {element.source_quote}
                  </blockquote>
                  {typeof element.source_start_offset === 'number' && typeof element.source_end_offset === 'number' && (
                    <div className="mt-2 text-xs text-gray-500">
                      Offsets {element.source_start_offset}-{element.source_end_offset}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </EnhancedCardContent>
    </EnhancedCard>
  )
}
