import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Explicit opt-in keeps the historical short Chromium runs reproducible. */
export function chromeOptions(argv) {
  const chrome = argv.includes('--chrome')
  const secondsFlag = argv.find(arg => arg.startsWith('--seconds='))
  const seconds = secondsFlag ? Number(secondsFlag.slice('--seconds='.length)) : 2.2
  if (!Number.isFinite(seconds) || seconds < 2 || seconds > 1800 || (secondsFlag && !chrome)) {
    throw new Error('--seconds requires --chrome and a duration between 2 and 1800 seconds')
  }
  return { chrome, seconds }
}

/** A repeating, non-speech PCM source for Chrome's native test microphone. */
export async function createMicrophoneFile(scratch) {
  const rate = 48000, seconds = 60, samples = rate * seconds
  const bytes = Buffer.alloc(44 + samples * 2)
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28)
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36)
  bytes.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) {
    const frequency = Math.floor(i / rate) % 2 ? 880 : 440
    bytes.writeInt16LE(Math.round(4000 * Math.sin(2 * Math.PI * frequency * i / rate)), 44 + i * 2)
  }
  const path = join(scratch, 'synthetic-microphone.wav')
  await writeFile(path, bytes)
  return path
}
