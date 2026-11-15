/** @jest-environment node */
import { createHash } from 'node:crypto'
import fileSystem from 'node:fs/promises'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRecordingJobInput } from '../recording-job-input'
import { createFfmpegRecordingDecoder } from '../recording-audio-decoder'
import { buildRecordingMergeTaskInput } from '../recording-merge'
import { verifyRecordingJobInput, withVerifiedRecordingJobInput } from '../recording-job-verifier'

jest.mock('../recording-job-input', () => ({ loadRecordingJobInput: jest.fn() }))
jest.mock('../recording-audio-decoder', () => ({ createFfmpegRecordingDecoder: jest.fn() }))

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
let tempRoot: string
beforeEach(async () => { jest.clearAllMocks(); tempRoot = await mkdtemp(join(tmpdir(), 'saga-job-verifier-')) })
afterEach(async () => { expect(await readdir(tempRoot)).toEqual([]); await rm(tempRoot, { recursive: true }) })

function fixture() {
  const bytes = [Buffer.from('first'), Buffer.from('second')]
  const task = buildRecordingMergeTaskInput({ projectId: 'p1', sessionId: 's1', assetId: 'a1', inputVersion: 1,
    processorVersion: 'ffmpeg-merge-v1', parameterVersion: 'default', mimeType: 'audio/webm',
    chunks: bytes.map((body, index) => ({ index, chunkId: `c${index}`, bucket: 'audio-recordings',
      objectKey: `projects/p1/sessions/s1/${index}`, byteSize: body.length, sha256: hash(body) })) })
  const revalidate = jest.fn(async () => {})
  jest.mocked(loadRecordingJobInput).mockResolvedValue({ task,
    storageObjectKeys: task.chunks.map(chunk => `u1/${chunk.objectKey}`), revalidate })
  const decode = jest.fn(async (file: string) => {
    expect(await readFile(file)).toEqual(Buffer.concat(bytes))
    return { durationMs: 120 }
  })
  jest.mocked(createFfmpegRecordingDecoder).mockReturnValue(decode)
  let index = 0
  const fetcher = jest.fn(async () => new Response(bytes[index++]))
  const options = { admin: {} as Parameters<typeof loadRecordingJobInput>[1]['admin'],
    storageUrl: 'https://project.supabase.co', serviceRoleKey: 'test-service-key',
    ffmpeg: { executable: '/test/ffmpeg', timeoutMs: 1000, maxDurationMs: 10000 },
    tempRoot, fetch: fetcher as typeof fetch, ioTimeoutMs: 1000 }
  return { bytes, task, revalidate, decode, fetcher, options }
}

it('loads only a job ID, streams the physical keys, verifies real bytes and returns no publication permission', async () => {
  const { options, fetcher, revalidate, bytes, decode } = fixture()
  const receipt = await verifyRecordingJobInput('job1', options)
  expect(loadRecordingJobInput).toHaveBeenCalledWith('job1', expect.objectContaining({ admin: options.admin }))
  expect(fetcher).toHaveBeenNthCalledWith(1,
    'https://project.supabase.co/storage/v1/object/audio-recordings/u1/projects/p1/sessions/s1/0',
    expect.objectContaining({ method: 'GET', redirect: 'error', cache: 'no-store',
      headers: { Authorization: 'Bearer test-service-key', apikey: 'test-service-key' }, signal: expect.any(AbortSignal) }))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(decode).toHaveBeenCalledTimes(1)
  expect(revalidate.mock.calls.length).toBeGreaterThanOrEqual(5)
  expect(receipt).toEqual({ status: 'input_verified', jobId: 'job1', canClearLocalDrafts: false,
    completion: expect.objectContaining({ decoded: true, outputByteSize: 11, outputSha256: hash(Buffer.concat(bytes)) }) })
  expect(receipt).not.toHaveProperty('filePath')
})

it('keeps the verified artifact alive only inside the scoped consumer and revalidates on exit', async () => {
  const f = fixture(); let path = ''; let checksAtCallback = 0
  const result = await withVerifiedRecordingJobInput('job1', f.options, async (artifact, context) => {
    path = artifact.filePath
    expect(await readFile(path)).toEqual(Buffer.concat(f.bytes))
    expect(artifact.completion.decoded).toBe(true)
    await context.revalidate()
    checksAtCallback = f.revalidate.mock.calls.length
    return { candidateId: 'opaque' }
  })
  expect(result).toEqual({ candidateId: 'opaque' })
  await expect(readFile(path)).rejects.toThrow()
  expect(f.revalidate.mock.calls.length).toBeGreaterThan(checksAtCallback)
})

it('does not return a consumer result after revocation, and cleans its artifact', async () => {
  const f = fixture(); let consumed = false
  await expect(withVerifiedRecordingJobInput('job1', f.options, async () => {
    consumed = true; f.revalidate.mockRejectedValue(new Error('revoked')); return 'not-published'
  })).rejects.toThrow('recording_input_unavailable')
  expect(consumed).toBe(true)
})

it.each(['missing', 'redirect', 'partial', 'empty body', 'long', 'short', 'hash', 'length header', 'encoding'])
('rejects %s content without decoding or a success receipt', async mode => {
  const { options, fetcher, decode } = fixture()
  const responses: Record<string, () => Response> = {
    missing: () => new Response('not found', { status: 404 }),
    redirect: () => new Response(null, { status: 302, headers: { Location: 'https://elsewhere.invalid' } }),
    partial: () => new Response('first', { status: 206 }),
    'empty body': () => new Response(null),
    long: () => new Response('first too long'), short: () => new Response('firs'), hash: () => new Response('wrong'),
    'length header': () => new Response('first', { headers: { 'content-length': '999' } }),
    encoding: () => new Response('first', { headers: { 'content-encoding': 'gzip' } }),
  }
  fetcher.mockImplementation(async () => responses[mode]())
  await expect(verifyRecordingJobInput('job1', options)).rejects.toThrow()
  expect(decode).not.toHaveBeenCalled()
})

it.each(['before fetch', 'after headers', 'after stream', 'after decode'])('refuses revoked input %s', async phase => {
  const { options, revalidate, fetcher, decode } = fixture()
  let revoked = phase === 'before fetch'
  revalidate.mockImplementation(async () => { if (revoked) throw new Error('recording_input_unavailable') })
  if (phase === 'after headers') fetcher.mockImplementation(async () => { revoked = true; return new Response('first') })
  if (phase === 'after stream') fetcher.mockImplementation(async () => new Response(new ReadableStream({
    pull(controller) { revoked = true; controller.enqueue(Buffer.from('first')); controller.close() },
  })))
  if (phase === 'after decode') decode.mockImplementation(async () => { revoked = true; return { durationMs: 120 } })
  await expect(verifyRecordingJobInput('job1', options)).rejects.toThrow('recording_input_unavailable')
  if (phase === 'before fetch') expect(fetcher).not.toHaveBeenCalled()
  if (phase !== 'after decode') expect(decode).not.toHaveBeenCalled()
})

it('cancels an oversized owned response stream', async () => {
  const { options, fetcher } = fixture()
  const cancel = jest.fn()
  fetcher.mockImplementation(async () => new Response(new ReadableStream({
    start(c) { c.enqueue(Buffer.from('first too long')) }, cancel,
  })))
  await expect(verifyRecordingJobInput('job1', options)).rejects.toThrow()
  expect(cancel).toHaveBeenCalledTimes(1)
})

it.each(['headers', 'body'])('bounds a stalled %s and aborts owned I/O', async phase => {
  const { options, fetcher } = fixture()
  let signal: AbortSignal | undefined
  const cancel = jest.fn()
  options.fetch = jest.fn(async (_url, init) => {
    signal = init?.signal as AbortSignal
    if (phase === 'headers') return await new Promise<Response>(() => {})
    return new Response(new ReadableStream({ cancel }))
  })
  await expect(verifyRecordingJobInput('job1', { ...options, ioTimeoutMs: 25 })).rejects.toThrow()
  expect(signal?.aborted).toBe(true)
  if (phase === 'body') expect(cancel).toHaveBeenCalledTimes(1)
  expect(fetcher).not.toHaveBeenCalled()
})

it('cleans a response that arrives after the request timed out', async () => {
  const { options } = fixture()
  let finish!: (response: Response) => void
  options.fetch = jest.fn(() => new Promise<Response>(resolve => { finish = resolve }))
  await expect(verifyRecordingJobInput('job1', { ...options, ioTimeoutMs: 20 })).rejects.toThrow()
  const cancel = jest.fn()
  finish(new Response(new ReadableStream({ cancel })))
  await new Promise(resolve => setImmediate(resolve))
  expect(cancel).toHaveBeenCalledTimes(1)
})

it.each(['pre', 'headers', 'body', 'decode'])('honors caller cancellation at %s', async phase => {
  const { options, decode } = fixture()
  const controller = new AbortController()
  const abort = () => controller.abort(new Error('caller_cancelled'))
  if (phase === 'pre') abort()
  if (phase === 'headers') options.fetch = jest.fn(async () => { abort(); return new Response('first') })
  if (phase === 'body') options.fetch = jest.fn(async () => new Response(new ReadableStream({
    pull(c) { abort(); c.enqueue(Buffer.from('first')); c.close() },
  })))
  if (phase === 'decode') decode.mockImplementation(async () => { abort(); return { durationMs: 120 } })
  await expect(verifyRecordingJobInput('job1', { ...options, signal: controller.signal })).rejects.toThrow()
  if (phase === 'pre') expect(loadRecordingJobInput).not.toHaveBeenCalled()
})

it.each(['http://project.supabase.co', 'https://user:pass@project.supabase.co', 'https://project.supabase.co/?secret=1',
  'https://project.supabase.co/#fragment', 'https://project.supabase.co/other'])('rejects unsafe configured endpoint %s before reading data', async storageUrl => {
  const { options } = fixture()
  await expect(verifyRecordingJobInput('job1', { ...options, storageUrl })).rejects.toThrow()
  expect(loadRecordingJobInput).not.toHaveBeenCalled()
})

it('does not downgrade decoder failure into verified input', async () => {
  const { options, decode } = fixture()
  decode.mockRejectedValue(new Error('bad audio'))
  await expect(verifyRecordingJobInput('job1', options)).rejects.toThrow()
})

it('revalidates after asynchronous temporary-file cleanup before returning evidence', async () => {
  const { options, revalidate } = fixture()
  const original = fileSystem.rm
  const cleanup = jest.spyOn(fileSystem, 'rm').mockImplementation(async (...args) => {
    await original(...args)
    revalidate.mockRejectedValue(new Error('recording_input_unavailable'))
  })
  try { await expect(verifyRecordingJobInput('job1', options)).rejects.toThrow() }
  finally { cleanup.mockRestore() }
})
