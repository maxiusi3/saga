import { getSupabaseAdmin } from '@/lib/supabase'
import { searchSemanticSources } from './semantic-search'
import type { ProvenanceSearchCitation } from './provenance-search'

export class SourceSearchError extends Error {
  constructor(public readonly status: number, message: string) { super(message) }
}
export interface SourceSearchInput { query: string; person?: string; date?: string; place?: string; mode?: 'literal' | 'semantic'; consent?: boolean; policyVersion?: string }
const kinds = ['original_transcript', 'family_supplement', 'disputed_memory', 'dispute_alternative']
const hash = /^[a-f0-9]{64}$/
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
export function parseSourceSearchInput(params: URLSearchParams): SourceSearchInput {
  const input: SourceSearchInput = { query: '' }
  for (const [param, field, max] of [['q', 'query', 240], ['person', 'person', 80], ['date', 'date', 4], ['place', 'place', 80]] as const) {
    const values = params.getAll(param), value = (values[0] ?? '').trim()
    if (values.length > 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(values[0] ?? '')) {
      throw new SourceSearchError(400, 'Invalid search filters')
    }
    input[field] = value
  }
  if ((!input.query && !input.person && !input.date && !input.place) || (input.date && !/^[0-9]{4}$/.test(input.date))) {
    throw new SourceSearchError(400, 'Enter keywords, a person, a four-digit year, or a place')
  }
  return input
}

export function parseSourceCitation(row: unknown, projectId: string): ProvenanceSearchCitation {
  const invalid = () => { throw new SourceSearchError(500, 'Source search response could not be verified') }
  if (!record(row)) return invalid()
  if (row.projectId !== projectId || !['entryId', 'storyTitle', 'quotedText'].every(k => typeof row[k] === 'string') ||
    !['storyId', 'transcriptVersionId'].every(k => typeof row[k] === 'string' && uuid.test(row[k] as string)) ||
    !['storyRevisionId', 'segmentId', 'mediaAssetId', 'attributedTo'].every(k => row[k] === null || (typeof row[k] === 'string' && uuid.test(row[k] as string))) ||
    !kinds.includes(String(row.sourceKind)) || !['source_only', 'approved'].includes(String(row.reviewStatus)) ||
    typeof row.sourceHash !== 'string' || !hash.test(row.sourceHash) || typeof row.sourceFingerprint !== 'string' || !hash.test(row.sourceFingerprint) ||
    !Number.isSafeInteger(row.excerptStart) || Number(row.excerptStart) < 0 || !Number.isSafeInteger(row.excerptEnd) ||
    Number(row.excerptEnd) - Number(row.excerptStart) !== Array.from(String(row.quotedText)).length ||
    Array.from(String(row.quotedText)).length > 1200 || Array.from(String(row.storyTitle)).length > 500 ||
    (row.reviewStatus === 'approved' && row.storyRevisionId === null)) return invalid()
  const timed = row.startMs !== null || row.endMs !== null
  if (timed && (row.sourceKind !== 'original_transcript' || !row.segmentId || !row.mediaAssetId ||
      !Number.isSafeInteger(row.startMs) || !Number.isSafeInteger(row.endMs) || Number(row.startMs) < 0 || Number(row.endMs) <= Number(row.startMs))) return invalid()
  if (row.sourceKind !== 'original_transcript' && (row.mediaAssetId !== null || row.startMs !== null || row.endMs !== null)) return invalid()
  return {
    entryId: String(row.entryId), storyId: String(row.storyId), storyTitle: String(row.storyTitle),
    transcriptVersionId: String(row.transcriptVersionId), storyRevisionId: row.storyRevisionId as string | null,
    segmentId: row.segmentId as string | null, mediaAssetId: row.mediaAssetId as string | null,
    startMs: row.startMs as number | null, endMs: row.endMs as number | null, quotedText: String(row.quotedText),
    sourceKind: row.sourceKind as ProvenanceSearchCitation['sourceKind'], reviewStatus: row.reviewStatus as ProvenanceSearchCitation['reviewStatus'],
    sourceHash: row.sourceHash, sourceFingerprint: row.sourceFingerprint, attributedTo: row.attributedTo as string | null,
    excerptStart: Number(row.excerptStart), excerptEnd: Number(row.excerptEnd), matchedPeople: [], matchedDates: [], matchedPlaces: [], score: 1,
  }
}

export async function searchAuthoritativeSources(actorId: string, projectId: string, filters: SourceSearchInput) {
  if (filters.mode === 'semantic') return searchSemanticSources(actorId, projectId, filters)
  const { data, error } = await getSupabaseAdmin().rpc('search_project_sources', {
    p_actor_id: actorId, p_project_id: projectId, p_query: filters.query,
    p_person: filters.person ?? '', p_year: filters.date ?? '', p_place: filters.place ?? '',
  })
  if (error) {
    const code = error.code
    const status = code === '42501' ? 403 : code === '22023' ? 400 : code === '54000' ? 422 : ['55P03', '57014'].includes(code) ? 503 : 500
    throw new SourceSearchError(status, status === 422 ? 'Archive exceeds the current search work limit' : 'Source search is unavailable')
  }
  if (!record(data) || !Array.isArray(data.entries) || data.entries.length > 50 || typeof data.hasMore !== 'boolean') {
    throw new SourceSearchError(500, 'Source search response could not be verified')
  }
  const citations = data.entries.map(row => parseSourceCitation(row, projectId))
  return {
    status: citations.length ? 'source_matches' as const : 'no_matching_sources' as const,
    query: filters.query, searchMode: 'literal' as const, semanticSearch: 'unavailable_unmeasured' as const,
    answerText: citations.length ? `Found ${citations.length} matching source excerpt(s)${data.hasMore ? '; more matches are available by narrowing the filters' : ''}.`
      : 'No matching family records were found in this project for your query.',
    citations, hasMore: data.hasMore,
  }
}

const citationFields = ['entryId', 'storyId', 'storyRevisionId', 'transcriptVersionId', 'segmentId', 'mediaAssetId',
  'sourceHash', 'sourceFingerprint', 'startMs', 'endMs'] as const
export interface SearchAudioCitation {
  entryId: string; storyId: string; storyRevisionId: string | null; transcriptVersionId: string
  segmentId: string; mediaAssetId: string; sourceHash: string; sourceFingerprint: string; startMs: number; endMs: number
}
export function parseSearchAudioCitation(value: unknown): SearchAudioCitation {
  if (!record(value) || Object.keys(value).length !== citationFields.length ||
    !['storyId', 'transcriptVersionId', 'segmentId', 'mediaAssetId'].every(k => typeof value[k] === 'string' && uuid.test(value[k] as string)) ||
    !(value.storyRevisionId === null || (typeof value.storyRevisionId === 'string' && uuid.test(value.storyRevisionId))) ||
    typeof value.entryId !== 'string' || !/^(segment|assertion):[a-f0-9-]{36}$/.test(value.entryId) ||
    typeof value.sourceHash !== 'string' || !hash.test(value.sourceHash) || typeof value.sourceFingerprint !== 'string' || !hash.test(value.sourceFingerprint) ||
    !Number.isSafeInteger(value.startMs) || !Number.isSafeInteger(value.endMs) || Number(value.startMs) < 0 || Number(value.endMs) <= Number(value.startMs)) {
    throw new SourceSearchError(400, 'Invalid source audio citation')
  }
  return value as unknown as SearchAudioCitation
}
export async function resolveSearchAudioCitation(actorId: string, projectId: string, citation: SearchAudioCitation): Promise<void> {
  const { data, error } = await getSupabaseAdmin().rpc('resolve_search_citation', {
    p_actor_id: actorId, p_project_id: projectId, p_citation: citation,
  })
  if (error) throw new SourceSearchError(error.code === '42501' ? 403 : error.code === '23505' ? 409 : 503, 'Current source audio is unavailable')
  if (!record(data) || data.projectId !== projectId || citationFields.some(key => data[key] !== citation[key])) {
    throw new SourceSearchError(409, 'Search source changed; search again before playback')
  }
}
