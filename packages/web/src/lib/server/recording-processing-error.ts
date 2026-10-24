/** Only failures with a known local outcome belong here. Do not classify by message. */
const dispositions = {
  recording_source_missing: 'permanent',
  recording_source_not_private_file: 'permanent',
  recording_source_size_mismatch: 'permanent',
  recording_source_hash_mismatch: 'permanent',
  recording_source_read_timeout: 'transient',
  recording_source_read_temporary: 'transient',
  recording_decode_invalid_pcm: 'permanent',
  recording_decode_duration_exceeded: 'permanent',
} as const

export type RecordingProcessingErrorCode = keyof typeof dispositions
const knownErrors = new WeakSet<RecordingProcessingError>()

export class RecordingProcessingError extends Error {
  readonly code: RecordingProcessingErrorCode
  readonly disposition: 'permanent' | 'transient'

  constructor(code: RecordingProcessingErrorCode, message: string) {
    super(message)
    if (!Object.prototype.hasOwnProperty.call(dispositions, code)) throw new Error('Unknown recording processing error code')
    this.name = 'RecordingProcessingError'
    this.code = code
    this.disposition = dispositions[code]
    knownErrors.add(this)
    Object.freeze(this)
  }
}

export function isRecordingProcessingError(error: unknown): error is RecordingProcessingError {
  return error instanceof RecordingProcessingError && knownErrors.has(error)
}
