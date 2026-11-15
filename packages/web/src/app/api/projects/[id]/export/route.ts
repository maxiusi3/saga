import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { randomUUID } from 'crypto'
import { assembleCompleteArchivalPackage, UnsupportedArchiveTextError } from '@/lib/server/archival-export-service'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ArchiveSourceError, loadArchiveSource, durableArchiveLimits } from '@/lib/server/publication-source-service'
import { MediaExportIntegrityError } from '@/lib/server/media-export'
import { preparePublication, publicationOperation, publicationStatus } from '@/lib/server/publication-delivery-service'
import { requireArchiveSpool } from '@/lib/server/publication-delivery-worker'
import { beginArchiveAssemblyAttempt, finishArchiveAssemblyAttempt, type ArchiveAssemblyOutcome } from '@/lib/server/archive-observations'

export const runtime = 'nodejs'

const MAX_MEDIA_BYTES = 25 * 1024 * 1024
interface TombstoneRow { subject_id: string }

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
    let durable=request.nextUrl.searchParams.get('durable')==='true'
    if(request.headers.get('Content-Type')?.includes('application/json')) {
      const body=await request.text()
      if(body.length>1024) return reply({error:'Export request too large'},400,auth.headers)
      try { durable=JSON.parse(body).durable===true || durable } catch { return reply({error:'Invalid export request'},400,auth.headers) }
    }
    let loaded
    try { loaded=await loadArchiveSource(admin,projectId,durable?durableArchiveLimits:undefined) }
    catch(error) { if(!(error instanceof ArchiveSourceError) || error.status!==413 || durable) throw error; durable=true;loaded=await loadArchiveSource(admin,projectId,durableArchiveLimits) }
    if(durable) requireArchiveSpool()
    const job=await preparePublication(admin,auth.user.id,loaded)
    if(durable) return reply(publicationStatus(job),202,auth.headers)
    const {project,stories,assets,subjects}=loaded
    if (request.signal.aborted) return reply({ error: 'Export cancelled' }, 409, auth.headers)
    const attemptId = randomUUID()
    if (!await beginArchiveAssemblyAttempt(attemptId, request.signal)) {
      return reply({ error: 'Export observation is unavailable' }, 503, auth.headers)
    }
    const zip = new JSZip()
    let downloadedBytes = 0
    let exceededLimit = false
    let zipBuffer: Buffer | undefined
    let publication: Awaited<ReturnType<typeof assembleCompleteArchivalPackage>> | undefined
    let outcome: ArchiveAssemblyOutcome = 'failed'
    let failureStatus = 409
    try {
      publication = await assembleCompleteArchivalPackage(zip, {
        projectId, projectName: project.name, projectDescription: project.description,
        createdBy: job.actor_id, snapshotId:job.id,snapshotVersion:job.snapshot_version,exportedAt:job.created_at,assets,
        // Never append the raw legacy row, signed locators, or member details.
        stories,
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
      if (error instanceof UnsupportedArchiveTextError) failureStatus=422
      if (outcome === 'limit_exceeded') failureStatus = 413
      if (outcome === 'cancelled') failureStatus = 409
    }

    // Persist assembly, not delivery. This await must precede the final privacy checks.
    if (!await finishArchiveAssemblyAttempt(attemptId, outcome)) {
      return reply({ error: 'Export observation is unavailable' }, 503, auth.headers)
    }
    if (!zipBuffer || outcome !== 'verified') {
      const error = failureStatus === 422 ? 'PDF contains unsupported characters; no partial archive was released' : failureStatus === 413 ? 'Archive exceeds synchronous limits'
        : failureStatus === 500 ? 'Archival export is unavailable' : 'Media assets are incomplete and cannot be exported'
      return reply({ error }, failureStatus, auth.headers)
    }
    if (request.signal.aborted) return reply({ error: 'Export cancelled' }, 409, auth.headers)
    if(!publication) return reply({error:'Publication assembly unavailable'},500,auth.headers)
    await publicationOperation(admin,auth.user.id,projectId,'sync_finish',job.id,{snapshot:publication.snapshot,manifest:publication.manifest,stories})
    const latestAccess = await requireProjectAccess(projectId, auth.user)
    if (!latestAccess.ok) return reply(await latestAccess.response.json(), latestAccess.response.status, auth.headers)

    // Recheck after all streaming and asynchronous compression. No more awaited
    // work may follow this deletion check before releasing the archive bytes.
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
  } catch (error) {
    if(error instanceof ArchiveSourceError) return reply({error:error.message},error.status,auth.headers)
    return reply({ error: 'Archival export is unavailable' }, 500, auth.headers)
  }
}
