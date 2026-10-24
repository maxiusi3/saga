import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { prepareDeletionTombstone } from '@/lib/server/deletion-service'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status })
  headers.forEach((value, key) => response.headers.set(key, value))
  response.headers.set('Cache-Control', 'no-store')
  return response
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return reply({ error: 'Media asset deletion is not enabled' }, 404, auth.headers)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reply({ error: 'Invalid request' }, 400, auth.headers)
  }
  if (!isRecord(body)) return reply({ error: 'Invalid request' }, 400, auth.headers)

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  const assetId = typeof body.assetId === 'string' ? body.assetId.trim() : ''
  const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : ''
  if (!projectId || (!assetId && !storyId)) {
    return reply({ error: 'projectId and either assetId or storyId are required' }, 400, auth.headers)
  }

  const access = await requireProjectAccess(projectId, auth.user)
  if (!access.ok) {
    const errBody = await access.response.json()
    return reply(errBody, access.response.status, auth.headers)
  }

  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch {
    return reply({ error: 'Database service not configured' }, 503, auth.headers)
  }

  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, facilitator_id')
    .eq('id', projectId)
    .maybeSingle()
  if (projectError || !project) return reply({ error: 'Project not found' }, 404, auth.headers)

  const isProjectOwner = project.facilitator_id === auth.user.id
  let actorRole: 'facilitator' | 'storyteller' | 'member' = isProjectOwner ? 'facilitator' : 'member'
  if (!isProjectOwner) {
    const { data: roleRow } = await admin
      .from('project_roles')
      .select('role, status')
      .eq('project_id', projectId)
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (roleRow?.role === 'facilitator') actorRole = 'facilitator'
    else if (roleRow?.role === 'storyteller') actorRole = 'storyteller'
  }

  const assetQuery = admin
    .from('media_assets')
    .select('id, project_id, story_id, bucket, object_key, state')
    .eq('project_id', projectId)
  if (assetId) assetQuery.eq('id', assetId)
  else assetQuery.eq('story_id', storyId)

  const { data: assets, error: assetsError } = await assetQuery
  if (assetsError) return reply({ error: 'Failed to load target assets' }, 500, auth.headers)
  if (!assets || assets.length === 0) return reply({ error: 'Target assets not found' }, 404, auth.headers)

  const now = new Date().toISOString()
  let prepared
  try {
    prepared = prepareDeletionTombstone({
      projectId,
      subjectId: assetId || storyId,
      actorId: auth.user.id,
      actorRole,
      actorActive: true,
      isProjectOwner,
      now,
      assets,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Deletion not permitted'
    const status = message.includes('not permitted') ? 403 : 409
    return reply({ error: message }, status, auth.headers)
  }

  const { data: savedRequest, error: insertError } = await admin
    .from('deletion_requests')
    .insert({
      id: prepared.request.id,
      project_id: projectId,
      subject_id: prepared.request.subjectId,
      requested_by: auth.user.id,
      state: prepared.request.state,
      tombstone_at: prepared.request.tombstoneAt,
      attempt: prepared.request.attempt,
      requested_at: prepared.request.requestedAt,
    })
    .select('*')
    .single()
  if (insertError || !savedRequest) {
    return reply({ error: 'Failed to persist deletion tombstone' }, 500, auth.headers)
  }

  await admin
    .from('media_assets')
    .update({ state: 'deleting', updated_at: now })
    .in('id', prepared.transitionedAssets.map(a => a.id))
    .eq('project_id', projectId)

  await admin
    .from('processing_jobs')
    .update({ state: 'cancelled', cancel_requested_at: now, lease_owner: null, lease_expires_at: null, updated_at: now })
    .in('asset_id', prepared.transitionedAssets.map(a => a.id))
    .in('state', ['queued', 'leased', 'running', 'retry_wait', 'outcome_unknown', 'awaiting_review'])

  return reply({ deletionRequest: prepared.request }, 202, auth.headers)
}
