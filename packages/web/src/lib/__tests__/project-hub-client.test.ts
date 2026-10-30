/** @jest-environment node */

import JSZip from 'jszip'
import {
  searchProjectArchive, getCitationAudioUrl, downloadProjectArchive, importProjectAudio,
} from '../project-hub-client'

const mockToken = jest.fn()
const mockUpload = jest.fn()
const mockBucket = jest.fn(() => ({ uploadToSignedUrl: mockUpload }))
jest.mock('@/stores/auth-store', () => ({ useAuthStore: { getState: () => ({ getAccessToken: mockToken }) } }))
jest.mock('@/lib/supabase', () => ({ createClientSupabase: () => ({ storage: { from: mockBucket } }) }))

const attemptId = '11111111-1111-4111-8111-111111111111'
const reportToken = 'A'.repeat(43)
const beginReceipt = { schemaVersion: 1, attemptId, reportToken, state: 'started' }
const finishReceipt = (state = 'client_succeeded') => ({ schemaVersion: 1, attemptId, state })
const originalFetch = global.fetch
const mockFetch = jest.fn()
const asset = {
  id: 'asset-123', project_id: 'project-123', bucket: 'audio-recordings',
  object_key: 'user/projects/project-123/assets/asset-123/original', state: 'pending_upload',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockReset()
  global.fetch = mockFetch
  mockToken.mockReset().mockResolvedValue('synthetic-user-token')
  mockUpload.mockReset().mockResolvedValue({ data: { path: asset.object_key }, error: null })
})
afterEach(() => { global.fetch = originalFetch })

it('sends encoded search filters with current authentication and no cached response', async () => {
  mockFetch.mockResolvedValue(Response.json({ status: 'no_matching_sources', answerText: 'No sources', citations: [] }))
  const result = await searchProjectArchive('project-123', { query: 'boat & river', person: 'Ada', date: '1968', place: 'Portland' })
  const [url, init] = mockFetch.mock.calls[0]
  expect(new URL(url, 'http://localhost').searchParams.get('q')).toBe('boat & river')
  expect(new URL(url, 'http://localhost').searchParams.get('person')).toBe('Ada')
  expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer synthetic-user-token')
  expect(result.status).toBe('no_matching_sources')
})

it('keeps cookie authentication when there is no Bearer token', async () => {
  mockToken.mockResolvedValue(null)
  mockFetch.mockResolvedValue(Response.json({ signedUrl: 'https://storage.example/audio?token=synthetic' }))
  await getCitationAudioUrl('asset-123')
  expect(new Headers(mockFetch.mock.calls[0][1].headers).has('authorization')).toBe(false)
})

it.each([401, 403, 503])('does not convert HTTP %s into a successful result', async status => {
  mockFetch.mockResolvedValue(Response.json({ error: 'private provider diagnostics' }, { status }))
  await expect(searchProjectArchive('project-123', { query: 'boat' })).rejects.toThrow('Archive request failed')
})

it('rejects malformed citations instead of offering invalid playback', async () => {
  mockFetch.mockResolvedValue(Response.json({ status: 'grounded_answer', answerText: 'bad', citations: [{ startMs: -1, endMs: 2 }] }))
  await expect(searchProjectArchive('project-123', { query: 'boat' })).rejects.toThrow('Invalid archive response')
})

it('rejects executable audio URLs', async () => {
  mockFetch.mockResolvedValue(Response.json({ signedUrl: 'javascript:alert(1)' }))
  await expect(getCitationAudioUrl('asset-123')).rejects.toThrow('Invalid audio response')
})

it('downloads ZIP bytes, not a JSON error body renamed as an archive', async () => {
  const bytes = await new JSZip().file('manifest.json', '{}').generateAsync({ type: 'uint8array' })
  mockFetch.mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'application/zip' } }))
  const archive = await downloadProjectArchive('project-123')
  expect(archive.size).toBe(bytes.length)
  expect(mockFetch.mock.calls[0][1].method).toBe('POST')
  mockFetch.mockResolvedValue(Response.json({ status: 'ok' }))
  await expect(downloadProjectArchive('project-123')).rejects.toThrow('Invalid archive download')
})

it('rejects truncated ZIPs with a valid-looking signature', async () => {
  mockFetch.mockResolvedValue(new Response(new Uint8Array([80, 75, 3, 4]), { headers: { 'Content-Type': 'application/zip' } }))
  await expect(downloadProjectArchive('project-123')).rejects.toThrow('Invalid archive download')
})

it('registers, uploads to the server-owned target and waits for complete before returning verifying', async () => {
  mockFetch.mockResolvedValueOnce(Response.json({ asset, upload: { token: 'synthetic-upload-token' } }))
    .mockResolvedValueOnce(Response.json(beginReceipt))
    .mockResolvedValueOnce(Response.json(finishReceipt()))
    .mockResolvedValueOnce(Response.json({ asset: { ...asset, state: 'verifying' } }, { status: 202 }))
  const file = new File(['audio'], 'family.webm', { type: 'audio/webm' })
  await expect(importProjectAudio('project-123', file, 'upload-key')).resolves.toEqual({ id: asset.id, state: 'verifying' })
  expect(mockBucket).toHaveBeenCalledWith('audio-recordings')
  expect(mockUpload).toHaveBeenCalledWith(asset.object_key, 'synthetic-upload-token', file, { contentType: 'audio/webm', upsert: false })
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ projectId: 'project-123', idempotencyKey: 'upload-key', expectedBytes: 5 })
  expect(mockFetch.mock.calls[3][0]).toBe('/api/media/assets/asset-123/complete')
})

it.each(['ready', 'verifying'])('does not observe, reupload or downgrade a %s idempotent replay', async state => {
  mockFetch.mockResolvedValue(Response.json({ asset: { ...asset, state } }))
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .resolves.toEqual({ id: asset.id, state })
  expect(mockUpload).not.toHaveBeenCalled()
  expect(mockFetch).toHaveBeenCalledTimes(1)
})

it('resumes verification of an uploaded replay without uploading again', async () => {
  mockFetch.mockResolvedValueOnce(Response.json({ asset: { ...asset, state: 'uploaded' } }))
    .mockResolvedValueOnce(Response.json({ asset: { ...asset, state: 'verifying' } }, { status: 202 }))
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .resolves.toEqual({ id: asset.id, state: 'verifying' })
  expect(mockUpload).not.toHaveBeenCalled()
  expect(mockFetch).toHaveBeenCalledTimes(2)
  expect(mockFetch.mock.calls[1][0]).toBe('/api/media/assets/asset-123/complete')
})

it.each([
  { statusCode: '409' },
  { status: 409, statusCode: 'ResourceAlreadyExists' },
  { statusCode: '400', message: 'Asset Already Exists' },
  { status: 400, statusCode: '400', message: 'The resource already exists' },
  { status: 400, statusCode: '400', message: 'Duplicate' },
  { status: 400, statusCode: 'Duplicate', message: 'Upload conflict' },
])('reconciles known existing-object responses through complete: %j', async error => {
  mockFetch.mockResolvedValueOnce(Response.json({ asset, upload: { token: 'synthetic' } }))
    .mockResolvedValueOnce(Response.json(beginReceipt))
    .mockResolvedValueOnce(Response.json(finishReceipt('client_conflict')))
    .mockResolvedValueOnce(Response.json({ asset: { ...asset, state: 'verifying' } }, { status: 202 }))
  mockUpload.mockResolvedValueOnce({ error })
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .resolves.toEqual({ id: asset.id, state: 'verifying' })
  expect(mockFetch.mock.calls[3][0]).toBe('/api/media/assets/asset-123/complete')
  expect(JSON.parse(mockFetch.mock.calls[2][1].body).outcome).toBe('client_conflict')
  expect(mockUpload.mock.calls[0][3]).not.toHaveProperty('upsert', true)
})

it.each(['Invalid key', 'Invalid Compact JWS', 'Unexpected request'])('does not reconcile an unrelated 400: %s', async message => {
  mockFetch.mockResolvedValueOnce(Response.json({ asset, upload: { token: 'synthetic' } }))
    .mockResolvedValueOnce(Response.json(beginReceipt))
    .mockResolvedValueOnce(Response.json(finishReceipt('client_failed')))
  mockUpload.mockResolvedValueOnce({ error: { status: 400, statusCode: '400', message } })
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .rejects.toThrow('Audio upload failed')
  expect(mockFetch).toHaveBeenCalledTimes(3)
})

it('does not upload to a mismatched project target', async () => {
  mockFetch.mockResolvedValue(Response.json({ asset: { ...asset, project_id: 'other-family' }, upload: { token: 'bad' } }))
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .rejects.toThrow('Invalid upload response')
  expect(mockUpload).not.toHaveBeenCalled()
})

it('never reports success when upload or verification fails', async () => {
  mockFetch.mockResolvedValueOnce(Response.json({ asset, upload: { token: 'synthetic' } }))
    .mockResolvedValueOnce(Response.json(beginReceipt))
    .mockResolvedValueOnce(Response.json(finishReceipt('client_failed')))
  mockUpload.mockResolvedValueOnce({ error: { message: 'private storage diagnostic' } })
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .rejects.toThrow('Audio upload failed')
  expect(mockFetch).toHaveBeenCalledTimes(3)
})

it('rejects invalid audio before network access', async () => {
  await expect(importProjectAudio('project-123', new File(['text'], 'family.txt', { type: 'text/plain' }), 'upload-key'))
    .rejects.toThrow('Select an audio file')
  expect(mockFetch).not.toHaveBeenCalled()
})

it('does not dispatch after cancellation during session lookup', async () => {
  const controller = new AbortController()
  mockToken.mockImplementationOnce(async () => { controller.abort(); return 'token' })
  await expect(searchProjectArchive('project-123', { query: 'boat' }, controller.signal)).rejects.toThrow()
  expect(mockFetch).not.toHaveBeenCalled()
})

function serveUpload(overrides: { begin?: () => unknown; finish?: (body: any, init: RequestInit) => unknown } = {}) {
  const calls: string[] = []
  mockUpload.mockImplementation(async () => { calls.push('put'); return { error: null } })
  mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
    if (url === '/api/media/assets') { calls.push('register'); return Response.json({ asset, upload: { token: 'synthetic' } }) }
    if (url.endsWith('/upload-attempts')) {
      const body = JSON.parse(String(init.body)); calls.push(body.action)
      if (body.action === 'begin') return overrides.begin ? overrides.begin() : Response.json(beginReceipt)
      return overrides.finish ? overrides.finish(body, init) : Response.json(finishReceipt(body.outcome))
    }
    if (url.endsWith('/complete')) { calls.push('complete'); return Response.json({ asset: { ...asset, state: 'verifying' } }) }
    throw new Error('Unexpected URL')
  })
  return calls
}
const audioFile = () => new File(['audio'], 'family.webm', { type: 'audio/webm' })

it('orders real register, begin, non-overwrite PUT, independent finish, complete', async () => {
  const calls = serveUpload()
  const caller = new AbortController()
  await importProjectAudio('project-123', audioFile(), 'same-key', caller.signal)
  expect(calls).toEqual(['register', 'begin', 'put', 'finish', 'complete'])
  const reports = mockFetch.mock.calls.filter(([url]) => url.endsWith('/upload-attempts'))
  expect(JSON.parse(reports[0][1].body)).toEqual({ action: 'begin' })
  expect(JSON.parse(reports[1][1].body)).toEqual({ action: 'finish', attemptId, reportToken, outcome: 'client_succeeded' })
  for (const [, init] of reports) {
    expect(init.signal).not.toBe(caller.signal)
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer synthetic-user-token')
  }
})

it.each([null, [], {}, { ...beginReceipt, schemaVersion: 2 }, { ...beginReceipt, state: 'client_succeeded' },
  { ...beginReceipt, attemptId: 'not-uuid' }, { ...beginReceipt, reportToken: 'A'.repeat(42) },
  { ...beginReceipt, reportToken: 'A'.repeat(43) + '\n' }, { ...beginReceipt, reportToken: '='.repeat(43) },
  { ...beginReceipt, extra: 'private' },
])('does not PUT after an unknown begin receipt %j', async body => {
  const calls = serveUpload({ begin: () => Response.json(body) })
  await expect(importProjectAudio('project-123', audioFile(), 'same-key')).rejects.toThrow('Upload observation failed')
  expect(calls).toEqual(['register', 'begin'])
  expect(mockUpload).not.toHaveBeenCalled()
})

it.each([null, [], {}, { ...finishReceipt(), attemptId: '22222222-2222-4222-8222-222222222222' },
  { ...finishReceipt(), schemaVersion: 2 }, finishReceipt('started'), finishReceipt('client_failed'),
  { ...finishReceipt(), reportToken },
])('never completes after an unknown finish receipt %j', async body => {
  const calls = serveUpload({ finish: () => Response.json(body) })
  await expect(importProjectAudio('project-123', audioFile(), 'same-key')).rejects.toThrow('Upload observation failed')
  expect(calls).toEqual(['register', 'begin', 'put', 'finish'])
})

it.each(['begin', 'finish'] as const)('does not retry %s HTTP errors or malformed JSON', async phase => {
  for (const response of [Response.json({}, { status: 503 }), new Response('{')]) {
    const calls = serveUpload({ [phase]: () => response })
    await expect(importProjectAudio('project-123', audioFile(), 'same-key')).rejects.toThrow('Upload observation failed')
    expect(calls.filter(call => call === phase)).toHaveLength(1)
    expect(calls).not.toContain('complete')
  }
})

it.each(['client_failed', 'client_cancelled'] as const)('reports a thrown SDK %s before rejecting', async outcome => {
  const calls = serveUpload()
  mockUpload.mockImplementation(async () => {
    calls.push('put')
    throw outcome === 'client_cancelled' ? new DOMException('Cancelled', 'AbortError') : new Error('private failure')
  })
  await expect(importProjectAudio('project-123', audioFile(), 'same-key')).rejects.toThrow(outcome === 'client_cancelled' ? 'Cancelled' : 'Audio upload failed')
  expect(calls).toEqual(['register', 'begin', 'put', 'finish'])
  expect(JSON.parse(mockFetch.mock.calls[2][1].body).outcome).toBe(outcome)
})

it('gives unknown reporting precedence over a known SDK failure', async () => {
  const calls = serveUpload({ finish: () => Response.json(finishReceipt('started')) })
  mockUpload.mockResolvedValue({ error: { message: 'private SDK failure' } })
  await expect(importProjectAudio('project-123', audioFile(), 'same-key')).rejects.toThrow('Upload observation failed')
  expect(calls).toEqual(['register', 'begin', 'finish'])
})

it('reports cancellation when begin confirms but abort happens before PUT', async () => {
  const caller = new AbortController()
  // The body is received before cancellation; the synchronous receipt check is the last step before PUT.
  const receipt = { ...beginReceipt, get state() { caller.abort(); return 'started' } }
  const calls = serveUpload({ begin: () => ({ ok: true, status: 200, json: async () => receipt }) })
  await expect(importProjectAudio('project-123', audioFile(), 'same-key', caller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mockUpload).not.toHaveBeenCalled()
  expect(calls).toEqual(['register', 'begin', 'finish'])
  expect(JSON.parse(mockFetch.mock.calls[2][1].body).outcome).toBe('client_cancelled')
})

it('reports actual success if caller cancels a non-cancellable SDK PUT and then stops', async () => {
  const caller = new AbortController()
  const calls = serveUpload()
  mockUpload.mockImplementation(async () => { calls.push('put'); caller.abort(); return { error: null } })
  await expect(importProjectAudio('project-123', audioFile(), 'same-key', caller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(calls).toEqual(['register', 'begin', 'put', 'finish'])
  const [, init] = mockFetch.mock.calls[2]
  expect(JSON.parse(init.body).outcome).toBe('client_succeeded')
})

it('retains the file and idempotency key for an explicit retry after unknown finish', async () => {
  const file = audioFile()
  const calls = serveUpload({ finish: () => Response.json({}, { status: 503 }) })
  await expect(importProjectAudio('project-123', file, 'same-key')).rejects.toThrow('Upload observation failed')
  expect(calls).not.toContain('complete')
  serveUpload()
  await expect(importProjectAudio('project-123', file, 'same-key')).resolves.toEqual({ id: asset.id, state: 'verifying' })
  const registrations = mockFetch.mock.calls.filter(([url]) => url === '/api/media/assets')
  expect(registrations.map(([, init]) => JSON.parse(init.body).idempotencyKey)).toEqual(['same-key', 'same-key'])
  expect(mockUpload.mock.calls.every(([, , body]) => body === file)).toBe(true)
})

it.each(['begin', 'finish'] as const)('bounds the whole %s operation including auth/fetch/body that ignore abort', async phase => {
  jest.useFakeTimers()
  try {
    for (const stall of ['auth', 'fetch', 'body']) {
      mockFetch.mockClear(); mockUpload.mockClear(); mockToken.mockReset().mockResolvedValue('token')
      let reject!: (error: Error) => void
      const never = new Promise<never>((_, fail) => { reject = fail })
      const calls = serveUpload({ [phase]: () => stall === 'fetch' ? never : stall === 'body' ? { ok: true, status: 200, json: () => never } : Response.json(phase === 'begin' ? beginReceipt : finishReceipt()) })
      if (stall === 'auth') {
        mockToken.mockResolvedValueOnce('token')
        if (phase === 'finish') mockToken.mockResolvedValueOnce('token')
        mockToken.mockImplementationOnce(() => never)
      }
      let settled = false
      const result = importProjectAudio('project-123', audioFile(), 'same-key').catch(error => error).then(value => { settled = true; return value })
      await jest.advanceTimersByTimeAsync(19999)
      expect(settled).toBe(false)
      expect(calls).not.toContain('complete')
      await jest.advanceTimersByTimeAsync(1)
      expect(await result).toMatchObject({ message: 'Upload observation failed' })
      expect(calls.filter(call => call === phase).length).toBe(stall === 'auth' ? 0 : 1)
      expect(calls).not.toContain('complete')
      if (phase === 'begin') expect(mockUpload).not.toHaveBeenCalled()
      reject(new Error('late private rejection'))
      await Promise.resolve()
      expect(jest.getTimerCount()).toBe(0)
    }
  } finally { jest.useRealTimers() }
})

it('interrupts a begin fetch that ignores cancellation without dispatching PUT', async () => {
  const caller = new AbortController()
  let started!: () => void
  const waiting = new Promise<void>(resolve => { started = resolve })
  const calls = serveUpload({ begin: () => { started(); return new Promise(() => {}) } })
  const result = importProjectAudio('project-123', audioFile(), 'same-key', caller.signal).catch(error => error)
  await waiting; caller.abort()
  expect(await result).toMatchObject({ name: 'AbortError' })
  expect(calls).toEqual(['register', 'begin'])
  expect(mockUpload).not.toHaveBeenCalled()
})

it.each(['begin', 'finish'] as const)('requires exact HTTP 200 for %s receipts', async phase => {
  const calls = serveUpload({ [phase]: () => Response.json(phase === 'begin' ? beginReceipt : finishReceipt(), { status: 202 }) })
  await expect(importProjectAudio('project-123', audioFile(), 'same-key')).rejects.toThrow('Upload observation failed')
  expect(calls).not.toContain('complete')
})

it('reports pre-PUT cancellation even for a custom non-AbortError caller reason', async () => {
  const caller = new AbortController()
  const receipt = { ...beginReceipt, get state() { caller.abort(new Error('custom reason')); return 'started' } }
  const calls = serveUpload({ begin: () => ({ ok: true, status: 200, json: async () => receipt }) })
  await expect(importProjectAudio('project-123', audioFile(), 'same-key', caller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(calls).toEqual(['register', 'begin', 'finish'])
  expect(JSON.parse(mockFetch.mock.calls[2][1].body).outcome).toBe('client_cancelled')
})
