import { execFileSync, spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { root, digest } from '../pg17-routines/runtime.mjs'
import { compileModule } from './compile-module.mjs'

const paths = process.argv.slice(2).map(path => resolve(path))
if (!paths.length) throw new Error('Provide passed Chrome results.json paths')
const evidence = join(root, 'docs/research/evidence/2026-11-07-g1-chrome', `audio-${Date.now()}-${randomUUID()}`)
await mkdir(evidence, { recursive: true })
const report = { status: 'running', inputs: [], checks: [],
  boundary: 'Synthetic alternating tone recorded in real time through native Chrome getUserMedia/MediaRecorder. Byte identity, full decode, duration and signal continuity; no human speech intelligibility or physical microphone qualification.' }
const assert = (condition, label) => { if (!condition) throw new Error(label) }
const scratch = await mkdtemp('/tmp/saga-g1-audio-')
try {
  report.sources = {}
  const { closeWebmEnvelope } = await compileModule('lib/server/recording-webm-envelope.ts',scratch,async path=>{
    const bytes=await readFile(join(root,path));report.sources[path]=digest(bytes);return bytes.toString()
  })
  for (const path of paths) {
    const jsonBytes = await readFile(path), input = JSON.parse(jsonBytes), directory = dirname(path)
    assert(input.status === 'passed' && input.channel === 'chrome', 'Expected a passed Chrome source')
    assert(input.sourceDrift.length === 0 && input.cleanup.errors.length === 0, 'Source/cleanup uncertainty')
    const files = new Map()
    for (const object of input.savedObjects) {
      assert(/^[a-z0-9.-]+$/.test(object.filename), 'Unsafe object filename')
      const bytes = await readFile(join(directory, object.filename))
      assert(bytes.length === object.byteSize && digest(bytes) === object.sha256, 'Saved object integrity')
      files.set(object.key, bytes)
    }
    const chunks = input.savedObjects.filter(object => object.key.startsWith('audio-recordings/')).sort((a, b) => Number(a.key.split('/').at(-1)) - Number(b.key.split('/').at(-1)))
    assert(chunks.length === input.localRecording.count, 'Every native chunk retained')
    chunks.forEach((object, index) => assert(Number(object.key.split('/').at(-1)) === index, 'Contiguous chunk indices'))
    const candidate = input.savedObjects.filter(object => object.key.startsWith('recording-candidates/'))
    assert(candidate.length === 1, 'Exactly one published output')
    const joined = Buffer.concat(chunks.map(object => files.get(object.key)))
    assert(digest(joined) === candidate[0].sha256, 'Published original must equal every captured chunk in order')
    const envelope=closeWebmEnvelope(joined)
    let decodingPath=join(directory,candidate[0].filename)
    if(envelope){decodingPath=join(scratch,'decode.webm');await writeFile(decodingPath,envelope.bytes)}
    const decoded = spawnSync('/usr/local/bin/ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror', '-err_detect', 'explode',
      '-f', 'matroska', '-i', decodingPath, '-map', '0', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1'], { timeout: 60000, maxBuffer: 128 * 1024 * 1024 })
    assert(!decoded.error && decoded.status === 0 && decoded.stderr.length === 0, 'Every saved audio block must decode without diagnostics after bounded envelope closure')
    const duration = decoded.stdout.length / 16000
    const expectedSeconds=input.interruptions?Math.floor(input.requestedSeconds/60)*60:input.requestedSeconds
    assert(Math.abs(duration - expectedSeconds) <= 5, 'Persisted capture range and decoded duration agree')
    const rms = [], silence = []
    for (let second = 0; second < Math.floor(duration); second++) {
      let power = 0
      for (let sample = 0; sample < 8000; sample++) power += (decoded.stdout.readInt16LE((second * 8000 + sample) * 2) / 32768) ** 2
      const level = Math.sqrt(power / 8000); rms.push(level)
      if (level < 0.001) silence.push(second)
    }
    assert(silence.length === 0, 'No silent one-second gaps in the continuous synthetic tone')
    // Preserve the actual failure that distinguishes an interrupted prefix
    // from a complete recording. A successful decoder exit alone is insufficient.
    const prefix = spawnSync('/usr/local/bin/ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror', '-err_detect', 'explode',
      '-f', 'matroska', '-i', join(directory, chunks[0].filename), '-map', '0', '-f', 'null', '-'], { timeout: 30000 })
    report.inputs.push({ path, resultSha256: digest(jsonBytes), requestedSeconds: input.requestedSeconds, elapsedRecordingMs: input.elapsedRecordingMs,
      chunkCount: chunks.length, totalBytes: joined.length, originalSha256: digest(joined), durationSeconds: duration,
      interrupted:input.interruptions,expectedPersistedSeconds:expectedSeconds,
      envelope:envelope?{bytes:envelope.bytes.length,sha256:digest(envelope.bytes),removedContainerHeaderBytes:envelope.removedContainerHeaderBytes,audioBlocks:envelope.audioBlocks}:null,
      decodedPcmSha256: digest(decoded.stdout), measuredSeconds: rms.length, minSecondRms: Math.min(...rms), maxSecondRms: Math.max(...rms), silentSeconds: silence,
      prefixDiagnostic: { exitCode: prefix.status, sourceSha256: chunks[0].sha256, diagnostics: prefix.stderr.toString().replaceAll(directory, '<evidence>'),
        rawDecoderAccepts: prefix.status === 0 && prefix.stderr.length === 0 } })
  }
  report.ffmpeg = execFileSync('/usr/local/bin/ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0]
  report.sourceSha256 = digest(await readFile(new URL(import.meta.url)))
  report.checks = ['all saved object hashes', 'contiguous chunks equal published bytes', 'strict FFmpeg decode after bounded envelope closure', 'persisted range duration within five seconds', 'no one-second tone gaps']
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1 }
finally { await rm(scratch,{recursive:true,force:true}) }
await writeFile(join(evidence, 'results.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ evidence, ...report }, null, 2))
