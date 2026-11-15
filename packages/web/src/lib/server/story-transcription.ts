import { createHash } from 'node:crypto'
import type { getSupabaseAdmin } from '@/lib/supabase'
import { isReviewUuid, REVIEW_SEGMENT_LIMIT, REVIEW_TEXT_LIMIT, type ReviewState } from '@/lib/story-review-contract'
import { assertCapabilityGatewayGuard, assertNonSimulatedText } from './ai-capability-gateway'
import { APPROVED_CAPABILITY_CONFIG, verifyProviderPolicyEvidence } from './provider-policy-verification'
import { hashReviewSource, readStoryReview, runStoryReview, reserveStoryTranscription, beginStoryTranscription, releaseStoryTranscription, readStoryTranscriptionStatus, StoryReviewError, type TranscriptIngestPayload } from './story-review-service'
import type { ConsentRecord } from './consent-deletion'

type Environment = Record<string, string | undefined>
type ConfigurationOptions = { env?: Environment; now?: Date }
export type TranscriptionRequest = { requestId: string; revisionId?: string; expectedVersion: number; consent: boolean; policyVersion: string }
export type TranscriptionConfiguration = { ready: boolean; provider: 'elevenlabs'; model: string; region: string; policyVersion: string | null; requiresConsent: true }
export class StoryTranscriptionError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code === 'transcription_pending' ? 'This transcription request is pending or its outcome is unknown. It will not be sent again.' : code === 'consent_required' ? 'Cloud transcription consent is required.' : code === 'policy_changed' ? 'The transcription policy changed. Reload before consenting.' : code === 'source_changed' ? 'The story or audio changed. Reload before continuing.' : status === 400 ? 'Invalid transcription request.' : 'Transcription is unavailable.')
  }
}
function unavailable(): never { throw new StoryTranscriptionError(503, 'unavailable') }
function invalidOutput(): never { throw new StoryTranscriptionError(502, 'provider_invalid_response') }
function policyConfiguration(options: ConfigurationOptions) {
  const env = options.env ?? process.env
  if (env.MEDIA_ASSETS_ENABLED !== 'true' || env.G2_TRANSCRIPTION_ENABLED !== 'true' || !env.ELEVENLABS_API_KEY || /\s/.test(env.ELEVENLABS_API_KEY)) return null
  try {
    storageConfiguration(env)
    const target = APPROVED_CAPABILITY_CONFIG.asr_transcribe
    const verified = verifyProviderPolicyEvidence(JSON.parse(env.G2_ASR_POLICY_EVIDENCE ?? ''), { now: options.now, targetRegion: target.defaultRegion })
    if (!verified.valid || !verified.parsed || verified.parsed.provider !== target.provider || verified.parsed.modelId !== target.defaultModelId) return null
    return { target, evidence: verified.parsed, policyVersion: `g2-asr-${createHash('sha256').update(JSON.stringify(verified.parsed)).digest('hex')}` }
  } catch { return null }
}
/** Public readiness never includes API credentials or account policy documents. */
export function getTranscriptionConfiguration(options: ConfigurationOptions = {}): TranscriptionConfiguration {
  const policy = policyConfiguration(options), target = APPROVED_CAPABILITY_CONFIG.asr_transcribe
  return { ready: policy !== null, provider: 'elevenlabs', model: target.defaultModelId, region: target.defaultRegion, policyVersion: policy?.policyVersion ?? null, requiresConsent: true }
}
export function parseTranscriptionRequest(raw: unknown): TranscriptionRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new StoryTranscriptionError(400, 'invalid_request')
  const body = raw as Record<string, unknown>, version = body.expectedVersion === undefined ? 0 : body.expectedVersion
  if (Object.keys(body).some(key => !['requestId', 'revisionId', 'expectedVersion', 'consent', 'policyVersion'].includes(key)) ||
    !isReviewUuid(body.requestId) || (body.revisionId !== undefined && !isReviewUuid(body.revisionId)) || typeof body.consent !== 'boolean' ||
    typeof body.policyVersion !== 'string' || !body.policyVersion.trim() || body.policyVersion.length > 100 || !Number.isSafeInteger(version) || Number(version) < 0 || Number(version) > 2_147_483_646) throw new StoryTranscriptionError(400, 'invalid_request')
  return { ...body, expectedVersion: version } as TranscriptionRequest
}
const normalizedWords = (text: string) => text.replace(/\s+/g, ' ').trim()
/** Preserve every provider token, including audio events. Log-probability is not confidence. */
export function parseElevenLabsTranscript(raw: unknown, durationMs: number): { language: string; fullText: string; segments: TranscriptIngestPayload['segments'] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs > 7_200_000) invalidOutput()
  const body = raw as Record<string, unknown>
  if ('transcripts' in body || typeof body.text !== 'string' || body.text.length > REVIEW_TEXT_LIMIT || body.text.includes('\0') ||
    typeof body.language_code !== 'string' || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(body.language_code) || !Array.isArray(body.words) || body.words.length < 1 || body.words.length > 100_000) invalidOutput()
  try { assertNonSimulatedText(body.text) } catch { invalidOutput() }
  const segments: TranscriptIngestPayload['segments'] = []
  let current: TranscriptIngestPayload['segments'][number] | null = null, joined = '', previousEnd = 0
  const flush = () => {
    if (!current) return
    current.text = current.text.trim()
    if (!current.text) invalidOutput()
    segments.push(current); current = null
    if (segments.length > REVIEW_SEGMENT_LIMIT) invalidOutput()
  }
  for (const rawWord of body.words) {
    if (!rawWord || typeof rawWord !== 'object' || Array.isArray(rawWord)) invalidOutput()
    const token = rawWord as Record<string, unknown>
    if (typeof token.text !== 'string' || !token.text || token.text.includes('\0') || token.text.length > 1200 ||
      !['word', 'spacing', 'audio_event'].includes(String(token.type)) || typeof token.start !== 'number' || typeof token.end !== 'number' ||
      !Number.isFinite(token.start) || !Number.isFinite(token.end) || token.start < 0 || token.end < token.start ||
      token.start < previousEnd || token.end * 1000 > durationMs) invalidOutput()
    previousEnd = token.end
    joined += token.text
    if (joined.length > REVIEW_TEXT_LIMIT) invalidOutput()
    if (token.type === 'spacing') {
      if (token.text.trim()) invalidOutput()
      if (current) current.text += token.text
      continue
    }
    const start = Math.round(token.start * 1000), end = Math.round(token.end * 1000)
    if (end <= start || !token.text.trim()) invalidOutput()
    if (token.speaker_id != null && (typeof token.speaker_id !== 'string' || !/^[\w .-]{1,100}$/.test(token.speaker_id))) invalidOutput()
    const speaker = typeof token.speaker_id === 'string' ? token.speaker_id : 'unknown'
    if (current && (current.speaker_label !== speaker || current.text.length + token.text.length > 1200 || end - current.start_ms! > 20_000)) flush()
    if (!current) current = { text: token.text, start_ms: start, end_ms: end, confidence: null, speaker_label: speaker }
    else { current.text += token.text; current.end_ms = end }
  }
  flush()
  if (!segments.length || normalizedWords(joined) !== normalizedWords(body.text)) invalidOutput()
  const fullText = segments.map(segment => segment.text).join('\n\n')
  if (fullText.length > REVIEW_TEXT_LIMIT || fullText.replace(/\s/g, '') !== body.text.replace(/\s/g, '')) invalidOutput()
  return { language: body.language_code, fullText, segments }
}


type ExecutionOptions = ConfigurationOptions & { admin: ReturnType<typeof getSupabaseAdmin>; fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number }
type Query = PromiseLike<{ data: unknown; error: unknown }> & { abortSignal(signal: AbortSignal): Query; retry(enabled: boolean): Query }
type Row = Record<string, unknown>
const MAX_AUDIO_BYTES = 100 * 1024 * 1024, MAX_PROVIDER_BYTES = 4 * 1024 * 1024
function operationScope(caller: AbortSignal | undefined, timeoutMs: number) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) unavailable()
  const controller = new AbortController(), abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true })
  if (caller?.aborted) abort()
  const timer = setTimeout(abort, timeoutMs)
  return {
    signal: controller.signal,
    async wait<T>(promise: PromiseLike<T>): Promise<T> {
      let rejectAbort: () => void = () => {}
      const interrupted = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(new StoryTranscriptionError(503, 'unavailable'))
        controller.signal.addEventListener('abort', rejectAbort, { once: true })
        if (controller.signal.aborted) rejectAbort()
      })
      try { const result = await Promise.race([promise, interrupted]); if (controller.signal.aborted) unavailable(); return result }
      finally { controller.signal.removeEventListener('abort', rejectAbort) }
    },
    close() { clearTimeout(timer); caller?.removeEventListener('abort', abort); abort() },
  }
}
type Scope = ReturnType<typeof operationScope>
function row(data: unknown): Row { if (!data || typeof data !== 'object' || Array.isArray(data)) unavailable(); return data as Row }
async function query(query: Query, scope: Scope): Promise<unknown> {
  const result = await scope.wait(query.abortSignal(scope.signal).retry(false))
  if (result.error) unavailable()
  return result.data
}
function storageConfiguration(env: Environment) {
  try {
    const base = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/' || !env.SUPABASE_SERVICE_ROLE_KEY || /\s/.test(env.SUPABASE_SERVICE_ROLE_KEY)) unavailable()
    return { base: base.origin, key: env.SUPABASE_SERVICE_ROLE_KEY }
  } catch { unavailable() }
}
async function readSource(actorId: string, storyId: string, options: ExecutionOptions, scope: Scope) {
  const dbOptions = { admin: options.admin, signal: scope.signal }
  await scope.wait(readStoryReview(actorId, storyId, dbOptions))
  const story = row(await query(options.admin.from('stories').select('id,project_id,status,transcript,audio_url').eq('id', storyId).maybeSingle(), scope))
  if (story.id !== storyId || !isReviewUuid(story.project_id) || story.status === 'deleted' || (story.transcript !== null && typeof story.transcript !== 'string')) unavailable()
  const match = typeof story.audio_url === 'string' ? /^\/api\/media\/assets\/([a-f0-9-]+)\/play$/i.exec(story.audio_url) : null
  if (!match || !isReviewUuid(match[1])) throw new StoryTranscriptionError(409, 'source_changed')
  const asset = row(await query(options.admin.from('media_assets').select('*').eq('id', match[1]).maybeSingle(), scope))
  if (asset.id !== match[1] || asset.story_id !== storyId || asset.project_id !== story.project_id || asset.state !== 'ready' || !['original_audio', 'derived_audio'].includes(String(asset.kind)) ||
    !Number.isSafeInteger(asset.version) || Number(asset.version) < 1 || !Number.isSafeInteger(asset.byte_size) || Number(asset.byte_size) < 1 || Number(asset.byte_size) > MAX_AUDIO_BYTES ||
    !Number.isSafeInteger(asset.duration_ms) || Number(asset.duration_ms) < 1 || Number(asset.duration_ms) > 7_200_000 || typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
    typeof asset.mime_type !== 'string' || !/^audio\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*$/.test(asset.mime_type) || !['saga', 'audio-recordings', 'recording-candidates'].includes(String(asset.bucket)) ||
    typeof asset.object_key !== 'string' || asset.object_key.length > 1024 || /[\\\x00-\x1f\x7f]/.test(asset.object_key) || asset.object_key.split('/').some(part => !part || part === '.' || part === '..') || asset.tombstone_at != null) throw new StoryTranscriptionError(409, 'source_changed')
  const subjects = [storyId, story.project_id, asset.id]
  if (asset.bucket === 'recording-candidates') {
    const candidates = await query(options.admin.from('recording_output_candidates').select('session_id,asset_id,project_id,bucket,object_key,state').eq('asset_id', asset.id).limit(2), scope)
    if (!Array.isArray(candidates) || candidates.length !== 1) unavailable()
    const candidate = row(candidates[0])
    if (!isReviewUuid(candidate.session_id) || candidate.project_id !== asset.project_id || candidate.bucket !== asset.bucket || candidate.object_key !== asset.object_key || candidate.state !== 'prepared') unavailable()
    subjects.push(candidate.session_id)
  }
  const consents = await query(options.admin.from('consent_records').select('id,grantor_id,subject_id,purpose,policy_version,provider,region,granted_at,withdrawn_at').eq('project_id', story.project_id).eq('grantor_id', actorId).eq('subject_id', storyId).eq('purpose', 'cloud_ai'), scope)
  if (!Array.isArray(consents)) unavailable()
  const consentRecords: ConsentRecord[] = consents.map(value => {
    const c = row(value)
    return { id: c.id, grantorId: c.grantor_id, subjectId: c.subject_id, purpose: c.purpose, policyVersion: c.policy_version, provider: c.provider, region: c.region, grantedAt: c.granted_at, withdrawnAt: c.withdrawn_at } as ConsentRecord
  })
  const tombstones = await query(options.admin.from('deletion_requests').select('subject_id,tombstone_at').eq('project_id', story.project_id).in('subject_id', subjects).not('tombstone_at', 'is', null), scope)
  if (!Array.isArray(tombstones)) unavailable()
  if (tombstones.length) throw new StoryTranscriptionError(409, 'source_changed')
  // A snapshot is a value: future reads must never mutate the pinned comparison.
  return { projectId: story.project_id, sourceHash: hashReviewSource(story.transcript as string | null), audioUrl: story.audio_url, asset: { ...asset }, consentRecords }
}
function assertConsent(actorId: string, storyId: string, source: Awaited<ReturnType<typeof readSource>>, options: ExecutionOptions, expectedPolicy: string) {
  const policy = policyConfiguration(options)
  if (!policy || policy.policyVersion !== expectedPolicy) throw new StoryTranscriptionError(409, 'policy_changed')
  try {
    assertCapabilityGatewayGuard('asr_transcribe', { actorId, storyId, projectId: source.projectId, surface: 'formal_archive', now: (options.now ?? new Date()).toISOString(), consentRecords: source.consentRecords,
      policy: { provider: policy.target.provider, model: policy.target.defaultModelId, region: policy.target.defaultRegion, policyVersion: policy.policyVersion, trainingOptOut: policy.evidence.trainingOptOutConfirmed, retentionDays: policy.evidence.zeroDataRetentionConfirmed ? 0 : policy.evidence.maxRetentionDaysAllowed, isLocalWorker: false } })
  } catch { throw new StoryTranscriptionError(403, 'consent_required') }
}
async function boundedBytes(response: Response, limit: number, scope: Scope, provider: boolean): Promise<Uint8Array> {
  const fail = () => provider ? invalidOutput() : unavailable()
  const declared = response.headers.get('content-length'), encoding = response.headers.get('content-encoding')
  if (response.status !== 200 || response.redirected || !response.body || (declared !== null && (!/^[1-9][0-9]*$/.test(declared) || Number(declared) > limit)) || (encoding !== null && encoding !== 'identity')) {
    void response.body?.cancel().catch(() => {})
    if (provider && response.status !== 200) throw new StoryTranscriptionError(502, 'provider_unavailable')
    fail()
  }
  const reader = response.body!.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const item = await scope.wait(reader.read())
      if (item.done) break
      if (!(item.value instanceof Uint8Array) || item.value.byteLength > limit - size) fail()
      size += item.value.byteLength; chunks.push(item.value)
    }
    if (!size || (declared !== null && Number(declared) !== size)) fail()
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
}
/** One durable reservation permits at most one outbound attempt. Unknown outcomes stay pending. */
export async function transcribeStory(actorId: string, storyId: string, input: TranscriptionRequest, options: ExecutionOptions): Promise<ReviewState> {
  if (typeof window !== 'undefined' || !isReviewUuid(actorId) || !isReviewUuid(storyId)) throw new StoryTranscriptionError(400, 'invalid_request')
  const request = parseTranscriptionRequest(input), policy = policyConfiguration(options)
  if (!policy) unavailable()
  if (request.policyVersion !== policy.policyVersion) throw new StoryTranscriptionError(409, 'policy_changed')
  if (!request.consent) throw new StoryTranscriptionError(403, 'consent_required')
  const env = options.env ?? process.env, storage = storageConfiguration(env), scope = operationScope(options.signal, options.timeoutMs ?? 120_000)
  const dbOptions = { admin: options.admin, signal: scope.signal }, fetcher = options.fetch ?? fetch
  let leaseToken: string | undefined, outbound = false
  const fetchOwned = async (url: string, init: RequestInit) => {
    const pending = fetcher(url, { ...init, redirect: 'error', cache: 'no-store', signal: scope.signal })
    void pending.then(response => { if (scope.signal.aborted) void response.body?.cancel().catch(() => {}) }, () => {})
    return scope.wait(pending)
  }
  try {
    const status = await scope.wait(readStoryTranscriptionStatus(actorId, storyId, dbOptions, request.requestId))
    if (status.status === 'completed') return status.review
    if (status.pendingRequestId && status.retryableRequestId !== request.requestId) throw new StoryTranscriptionError(409, 'transcription_pending')
    const source = await readSource(actorId, storyId, options, scope), asset = source.asset
    const reservation = await scope.wait(reserveStoryTranscription(actorId, storyId, { requestId: request.requestId, revisionId: request.revisionId, expectedVersion: request.expectedVersion, consent: request.consent, sourceHash: source.sourceHash, assetId: asset.id as string, provider: policy.target.provider, model: policy.target.defaultModelId, region: policy.target.defaultRegion, policyVersion: policy.policyVersion, assetVersion: asset.version as number, assetSha256: asset.sha256 as string, assetBucket: asset.bucket as string, assetObjectKey: asset.object_key as string }, dbOptions))
    if (reservation.status === 'completed') return reservation.review
    if (reservation.status !== 'reserved') throw new StoryTranscriptionError(409, 'transcription_pending')
    leaseToken = reservation.leaseToken!
    const revalidate = async () => {
      const current = await readSource(actorId, storyId, options, scope)
      if (current.sourceHash !== source.sourceHash || current.projectId !== source.projectId || current.audioUrl !== source.audioUrl || JSON.stringify(current.asset) !== JSON.stringify(source.asset)) throw new StoryTranscriptionError(409, 'source_changed')
      assertConsent(actorId, storyId, current, options, policy.policyVersion)
      // Keep the SQL source/asset/consent/CAS fence as the final external wait.
      const fence = await scope.wait(readStoryTranscriptionStatus(actorId, storyId, dbOptions, request.requestId))
      if (fence.status !== 'pending' || fence.pendingRequestId !== request.requestId) throw new StoryTranscriptionError(409, 'transcription_pending')
    }
    await revalidate()
    const path = [asset.bucket as string, ...(asset.object_key as string).split('/')].map(encodeURIComponent).join('/')
    const bytes = await boundedBytes(await fetchOwned(`${storage.base}/storage/v1/object/${path}`, { method: 'GET', headers: { Authorization: `Bearer ${storage.key}`, apikey: storage.key, 'Accept-Encoding': 'identity' } }), asset.byte_size as number, scope, false)
    if (bytes.byteLength !== asset.byte_size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) unavailable()
    await revalidate()
    const form = new FormData()
    form.set('file', new Blob([bytes as Uint8Array<ArrayBuffer>], { type: asset.mime_type as string }), 'recording.audio')
    form.set('model_id', policy.target.defaultModelId); form.set('diarize', 'true'); form.set('timestamps_granularity', 'word'); form.set('tag_audio_events', 'true')
    outbound = true // A lost permit response is unknown; never send without its acknowledgement.
    if (!await scope.wait(beginStoryTranscription(actorId, storyId, request.requestId, leaseToken, dbOptions))) throw new StoryTranscriptionError(409, 'transcription_pending')
    const response = await fetchOwned('https://api.elevenlabs.io/v1/speech-to-text?enable_logging=false', { method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY!, 'Accept-Encoding': 'identity' }, body: form })
    const responseBytes = await boundedBytes(response, MAX_PROVIDER_BYTES, scope, true)
    let body: unknown
    try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(responseBytes)) } catch { invalidOutput() }
    const transcript = parseElevenLabsTranscript(body, asset.duration_ms as number)
    await revalidate()
    const payload: TranscriptIngestPayload = { source_hash: source.sourceHash, asset_id: asset.id as string, provider: policy.target.provider, model: policy.target.defaultModelId, region: policy.target.defaultRegion, policy_version: policy.policyVersion, local_worker: false, language: transcript.language, segments: transcript.segments }
    if (request.revisionId) payload.revision_id = request.revisionId
    return await scope.wait(runStoryReview({ actorId, storyId, operation: 'ingest_transcript', requestId: request.requestId, expectedVersion: request.expectedVersion, payload: { ...payload, lease_token: leaseToken } }, dbOptions))
  } catch (error) {
    if (leaseToken && !outbound) await releaseStoryTranscription(actorId, storyId, request.requestId, leaseToken, { admin: options.admin, timeoutMs: 5000 }).catch(() => false)
    if (error instanceof StoryTranscriptionError && !scope.signal.aborted) throw error
    if (error instanceof StoryReviewError && !scope.signal.aborted) throw error
    if (leaseToken && outbound) throw new StoryTranscriptionError(409, 'transcription_pending')
    unavailable()
  } finally { scope.close() }
}
