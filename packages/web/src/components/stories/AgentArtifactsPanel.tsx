import type { AgentArtifact, StoryElement } from '@saga/shared/types/agents'
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
}

export function AgentArtifactsPanel({
  standaloneStory,
  elements,
}: AgentArtifactsPanelProps) {
  if (!standaloneStory && elements.length === 0) return null

  return (
    <EnhancedCard>
      <EnhancedCardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EnhancedCardTitle>Editor Agent Review</EnhancedCardTitle>
          <Badge variant="outline">{elements.length} elements</Badge>
        </div>
      </EnhancedCardHeader>
      <EnhancedCardContent className="space-y-6">
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
