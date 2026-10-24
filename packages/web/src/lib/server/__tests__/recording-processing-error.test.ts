/** @jest-environment node */
import { RecordingProcessingError, isRecordingProcessingError } from '../recording-processing-error'

it('accepts only errors constructed by the helper and keeps codes immutable', () => {
  const actual = new RecordingProcessingError('recording_source_read_timeout', 'Recording I/O timed out')
  expect(isRecordingProcessingError(actual)).toBe(true)
  expect(actual.disposition).toBe('transient')
  expect(Object.isFrozen(actual)).toBe(true)
  const forged = Object.assign(new Error(actual.message), { code: actual.code, disposition: actual.disposition })
  expect(isRecordingProcessingError(forged)).toBe(false)
  Object.setPrototypeOf(forged, RecordingProcessingError.prototype)
  expect(isRecordingProcessingError(forged)).toBe(false)
})
