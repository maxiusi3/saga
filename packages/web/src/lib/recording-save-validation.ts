import { isRecordingSaveUuid, type RecordingSaveConfirmationIdentity } from './recording-save-contract'

/** Public status is a hint to confirm, never a cleanup receipt. No server imports. */
export function validateSaveStatus(value: unknown, expected: RecordingSaveConfirmationIdentity) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('recording_status_invalid')
  const row = value as Record<string, unknown>
  const keys = ['schemaVersion','projectId','sessionId','assetId','jobId','manifestSha256','observedAt','state','content','errorCode','finishedAt','canClearLocalDrafts']
  const time = (v: unknown): number => {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(v) ||
      !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,19) !== v.slice(0,19)) throw new Error('recording_status_invalid')
    return Date.parse(v)
  }
  const fail = () => { throw new Error('recording_status_invalid') }
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(row,key)) || row.schemaVersion !== 1 ||
    row.canClearLocalDrafts !== false || ['projectId','sessionId','assetId','manifestSha256'].some(key => row[key] !== expected[key as keyof typeof expected]) ||
    (row.jobId !== null && !isRecordingSaveUuid(row.jobId))) fail()
  const observed = time(row.observedAt)
  if (row.state === 'unresolved') {
    if (row.content !== null || row.errorCode !== null || row.finishedAt !== null) fail()
  } else if (row.state === 'succeeded' || row.state === 'failed') {
    if (row.jobId === null || time(row.finishedAt) > observed) fail()
    if (row.state === 'failed') {
      if (row.content !== null || typeof row.errorCode !== 'string' || !['recording_source_missing','recording_source_not_private_file',
        'recording_source_size_mismatch','recording_source_hash_mismatch','recording_decode_invalid_pcm','recording_decode_duration_exceeded'].includes(row.errorCode)) fail()
    } else {
      if (!row.content || typeof row.content !== 'object' || Array.isArray(row.content) || row.errorCode !== null) fail()
      const content = row.content as Record<string,unknown>
      if (Object.keys(content).length !== 4 || !['byteSize','sha256','mimeType','durationMs'].every(k => Object.prototype.hasOwnProperty.call(content,k)) ||
        !Number.isSafeInteger(content.byteSize) || Number(content.byteSize) < 1 || Number(content.byteSize) > 104857600 ||
        !Number.isSafeInteger(content.durationMs) || Number(content.durationMs) < 1 || Number(content.durationMs) > 86400000 ||
        typeof content.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(content.sha256) || typeof content.mimeType !== 'string' ||
        !/^audio\/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$/.test(content.mimeType)) fail()
    }
  } else fail()
  return { state: row.state as 'unresolved'|'succeeded'|'failed', jobId: row.jobId as string|null }
}

export async function recordingBlobSha256(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2,'0')).join('')
}
