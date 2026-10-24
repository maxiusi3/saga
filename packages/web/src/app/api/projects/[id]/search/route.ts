import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { executeProvenanceSearch, type SearchIndexEntry } from '@/lib/server/provenance-search'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Provenance search is not enabled' }, { status: 503 })
  }

  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { id: projectId } = await params
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const person = url.searchParams.get('person') ?? undefined
  const date = url.searchParams.get('date') ?? undefined
  const place = url.searchParams.get('place') ?? undefined

  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Provenance search service is not configured' }, { status: 503 })
  }

  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id, facilitator_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
  }

  let isActiveMember =
    project.owner_id === auth.user.id || project.facilitator_id === auth.user.id

  if (!isActiveMember) {
    const { data: roleRow } = await admin
      .from('project_roles')
      .select('status')
      .eq('project_id', projectId)
      .eq('user_id', auth.user.id)
      .maybeSingle()
    isActiveMember = roleRow?.status === 'active'
  }

  if (!isActiveMember) {
    return NextResponse.json({ error: 'Project access denied' }, { status: 403 })
  }

  const { data: rows, error: rowsError } = await admin
    .from('search_index_entries')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active_index', true)

  if (rowsError) {
    return NextResponse.json({ error: 'Failed to load search index' }, { status: 500 })
  }

  const { data: tombstones } = await admin
    .from('deletion_requests')
    .select('subject_id, tombstone_at')
    .eq('project_id', projectId)
    .not('tombstone_at', 'is', null)

  const tombstonedIds = new Set<string>(
    (tombstones || []).map((t: { subject_id: string }) => t.subject_id),
  )

  const entries: SearchIndexEntry[] = (rows || []).map((r: any) => ({
    id: r.id,
    projectId: r.project_id,
    storyId: r.story_id,
    storyTitle: r.story_title || 'Story',
    transcriptVersionId: r.transcript_version_id,
    storyRevisionId: r.story_revision_id,
    mediaAssetId: r.media_asset_id,
    segmentId: r.segment_id,
    indexVersion: r.index_version,
    isActiveIndex: r.is_active_index,
    entityPeople: r.entity_people || [],
    entityDates: r.entity_dates || [],
    entityPlaces: r.entity_places || [],
    searchableText: r.searchable_text,
    startMs: r.start_ms,
    endMs: r.end_ms,
    createdAt: r.created_at,
  }))

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

  return NextResponse.json(result, { status: 200, headers: auth.headers })
}
