import { recorderDB } from './recorder-db'
import { useAuthStore } from '@/stores/auth-store'
import { createClientSupabase } from './supabase'
import { recordingChunkLocation } from './recording-chunk-location'
import { acquireRecordingSessionLock } from './recording-session-lock'
import { recordingBlobSha256, validateSaveStatus } from './recording-save-validation'
import { validateRecordingSaveIdentity, validateRecordingSaveLookup, validateRecordingSaveReceipt, isRecordingSaveUuid,
  type RecordingSaveIdentity, type RecordingSaveMetadata, type RecordingSaveReceipt } from './recording-save-contract'

export type RecordingSaveProgress = 'checking' | 'uploading' | 'processing' | 'confirming' | 'saved'
export type RecordingSaveResult = { state: 'pending' } | { state: 'saved'; receipt: RecordingSaveReceipt }
export type RecordingSaveOptions = { identity: RecordingSaveIdentity; metadata?: RecordingSaveMetadata; signal?: AbortSignal;
  isCurrent: () => boolean; onProgress?: (progress: RecordingSaveProgress) => void; onIntent?: (metadata: RecordingSaveMetadata) => void }

/** Bound even transports that ignore AbortSignal. An uncertain write is reconciled on explicit resume. */
async function bounded<T>(operation: (signal: AbortSignal) => PromiseLike<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_,reject) => { rejectAbort = () => reject(new Error('recording_request_unavailable')) })
  const abort = () => { controller.abort(); rejectAbort() }
  signal?.addEventListener('abort',abort,{once:true})
  const timer = setTimeout(abort,15000)
  try {
    if (signal?.aborted) abort()
    return await Promise.race([Promise.resolve().then(() => { if (controller.signal.aborted) throw new Error('recording_scope_changed'); return operation(controller.signal) }),interrupted])
  } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); controller.abort() }
}
function sameMetadata(a: RecordingSaveMetadata, b: RecordingSaveMetadata) {
  return Object.keys(a).every(key => a[key as keyof typeof a] === b[key as keyof typeof b])
}
function scope(options: RecordingSaveOptions) {
  return !options.signal?.aborted && options.isCurrent() && useAuthStore.getState().user?.id === options.identity.actorId
}
function assertScope(options: RecordingSaveOptions) { if (!scope(options)) throw new Error('recording_scope_changed') }

export async function saveLocalRecording(options: RecordingSaveOptions): Promise<RecordingSaveResult> {
  const identity = Object.freeze({...options.identity})
  validateRecordingSaveIdentity(identity)
  options = {...options,identity}
  assertScope(options)
  const release = await acquireRecordingSessionLock(identity.sessionId)
  try { return await saveLocked(options) } finally { release() }
}

async function saveLocked(options: RecordingSaveOptions): Promise<RecordingSaveResult> {
  const {identity} = options
  const current = () => scope(options)
  const progress = (value: RecordingSaveProgress) => { assertScope(options); options.onProgress?.(value) }
  progress('checking')
  let snapshot = await bounded(() => recorderDB.prepareSave(identity,options.metadata,current),options.signal)
  assertScope(options)
  const pinned = snapshot.session.saveIntent!
  options.onIntent?.(pinned.metadata)
  const recheck = async (verification?: 'all' | number) => {
    assertScope(options)
    const next = await bounded(() => verification === 'all'
      ? recorderDB.readSave(identity,current)
      : recorderDB.readSaveState(identity,current,verification),options.signal)
    assertScope(options)
    if (next.session.saveIntent?.chunkIdentity !== pinned.chunkIdentity || !sameMetadata(next.session.saveIntent.metadata,pinned.metadata)) throw new Error('recording_local_changed')
    snapshot = next
  }
  const token = async () => {
    assertScope(options)
    const value = await bounded(() => useAuthStore.getState().getAccessToken(),options.signal)
    assertScope(options)
    if (!value) throw new Error('recording_auth_unavailable')
    return value
  }
  const api = async (suffix: string, body?: unknown, verifyAll = false) => {
    const accessToken = await token()
    await recheck(verifyAll ? 'all' : undefined)
    const value = await bounded(async signal => {
      const response = await fetch(`/api/recordings/sessions/${identity.sessionId}/${suffix}`, { method: body ? 'POST':'GET',
        headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},cache:'no-store',signal,...(body ? {body:JSON.stringify(body)}:{}) })
      assertScope(options)
      if (!response.ok) throw new Error('recording_request_unavailable')
      const json:unknown = await response.json()
      assertScope(options)
      return json
    },options.signal)
    assertScope(options)
    return value
  }
  const applyLookup = async (value: unknown) => {
    const lookup = validateRecordingSaveLookup(value,identity)
    if (lookup.intent && !sameMetadata(lookup.intent.metadata,pinned.metadata)) throw new Error('recording_metadata_changed')
    if (lookup.intent) {
      snapshot = await bounded(() => recorderDB.recordSaveLookup(identity,lookup,current),options.signal)
      assertScope(options)
    } else if (snapshot.session.saveIntent?.remote) throw new Error('recording_remote_changed')
    return lookup
  }
  const lookup = () => api(`save?projectId=${identity.projectId}`).then(applyLookup)
  let remote = await lookup()
  if (!remote.intent) remote = await applyLookup(await api('save',{action:'reserve',projectId:identity.projectId,metadata:pinned.metadata}))
  if (!remote.intent) throw new Error('recording_reservation_missing')

  const seal = async () => {
    progress('uploading')
    for (const chunk of snapshot.chunks) {
      // Historical uploaded flags do not establish byte identity. Always read the object back.
      const accessToken = await token()
      await recheck(chunk.index)
      const location = recordingChunkLocation({userId:identity.actorId,projectId:identity.projectId,sessionId:identity.sessionId,index:chunk.index})
      const bucket = createClientSupabase().storage.from('audio-recordings')
      try {
        await bounded(() => bucket.upload(location.storageObjectKey,chunk.blob,{upsert:false,contentType:snapshot.session.mimeType,
          headers:{Authorization:`Bearer ${accessToken}`}}),options.signal)
      } catch { /* An uncertain or duplicate upload is resolved only by authorized readback below. */ }
      assertScope(options)
      await token()
      const downloaded = await bounded(async signal => await bucket.download(location.storageObjectKey,{}, {signal,cache:'no-store'}),options.signal)
      assertScope(options)
      if (downloaded.error || !downloaded.data || downloaded.data.size !== chunk.byteSize ||
        await bounded(() => recordingBlobSha256(downloaded.data!),options.signal) !== chunk.sha256) throw new Error('recording_remote_bytes_invalid')
      assertScope(options)
      await recheck()
    }
    const value = await api('seal',{projectId:identity.projectId,storyId:remote.intent!.storyId,mimeType:snapshot.session.mimeType,
      chunks:snapshot.chunks.map(chunk => ({index:chunk.index,chunkId:chunk.id,bucket:'audio-recordings',
        objectKey:recordingChunkLocation({userId:identity.actorId,projectId:identity.projectId,sessionId:identity.sessionId,index:chunk.index}).objectKey,
        byteSize:chunk.byteSize,sha256:chunk.sha256}))},true)
    // Seal contains raw server rows; validate only its bounded identity envelope, then use lookup/status.
    const sealed = validateSeal(value,identity,remote.intent!.storyId)
    remote = await lookup()
    if (remote.intent?.manifestSha256 !== sealed.manifestSha256 || remote.intent.assetId !== sealed.assetId) throw new Error('recording_remote_changed')
  }
  const hadManifest = !!remote.intent.manifestSha256
  if (!hadManifest) await seal()
  const confirmationIdentity = () => {
    if (!remote.intent?.assetId || !remote.intent.manifestSha256) throw new Error('recording_manifest_missing')
    return {...identity,storyId:remote.intent.storyId,assetId:remote.intent.assetId,manifestSha256:remote.intent.manifestSha256}
  }
  const readStatus = async () => {
    progress('processing')
    const expected = confirmationIdentity()
    return validateSaveStatus(await api(`status?projectId=${identity.projectId}&manifestSha256=${expected.manifestSha256}`),expected)
  }
  let status = await readStatus()
  // Only a coherent authorized absence permits replay of the identical manifest. No automatic job retries.
  if (hadManifest && status.state === 'unresolved' && status.jobId === null) {
    await seal()
    status = await readStatus()
  }
  for (let poll=0; status.state === 'unresolved' && status.jobId !== null && poll<3; poll++) {
    await bounded(signal => new Promise<void>((resolve,reject) => {
      const abort = () => { clearTimeout(timer); reject(new Error('recording_scope_changed')) }
      const timer = setTimeout(() => { signal.removeEventListener('abort',abort); resolve() },1000)
      signal.addEventListener('abort',abort,{once:true})
    }),options.signal)
    assertScope(options)
    status = await readStatus()
  }
  if (status.state === 'failed') throw new Error('recording_processing_failed')
  if (status.state !== 'succeeded') return {state:'pending'}
  progress('confirming')
  const expected = confirmationIdentity()
  const receipt = validateRecordingSaveReceipt(await api('save',{action:'confirm',projectId:identity.projectId,manifestSha256:expected.manifestSha256},true),expected)
  await bounded(() => recorderDB.recordSaveConfirmation(identity,receipt,current),options.signal)
  assertScope(options)
  progress('saved')
  return {state:'saved',receipt}
}

function validateSeal(value: unknown, identity: RecordingSaveIdentity, storyId: string) {
  const fail = () => { throw new Error('recording_seal_invalid') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const row = value as Record<string,unknown>
  const keys=['asset','job','idempotentReplay','canClearLocalDrafts','manifestSha256']
  const asset=row.asset as Record<string,unknown>|null,job=row.job as Record<string,unknown>|null
  if (Object.keys(row).length !== keys.length || !keys.every(key => Object.prototype.hasOwnProperty.call(row,key)) ||
    row.canClearLocalDrafts !== false || typeof row.idempotentReplay !== 'boolean' || typeof row.manifestSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.manifestSha256) || !asset || !job || !isRecordingSaveUuid(asset.id) || !isRecordingSaveUuid(job.id) ||
    asset.project_id !== identity.projectId || asset.story_id !== storyId || asset.created_by !== identity.actorId ||
    job.project_id !== identity.projectId || job.asset_id !== asset.id || job.created_by !== identity.actorId) return fail()
  return {assetId:asset.id,manifestSha256:row.manifestSha256}
}

/** The explicit button reauthorizes and reconfirms immediately before atomic local cleanup. */
export async function clearSavedLocalRecording(options: RecordingSaveOptions, receipt: RecordingSaveReceipt) {
  validateRecordingSaveIdentity(options.identity)
  const release = await acquireRecordingSessionLock(options.identity.sessionId)
  try {
    assertScope(options)
    const result = await saveLocked(options)
    if (result.state !== 'saved') throw new Error('recording_confirmation_missing')
    validateRecordingSaveReceipt(receipt,result.receipt)
    await recorderDB.clearConfirmedSave(options.identity,result.receipt,() => scope(options))
    assertScope(options)
  } finally { release() }
}
