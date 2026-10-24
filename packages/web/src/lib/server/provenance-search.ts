import { randomUUID } from 'crypto'
import type { TranscriptSegmentRecord } from './ai-capability-gateway'

export function extractStructuredFacts(text: string): {
  people: string[]
  years: string[]
  places: string[]
} {
  const people = new Set<string>()
  const years = new Set<string>()
  const places = new Set<string>()

  for (const m of text.matchAll(/\b(18\d{2}|19\d{2}|20\d{2})\b/g)) {
    years.add(m[1])
  }
  for (const m of text.matchAll(
    /\b((?:Grandma|Grandpa|Uncle|Aunt|Cousin|Father|Mother|Brother|Sister)\s+[A-Z][a-z]+)\b/g,
  )) {
    people.add(m[1])
  }
  for (const m of text.matchAll(/\b(?:in|to|from|at)\s+([A-Z][a-z]{2,20}(?:\s+[A-Z][a-z]{2,20})?)\b/g)) {
    places.add(m[1])
  }

  return {
    people: [...people],
    years: [...years],
    places: [...places],
  }
}

export interface SearchIndexEntry {
  id: string
  projectId: string
  storyId: string
  storyTitle: string
  transcriptVersionId: string
  storyRevisionId?: string | null
  mediaAssetId?: string | null
  segmentId: string
  indexVersion: number
  isActiveIndex: boolean
  entityPeople: string[]
  entityDates: string[]
  entityPlaces: string[]
  searchableText: string
  startMs: number
  endMs: number
  createdAt: string
}

export interface ProvenanceSearchCitation {
  entryId: string
  storyId: string
  storyTitle: string
  transcriptVersionId: string
  storyRevisionId?: string | null
  segmentId: string
  startMs: number
  endMs: number
  quotedText: string
  matchedPeople: string[]
  matchedDates: string[]
  matchedPlaces: string[]
  score: number
}

export interface ProvenanceSearchResult {
  status: 'grounded_answer' | 'no_matching_sources'
  query: string
  answerText: string
  citations: ProvenanceSearchCitation[]
  activeIndexVersion: number
  filteredByPermissionCount: number
}

export interface BuildSearchIndexInput {
  projectId: string
  storyId: string
  storyTitle: string
  transcriptVersionId: string
  storyRevisionId?: string | null
  mediaAssetId?: string | null
  indexVersion: number
  isActiveIndex?: boolean
  segments: readonly TranscriptSegmentRecord[]
  now?: string
}

export function buildSearchIndexEntries(input: BuildSearchIndexInput): SearchIndexEntry[] {
  const now = input.now ?? new Date().toISOString()
  const isActive = input.isActiveIndex ?? true

  return input.segments.map(seg => {
    const facts = extractStructuredFacts(seg.text)
    return {
      id: randomUUID(),
      projectId: input.projectId,
      storyId: input.storyId,
      storyTitle: input.storyTitle,
      transcriptVersionId: input.transcriptVersionId,
      storyRevisionId: input.storyRevisionId ?? null,
      mediaAssetId: input.mediaAssetId ?? null,
      segmentId: seg.id,
      indexVersion: input.indexVersion,
      isActiveIndex: isActive,
      entityPeople: facts.people,
      entityDates: facts.years,
      entityPlaces: facts.places,
      searchableText: seg.text,
      startMs: seg.startMs ?? 0,
      endMs: seg.endMs ?? Math.max((seg.startMs ?? 0) + 1000, 1000),
      createdAt: now,
    }
  })
}

export function switchActiveSearchIndexVersion(
  entries: readonly SearchIndexEntry[],
  projectId: string,
  targetIndexVersion: number,
): SearchIndexEntry[] {
  return entries.map(entry => {
    if (entry.projectId !== projectId) return entry
    return {
      ...entry,
      isActiveIndex: entry.indexVersion === targetIndexVersion,
    }
  })
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2)
}

export function executeProvenanceSearch(params: {
  actorId: string
  projectId: string
  isActiveMember: boolean
  query: string
  personFilter?: string
  dateFilter?: string
  placeFilter?: string
  entries: readonly SearchIndexEntry[]
  tombstonedSubjectIds?: ReadonlySet<string>
}): ProvenanceSearchResult {
  if (!params.actorId || !params.isActiveMember) {
    throw new Error('search_access_denied: Actor is not an active member of this project')
  }

  const tombstones = params.tombstonedSubjectIds ?? new Set<string>()
  const authorizedEntries = params.entries.filter(
    entry =>
      entry.projectId === params.projectId &&
      entry.isActiveIndex &&
      !tombstones.has(entry.storyId) &&
      (!entry.mediaAssetId || !tombstones.has(entry.mediaAssetId)),
  )

  const activeIndexVersion =
    authorizedEntries.length > 0 ? Math.max(...authorizedEntries.map(e => e.indexVersion)) : 1

  const queryFacts = extractStructuredFacts(params.query)
  const queryTokens = tokenizeQuery(params.query)
  const personTarget = params.personFilter?.trim().toLowerCase()
  const dateTarget = params.dateFilter?.trim().toLowerCase()
  const placeTarget = params.placeFilter?.trim().toLowerCase()

  const citations: ProvenanceSearchCitation[] = []

  for (const entry of authorizedEntries) {
    if (personTarget && !entry.entityPeople.some(p => p.toLowerCase().includes(personTarget))) {
      continue
    }
    if (dateTarget && !entry.entityDates.some(d => d.toLowerCase().includes(dateTarget))) {
      continue
    }
    if (placeTarget && !entry.entityPlaces.some(pl => pl.toLowerCase().includes(placeTarget))) {
      continue
    }

    const matchedPeople = entry.entityPeople.filter(p =>
      queryFacts.people.some(qp => qp.toLowerCase() === p.toLowerCase()) ||
      (personTarget ? p.toLowerCase().includes(personTarget) : false),
    )
    const matchedDates = entry.entityDates.filter(d =>
      queryFacts.years.includes(d) || (dateTarget ? d.toLowerCase().includes(dateTarget) : false),
    )
    const matchedPlaces = entry.entityPlaces.filter(pl =>
      queryFacts.places.some(qpl => qpl.toLowerCase() === pl.toLowerCase()) ||
      (placeTarget ? pl.toLowerCase().includes(placeTarget) : false),
    )

    const lowerText = entry.searchableText.toLowerCase()
    let tokenHits = 0
    for (const token of queryTokens) {
      if (lowerText.includes(token)) {
        tokenHits += 1
      }
    }

    const score =
      matchedPeople.length * 3 +
      matchedDates.length * 3 +
      matchedPlaces.length * 3 +
      tokenHits

    if (score > 0 || (queryTokens.length === 0 && (personTarget || dateTarget || placeTarget))) {
      citations.push({
        entryId: entry.id,
        storyId: entry.storyId,
        storyTitle: entry.storyTitle,
        transcriptVersionId: entry.transcriptVersionId,
        storyRevisionId: entry.storyRevisionId ?? null,
        segmentId: entry.segmentId,
        startMs: entry.startMs,
        endMs: entry.endMs,
        quotedText: entry.searchableText,
        matchedPeople,
        matchedDates,
        matchedPlaces,
        score: Math.max(score, 1),
      })
    }
  }

  citations.sort((a, b) => b.score - a.score || a.startMs - b.startMs)

  if (citations.length === 0) {
    return {
      status: 'no_matching_sources',
      query: params.query,
      answerText: 'No matching family records were found in this project for your query.',
      citations: [],
      activeIndexVersion,
      filteredByPermissionCount: authorizedEntries.length,
    }
  }

  const topQuotes = citations
    .slice(0, 3)
    .map(
      c =>
        `[${c.storyTitle} @ ${(c.startMs / 1000).toFixed(1)}s–${(c.endMs / 1000).toFixed(1)}s]: "${c.quotedText}"`,
    )
    .join(' | ')

  return {
    status: 'grounded_answer',
    query: params.query,
    answerText: `Found ${citations.length} verified source segment(s): ${topQuotes}`,
    citations,
    activeIndexVersion,
    filteredByPermissionCount: authorizedEntries.length,
  }
}
