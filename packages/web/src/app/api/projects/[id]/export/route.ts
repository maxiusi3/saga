import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { randomUUID } from 'crypto'
import { assembleCompleteArchivalPackage, type ArchivalStoryInput } from '@/lib/server/archival-export-service'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { planLegacyStoryMedia } from '@/lib/legacy-story-media'
import { MediaExportIntegrityError, type ExportableMediaAsset } from '@/lib/server/media-export'
import { beginArchiveAssemblyAttempt, finishArchiveAssemblyAttempt, type ArchiveAssemblyOutcome } from '@/lib/server/archive-observations'

export const runtime = 'nodejs'

// This route buffers a ZIP in memory. Larger packages require an asynchronous
// Worker (not implemented); never fall back to a partial synchronous archive.
const MAX_STORIES = 200
const MAX_ASSETS = 100
const MAX_TRANSCRIPT_VERSIONS = 1000
const MAX_MEDIA_BYTES = 25 * 1024 * 1024
const MAX_METADATA_BYTES = 2 * 1024 * 1024

type ArchiveStoryRow = Record<string, unknown> & ArchivalStoryInput & { tombstone_at?: string | null }
interface ArchiveAssetRow extends ExportableMediaAsset { project_id: string; tombstone_at?: string | null }
interface TombstoneRow { subject_id: string }
interface TranscriptSourceRow { id: string; project_id: string; story_id: string; asset_id: string | null }

function reply(body: unknown, status: number, headers: Headers) {
  const response = NextResponse.json(body, { status, headers })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'no-store')
    return auth.response
  }
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return reply({ error: 'Archival export is not enabled' }, 503, auth.headers)
  }

  const { id: projectId } = await params
  const access = await requireProjectAccess(projectId, auth.user)
  if (!access.ok) return reply(await access.response.json(), access.response.status, auth.headers)
  let admin: ReturnType<typeof getSupabaseAdmin>
  try { admin = getSupabaseAdmin() } catch {
    return reply({ error: 'Archival export is not configured' }, 503, auth.headers)
  }

  try {
    const { data: project, error: projectError } = await admin.from('projects')
      .select('id, name, description, facilitator_id').eq('id', projectId).maybeSingle()
    if (projectError) return reply({ error: 'Failed to load project' }, 500, auth.headers)
    if (!project) return reply({ error: 'Project not found' }, 404, auth.headers)

    const storyResult = await admin.from('stories').select('*', { count: 'exact' })
      .eq('project_id', projectId).order('created_at', { ascending: true }).limit(MAX_STORIES + 1)
    const assetResult = await admin.from('media_assets').select('*', { count: 'exact' })
      .eq('project_id', projectId).order('created_at', { ascending: true }).limit(MAX_ASSETS + 1)
    const deletionResult = await admin.from('deletion_requests')
      .select('subject_id, tombstone_at', { count: 'exact' }).eq('project_id', projectId).not('tombstone_at', 'is', null)
    if (storyResult.error || assetResult.error || deletionResult.error ||
        !Array.isArray(storyResult.data) || !Array.isArray(assetResult.data) || !Array.isArray(deletionResult.data) ||
        deletionResult.count == null || deletionResult.count !== deletionResult.data.length) {
      return reply({ error: 'Failed to load complete archive and deletion evidence' }, 500, auth.headers)
    }
    if ((storyResult.count ?? storyResult.data.length) > MAX_STORIES || storyResult.data.length > MAX_STORIES ||
        (assetResult.count ?? assetResult.data.length) > MAX_ASSETS || assetResult.data.length > MAX_ASSETS ||
        Buffer.byteLength(JSON.stringify([project, storyResult.data, assetResult.data])) > MAX_METADATA_BYTES) {
      return reply({ error: 'Archive exceeds synchronous limits; larger exports are not available yet' }, 413, auth.headers)
    }
    if (storyResult.count == null || storyResult.count !== storyResult.data.length ||
        assetResult.count == null || assetResult.count !== assetResult.data.length) {
      return reply({ error: 'Failed to load the complete archive' }, 500, auth.headers)
    }

    const storyRows = storyResult.data as ArchiveStoryRow[]
    const assetRows = assetResult.data as ArchiveAssetRow[]
    const tombstones = new Set<string>((deletionResult.data as TombstoneRow[]).map(row => row.subject_id))
    for (const story of storyRows) if (story.tombstone_at != null) tombstones.add(story.id)
    const stories = storyRows.filter(story => !tombstones.has(story.id))
    const removed = (asset: ArchiveAssetRow) => asset.tombstone_at != null || ['deleted', 'deleting'].includes(asset.state) ||
      tombstones.has(asset.id) || (!!asset.story_id && tombstones.has(asset.story_id))
    const assets = assetRows.filter(asset => !removed(asset))
    if (assets.some(asset => asset.state !== 'ready' || typeof asset.byte_size !== 'number' || !Number.isSafeInteger(asset.byte_size) || asset.byte_size < 0 ||
        typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(asset.sha256))) {
      return reply({ error: 'Media assets are incomplete and cannot be exported' }, 409, auth.headers)
    }
    if (assets.reduce((total, asset) => total + (asset.byte_size ?? 0), 0) > MAX_MEDIA_BYTES) {
      return reply({ error: 'Archive exceeds synchronous limits; larger exports are not available yet' }, 413, auth.headers)
    }

    const storyIds = stories.map(story => story.id)
    const sources = storyIds.length ? await admin.from('transcript_versions')
      .select('id, project_id, story_id, asset_id', { count: 'exact' }).eq('project_id', projectId)
      .in('story_id', storyIds).limit(MAX_TRANSCRIPT_VERSIONS + 1)
      : { data: [], error: null, count: 0 }
    if (sources.error || !Array.isArray(sources.data) || sources.count == null || sources.count !== sources.data.length) {
      return reply({ error: 'Failed to verify complete transcript lineage' }, 500, auth.headers)
    }
    if (sources.count > MAX_TRANSCRIPT_VERSIONS || Buffer.byteLength(JSON.stringify(sources.data)) > MAX_METADATA_BYTES) {
      return reply({ error: 'Archive lineage exceeds synchronous limits' }, 413, auth.headers)
    }
    // stories.transcript/summary do not identify which revision supplied their
    // text. Fail closed if any established audio source is removed/unresolved;
    // deleting an unrelated photo must not remove independently sourced text.
    const unsafeLineage = (sources.data as TranscriptSourceRow[]).some(source => {
      const original = assetRows.find(asset => asset.id === source.asset_id)
      return source.project_id !== projectId || !storyIds.includes(source.story_id) ||
        !original || original.project_id !== projectId || original.kind !== 'original_audio' ||
        (!!original.story_id && original.story_id !== source.story_id) || removed(original)
    })
    const removedLegacyAudio = assetRows.some(asset => asset.kind === 'original_audio' &&
      !!asset.story_id && storyIds.includes(asset.story_id) && removed(asset))
    if (unsafeLineage || removedLegacyAudio) {
      return reply({ error: 'Story sources were removed or could not be verified; export is blocked' }, 409, auth.headers)
    }

    let verifiedStorageHost: string | undefined
    try { verifiedStorageHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host } catch { /* Exact local keys can still be matched. */ }
    for (const story of stories) {
      const plan = planLegacyStoryMedia(story, {
        verifiedStorageHost,
        verifiedBucketsByField: { audio_url: 'audio-recordings', mastered_audio_url: 'audio-recordings', photo_url: 'saga', photo_urls: 'saga', images: 'saga' },
      })
      for (const reference of plan.references) {
        if (reference.rawValue == null || reference.rawValue === '') continue
        const matches = reference.locator.status === 'mapped' ? assetRows.filter(asset =>
          asset.story_id === story.id && asset.bucket === reference.locator.bucket &&
          asset.object_key === reference.locator.objectKey && asset.kind === reference.kind,
        ) : []
        // A basename, unrelated story asset, or signed URL on another host is
        // not proof of representation. Deleted references are intentionally omitted.
        if (matches.length !== 1 || (!removed(matches[0]) && !assets.includes(matches[0]))) {
          return reply({ error: 'Legacy media must be reconciled before a complete export' }, 409, auth.headers)
        }
      }
    }

    if (request.signal.aborted) return reply({ error: 'Export cancelled' }, 409, auth.headers)
    const attemptId = randomUUID()
    if (!await beginArchiveAssemblyAttempt(attemptId, request.signal)) {
      return reply({ error: 'Export observation is unavailable' }, 503, auth.headers)
    }
    const zip = new JSZip()
    let downloadedBytes = 0
    let exceededLimit = false
    let zipBuffer: Buffer | undefined
    let outcome: ArchiveAssemblyOutcome = 'failed'
    let failureStatus = 409
    try {
      await assembleCompleteArchivalPackage(zip, {
        projectId, projectName: project.name, projectDescription: project.description,
        createdBy: auth.user.id, exportedAt: new Date().toISOString(), assets,
        // Never append the raw legacy row, signed locators, or member details.
        stories: stories.map(story => ({ id: story.id, title: story.title, transcript: story.transcript,
          summary: story.summary, created_at: story.created_at })),
        readObject: async asset => {
          const { data: stream, error } = await admin.storage.from(asset.bucket).download(asset.object_key).asStream()
          if (error || !stream) throw new Error('Archive source unavailable')
          const reader = stream.getReader()
          const cancelRead = () => { void reader.cancel().catch(() => {}) }
          request.signal.addEventListener('abort', cancelRead, { once: true })
          if (request.signal.aborted) cancelRead()
          const chunks: Buffer[] = []
          let objectBytes = 0
          try {
            while (true) {
              if (request.signal.aborted) throw new Error('Export cancelled')
              const { done, value } = await reader.read()
              if (request.signal.aborted) throw new Error('Export cancelled')
              if (done) break
              downloadedBytes += value.byteLength
              objectBytes += value.byteLength
              if (downloadedBytes > MAX_MEDIA_BYTES) {
                exceededLimit = true
                throw new Error('Archive byte limit exceeded')
              }
              if (objectBytes > (asset.byte_size ?? 0)) throw new MediaExportIntegrityError()
              chunks.push(Buffer.from(value))
            }
          } finally {
            request.signal.removeEventListener('abort', cancelRead)
            await reader.cancel().catch(() => {})
            reader.releaseLock()
          }
          return Buffer.concat(chunks)
        },
      })
      failureStatus = 500
      zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      if (request.signal.aborted) throw new Error('Export cancelled')
      outcome = 'verified'
    } catch (error) {
      outcome = error instanceof MediaExportIntegrityError ? 'integrity_failed'
        : exceededLimit ? 'limit_exceeded' : request.signal.aborted ? 'cancelled' : 'failed'
      if (outcome === 'limit_exceeded') failureStatus = 413
      if (outcome === 'cancelled') failureStatus = 409
    }

    // Persist assembly, not delivery. This await must precede the final privacy checks.
    if (!await finishArchiveAssemblyAttempt(attemptId, outcome)) {
      return reply({ error: 'Export observation is unavailable' }, 503, auth.headers)
    }
    if (!zipBuffer || outcome !== 'verified') {
      const error = failureStatus === 413 ? 'Archive exceeds synchronous limits'
        : failureStatus === 500 ? 'Archival export is unavailable' : 'Media assets are incomplete and cannot be exported'
      return reply({ error }, failureStatus, auth.headers)
    }
    if (request.signal.aborted) return reply({ error: 'Export cancelled' }, 409, auth.headers)
    const latestAccess = await requireProjectAccess(projectId, auth.user)
    if (!latestAccess.ok) return reply(await latestAccess.response.json(), latestAccess.response.status, auth.headers)

    // Recheck after all streaming and asynchronous compression. No more awaited
    // work may follow this deletion check before releasing the archive bytes.
    const subjects = [...stories.map(story => story.id), ...assets.map(asset => asset.id)]
    if (subjects.length) {
      const latest = await admin.from('deletion_requests').select('subject_id, tombstone_at')
        .eq('project_id', projectId).in('subject_id', subjects).not('tombstone_at', 'is', null)
      if (latest.error || !Array.isArray(latest.data)) return reply({ error: 'Failed to verify deletion status' }, 500, auth.headers)
      if ((latest.data as TombstoneRow[]).some(row => subjects.includes(row.subject_id))) return reply({ error: 'Archive changed during export; please retry' }, 409, auth.headers)
    }
    if (request.signal.aborted) return reply({ error: 'Export cancelled' }, 409, auth.headers)
    const filename = `${String(project.name).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80)}_export_${new Date().toISOString().slice(0, 10)}.zip`
    const headers = new Headers(auth.headers)
    headers.set('Cache-Control', 'no-store')
    headers.set('Content-Type', 'application/zip')
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    headers.set('Content-Length', String(zipBuffer.length))
    return new NextResponse(new Uint8Array(zipBuffer), { status: 200, headers })
  } catch {
    return reply({ error: 'Archival export is unavailable' }, 500, auth.headers)
  }
}
