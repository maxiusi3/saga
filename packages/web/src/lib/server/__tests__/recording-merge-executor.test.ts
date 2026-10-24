/** @jest-environment node */
import { createHash } from 'node:crypto'
import fileSystem from 'node:fs/promises'
import { mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildRecordingMergeTaskInput, type RecordingMergeChunk } from '../recording-merge'
import { withVerifiedRecordingMerge } from '../recording-merge-executor'

const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')
let tempRoot: string
beforeEach(async () => { tempRoot = await mkdtemp(join(tmpdir(), 'saga-merge-test-')) })
afterEach(async () => { await rm(tempRoot, { recursive: true, force: true }) })

function fixture() {
  const bodies = [Buffer.from('first'), Buffer.from('second')]
  const chunks: RecordingMergeChunk[] = bodies.map((bytes, index) => ({
    index, chunkId: `chunk-${index}`, bucket: 'audio-recordings',
    objectKey: `projects/p1/sessions/s1/${index}`, byteSize: bytes.length, sha256: hash(bytes),
  }))
  const input = buildRecordingMergeTaskInput({ projectId: 'p1', sessionId: 's1', assetId: 'a1', inputVersion: 1,
    processorVersion: 'v1', parameterVersion: 'v1', mimeType: 'audio/webm', chunks: chunks.reverse() })
  const dependencies = {
    tempRoot, maxInputBytes: 100,
    readChunk: async (chunk: RecordingMergeChunk) => (async function* () { yield bodies[chunk.index] })(),
    decodeAudio: async (filePath: string) => {
      expect((await readFile(filePath)).toString()).toBe('firstsecond')
      return { durationMs: 125 }
    },
  }
  return { input, dependencies, bodies }
}

it('streams numeric chunk order into the exact original and cleans after consumption', async () => {
  const { input, dependencies } = fixture()
  input.chunks.reverse()
  let outputPath = ''
  const result = await withVerifiedRecordingMerge(input, dependencies, async artifact => {
    outputPath = artifact.filePath
    expect((await readFile(outputPath)).toString()).toBe('firstsecond')
    expect(artifact.completion).toMatchObject({ projectId: 'p1', sessionId: 's1', assetId: 'a1', decoded: true,
      durationMs: 125, outputByteSize: 11, outputSha256: hash(Buffer.from('firstsecond')) })
    return 'consumed'
  })
  expect(result).toBe('consumed')
  await expect(readFile(outputPath)).rejects.toThrow()
  expect(await readdir(tempRoot)).toEqual([])
})

it.each(['short', 'long', 'hash', 'missing', 'stream failure'] as const)('rejects %s source and cleans without consuming', async mode => {
  const { input, dependencies, bodies } = fixture()
  let consumed = false
  let closed = false
  dependencies.readChunk = async () => (async function* () {
    try {
      if (mode === 'missing') throw new Error('missing')
      if (mode === 'stream failure') { yield bodies[0].subarray(0, 1); throw new Error('read failure') }
      yield mode === 'short' ? Buffer.from('firs') : mode === 'long' ? Buffer.from('first extra') : Buffer.from('wrong')
    } finally { closed = true }
  })()
  await expect(withVerifiedRecordingMerge(input, dependencies, async () => { consumed = true })).rejects.toThrow()
  expect(consumed).toBe(false)
  expect(closed).toBe(true)
  expect(await readdir(tempRoot)).toEqual([])
})

it.each(['read failure', 'read and cleanup failure', 'oversized chunk'] as const)('closes an owned source exactly once after %s', async mode => {
  const { input, dependencies, bodies } = fixture()
  const sourcePath = join(tempRoot, 'source')
  await writeFile(sourcePath, bodies[0])
  const handle = await open(sourcePath, 'r')
  const readError = new Error('source read failed')
  let returns = 0
  let consumed = false
  const source: AsyncIterable<Uint8Array> = {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (mode === 'oversized chunk') return { done: false, value: Buffer.alloc(bodies[0].length + 1) }
          throw readError
        },
        async return() {
          returns += 1
          await handle.close()
          if (mode === 'read and cleanup failure') throw new Error('source cleanup failed')
          return { done: true, value: undefined }
        },
      }
    },
  }
  try {
    const result = withVerifiedRecordingMerge(input, { ...dependencies, readChunk: async () => source }, async () => { consumed = true })
    if (mode === 'oversized chunk') await expect(result).rejects.toThrow(/byte size exceeds/)
    else await expect(result).rejects.toBe(readError)
    expect(handle.fd).toBe(-1)
    expect(returns).toBe(1)
    expect(consumed).toBe(false)
    expect(await readdir(tempRoot)).toEqual(['source'])
    expect(await readFile(sourcePath)).toEqual(bodies[0])
  } finally {
    await handle.close()
  }
})

it.each(['total', 'key', 'job type', 'gap', 'limit', 'unsafe limit'] as const)('rejects invalid %s before opening a source', async mode => {
  const { input, dependencies } = fixture()
  if (mode === 'total') input.totalInputBytes = 1
  if (mode === 'key') input.idempotencyKey = 'forged'
  if (mode === 'job type') Object.assign(input, { jobType: 'other' })
  if (mode === 'gap') input.chunks[1].index = 2
  if (mode === 'limit') dependencies.maxInputBytes = 10
  if (mode === 'unsafe limit') dependencies.maxInputBytes = Infinity
  let opened = false
  dependencies.readChunk = async () => { opened = true; throw new Error('should not read') }
  await expect(withVerifiedRecordingMerge(input, dependencies, async () => undefined)).rejects.toThrow()
  expect(opened).toBe(false)
  expect(await readdir(tempRoot)).toEqual([])
})

it('rejects unsafe accumulated chunk size before reading', async () => {
  const { input, dependencies } = fixture()
  input.chunks.forEach(chunk => { chunk.byteSize = Number.MAX_SAFE_INTEGER })
  const huge = buildRecordingMergeTaskInput(input)
  let opened = false
  dependencies.maxInputBytes = Number.MAX_SAFE_INTEGER
  dependencies.readChunk = async () => { opened = true; throw new Error('should not read') }
  await expect(withVerifiedRecordingMerge(huge, dependencies, async () => undefined)).rejects.toThrow()
  expect(opened).toBe(false)
})

it('snapshots caller and adapter-owned metadata across asynchronous reads', async () => {
  const { input, dependencies } = fixture()
  const read = dependencies.readChunk
  dependencies.readChunk = async chunk => {
    const bytes = await read(chunk)
    input.assetId = 'other-asset'
    input.chunks[0].sha256 = '0'.repeat(64)
    chunk.sha256 = 'f'.repeat(64)
    return bytes
  }
  await withVerifiedRecordingMerge(input, dependencies, async artifact => {
    expect(artifact.completion.assetId).toBe('a1')
    expect(artifact.completion.chunks[0].sha256).toBe(hash(Buffer.from('first')))
  })
})

it.each(['decode', 'duration', 'consumer'] as const)('cleans after %s failure', async mode => {
  const { input, dependencies } = fixture()
  if (mode === 'decode') dependencies.decodeAudio = async () => { throw new Error('decode failed') }
  if (mode === 'duration') dependencies.decodeAudio = async () => ({ durationMs: 0 })
  let consumed = false
  await expect(withVerifiedRecordingMerge(input, dependencies, async () => {
    consumed = true
    throw new Error('consumer failed')
  })).rejects.toThrow()
  expect(consumed).toBe(mode === 'consumer')
  expect(await readdir(tempRoot)).toEqual([])
})

it('rejects an already aborted merge before creating files or opening a source', async () => {
  const { input, dependencies } = fixture()
  const controller = new AbortController()
  controller.abort()
  const readChunk = jest.fn(dependencies.readChunk)
  const decodeAudio = jest.fn(dependencies.decodeAudio)
  const consume = jest.fn(async () => 'consumed')
  await expect(withVerifiedRecordingMerge(input, {
    ...dependencies, signal: controller.signal, readChunk, decodeAudio,
  }, consume)).rejects.toMatchObject({ name: 'AbortError' })
  expect(readChunk).not.toHaveBeenCalled()
  expect(decodeAudio).not.toHaveBeenCalled()
  expect(consume).not.toHaveBeenCalled()
  expect(await readdir(tempRoot)).toEqual([])
})

it('passes the same live signal to every reader and the decoder', async () => {
  const { input, dependencies } = fixture()
  const controller = new AbortController()
  const readSignals: Array<AbortSignal | undefined> = []
  let decoderSignal: AbortSignal | undefined
  await withVerifiedRecordingMerge(input, {
    ...dependencies,
    signal: controller.signal,
    readChunk: async (chunk, signal) => {
      readSignals.push(signal)
      return dependencies.readChunk(chunk)
    },
    decodeAudio: async (filePath, _mimeType, signal) => {
      decoderSignal = signal
      return dependencies.decodeAudio(filePath)
    },
  }, async artifact => {
    expect((await readFile(artifact.filePath)).toString()).toBe('firstsecond')
  })
  expect(readSignals.map(signal => signal === controller.signal)).toEqual([true, true])
  expect(decoderSignal === controller.signal).toBe(true)
})

it.each(['opening source', 'reading frame'] as const)('closes owned source and output after cancellation while %s', async phase => {
  const { input, dependencies, bodies } = fixture()
  const controller = new AbortController()
  const reason = new Error('recording job lost its lease')
  const sourcePath = join(tempRoot, 'source')
  await writeFile(sourcePath, bodies[0])
  const handle = await open(sourcePath, 'r')
  let returns = 0
  let reads = 0
  let observedSignal: AbortSignal | undefined
  const source: AsyncIterable<Uint8Array> = {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          reads += 1
          if (reads > 1) return { done: true, value: undefined }
          const bytes = await handle.readFile()
          if (phase === 'reading frame') controller.abort(reason)
          return { done: false, value: bytes }
        },
        async return() {
          returns += 1
          await handle.close()
          return { done: true, value: undefined }
        },
      }
    },
  }
  const opened = jest.spyOn(fileSystem, 'open')
  const decodeAudio = jest.fn(dependencies.decodeAudio)
  const consume = jest.fn(async () => 'consumed')
  try {
    await expect(withVerifiedRecordingMerge(input, {
      ...dependencies, signal: controller.signal, decodeAudio,
      readChunk: async (chunk, signal) => {
        observedSignal = signal
        if (chunk.index > 0) return dependencies.readChunk(chunk)
        if (phase === 'opening source') controller.abort(reason)
        return source
      },
    }, consume)).rejects.toBe(reason)
    expect(observedSignal).toBe(controller.signal)
    expect(reads).toBe(phase === 'opening source' ? 0 : 1)
    expect(returns).toBe(1)
    expect(handle.fd).toBe(-1)
    expect(opened).toHaveBeenCalledTimes(1)
    expect((await opened.mock.results[0].value).fd).toBe(-1)
    expect(decodeAudio).not.toHaveBeenCalled()
    expect(consume).not.toHaveBeenCalled()
    expect(await readdir(tempRoot)).toEqual(['source'])
  } finally {
    opened.mockRestore()
    await handle.close()
  }
})

it('does not consume when cancellation arrives while decoding is pending', async () => {
  const { input, dependencies } = fixture()
  const controller = new AbortController()
  const reason = new Error('recording job cancelled')
  let finishDecode!: (result: { durationMs: number }) => void
  const decoded = new Promise<{ durationMs: number }>(resolve => { finishDecode = resolve })
  let markStarted!: () => void
  const started = new Promise<void>(resolve => { markStarted = resolve })
  let decoderSignal: AbortSignal | undefined
  const consume = jest.fn(async () => 'consumed')
  const merging = withVerifiedRecordingMerge(input, {
    ...dependencies, signal: controller.signal,
    decodeAudio: async (_filePath, _mimeType, signal) => {
      decoderSignal = signal
      markStarted()
      return decoded
    },
  }, consume)
  const rejection = expect(merging).rejects.toBe(reason)
  await started
  controller.abort(reason)
  // An injected Promise may ignore abort. The executor checks again when it settles.
  finishDecode({ durationMs: 125 })
  await rejection
  expect(decoderSignal).toBe(controller.signal)
  expect(consume).not.toHaveBeenCalled()
  expect(await readdir(tempRoot)).toEqual([])
})

it('rejects cancellation from the decoder before entering artifact consumption', async () => {
  const { input, dependencies } = fixture()
  const controller = new AbortController()
  const consume = jest.fn(async () => 'consumed')
  await expect(withVerifiedRecordingMerge(input, {
    ...dependencies, signal: controller.signal,
    decodeAudio: async () => {
      controller.abort()
      return { durationMs: 125 }
    },
  }, consume)).rejects.toMatchObject({ name: 'AbortError' })
  expect(consume).not.toHaveBeenCalled()
  expect(await readdir(tempRoot)).toEqual([])
})

it('does not report success when cancellation arrives during artifact consumption', async () => {
  const { input, dependencies } = fixture()
  const controller = new AbortController()
  await expect(withVerifiedRecordingMerge(input, {
    ...dependencies, signal: controller.signal,
  }, async artifact => {
    expect((await readFile(artifact.filePath)).toString()).toBe('firstsecond')
    controller.abort()
    return 'consumed'
  })).rejects.toMatchObject({ name: 'AbortError' })
  expect(await readdir(tempRoot)).toEqual([])
})

it.each([
  ['short', 'recording_source_size_mismatch'],
  ['long', 'recording_source_size_mismatch'],
  ['hash', 'recording_source_hash_mismatch'],
])('classifies %s integrity failure after cleaning local work', async (mode, code) => {
  const { input, dependencies } = fixture()
  dependencies.readChunk = async () => (async function* () {
    yield Buffer.from(mode === 'short' ? 'firs' : mode === 'long' ? 'first extra' : 'wrong')
  })()
  await expect(withVerifiedRecordingMerge(input, dependencies, async () => 'not consumed')).rejects.toMatchObject({
    name: 'RecordingProcessingError', code, disposition: 'permanent',
  })
  expect(await readdir(tempRoot)).toEqual([])
})

it('does not preserve known failure identity when iterator cleanup fails', async () => {
  const { input, dependencies } = fixture()
  const source: AsyncIterable<Uint8Array> = { [Symbol.asyncIterator]: () => ({
    next: async () => ({ done: false, value: Buffer.from('too many bytes') }),
    return: async () => { throw new Error('cleanup failed') },
  }) }
  const outcome = withVerifiedRecordingMerge(input, { ...dependencies, readChunk: async () => source }, async () => 'not consumed')
  await expect(outcome).rejects.toThrow('cleanup failed')
  expect(await readdir(tempRoot)).toEqual([])
})
