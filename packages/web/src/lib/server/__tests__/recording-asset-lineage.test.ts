/** @jest-environment node */
import { recordingAssetDeletionSubjects } from '../recording-asset-lineage'

const uuid = (d: string) => `${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`
const candidate = { id: uuid('1'), job_id: uuid('2'), project_id: uuid('3'), asset_id: uuid('4'), session_id: uuid('5'),
  manifest_sha256: 'a'.repeat(64), worker_id: 'worker-1', attempt_no: 1, bucket: 'recording-candidates',
  object_key: `jobs/${uuid('2')}/attempts/1/${uuid('1')}`, state: 'prepared', byte_size: 20, sha256: 'b'.repeat(64), mime_type: 'audio/webm', duration_ms: 1000,
  created_at: '2026-11-04T00:00:00.000001Z', prepared_at: '2026-11-04T00:00:00.000002Z' }
const asset = { id: candidate.asset_id, project_id: candidate.project_id, bucket: candidate.bucket, object_key: candidate.object_key,
  state: 'ready', kind: 'original_audio', byte_size: candidate.byte_size, sha256: candidate.sha256, mime_type: candidate.mime_type, duration_ms: candidate.duration_ms }
function fixture(data: unknown = candidate, error: unknown = null) {
  const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn(async () => ({ data, error })) }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
  const from = jest.fn(() => query)
  return { from, query, admin: { from } as unknown as Parameters<typeof recordingAssetDeletionSubjects>[0] }
}
it.each(['audio-recordings', 'saga'])('keeps ordinary %s assets source compatible without DB reads', async bucket => {
  const f = fixture(); expect(await recordingAssetDeletionSubjects(f.admin, { bucket })).toEqual([])
  expect(f.from).not.toHaveBeenCalled()
})
it.each(['ready', 'deleting', 'deleted'])('returns session deletion subject for valid published %s candidate', async state => {
  const f = fixture(); const subjects = await recordingAssetDeletionSubjects(f.admin, { ...asset, state })
  expect(subjects).toEqual([candidate.session_id]); expect(Object.isFrozen(subjects)).toBe(true)
  expect(f.from).toHaveBeenCalledWith('recording_output_candidates')
  expect(f.query.eq).toHaveBeenCalledWith('bucket', candidate.bucket)
  expect(f.query.eq).toHaveBeenCalledWith('object_key', candidate.object_key)
})
it.each(['id', 'job_id', 'project_id', 'asset_id', 'session_id', 'manifest_sha256', 'worker_id', 'attempt_no', 'bucket', 'object_key',
  'state', 'byte_size', 'sha256', 'mime_type', 'duration_ms', 'created_at', 'prepared_at'])
('rejects malformed/mismatched candidate %s', async field => {
  const f = fixture({ ...candidate, [field]: 'invalid/value' })
  await expect(recordingAssetDeletionSubjects(f.admin, asset)).rejects.toThrow('recording_asset_lineage_unavailable')
})
it.each([{ byte_size: 21 }, { duration_ms: 1001 }, { sha256: 'c'.repeat(64) }, { mime_type: 'audio/ogg' },
  { project_id: uuid('9') }, { asset_id: uuid('9') }, { job_id: uuid('9') }, { attempt_no: 2 }, { id: uuid('9') },
  { byte_size: 0 }, { duration_ms: 0 }, { state: 'reserved' }])('rejects valid-shaped but inconsistent immutable lineage %j', async drift => {
  const f = fixture({ ...candidate, ...drift })
  await expect(recordingAssetDeletionSubjects(f.admin, asset)).rejects.toThrow('recording_asset_lineage_unavailable')
})
it.each(['verifying', 'quarantined', 'pending_upload'])('rejects impossible %s published pointer', async state => {
  const f = fixture()
  await expect(recordingAssetDeletionSubjects(f.admin, { ...asset, state })).rejects.toThrow('recording_asset_lineage_unavailable')
})
it.each(['byte_size', 'sha256', 'mime_type', 'duration_ms', 'id', 'project_id', 'kind'])('rejects malformed asset %s', async field => {
  const f = fixture()
  await expect(recordingAssetDeletionSubjects(f.admin, { ...asset, [field]: undefined })).rejects.toThrow('recording_asset_lineage_unavailable')
})
it.each([null, [], {}, 'SECRET'])('fails closed on missing malformed or duplicate-query result %j', async data => {
  const f = fixture(data)
  await expect(recordingAssetDeletionSubjects(f.admin, asset)).rejects.toThrow('recording_asset_lineage_unavailable')
})
it('sanitizes database rejection', async () => {
  const f = fixture(candidate, { message: 'SECRET /private/path' })
  await expect(recordingAssetDeletionSubjects(f.admin, asset)).rejects.toThrow('recording_asset_lineage_unavailable')
  f.from.mockImplementation(() => { throw new Error('SECRET') })
  await expect(recordingAssetDeletionSubjects(f.admin, asset)).rejects.toThrow('recording_asset_lineage_unavailable')
})
