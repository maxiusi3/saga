import JSZip from 'jszip'
import { useAuthStore } from '@/stores/auth-store'
import { createClientSupabase } from '@/lib/supabase'
import { isUuid } from '@/lib/invitation-acceptance-protocol'
import type { BrowserUploadOutcome } from '@/lib/server/upload-observations'
import type { ProvenanceSearchCitation } from '@/lib/server/provenance-search'

export interface ArchiveSearchFilters {
  query: string
  person?: string
  date?: string
  place?: string
}

export interface ArchiveSearchResult {
  status: 'grounded_answer' | 'no_matching_sources'
  answerText: string
  citations: ProvenanceSearchCitation[]
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await useAuthStore.getState().getAccessToken()
  init.signal?.throwIfAborted()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, {
    ...init, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
  })
  if (!response.ok) throw new Error('Archive request failed')
  return response
}

async function json(response: Response): Promise<unknown> {
  try { return await response.json() } catch { throw new Error('Invalid archive response') }
}

function citation(value: unknown): value is ProvenanceSearchCitation {
  if (!record(value)) return false
  return ['entryId', 'storyId', 'storyTitle', 'transcriptVersionId', 'segmentId', 'quotedText']
    .every(key => typeof value[key] === 'string') &&
    Number.isSafeInteger(value.startMs) && Number.isSafeInteger(value.endMs) &&
    Number(value.startMs) >= 0 && Number(value.endMs) > Number(value.startMs) &&
    (value.mediaAssetId == null || typeof value.mediaAssetId === 'string')
}

export async function searchProjectArchive(
  projectId: string, filters: ArchiveSearchFilters, signal?: AbortSignal,
): Promise<ArchiveSearchResult> {
  const query = new URLSearchParams({ q: filters.query })
  for (const key of ['person', 'date', 'place'] as const) {
    if (filters[key]) query.set(key, filters[key])
  }
  const body = await json(await request(`/api/projects/${encodeURIComponent(projectId)}/search?${query}`, { signal }))
  if (!record(body) || !['grounded_answer', 'no_matching_sources'].includes(String(body.status)) ||
    typeof body.answerText !== 'string' || !Array.isArray(body.citations) || !body.citations.every(citation) ||
    (body.status === 'no_matching_sources' && body.citations.length !== 0)) {
    throw new Error('Invalid archive response')
  }
  return { status: body.status as ArchiveSearchResult['status'], answerText: body.answerText, citations: body.citations }
}

export async function getCitationAudioUrl(assetId: string, signal?: AbortSignal): Promise<string> {
  const body = await json(await request(`/api/media/assets/${encodeURIComponent(assetId)}/access`, { signal }))
  try {
    if (!record(body) || typeof body.signedUrl !== 'string') throw new Error()
    const url = new URL(body.signedUrl)
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) throw new Error()
    return url.href
  } catch { throw new Error('Invalid audio response') }
}

export async function downloadProjectArchive(projectId: string, signal?: AbortSignal): Promise<Blob> {
  const response = await request(`/api/projects/${encodeURIComponent(projectId)}/export`, { method: 'POST', signal })
  if (response.headers.get('content-type')?.split(';')[0] !== 'application/zip') throw new Error('Invalid archive download')
  const blob = await response.blob()
  if (blob.size < 4 || blob.size > 32 * 1024 * 1024) throw new Error('Invalid archive download')
  try {
    // Check the container without expanding every entry in browser memory.
    // Original-byte integrity is verified by the server before assembly.
    await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: false })
  } catch { throw new Error('Invalid archive download') }
  signal?.throwIfAborted()
  return blob
}

function uploadAsset(body: unknown, projectId: string) {
  if (!record(body) || !record(body.asset)) throw new Error('Invalid upload response')
  const asset = body.asset
  if (typeof asset.id !== 'string' || !/^[A-Za-z0-9_-]{3,128}$/.test(asset.id) ||
      asset.project_id !== projectId || asset.bucket !== 'audio-recordings' ||
      typeof asset.object_key !== 'string' || asset.tombstone_at != null ||
      typeof asset.state !== 'string') throw new Error('Invalid upload response')
  return { id: asset.id, state: asset.state, bucket: asset.bucket, objectKey: asset.object_key }
}

function isExistingObjectError(error: unknown): boolean {
  if (!record(error)) return false
  const status = String(error.status ?? error.statusCode)
  if (status === '409') return true
  // Storage still supports the old 400 duplicate-object response. Other 400s
  // (invalid key/token, for example) must not be mistaken for a completed PUT.
  return status === '400' && (error.statusCode === 'Duplicate' ||
    (typeof error.message === 'string' && /^(?:asset already exists|the resource already exists|duplicate)$/i.test(error.message)))
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}

/** Bound auth, fetch and body together, even when one ignores AbortSignal. Never replay unknown reports. */
async function uploadObservation(assetId: string, body: unknown, caller?: AbortSignal): Promise<unknown> {
  caller?.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true })
  let onAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('Upload observation failed'))
    controller.signal.addEventListener('abort', onAbort, { once: true })
  })
  const timer = setTimeout(abort, 20_000)
  try {
    return await Promise.race([
      request(`/api/media/assets/${encodeURIComponent(assetId)}/upload-attempts`, {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(response => {
        if (response.status !== 200) throw new Error('Upload observation failed')
        return json(response)
      }),
      interrupted,
    ])
  } catch {
    caller?.throwIfAborted()
    throw new Error('Upload observation failed')
  } finally {
    clearTimeout(timer)
    caller?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', onAbort)
    controller.abort()
  }
}

async function beginUploadObservation(assetId: string, signal?: AbortSignal) {
  const data = await uploadObservation(assetId, { action: 'begin' }, signal)
  if (!exactKeys(data, ['schemaVersion', 'attemptId', 'reportToken', 'state']) || data.schemaVersion !== 1 ||
    !isUuid(data.attemptId) || data.state !== 'started' || typeof data.reportToken !== 'string' ||
    data.reportToken.length !== 43 || !/^[A-Za-z0-9_-]{43}$/.test(data.reportToken)) throw new Error('Upload observation failed')
  return { attemptId: data.attemptId, reportToken: data.reportToken }
}

async function finishUploadObservation(assetId: string, attempt: { attemptId: string; reportToken: string }, outcome: BrowserUploadOutcome) {
  // Independent from caller cancellation: record the actual SDK result before any follow-up.
  const data = await uploadObservation(assetId, { action: 'finish', ...attempt, outcome })
  if (!exactKeys(data, ['schemaVersion', 'attemptId', 'state']) || data.schemaVersion !== 1 ||
    data.attemptId !== attempt.attemptId || data.state !== outcome) throw new Error('Upload observation failed')
}

export async function importProjectAudio(
  projectId: string, file: File, idempotencyKey: string, signal?: AbortSignal,
): Promise<{ id: string; state: 'ready' | 'verifying' }> {
  if (!file.type.startsWith('audio/') || file.size === 0 || file.size > 100 * 1024 * 1024) {
    throw new Error('Select an audio file between 1 byte and 100 MiB')
  }
  const body = await json(await request('/api/media/assets', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, kind: 'original_audio', mimeType: file.type,
      originalFilename: file.name, expectedBytes: file.size, idempotencyKey }),
  }))
  const asset = uploadAsset(body, projectId)
  if (asset.state === 'ready' || asset.state === 'verifying') return { id: asset.id, state: asset.state }
  if (!['pending_upload', 'uploaded'].includes(asset.state)) throw new Error('Audio upload is not eligible for retry')
  if (asset.state === 'pending_upload') {
    if (!record(body) || !record(body.upload) || typeof body.upload.token !== 'string' || !body.upload.token) {
      throw new Error('Invalid upload response')
    }
    const attempt = await beginUploadObservation(asset.id, signal)
    let outcome: BrowserUploadOutcome
    let failure: Error | undefined
    try {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      const result = await createClientSupabase().storage.from(asset.bucket)
        .uploadToSignedUrl(asset.objectKey, body.upload.token, file, { contentType: file.type, upsert: false })
      // A conflict is not a successful new-object PUT. Only the existing server verifier can reconcile it.
      outcome = !result.error ? 'client_succeeded' : isExistingObjectError(result.error) ? 'client_conflict' : 'client_failed'
      if (outcome === 'client_failed') failure = new Error('Audio upload failed')
    } catch (error) {
      const cancelled = record(error) && error.name === 'AbortError'
      outcome = cancelled ? 'client_cancelled' : 'client_failed'
      failure = cancelled ? new DOMException('Cancelled', 'AbortError') : new Error('Audio upload failed')
    }
    await finishUploadObservation(asset.id, attempt, outcome)
    if (failure) throw failure
  }
  signal?.throwIfAborted()
  const completed = uploadAsset(await json(await request(`/api/media/assets/${encodeURIComponent(asset.id)}/complete`, {
    method: 'POST', signal,
  })), projectId)
  if (completed.id !== asset.id || !['ready', 'verifying'].includes(completed.state)) throw new Error('Invalid upload response')
  return { id: completed.id, state: completed.state as 'ready' | 'verifying' }
}
