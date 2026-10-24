/** @jest-environment node */
import childProcess from 'node:child_process'
import { getEventListeners } from 'node:events'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFfmpegRecordingDecoder } from '../recording-audio-decoder'

jest.setTimeout(15000)

let directory: string
let audioPath: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'saga-decoder-test-'))
  audioPath = join(directory, 'audio; literal $(name).webm')
  await writeFile(audioPath, 'synthetic bytes')
})
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

async function executable(body: string) {
  const file = join(directory, 'decoder')
  await writeFile(file, `#!${process.execPath}\n${body}\n`, { mode: 0o700 })
  return file
}

it('passes literal file paths without a shell and measures complete PCM output', async () => {
  const bin = await executable(`
    const fs = require('node:fs');
    const args = process.argv.slice(2);
    const input = args[args.indexOf('-i') + 1];
    if (fs.readFileSync(input, 'utf8') !== 'synthetic bytes') process.exit(3);
    process.stdout.write(Buffer.alloc(3200));
  `)
  const decode = createFfmpegRecordingDecoder({ executable: bin, timeoutMs: 10000, maxDurationMs: 1000 })
  await expect(decode(audioPath, 'audio/webm;codecs=opus')).resolves.toEqual({ durationMs: 100 })
})

it.each(['audio/webm', 'audio/mp4', 'audio/ogg'])('restricts %s to the matching demuxer and local protocols', async mime => {
  const bin = await executable('')
  // A policy-aware child exercises the actual spawn arguments.
  await writeFile(bin, `#!${process.execPath}\n
    const args = process.argv.slice(2);
    const value = name => args[args.indexOf(name) + 1];
    const expected = ${JSON.stringify(mime === 'audio/webm' ? 'matroska' : mime === 'audio/mp4' ? 'mov' : 'ogg')};
    if (value('-f') !== expected || value('-protocol_whitelist') !== 'file,pipe') process.exit(3);
    if (expected === 'mov' && (value('-enable_drefs') !== '0' || value('-use_absolute_path') !== '0')) process.exit(4);
    process.stdout.write(Buffer.alloc(320));
  `)
  await expect(createFfmpegRecordingDecoder({ executable: bin, timeoutMs: 10000, maxDurationMs: 1000 })(audioPath, mime)).resolves.toEqual({ durationMs: 10 })
})

it.each([
  ['zero samples', '', /sample|empty|duration/i],
  ['partial PCM sample', 'process.stdout.write(Buffer.alloc(3))', /sample|pcm/i],
  ['nonzero exit', 'process.stdout.write(Buffer.alloc(32)); process.exitCode = 2', /decod|exit|ffmpeg/i],
  ['decoder diagnostic', "process.stderr.write('damaged packet'); process.stdout.write(Buffer.alloc(32))", /decod|diagnostic/i],
  ['diagnostic overflow', "process.stderr.write('x'.repeat(40000)); setInterval(() => {}, 1000)", /diagnostic|limit/i],
  ['duration overflow', 'process.stdout.write(Buffer.alloc(64000)); setInterval(() => {}, 1000)', /duration|limit/i],
  ['timeout', 'setInterval(() => {}, 1000)', /timeout|timed out/i],
] as const)('fails closed for %s', async (_label, body, message) => {
  const bin = await executable(body)
  const decode = createFfmpegRecordingDecoder({ executable: bin, timeoutMs: _label === 'timeout' ? 150 : 10000, maxDurationMs: 1000 })
  await expect(decode(audioPath, 'audio/webm')).rejects.toThrow(message)
})

it('awaits child termination before reporting timeout', async () => {
  const bin = await executable('setInterval(() => {}, 1000)')
  // Observe the real spawned PID. It exists even when OS startup is slower than
  // the watchdog; requiring the child to write a file first races that watchdog.
  const spawned = jest.spyOn(childProcess, 'spawn')
  try {
    await expect(createFfmpegRecordingDecoder({ executable: bin, timeoutMs: 150, maxDurationMs: 1000 })(audioPath, 'audio/webm')).rejects.toThrow(/timeout|timed out/i)
    const pid = spawned.mock.results[0].value.pid as number
    expect(pid).toBeGreaterThan(0)
    expect(() => process.kill(pid, 0)).toThrow()
  } finally { spawned.mockRestore() }
})

it('reports an unavailable executable', async () => {
  const decode = createFfmpegRecordingDecoder({ executable: join(directory, 'missing'), timeoutMs: 1000, maxDurationMs: 1000 })
  await expect(decode(audioPath, 'audio/webm')).rejects.toThrow(/unavailable|start|ENOENT/i)
})

it('rejects unsupported MIME before starting the child', async () => {
  const decode = createFfmpegRecordingDecoder({ executable: join(directory, 'missing'), timeoutMs: 1000, maxDurationMs: 1000 })
  await expect(decode(audioPath, 'audio/mpeg')).rejects.toThrow(/mime|support/i)
})

it.each([
  ['audio/mp4;codecs=mp4a.40.2', 'aac'],
  ['audio/ogg; codecs="opus"', 'opus'],
])('accepts browser codec parameters in %s and enforces the decoder', async (mime, codec) => {
  const bin = await executable(`
    const args = process.argv.slice(2);
    const inputArgs = args.slice(0, args.indexOf('-i'));
    if (inputArgs[inputArgs.indexOf('-c:a') + 1] !== ${JSON.stringify(codec)}) process.exit(4);
    process.stdout.write(Buffer.alloc(320));
  `)
  await expect(createFfmpegRecordingDecoder({ executable: bin, timeoutMs: 10000, maxDurationMs: 1000 })(audioPath, mime)).resolves.toEqual({ durationMs: 10 })
})

it.each([0, -1, Infinity, 0.5, Number.MAX_SAFE_INTEGER])('rejects invalid or unsafe process limits %s', value => {
  expect(() => createFfmpegRecordingDecoder({ executable: process.execPath, timeoutMs: value, maxDurationMs: 1000 })).toThrow()
  expect(() => createFfmpegRecordingDecoder({ executable: process.execPath, timeoutMs: 1000, maxDurationMs: value })).toThrow()
})

it('rejects pre-cancellation without spawning a decoder or registering a listener', async () => {
  const bin = await executable('process.stdout.write(Buffer.alloc(320))')
  const controller = new AbortController()
  controller.abort()
  const spawned = jest.spyOn(childProcess, 'spawn')
  try {
    const decode = createFfmpegRecordingDecoder({ executable: bin, timeoutMs: 1000, maxDurationMs: 1000 })
    await expect(decode(audioPath, 'audio/webm', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(spawned).not.toHaveBeenCalled()
    expect(getEventListeners(controller.signal, 'abort')).toEqual([])
  } finally { spawned.mockRestore() }
})

it.each([
  ['PCM output', 0],
  ['process exit', 0],
  ['PCM output', 1500],
] as const)('awaits child close on abort after %s (%i ms readiness delay) and never accepts valid PCM as success', async (phase, readinessDelayMs) => {
  const body = `process.stdout.write(Buffer.alloc(3200)); ${phase === 'PCM output' ? 'setInterval(() => {}, 1000)' : ''}`
  const bin = await executable(readinessDelayMs ? `setTimeout(() => { ${body} }, ${readinessDelayMs})` : body)
  const controller = new AbortController()
  const reason = new Error('worker lease expired')
  const callerListener = () => undefined
  controller.signal.addEventListener('abort', callerListener)
  const spawned = jest.spyOn(childProcess, 'spawn')
  try {
    // Allow the real child to reach the cancellation phase, including delayed
    // readiness; use the same startup budget as the other child behavior tests.
    const decode = createFfmpegRecordingDecoder({ executable: bin, timeoutMs: 10000, maxDurationMs: 1000 })
    const decoding = decode(audioPath, 'audio/webm', controller.signal)
    const child = spawned.mock.results[0].value as childProcess.ChildProcessWithoutNullStreams
    const listenersWhileDecoding = getEventListeners(controller.signal, 'abort').length
    let closed = false
    let pcmBytes = 0
    let exitCode: number | null | undefined
    let exitSignal: NodeJS.Signals | null | undefined
    child.once('close', () => { closed = true })
    child.stdout.on('data', bytes => { pcmBytes += bytes.length })
    if (phase === 'PCM output') child.stdout.once('data', () => controller.abort(reason))
    else child.once('exit', (code, signal) => {
      exitCode = code
      exitSignal = signal
      controller.abort(reason)
    })
    await expect(decoding).rejects.toBe(reason)
    expect(pcmBytes).toBe(3200)
    if (phase === 'process exit') {
      expect(exitCode).toBe(0)
      expect(exitSignal).toBeNull()
    }
    expect(listenersWhileDecoding).toBe(2)
    expect(closed).toBe(true)
    expect(child.pid).toBeGreaterThan(0)
    expect(() => process.kill(child.pid!, 0)).toThrow()
    expect(getEventListeners(controller.signal, 'abort')).toEqual([callerListener])
  } finally { spawned.mockRestore() }
})

it.each(['success', 'invalid PCM', 'unavailable', 'timeout'] as const)('removes its abort listener after %s', async outcome => {
  const bin = outcome === 'unavailable' ? join(directory, 'missing') : await executable(
    outcome === 'success' ? 'process.stdout.write(Buffer.alloc(320))'
      : outcome === 'invalid PCM' ? 'process.stdout.write(Buffer.alloc(3))' : 'setInterval(() => {}, 1000)',
  )
  const controller = new AbortController()
  const decode = createFfmpegRecordingDecoder({ executable: bin, timeoutMs: outcome === 'timeout' ? 150 : 10000, maxDurationMs: 1000 })
  const decoding = decode(audioPath, 'audio/webm', controller.signal)
  const listenersWhileDecoding = getEventListeners(controller.signal, 'abort').length
  if (outcome === 'success') await expect(decoding).resolves.toEqual({ durationMs: 10 })
  else await expect(decoding).rejects.toThrow()
  expect(listenersWhileDecoding).toBe(1)
  expect(getEventListeners(controller.signal, 'abort')).toEqual([])
})

it.each([
  ['empty PCM', '', 'recording_decode_invalid_pcm'],
  ['partial PCM', 'process.stdout.write(Buffer.alloc(3))', 'recording_decode_invalid_pcm'],
  ['duration', 'process.stdout.write(Buffer.alloc(64000)); setInterval(() => {}, 1000)', 'recording_decode_duration_exceeded'],
])('classifies %s as permanent only after child closes', async (_label, body, code) => {
  const bin = await executable(body)
  const spawned = jest.spyOn(childProcess, 'spawn')
  try {
    await expect(createFfmpegRecordingDecoder({ executable: bin, timeoutMs: 10000, maxDurationMs: 1000 })(audioPath, 'audio/webm'))
      .rejects.toMatchObject({ name: 'RecordingProcessingError', code, disposition: 'permanent' })
    expect(() => process.kill(spawned.mock.results[0].value.pid, 0)).toThrow()
  } finally { spawned.mockRestore() }
})

it.each(['unavailable', 'timeout', 'diagnostic overflow'])('keeps uncertain %s failures unclassified', async outcome => {
  const bin = outcome === 'unavailable' ? join(directory, 'missing') : await executable(
    outcome === 'diagnostic overflow' ? "process.stderr.write('x'.repeat(40000)); setInterval(() => {}, 1000)" : 'setInterval(() => {}, 1000)',
  )
  const decode = createFfmpegRecordingDecoder({ executable: bin, timeoutMs: outcome === 'timeout' ? 150 : 10000, maxDurationMs: 1000 })
  const error = await decode(audioPath, 'audio/webm').catch(error => error)
  expect(error).toBeInstanceOf(Error)
  expect(error.name).toBe('Error')
  expect(error.disposition).toBeUndefined()
})

it.each([
  ['loader exit 127', "process.stderr.write('loader dependency unavailable'); process.exitCode = 127"],
  ['resource exit 1', "process.stderr.write('resource allocation failed'); process.exitCode = 1"],
  ['exit 0 with diagnostics', "process.stderr.write('unclassified diagnostic'); process.stdout.write(Buffer.alloc(32))"],
])('keeps %s after successful spawn unclassified until close', async (_label, body) => {
  const bin = await executable(body)
  const controller = new AbortController()
  const spawned = jest.spyOn(childProcess, 'spawn')
  try {
    let settled = false
    const decoding = createFfmpegRecordingDecoder({ executable: bin, timeoutMs: 10000, maxDurationMs: 1000 })(audioPath, 'audio/webm', controller.signal)
      .then(value => { settled = true; return value }, error => { settled = true; return error })
    const child = spawned.mock.results[0].value as childProcess.ChildProcessWithoutNullStreams
    let didSpawn = false
    let closed = false
    let settledAtExit: boolean | undefined
    child.once('spawn', () => { didSpawn = true })
    child.once('exit', () => { settledAtExit = settled })
    child.once('close', () => { closed = true })
    const error = await decoding
    expect(didSpawn).toBe(true)
    expect(settledAtExit).toBe(false)
    expect(closed).toBe(true)
    expect(() => process.kill(child.pid!, 0)).toThrow()
    expect(getEventListeners(controller.signal, 'abort')).toEqual([])
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('Error')
    expect(error.disposition).toBeUndefined()
    expect(error.code).toBeUndefined()
  } finally { spawned.mockRestore() }
})
