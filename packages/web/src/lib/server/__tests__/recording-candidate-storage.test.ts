/** @jest-environment node */
import { createHash } from 'node:crypto'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { uploadAndVerifyRecordingCandidate } from '../recording-candidate-storage'
import type { RecordingOutputCandidate } from '../recording-output-candidate'
import type { VerifiedRecordingArtifact } from '../recording-merge-executor'

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const uuid = (n: string) => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`
let directory: string
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'saga-candidate-storage-test-')) })
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

async function fixture() {
  const bytes = Buffer.from('synthetic verified audio bytes')
  const filePath = join(directory, 'original.audio'); await writeFile(filePath, bytes)
  const artifact: VerifiedRecordingArtifact = { filePath, mimeType: 'audio/webm', completion: {
    projectId: uuid('2'), assetId: uuid('3'), sessionId: uuid('4'), decoded: true, durationMs: 2000,
    outputByteSize: bytes.length, outputSha256: hash(bytes), chunks: [] } }
  const candidate: RecordingOutputCandidate = { schemaVersion: 1, candidateId: uuid('5'), jobId: uuid('1'), projectId: uuid('2'),
    assetId: uuid('3'), sessionId: uuid('4'), manifestSha256: 'a'.repeat(64), workerId: 'worker', attempt: 1, state: 'reserved',
    bucket: 'recording-candidates', objectKey: `jobs/${uuid('1')}/attempts/1/${uuid('5')}`, byteSize: bytes.length,
    sha256: hash(bytes), mimeType: 'audio/webm', durationMs: 2000, createdAt: new Date().toISOString(), preparedAt: null, canClearLocalDrafts: false }
  let uploaded = Buffer.alloc(0)
  const fetcher = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const parts: Buffer[] = []
      for await (const part of init.body as unknown as AsyncIterable<Uint8Array>) parts.push(Buffer.from(part))
      uploaded = Buffer.concat(parts)
      return new Response('{}', { status: 200 })
    }
    return new Response(uploaded, { headers: { 'content-length': String(uploaded.length) } })
  })
  const revalidate = jest.fn(async (_signal?: AbortSignal) => {})
  const options = { storageUrl: 'https://storage.invalid', serviceRoleKey: 'synthetic-key', fetch: fetcher as typeof fetch,
    ioTimeoutMs: 1000, revalidate }
  return { bytes, filePath, artifact, candidate, fetcher, options, revalidate }
}

it('streams only the registered private destination, disables overwrite, reads back all bytes and keeps the local source', async () => {
  const f = await fixture()
  await expect(uploadAndVerifyRecordingCandidate(f.artifact, f.candidate, f.options)).resolves.toBeUndefined()
  expect(f.fetcher).toHaveBeenCalledTimes(2)
  for (const [url, init] of f.fetcher.mock.calls) {
    expect(url).toBe(`https://storage.invalid/storage/v1/object/recording-candidates/${f.candidate.objectKey}`)
    expect(init).toMatchObject({ redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal) })
  }
  expect(f.fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', duplex: 'half',
    headers: { 'x-upsert': 'false', 'content-type': 'audio/webm', 'content-length': String(f.bytes.length), Authorization: 'Bearer synthetic-key' } })
  expect(f.revalidate.mock.calls.length).toBeGreaterThanOrEqual(3)
  expect(await readFile(f.filePath)).toEqual(f.bytes)
})

it('finishes an actual HTTP upload with an unread acknowledgement before aborting its scope', async () => {
  const f = await fixture(); const methods: string[] = []; let uploaded = Buffer.alloc(0)
  const server = createServer(async (request, response) => {
    methods.push(request.method!)
    if (request.method === 'POST') {
      const parts: Buffer[] = []
      for await (const part of request) parts.push(Buffer.from(part))
      uploaded = Buffer.concat(parts)
      response.writeHead(201, { 'content-type': 'application/json' }); response.end('{"Key":"ignored"}')
    } else { response.writeHead(200, { 'content-length': uploaded.length }); response.end(uploaded) }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const port = (server.address() as AddressInfo).port
    const fetcher: typeof fetch = (url, init) => fetch(`http://127.0.0.1:${port}${new URL(String(url)).pathname}`, init)
    await expect(uploadAndVerifyRecordingCandidate(f.artifact, f.candidate, { ...f.options, fetch: fetcher })).resolves.toBeUndefined()
    expect(methods).toEqual(['POST', 'GET']); expect(uploaded).toEqual(f.bytes)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

it.each(['upload error', 'lost upload response', 'conflict', 'short', 'long', 'hash', 'partial', 'redirect', 'encoding', 'length', 'missing body', 'stalled body'])
('rejects %s without retry, deletion, or false verification', async mode => {
  const f = await fixture(); const original = f.fetcher.getMockImplementation()!
  const cancel = jest.fn()
  f.fetcher.mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      const response = await original(url, init)
      if (mode === 'lost upload response') throw new Error('SECRET remote committed')
      if (mode === 'upload error' || mode === 'conflict') return new Response('SECRET', { status: mode === 'conflict' ? 409 : 500 })
      return response
    }
    if (mode === 'short') return new Response(f.bytes.subarray(1))
    if (mode === 'long') return new Response(Buffer.concat([f.bytes, f.bytes]))
    if (mode === 'hash') return new Response(Buffer.alloc(f.bytes.length))
    if (mode === 'partial') return new Response(f.bytes, { status: 206 })
    if (mode === 'redirect') return new Response(null, { status: 302 })
    if (mode === 'encoding') return new Response(f.bytes, { headers: { 'content-encoding': 'gzip' } })
    if (mode === 'length') return new Response(f.bytes, { headers: { 'content-length': '01' } })
    if (mode === 'missing body') return new Response(null)
    return new Response(new ReadableStream({ cancel }))
  })
  await expect(uploadAndVerifyRecordingCandidate(f.artifact, f.candidate, { ...f.options, ioTimeoutMs: 40 }))
    .rejects.toThrow('recording_candidate_storage_unavailable')
  expect(f.fetcher).toHaveBeenCalledTimes(['upload error', 'lost upload response', 'conflict'].includes(mode) ? 1 : 2)
  expect(f.fetcher.mock.calls.every(([, init]) => ['POST', 'GET'].includes(init!.method!))).toBe(true)
  if (mode === 'stalled body') expect(cancel).toHaveBeenCalledTimes(1)
})

it.each(['bucket', 'objectKey', 'sha256', 'byteSize', 'mimeType', 'assetId', 'state'])
('refuses mismatched %s before any network request', async key => {
  const f = await fixture()
  await expect(uploadAndVerifyRecordingCandidate(f.artifact, { ...f.candidate, [key]: 'bad' }, f.options)).rejects.toThrow()
  expect(f.fetcher).not.toHaveBeenCalled()
})

it.each(['before', 'after upload', 'after readback'])('stops revoked work %s', async phase => {
  const f = await fixture()
  f.revalidate.mockImplementation(async () => {
    if ((phase === 'before') || (phase === 'after upload' && f.fetcher.mock.calls.length >= 1) ||
      (phase === 'after readback' && f.fetcher.mock.calls.length >= 2)) throw new Error('SECRET revoked')
  })
  await expect(uploadAndVerifyRecordingCandidate(f.artifact, f.candidate, f.options)).rejects.toThrow('recording_candidate_storage_unavailable')
  expect(f.fetcher).toHaveBeenCalledTimes(phase === 'before' ? 0 : phase === 'after upload' ? 1 : 2)
})

it('cancels a late response body after a non-cooperative timeout', async () => {
  const f = await fixture(); let release!: (response: Response) => void; const cancel = jest.fn()
  f.fetcher.mockImplementation(async () => new Promise<Response>(resolve => { release = resolve }))
  await expect(uploadAndVerifyRecordingCandidate(f.artifact, f.candidate, { ...f.options, ioTimeoutMs: 20 })).rejects.toThrow()
  release(new Response(new ReadableStream({ cancel })))
  await new Promise(resolve => setTimeout(resolve, 5))
  expect(cancel).toHaveBeenCalledTimes(1)
})

it('aborts a stalled upload and closes the request stream on caller cancellation', async () => {
  const f = await fixture(); const caller = new AbortController()
  let body: { destroyed: boolean } | undefined
  f.fetcher.mockImplementation(async (_url, init) => { body = init?.body as unknown as typeof body; caller.abort(); return new Promise<Response>(() => {}) })
  await expect(uploadAndVerifyRecordingCandidate(f.artifact, f.candidate, { ...f.options, signal: caller.signal })).rejects.toThrow()
  expect(body?.destroyed).toBe(true)
  expect(f.fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
})

it('does not verify an altered local file after reservation', async () => {
  const f = await fixture(); await writeFile(f.filePath, Buffer.alloc(f.bytes.length))
  await expect(uploadAndVerifyRecordingCandidate(f.artifact, f.candidate, f.options)).rejects.toThrow()
  expect(f.fetcher.mock.calls.every(([, init]) => init?.method === 'POST')).toBe(true)
})
