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
  mockToken.mockResolvedValue('synthetic-user-token')
  mockUpload.mockResolvedValue({ data: { path: asset.object_key }, error: null })
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
    .mockResolvedValueOnce(Response.json({ asset: { ...asset, state: 'verifying' } }, { status: 202 }))
  const file = new File(['audio'], 'family.webm', { type: 'audio/webm' })
  await expect(importProjectAudio('project-123', file, 'upload-key')).resolves.toEqual({ id: asset.id, state: 'verifying' })
  expect(mockBucket).toHaveBeenCalledWith('audio-recordings')
  expect(mockUpload).toHaveBeenCalledWith(asset.object_key, 'synthetic-upload-token', file, { contentType: 'audio/webm' })
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ projectId: 'project-123', idempotencyKey: 'upload-key', expectedBytes: 5 })
  expect(mockFetch.mock.calls[1][0]).toBe('/api/media/assets/asset-123/complete')
})

it('does not reupload or downgrade a verified idempotent replay', async () => {
  mockFetch.mockResolvedValue(Response.json({ asset: { ...asset, state: 'ready' } }))
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .resolves.toEqual({ id: asset.id, state: 'ready' })
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
    .mockResolvedValueOnce(Response.json({ asset: { ...asset, state: 'verifying' } }, { status: 202 }))
  mockUpload.mockResolvedValueOnce({ error })
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .resolves.toEqual({ id: asset.id, state: 'verifying' })
  expect(mockFetch.mock.calls[1][0]).toBe('/api/media/assets/asset-123/complete')
  expect(mockUpload.mock.calls[0][3]).not.toHaveProperty('upsert', true)
})

it.each(['Invalid key', 'Invalid Compact JWS', 'Unexpected request'])('does not reconcile an unrelated 400: %s', async message => {
  mockFetch.mockResolvedValueOnce(Response.json({ asset, upload: { token: 'synthetic' } }))
  mockUpload.mockResolvedValueOnce({ error: { status: 400, statusCode: '400', message } })
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .rejects.toThrow('Audio upload failed')
  expect(mockFetch).toHaveBeenCalledTimes(1)
})

it('does not upload to a mismatched project target', async () => {
  mockFetch.mockResolvedValue(Response.json({ asset: { ...asset, project_id: 'other-family' }, upload: { token: 'bad' } }))
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .rejects.toThrow('Invalid upload response')
  expect(mockUpload).not.toHaveBeenCalled()
})

it('never reports success when upload or verification fails', async () => {
  mockFetch.mockResolvedValueOnce(Response.json({ asset, upload: { token: 'synthetic' } }))
  mockUpload.mockResolvedValueOnce({ error: { message: 'private storage diagnostic' } })
  await expect(importProjectAudio('project-123', new File(['audio'], 'family.webm', { type: 'audio/webm' }), 'upload-key'))
    .rejects.toThrow('Audio upload failed')
  expect(mockFetch).toHaveBeenCalledTimes(1)
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
