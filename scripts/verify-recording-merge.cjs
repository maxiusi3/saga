// Local-only evidence: synthetic audio, real production merge/decoder modules.
// SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node scripts/verify-recording-merge.cjs
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'docs/research/evidence/2026-10-15-t04-merge')
const report = {
  timestamp: new Date().toISOString(),
  os: `${os.platform()} ${os.release()} ${os.arch()}`,
  limits: 'Local synthetic files and a local chunk reader only. No remote Storage, database, queue, authorization, cloud confirmation, microphone, device interruptions or G1 acceptance. Successful decoding does not prove the recording tail is complete. Runtime is supplied externally, not bundled or qualified for deployment.',
  checks: [], fixtures: [], sourceSha256: {},
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
let scratch

function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name)
  report.checks.push(name)
}

function command(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error(`Local FFmpeg failed: ${result.error?.message ?? result.stderr}`)
  return result.stdout
}

async function main() {
  const executable = process.env.SAGA_FFMPEG_PATH
  if (!executable || !path.isAbsolute(executable)) throw new Error('Set SAGA_FFMPEG_PATH to an absolute standalone FFmpeg executable path')
  report.runtime = {
    version: command(executable, ['-version']).split('\n')[0],
    sha256: digest(await fs.readFile(executable)),
  }
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'saga-merge-evidence-'))
  const tempRoot = path.join(scratch, 'attempts')
  await fs.mkdir(tempRoot)
  for (const name of ['processing-jobs', 'recording-merge', 'recording-merge-executor', 'recording-audio-decoder']) {
    const source = await fs.readFile(path.join(root, `packages/web/src/lib/server/${name}.ts`), 'utf8')
    report.sourceSha256[name] = digest(source)
    const compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText
    await fs.writeFile(path.join(scratch, `${name}.js`), compiled)
  }
  const { buildRecordingMergeTaskInput, verifyRecordingMergeCompletion } = require(path.join(scratch, 'recording-merge.js'))
  const { withVerifiedRecordingMerge } = require(path.join(scratch, 'recording-merge-executor.js'))
  const { createFfmpegRecordingDecoder } = require(path.join(scratch, 'recording-audio-decoder.js'))
  const decodeAudio = createFfmpegRecordingDecoder({ executable, timeoutMs: 10000, maxDurationMs: 5000 })
  const formats = [
    { name: 'webm', mime: 'audio/webm;codecs=opus', args: ['-c:a', 'libopus', '-f', 'webm'] },
    { name: 'mp4', mime: 'audio/mp4', args: ['-c:a', 'aac', '-movflags', '+faststart', '-f', 'mp4'] },
    { name: 'mp4-codec', mime: 'audio/mp4;codecs=mp4a.40.2', args: ['-c:a', 'aac', '-movflags', '+faststart', '-f', 'mp4'] },
    { name: 'fragmented-mp4', mime: 'audio/mp4', args: ['-c:a', 'aac', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4'] },
    { name: 'ogg', mime: 'audio/ogg', args: ['-c:a', 'libopus', '-f', 'ogg'] },
  ]

  function taskFor(bytes, mimeType) {
    const stored = new Map()
    const chunks = []
    const width = Math.ceil(bytes.length / 13)
    for (let offset = 0, index = 0; offset < bytes.length; offset += width, index++) {
      const body = Buffer.from(bytes.subarray(offset, offset + width))
      const chunk = {
        index, chunkId: `chunk-${index}`, bucket: 'audio-recordings',
        objectKey: `projects/synthetic-project/sessions/synthetic-session/${index}`,
        byteSize: body.length, sha256: digest(body),
      }
      chunks.push(chunk)
      stored.set(chunk.objectKey, body)
    }
    const input = buildRecordingMergeTaskInput({
      projectId: 'synthetic-project', sessionId: 'synthetic-session', assetId: 'synthetic-asset',
      inputVersion: 1, processorVersion: 'local-merge-v1', parameterVersion: 'local-limits-v1',
      mimeType, chunks: chunks.reverse(),
    })
    const readChunk = async chunk => {
      const body = stored.get(chunk.objectKey)
      if (!body) throw new Error('Synthetic chunk missing')
      return (async function* () {
        for (let offset = 0; offset < body.length; offset += 137) yield body.subarray(offset, offset + 137)
      })()
    }
    return { input, stored, dependencies: { readChunk, decodeAudio, maxInputBytes: 1024 * 1024, tempRoot } }
  }

  let webm
  for (const format of formats) {
    const filename = path.join(scratch, `${format.name}.audio`)
    command(executable, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', ...format.args, filename])
    const bytes = await fs.readFile(filename)
    if (format.name === 'webm') webm = bytes
    const fixture = taskFor(bytes, format.mime)
    const completion = await withVerifiedRecordingMerge(fixture.input, fixture.dependencies, async artifact => {
      const merged = await fs.readFile(artifact.filePath)
      check(`${format.name}: original bytes preserved`, merged.equals(bytes), true)
      check(`${format.name}: declared MIME preserved`, artifact.mimeType, format.mime)
      check(`${format.name}: output SHA-256 verified`, artifact.completion.outputSha256, digest(bytes))
      check(`${format.name}: output size verified`, artifact.completion.outputByteSize, bytes.length)
      check(`${format.name}: actual decoded duration near 2 seconds`, artifact.completion.durationMs >= 1900 && artifact.completion.durationMs <= 2150, true)
      check(`${format.name}: existing completion gate accepts actual evidence`, verifyRecordingMergeCompletion(fixture.input, artifact.completion).state, 'ready')
      return artifact.completion
    })
    check(`${format.name}: attempt files cleaned`, await fs.readdir(tempRoot), [])
    check(`${format.name}: source fixture unchanged`, digest(await fs.readFile(filename)), digest(bytes))
    report.fixtures.push({ format: format.name, mimeType: format.mime, byteSize: bytes.length, sha256: digest(bytes), chunkCount: fixture.input.chunks.length, durationMs: completion.durationMs })
  }

  async function rejection(name, fixture, expected) {
    let consumed = false
    await assert.rejects(() => withVerifiedRecordingMerge(fixture.input, fixture.dependencies, async () => { consumed = true }), expected)
    check(`${name}: no verified output consumed`, consumed, false)
    check(`${name}: attempt files cleaned`, await fs.readdir(tempRoot), [])
  }
  const corrupt = taskFor(webm, 'audio/webm;codecs=opus')
  const first = corrupt.stored.get(corrupt.input.chunks[0].objectKey)
  first[0] ^= 255
  await rejection('same-size corrupted chunk', corrupt, /hash|sha256|digest/i)
  const missing = taskFor(webm, 'audio/webm;codecs=opus')
  missing.stored.delete(missing.input.chunks[1].objectKey)
  await rejection('missing source chunk', missing, /missing/i)
  await rejection('matching manifest with invalid audio', taskFor(Buffer.from('this is not an audio container'.repeat(40)), 'audio/webm'), /decod|ffmpeg|invalid|process/i)
  await rejection('MIME does not match actual container', taskFor(webm, 'audio/mp4'), /decod|ffmpeg|invalid|process/i)
  const vorbisPath = path.join(scratch, 'vorbis.webm')
  command(executable, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=duration=1', '-c:a', 'libvorbis', '-f', 'webm', vorbisPath])
  await rejection('declared Opus does not match actual codec', taskFor(await fs.readFile(vorbisPath), 'audio/webm;codecs=opus'), /decod|ffmpeg|invalid|process/i)
  const videoPath = path.join(scratch, 'with-video.mp4')
  command(executable, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=duration=1', '-f', 'lavfi', '-i', 'color=black:s=32x32:d=1', '-c:a', 'aac', '-c:v', 'mpeg4', '-f', 'mp4', videoPath])
  await rejection('additional video stream in audio asset', taskFor(await fs.readFile(videoPath), 'audio/mp4'), /decod|ffmpeg|invalid|process/i)
  const long = taskFor(webm, 'audio/webm;codecs=opus')
  long.dependencies.decodeAudio = createFfmpegRecordingDecoder({ executable, timeoutMs: 10000, maxDurationMs: 100 })
  await rejection('decoded duration exceeds configured limit', long, /duration|limit|exceed/i)
  const oversized = taskFor(webm, 'audio/webm;codecs=opus')
  oversized.dependencies.maxInputBytes = 100
  await rejection('encoded input exceeds configured limit', oversized, /size|byte|limit|exceed/i)
  report.status = 'passed'
}

main().catch(error => {
  report.status = 'failed'
  report.error = error.message
  process.exitCode = 1
}).finally(async () => {
  if (scratch) await fs.rm(scratch, { recursive: true, force: true })
  await fs.mkdir(output, { recursive: true })
  report.sourceSha256['verification-script'] = digest(await fs.readFile(__filename))
  await fs.writeFile(path.join(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
})
