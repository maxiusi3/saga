import { RecordingProcessingError } from './recording-processing-error'
import { spawn } from 'node:child_process'
import { isAbsolute } from 'node:path'

interface DecoderOptions {
  executable: string
  timeoutMs: number
  maxDurationMs: number
}

const PCM_BYTES_PER_MS = 32 // 16 kHz, signed 16-bit, mono
const MAX_DIAGNOSTIC_BYTES = 8192

function inputFormat(mimeType: string): { format: string; codec?: string } {
  const match = /^audio\/(webm|mp4|ogg)(?:;\s*codecs=(?:"([a-z0-9.]+)"|([a-z0-9.]+)))?$/i.exec(mimeType)
  if (!match) throw new Error('Unsupported recording MIME type')
  const container = match[1].toLowerCase()
  const declaredCodec = (match[2] ?? match[3])?.toLowerCase()
  const format = container === 'webm' ? 'matroska' : container === 'mp4' ? 'mov' : 'ogg'
  if (!declaredCodec) return { format }
  if (container === 'mp4' && declaredCodec === 'mp4a.40.2') return { format, codec: 'aac' }
  if (container !== 'mp4' && (declaredCodec === 'opus' || declaredCodec === 'vorbis')) return { format, codec: declaredCodec }
  throw new Error('Unsupported recording MIME codec')
}

/** Decode all audio samples, preserving the original file. Runtime provisioning is external.
 * Fixed demuxers exclude playlists; MOV external data references are disabled explicitly.
 * This is process/output bounding, not an OS sandbox for a production media worker.
 */
export function createFfmpegRecordingDecoder(options: DecoderOptions) {
  const { executable, timeoutMs, maxDurationMs } = options
  if (!isAbsolute(executable)) throw new Error('FFmpeg executable must be an absolute path')
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) throw new Error('Invalid decoder timeout')
  if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs <= 0 || !Number.isSafeInteger(maxDurationMs * PCM_BYTES_PER_MS)) {
    throw new Error('Invalid decoder duration limit')
  }
  return async (filePath: string, mimeType: string, signal?: AbortSignal): Promise<{ durationMs: number }> => {
    signal?.throwIfAborted()
    const { format, codec } = inputFormat(mimeType)
    if (!isAbsolute(filePath)) throw new Error('Recording file must be an absolute path')
    const args = [
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror', '-err_detect', 'explode',
      '-protocol_whitelist', 'file,pipe', '-f', format,
      ...(format === 'mov' ? ['-enable_drefs', '0', '-use_absolute_path', '0'] : []),
      ...(codec ? ['-c:a', codec] : []),
      // Map all streams: raw PCM output rejects extra audio/video/data tracks.
      '-i', filePath, '-map', '0', '-c:a', 'pcm_s16le',
      '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1',
    ]
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
      let failure: Error | undefined
      let pcmBytes = 0
      let diagnosticBytes = 0
      const stop = (error: Error) => {
        failure ??= error
        child.kill('SIGKILL')
      }
      const timer = setTimeout(() => stop(new Error('Recording decoder timed out')), timeoutMs)
      // Cancellation owns only this child. Rejection waits for close, after its I/O has ended.
      const abort = () => { child.kill('SIGKILL') }
      child.once('error', error => { failure ??= new Error(`Recording decoder unavailable: ${error.message}`) })
      child.stdout.on('data', (bytes: Buffer) => {
        pcmBytes += bytes.length
        if (pcmBytes > maxDurationMs * PCM_BYTES_PER_MS) stop(new RecordingProcessingError('recording_decode_duration_exceeded', 'Recording decoded duration exceeds the limit'))
      })
      child.stderr.on('data', (bytes: Buffer) => {
        diagnosticBytes += bytes.length
        // Do not retain/log decoder diagnostics, which may contain source paths.
        if (diagnosticBytes > MAX_DIAGNOSTIC_BYTES) stop(new Error('Recording decoder diagnostic limit exceeded'))
      })
      child.once('close', (code, exitSignal) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        if (signal?.aborted) return reject(signal.reason)
        if (failure) return reject(failure)
        // Exit codes and stderr do not distinguish bad input from runtime/resource failure.
        if (exitSignal || code !== 0 || diagnosticBytes > 0) return reject(new Error('Recording audio decode failed or emitted error diagnostics'))
        if (pcmBytes === 0 || pcmBytes % 2 !== 0) return reject(new RecordingProcessingError('recording_decode_invalid_pcm', 'Recording decoder produced empty or invalid PCM samples'))
        resolve({ durationMs: Math.ceil(pcmBytes / PCM_BYTES_PER_MS) })
      })
      signal?.addEventListener('abort', abort, { once: true })
      // Also cover cancellation between the initial check and listener registration.
      if (signal?.aborted) abort()
    })
  }
}
