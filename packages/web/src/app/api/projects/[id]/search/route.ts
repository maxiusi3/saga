import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { executeProvenanceSearch, type SearchIndexEntry } from '@/lib/server/provenance-search'

interface SearchIndexRow {
  id: string
  project_id: string
  story_id: string
  transcript_version_id: string
  story_revision_id: string | null
  segment_id: string
  index_version: number
  is_active_index: boolean
  entity_people: string[]
  entity_dates: string[]
  entity_places: string[]
  searchable_text: string
  start_ms: number
  end_ms: number
  created_at: string
}
interface TranscriptSourceRow { id: string; project_id: string; story_id: string; asset_id: string | null }
interface StorySourceRow { id: string; project_id: string; title: string | null }
interface MediaSourceRow { id: string; project_id: string; story_id: string | null; state: string; tombstone_at?: string | null }

function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status, headers })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return reply({ error: 'Provenance search is not enabled' }, 503, auth.headers)
  }

  const { id: projectId } = await params
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const person = url.searchParams.get('person') ?? undefined
  const date = url.searchParams.get('date') ?? undefined
  const place = url.searchParams.get('place') ?? undefined

  const access = await requireProjectAccess(projectId, auth.user)
  if (!access.ok) return reply(await access.response.json(), access.response.status, auth.headers)

  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch {
    return reply({ error: 'Provenance search service is not configured' }, 503, auth.headers)
  }

  try {
    const { data: rows, error: rowsError } = await admin
      .from('search_index_entries')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active_index', true)

    if (rowsError) {
      return reply({ error: 'Failed to load search index' }, 500, auth.headers)
    }

    const indexRows = (rows || []) as SearchIndexRow[]
    const transcriptIds = [...new Set(indexRows.map(row => row.transcript_version_id))]
    const storyIds = [...new Set(indexRows.map(row => row.story_id))]
    const empty = { data: [], error: null, count: 0 }
    const versionResult = transcriptIds.length ? await admin.from('transcript_versions')
      .select('id, project_id, story_id, asset_id', { count: 'exact' })
      .eq('project_id', projectId).in('id', transcriptIds) : empty
    const storyResult = storyIds.length ? await admin.from('stories')
      .select('id, project_id, title', { count: 'exact' })
      .eq('project_id', projectId).in('id', storyIds) : empty
    if (versionResult.error || storyResult.error || !Array.isArray(versionResult.data) || !Array.isArray(storyResult.data) ||
        versionResult.count == null || versionResult.count !== versionResult.data.length ||
        storyResult.count == null || storyResult.count !== storyResult.data.length) {
      return reply({ error: 'Failed to verify search sources' }, 500, auth.headers)
    }

    const versions = versionResult.data as TranscriptSourceRow[]
    const stories = storyResult.data as StorySourceRow[]
    // P3 search rows reference a transcript; only P2 transcript_versions carries
    // asset_id. Never infer a source from an index extension or an unrelated asset.
    const assetIds = [...new Set(versions.filter(version => version.project_id === projectId)
      .map(version => version.asset_id).filter((id): id is string => typeof id === 'string' && id.length > 0))]
    const assetResult = assetIds.length ? await admin.from('media_assets')
      .select('*', { count: 'exact' }).eq('project_id', projectId).in('id', assetIds) : empty
    if (assetResult.error || !Array.isArray(assetResult.data) ||
        assetResult.count == null || assetResult.count !== assetResult.data.length) {
      return reply({ error: 'Failed to verify media status' }, 500, auth.headers)
    }

    const subjects = [...new Set([...storyIds, ...assetIds])]
    const { data: tombstones, error: tombstoneError, count: tombstoneCount } = subjects.length ? await admin
      .from('deletion_requests')
      .select('subject_id, tombstone_at', { count: 'exact' })
      .eq('project_id', projectId)
      .in('subject_id', subjects)
      .not('tombstone_at', 'is', null)
      : empty
    if (tombstoneError || !Array.isArray(tombstones) || tombstoneCount == null || tombstoneCount !== tombstones.length) {
      return reply({ error: 'Failed to verify deletion status' }, 500, auth.headers)
    }
    const tombstonedIds = new Set<string>((tombstones as Array<{ subject_id: string }>).map(row => row.subject_id))
    const versionsById = new Map(versions.map(version => [version.id, version]))
    const storiesById = new Map(stories.map(story => [story.id, story]))
    const assetsById = new Map((assetResult.data as MediaSourceRow[]).map(asset => [asset.id, asset]))
    const entries: SearchIndexEntry[] = []
    for (const row of indexRows) {
      const version = versionsById.get(row.transcript_version_id)
      const story = storiesById.get(row.story_id)
      const asset = version?.asset_id ? assetsById.get(version.asset_id) : undefined
      if (row.project_id !== projectId || !version || version.project_id !== projectId || version.story_id !== row.story_id ||
          !story || story.project_id !== projectId || !asset || asset.project_id !== projectId || asset.story_id !== row.story_id ||
          asset.state !== 'ready' || asset.tombstone_at != null || tombstonedIds.has(row.story_id) || tombstonedIds.has(asset.id)) {
        continue
      }
      entries.push({
        id: row.id,
        projectId: row.project_id,
        storyId: row.story_id,
        storyTitle: story.title || 'Story',
        transcriptVersionId: row.transcript_version_id,
        storyRevisionId: row.story_revision_id,
        mediaAssetId: asset.id,
        segmentId: row.segment_id,
        indexVersion: row.index_version,
        isActiveIndex: row.is_active_index,
        entityPeople: row.entity_people || [],
        entityDates: row.entity_dates || [],
        entityPlaces: row.entity_places || [],
        searchableText: row.searchable_text,
        startMs: row.start_ms,
        endMs: row.end_ms,
        createdAt: row.created_at,
      })
    }

    const result = executeProvenanceSearch({
      actorId: auth.user.id,
      projectId,
      isActiveMember: true,
      query: q,
      personFilter: person,
      dateFilter: date,
      placeFilter: place,
      entries,
      tombstonedSubjectIds: tombstonedIds,
    })

    return reply(result, 200, auth.headers)
  } catch {
    return reply({ error: 'Provenance search is unavailable' }, 500, auth.headers)
  }
}
