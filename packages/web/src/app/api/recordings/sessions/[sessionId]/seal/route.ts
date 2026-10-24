import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { prepareRecordingSessionSeal } from '@/lib/server/recording-session-service'
import type { RecordingMergeChunk } from '@/lib/server/recording-merge'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return reply({ error: 'Recording session seal is not enabled' }, 404, auth.headers)
  }

  const { sessionId } = await params
  if (!sessionId || !/^[A-Za-z0-9_-]{3,128}$/.test(sessionId)) {
    return reply({ error: 'Invalid session id' }, 400, auth.headers)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reply({ error: 'Invalid request' }, 400, auth.headers)
  }
  if (!isRecord(body)) return reply({ error: 'Invalid request' }, 400, auth.headers)

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : null
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : ''
  const chunks = Array.isArray(body.chunks) ? (body.chunks as RecordingMergeChunk[]) : []
  if (!projectId || !mimeType || chunks.length === 0) {
    return reply({ error: 'projectId, mimeType, and non-empty chunks are required' }, 400, auth.headers)
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

  // Check if story or session is blocked by a deletion tombstone
  if (storyId) {
    const { data: tombstone } = await admin
      .from('deletion_requests')
      .select('id, tombstone_at')
      .eq('project_id', projectId)
      .eq('subject_id', storyId)
      .not('tombstone_at', 'is', null)
      .maybeSingle()
    if (tombstone?.tombstone_at) {
      return reply({ error: 'Target story has an active deletion tombstone' }, 409, auth.headers)
    }
  }

  let sealed
  try {
    sealed = prepareRecordingSessionSeal({
      projectId,
      sessionId,
      storyId,
      actorId: auth.user.id,
      actorRole: 'storyteller',
      actorActive: true,
      mimeType,
      chunks,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid recording session manifest'
    const status = message.includes('recording_quota_exceeded') ? 413 : 400
    return reply({ error: message }, status, auth.headers)
  }

  // Idempotency check: if this exact manifest was already sealed for this project, reuse it
  const { data: existingAsset } = await admin
    .from('media_assets')
    .select('*')
    .eq('project_id', projectId)
    .eq('idempotency_key', sealed.task.idempotencyKey)
    .maybeSingle()

  if (existingAsset) {
    const { data: existingJob } = await admin
      .from('processing_jobs')
      .select('*')
      .eq('idempotency_key', sealed.task.idempotencyKey)
      .maybeSingle()
    return reply(
      {
        asset: existingAsset,
        job: existingJob,
        idempotentReplay: true,
        canClearLocalDrafts: existingAsset.state === 'ready',
      },
      existingAsset.state === 'ready' ? 200 : 202,
      auth.headers,
    )
  }

  const { data: savedAsset, error: assetErr } = await admin
    .from('media_assets')
    .insert(sealed.assetRecord)
    .select('*')
    .single()
  if (assetErr || !savedAsset) {
    return reply({ error: 'Failed to register recording asset' }, 500, auth.headers)
  }

  const { data: savedJob, error: jobErr } = await admin
    .from('processing_jobs')
    .insert({
      id: sealed.jobSnapshot.id,
      project_id: projectId,
      asset_id: savedAsset.id,
      input_version: sealed.jobSnapshot.inputVersion,
      job_type: sealed.jobSnapshot.jobType,
      processor_version: sealed.jobSnapshot.processorVersion,
      model_config_version: sealed.jobSnapshot.modelConfigVersion,
      parameter_version: sealed.jobSnapshot.parameterVersion,
      idempotency_key: sealed.task.idempotencyKey,
      state: sealed.jobSnapshot.state,
      attempt_count: 0,
      max_attempts: sealed.jobSnapshot.maxAttempts,
      created_by: auth.user.id,
    })
    .select('*')
    .single()
  if (jobErr || !savedJob) {
    return reply({ error: 'Failed to enqueue recording merge job' }, 500, auth.headers)
  }

  return reply(
    {
      asset: savedAsset,
      job: savedJob,
      idempotentReplay: false,
      canClearLocalDrafts: false,
    },
    202,
    auth.headers,
  )
}
