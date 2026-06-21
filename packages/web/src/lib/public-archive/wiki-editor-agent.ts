import type { StoryElementType } from '@saga/shared/types/agents'

interface PublicContributionForWiki {
  id: string
  anonymized_title: string
  anonymized_text: string
  anonymized_summary: string
  elements: Array<{
    element_type: StoryElementType
    value: string
    normalized_value: string | null
    confidence: number
  }>
}

interface ExistingCluster {
  id: string
  event_label: string
  timeframe: string
  place_scope: string
  status?: string
}

export function processWikiEventDraft(input: {
  existingClusters: ExistingCluster[]
  contributions: PublicContributionForWiki[]
  primaryContributionId?: string
}) {
  const groups = groupBySignature(input.contributions)
  // When processing a specific contribution, build the cluster around ITS signature
  // group; otherwise fall back to the largest group.
  const selected =
    (input.primaryContributionId
      ? groups.find(group => group.some(item => item.id === input.primaryContributionId))
      : undefined) ||
    groups[0] ||
    []
  const first = selected[0]
  const timeframe = getElementValue(first, 'time') || 'Unknown timeframe'
  const placeScope = getElementValue(first, 'place') || 'Unknown place'
  const event = getElementValue(first, 'event') || 'shared event'
  const eventLabel = `${timeframe} ${placeScope} ${event} memories`.replace(/\s+/g, ' ').trim()

  return {
    status: selected.length >= 2 ? 'draft' as const : 'candidate' as const,
    eventLabel,
    timeframe,
    placeScope,
    historicalContextSummary: `Contributors described ${event} around ${placeScope} during ${timeframe}.`,
    perspectiveSummary: selected.map(item => item.anonymized_summary).join(' '),
    representativeExcerpts: selected.slice(0, 3).map(item => excerpt(item.anonymized_text)),
    uncertaintyNotes: `This summary is derived from ${selected.length} active contributions and does not use external historical sources.`,
    confidence: selected.length >= 2 ? 0.8 : 0.65,
    activeContributionIds: selected.map(item => item.id),
    // Reuse an existing open cluster with the same timeframe/place so reprocessing
    // updates one cluster instead of accumulating duplicates.
    existingClusterId: findMatchingClusterId(input.existingClusters, timeframe, placeScope),
  }
}

function findMatchingClusterId(clusters: ExistingCluster[], timeframe: string, placeScope: string) {
  // Never merge on a fully-unknown signature, or every signature-less contribution
  // would collapse into one cluster.
  if (timeframe === 'Unknown timeframe' && placeScope === 'Unknown place') return null
  const match = clusters.find(
    cluster => cluster.timeframe === timeframe && cluster.place_scope === placeScope,
  )
  return match ? match.id : null
}

function groupBySignature(contributions: PublicContributionForWiki[]) {
  const map = new Map<string, PublicContributionForWiki[]>()
  for (const contribution of contributions) {
    const signature = [
      getElementValue(contribution, 'time'),
      getElementValue(contribution, 'place'),
      getElementValue(contribution, 'event'),
    ].filter(Boolean).join('|') || contribution.id
    map.set(signature, [...(map.get(signature) || []), contribution])
  }
  return [...map.values()].sort((a, b) => b.length - a.length)
}

function getElementValue(contribution: PublicContributionForWiki | undefined, type: StoryElementType) {
  if (!contribution) return null
  const element = contribution.elements.find(item => item.element_type === type && item.confidence >= 0.6)
  return element?.normalized_value || element?.value || null
}

function excerpt(text: string) {
  if (text.length <= 160) return text
  return `${text.slice(0, 157).trimEnd()}...`
}
