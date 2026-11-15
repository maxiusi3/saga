/** @jest-environment node */
import { createHash } from 'node:crypto'
import { getTranscriptionConfiguration, transcribeStory } from '../story-transcription'
const actorId = '22222222-2222-4222-8222-222222222222', storyId = '11111111-1111-4111-8111-111111111111', projectId = '33333333-3333-4333-8333-333333333333', requestId = '44444444-4444-4444-8444-444444444444', assetId = '55555555-5555-4555-8555-555555555555'
const now = new Date('2026-11-10T12:00:00Z')
const env = { MEDIA_ASSETS_ENABLED: 'true', G2_TRANSCRIPTION_ENABLED: 'true', ELEVENLABS_API_KEY: 'controlled-key', G2_ASR_POLICY_EVIDENCE: JSON.stringify({ provider: 'elevenlabs', accountOrOrgId: 'local-test-account', modelId: 'scribe_v2', allowedRegions: ['us'], trainingOptOutConfirmed: true, zeroDataRetentionConfirmed: true, maxRetentionDaysAllowed: 0, evidenceDate: '2026-11-01T00:00:00Z', evidenceReference: 'controlled-policy-fixture' }), NEXT_PUBLIC_SUPABASE_URL: 'https://storage.example.test', SUPABASE_SERVICE_ROLE_KEY: 'controlled-storage-key' }
const policyVersion = getTranscriptionConfiguration({ env, now }).policyVersion!
const request = { requestId, consent: true, policyVersion, expectedVersion: 0 }
const review = { revision: null, assertions: [], transcript: null, approvedRevisions: [], sourceChanged: false, canApprove: true }
const audio = new Uint8Array([1, 2, 3, 4, 5])
const providerBody = { text: 'Hello.', language_code: 'eng', words: [{ text: 'Hello.', start: 0, end: 1, type: 'word', speaker_id: 'speaker_0', logprob: -0.01 }] }
function fixture() {
  const rows: Record<string, Array<Record<string, any>>> = {
    stories: [{ id: storyId, project_id: projectId, status: 'ready', transcript: null, audio_url: `/api/media/assets/${assetId}/play` }],
    media_assets: [{ id: assetId, project_id: projectId, story_id: storyId, bucket: 'saga', object_key: 'recordings/source.webm', kind: 'original_audio', state: 'ready', version: 1, mime_type: 'audio/webm', byte_size: 5, duration_ms: 3000, sha256: createHash('sha256').update(audio).digest('hex') }],
    consent_records: [], deletion_requests: [], recording_output_candidates: [],
  }
  const rpcCalls: Array<{ name: string; args: any }> = []
  let pending = false, completed = false, deny = false, rejectPendingStatus = false, retryable = false, outbound = false
  const leaseToken = '66666666-6666-4666-8666-666666666666'
  function result(data: unknown, error: unknown = null) { const q = { abortSignal: () => q, retry: () => Promise.resolve({ data, error }) }; return q }
  const admin = {
    rpc(name: string, args: any) {
      rpcCalls.push({ name, args })
      if (deny) return result(null, { code: '42501' })
      if (name === 'read_story_transcription_status' && pending && rejectPendingStatus) return result(null, { code: '42501' })
      if (name === 'read_story_transcription_status') return result({ pendingRequestId: pending ? requestId : null, status: completed ? 'completed' : pending ? 'pending' : null, retryableRequestId: retryable ? requestId : null, review })
      if (name === 'reserve_story_transcription') {
        if (pending && !retryable) return result({ status: 'pending', review })
        retryable = false
        pending = true
        rows.consent_records.push({ id: requestId, project_id: projectId, grantor_id: actorId, subject_id: storyId, purpose: 'cloud_ai', policy_version: policyVersion, provider: 'elevenlabs', region: 'us', granted_at: '2026-11-10T11:00:00Z', withdrawn_at: null })
        return result({ status: 'reserved', leaseToken, review })
      }
      if (name === 'begin_story_transcription') { if (outbound) return result({ started: false }); outbound = true; return result({ started: true }) }
      if (name === 'release_story_transcription') { if (!outbound) retryable = true; return result({ released: !outbound }) }
      if (args.p_operation === 'ingest_transcript') { pending = false; completed = true }
      return result(review)
    },
    from(table: string) {
      let selected = rows[table] ?? [], single = false
      const q: any = { select: () => q, eq: (key: string, value: unknown) => { selected = selected.filter(r => r[key] === value); return q }, in: (key: string, values: unknown[]) => { selected = selected.filter(r => values.includes(r[key])); return q }, not: (key: string, _op: string, value: unknown) => { selected = selected.filter(r => r[key] !== value); return q }, limit: (limit: number) => { selected = selected.slice(0, limit); return q }, maybeSingle: () => { single = true; return q }, abortSignal: () => q, retry: () => Promise.resolve({ data: single ? selected[0] ?? null : selected, error: null }) }
      return q
    },
  }
  const calls: Array<{ url: string; init: RequestInit }> = []
  let onProvider: (() => void) | undefined, onStorage: (() => void) | undefined
  let storageResponse = () => new Response(audio, { headers: { 'content-length': '5' } }), providerResponse = () => Response.json(providerBody)
  const fetcher: typeof fetch = async (url, init) => { calls.push({ url: String(url), init: init! }); if (String(url).startsWith(env.NEXT_PUBLIC_SUPABASE_URL)) { onStorage?.(); return storageResponse() } onProvider?.(); return providerResponse() }
  return { rows, admin, calls, rpcCalls, fetcher, setDeny: () => { deny = true }, setRejectPendingStatus: () => { rejectPendingStatus = true }, setPending: () => { pending = true }, setCompleted: () => { completed = true }, setOnProvider: (fn: () => void) => { onProvider = fn }, setOnStorage: (fn: () => void) => { onStorage = fn }, setStorage: (fn: () => Response) => { storageResponse = fn }, setProvider: (fn: () => Response) => { providerResponse = fn } }
}
function run(f: ReturnType<typeof fixture>, patch: Record<string, unknown> = {}) { return transcribeStory(actorId, storyId, request, { admin: f.admin, env, now, fetch: f.fetcher, ...patch }) }
describe('bounded authorized transcription execution', () => {
  it('sends only pinned same-story bytes to the configured endpoint and persists actual timed words', async () => {
    const f = fixture(); expect(await run(f)).toEqual(review)
    expect(f.calls).toHaveLength(2)
    expect(f.calls[0].url).toBe('https://storage.example.test/storage/v1/object/saga/recordings/source.webm')
    const provider = f.calls[1]
    expect(provider.url).toBe('https://api.elevenlabs.io/v1/speech-to-text?enable_logging=false')
    expect(provider.init).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store' })
    expect(new Headers(provider.init.headers).get('xi-api-key')).toBe('controlled-key')
    const form = provider.init.body as FormData
    expect(form.get('model_id')).toBe('scribe_v2'); expect(form.get('diarize')).toBe('true'); expect(form.get('tag_audio_events')).toBe('true'); expect(form.get('timestamps_granularity')).toBe('word')
    expect(new Uint8Array(await (form.get('file') as Blob).arrayBuffer())).toEqual(audio)
    const ingest = f.rpcCalls.find(call => call.args.p_operation === 'ingest_transcript')!
    expect(ingest.args).toMatchObject({ p_actor_id: actorId, p_story_id: storyId, p_request_id: requestId, p_expected_version: 0, p_payload: { source_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', asset_id: assetId, provider: 'elevenlabs', model: 'scribe_v2', local_worker: false, segments: [{ text: 'Hello.', start_ms: 0, end_ms: 1000, confidence: null, speaker_label: 'speaker_0' }] } })
  })
  it.each(['policy', 'consent', 'membership', 'asset', 'tombstone', 'size'])('rejects %s before any storage/provider request', async issue => {
    const f = fixture(); let input = request, configured = env
    if (issue === 'policy') configured = { ...env, G2_ASR_POLICY_EVIDENCE: '{}' }
    if (issue === 'consent') input = { ...request, consent: false }
    if (issue === 'membership') f.setDeny()
    if (issue === 'asset') f.rows.media_assets[0].story_id = projectId
    if (issue === 'tombstone') f.rows.deletion_requests.push({ subject_id: assetId, project_id: projectId, tombstone_at: now.toISOString() })
    if (issue === 'size') f.rows.media_assets[0].byte_size = 100 * 1024 * 1024 + 1
    await expect(transcribeStory(actorId, storyId, input, { admin: f.admin, env: configured, now, fetch: f.fetcher })).rejects.toThrow()
    expect(f.calls).toHaveLength(0)
  })
  it('blocks a stale displayed policy before persisting consent', async () => { const f = fixture(); await expect(transcribeStory(actorId, storyId, { ...request, policyVersion: 'stale' }, { admin: f.admin, env, now, fetch: f.fetcher })).rejects.toMatchObject({ code: 'policy_changed' }); expect(f.rpcCalls).toHaveLength(0) })
  it('returns completed requests without downloading or invoking provider again', async () => { const f = fixture(); f.setCompleted(); expect(await run(f)).toEqual(review); expect(f.calls).toHaveLength(0) })
  it('does not send a pending/unknown request again', async () => { const f = fixture(); f.setPending(); await expect(run(f)).rejects.toMatchObject({ code: 'transcription_pending' }); expect(f.calls).toHaveLength(0) })
  it.each(['length', 'checksum', 'redirect'])('refuses %s storage evidence before cloud invocation', async issue => {
    const f = fixture()
    f.setStorage(() => issue === 'length' ? new Response(new Uint8Array([1, 2, 3, 4, 5, 6])) : issue === 'checksum' ? new Response(new Uint8Array([5, 4, 3, 2, 1])) : new Response(null, { status: 302, headers: { location: 'https://attacker.test' } }))
    await expect(run(f)).rejects.toThrow(); expect(f.calls).toHaveLength(1)
  })
  it('uses the atomic pending-request fence before sending source bytes', async () => { const f = fixture(); f.setRejectPendingStatus(); await expect(run(f)).rejects.toThrow(); expect(f.calls.filter(call => call.url.startsWith('https://api.elevenlabs.io/'))).toHaveLength(0) })
  it('rechecks consent after download before exposing bytes to provider', async () => { const f = fixture(); f.setOnStorage(() => { f.rows.consent_records[0].withdrawn_at = '2026-11-10T11:30:00Z' }); await expect(run(f)).rejects.toThrow(); expect(f.calls).toHaveLength(1) })
  it.each(['consent', 'membership', 'source', 'asset', 'deletion'])('rejects %s revoked while provider responds without persisting', async issue => {
    const f = fixture(); f.setOnProvider(() => {
      if (issue === 'consent') f.rows.consent_records[0].withdrawn_at = '2026-11-10T11:30:00Z'
      if (issue === 'membership') f.setDeny()
      if (issue === 'source') f.rows.stories[0].transcript = 'changed'
      if (issue === 'asset') f.rows.media_assets[0].version = 2
      if (issue === 'deletion') f.rows.deletion_requests.push({ subject_id: storyId, project_id: projectId, tombstone_at: now.toISOString() })
    }); await expect(run(f)).rejects.toThrow(); expect(f.rpcCalls.some(call => call.args.p_operation === 'ingest_transcript')).toBe(false)
  })
  it.each([new Response('secret provider diagnostics', { status: 500 }), new Response('bad json'), new Response('{}', { headers: { 'content-length': '4194305' } })])('fails safely on rejected or malformed provider response %#', async response => { const f = fixture(); f.setProvider(() => response); await expect(run(f)).rejects.toMatchObject({ status: 502 }); expect(f.rpcCalls.some(call => call.args.p_operation === 'ingest_transcript')).toBe(false); expect(f.calls).toHaveLength(2) })
  it('bounds a provider that ignores cancellation and leaves the request pending', async () => {
    const f = fixture(); const fetcher: typeof fetch = (url, init) => String(url).startsWith(env.NEXT_PUBLIC_SUPABASE_URL) ? f.fetcher(url, init) : new Promise(() => {})
    await expect(run(f, { fetch: fetcher, timeoutMs: 20 })).rejects.toMatchObject({ code: 'transcription_pending' })
    await expect(run(f)).rejects.toMatchObject({ code: 'transcription_pending' }); expect(f.calls).toHaveLength(1)
  })
})

it('retries a durable pre-send reservation after Storage503 without duplicating the provider attempt', async () => {
 const f=fixture();f.setStorage(()=>new Response('temporary unavailable',{status:503}))
 await expect(run(f)).rejects.toMatchObject({code:'unavailable'})
 f.setStorage(()=>new Response(audio,{headers:{'content-length':'5'}}))
 expect(await run(f)).toEqual(review)
 expect(f.calls.filter(c=>c.url.startsWith('https://api.elevenlabs.io/'))).toHaveLength(1)
 expect(f.rpcCalls.filter(c=>c.name==='release_story_transcription')).toHaveLength(1)
 const begin=f.rpcCalls.find(c=>c.name==='begin_story_transcription')!
 expect(begin.args.p_lease_token).toBe('66666666-6666-4666-8666-666666666666')
 expect(f.rpcCalls.find(c=>c.args.p_operation==='ingest_transcript')!.args.p_payload.lease_token).toBe(begin.args.p_lease_token)
})
it('allows only one concurrent sender for the same story',async()=>{
 const f=fixture(),results=await Promise.allSettled([run(f),run(f)])
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
 expect(f.calls.filter(c=>c.url.startsWith('https://api.elevenlabs.io/'))).toHaveLength(1)
})
it('never releases an outbound attempt after provider failure',async()=>{
 const f=fixture();f.setProvider(()=>new Response('temporary unavailable',{status:503}))
 await expect(run(f)).rejects.toMatchObject({status:502});await expect(run(f)).rejects.toMatchObject({code:'transcription_pending'})
 expect(f.rpcCalls.filter(c=>c.name==='release_story_transcription')).toHaveLength(0)
})
