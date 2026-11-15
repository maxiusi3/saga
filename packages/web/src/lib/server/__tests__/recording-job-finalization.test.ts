/** @jest-environment node */
import { publishRecordingJob, failRecordingJob } from '../recording-job-finalization'
import type { RecordingJobLease } from '../recording-job-lease'
import type { RecordingOutputCandidate } from '../recording-output-candidate'
import { RecordingProcessingError } from '../recording-processing-error'

const uuid = (d: string) => `${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`
function fixture() {
  const lease: RecordingJobLease = { schemaVersion: 1, jobId: uuid('1'), projectId: uuid('2'), assetId: uuid('3'), sessionId: uuid('4'),
    manifestSha256: 'a'.repeat(64), state: 'running', workerId: 'worker-1', attempt: 1, serverNow: '2026-11-04T00:00:00.000001Z',
    leaseExpiresAt: '2026-11-04T00:00:30.000001Z', deadline: performance.now() + 30000, canClearLocalDrafts: false }
  const output = { byteSize: 10, sha256: 'b'.repeat(64), mimeType: 'audio/webm', durationMs: 2000 }
  const candidate: RecordingOutputCandidate = { schemaVersion: 1, jobId: lease.jobId, projectId: lease.projectId, assetId: lease.assetId,
    sessionId: lease.sessionId, manifestSha256: lease.manifestSha256, workerId: lease.workerId, attempt: 1, candidateId: uuid('5'),
    state: 'prepared', bucket: 'recording-candidates', objectKey: `jobs/${lease.jobId}/attempts/1/${uuid('5')}`, ...output,
    createdAt: '2026-11-04T00:00:00.000002Z', preparedAt: '2026-11-04T00:00:00.000999Z', canClearLocalDrafts: false }
  const receipt = { schemaVersion: 1, jobId: lease.jobId, projectId: lease.projectId, assetId: lease.assetId, sessionId: lease.sessionId,
    manifestSha256: lease.manifestSha256, workerId: lease.workerId, attempt: 1, state: 'succeeded', assetState: 'ready', sessionState: 'cloud_confirmed',
    candidateId: candidate.candidateId, bucket: candidate.bucket, objectKey: candidate.objectKey, ...output, errorCode: null,
    finishedAt: '2026-11-04T00:00:00.001000+00:00', canClearLocalDrafts: false }
  const error = new RecordingProcessingError('recording_source_missing', 'SECRET /private/source')
  const failed = { ...receipt, state: 'failed', assetState: 'quarantined', sessionState: 'failed', candidateId: null,
    bucket: null, objectKey: null, byteSize: null, sha256: null, mimeType: null, durationMs: null, errorCode: error.code }
  const query = { abortSignal: jest.fn(), retry: jest.fn() }
  query.abortSignal.mockReturnValue(query); query.retry.mockResolvedValue({ data: receipt, error: null })
  const rpc = jest.fn(() => query)
  const options = { admin: { rpc } as unknown as Parameters<typeof publishRecordingJob>[2]['admin'], timeoutMs: 1000 }
  return { lease, output, candidate, receipt, failed, error, query, rpc, options }
}
const unavailable = 'recording_finalization_unavailable'

it('publishes once with exactly eight arguments and immutable closed terminal receipt', async () => {
  const f = fixture(); const value = await publishRecordingJob(f.lease, f.candidate, f.options)
  expect(value).toEqual(f.receipt); expect(Object.isFrozen(value)).toBe(true)
  expect(f.rpc).toHaveBeenCalledWith('finalize_recording_job', { p_job_id: f.lease.jobId, p_action: 'publish', p_worker_id: f.lease.workerId,
    p_attempt: 1, p_manifest_sha256: f.lease.manifestSha256, p_candidate_id: f.candidate.candidateId, p_output: f.output, p_failure_code: null })
  expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.query.retry).toHaveBeenCalledWith(false)
  expect(f.query.abortSignal.mock.calls[0][0].aborted).toBe(true)
})
it('fails only a branded permanent error with null publish arguments', async () => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data: f.failed, error: null })
  expect(await failRecordingJob(f.lease, f.error, f.options)).toEqual(f.failed)
  expect(f.rpc).toHaveBeenCalledWith('finalize_recording_job', { p_job_id: f.lease.jobId, p_action: 'fail', p_worker_id: f.lease.workerId,
    p_attempt: 1, p_manifest_sha256: f.lease.manifestSha256, p_candidate_id: null, p_output: null, p_failure_code: f.error.code })
  expect(f.rpc).toHaveBeenCalledTimes(1)
})
it.each(['jobId', 'projectId', 'assetId', 'sessionId', 'manifestSha256', 'workerId', 'attempt', 'candidateId', 'bucket', 'objectKey',
  'byteSize', 'sha256', 'mimeType', 'durationMs', 'state', 'assetState', 'sessionState', 'errorCode', 'finishedAt', 'schemaVersion', 'canClearLocalDrafts', 'extra'])
('rejects changed receipt %s after a single possibly committed request', async key => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data: { ...f.receipt, [key]: 'invalid' }, error: null })
  await expect(publishRecordingJob(f.lease, f.candidate, f.options)).rejects.toThrow(unavailable)
  expect(f.rpc).toHaveBeenCalledTimes(1)
})
it.each(['candidateId', 'bucket', 'objectKey', 'byteSize', 'sha256', 'mimeType', 'durationMs', 'errorCode', 'assetState', 'sessionState'])
('rejects non-null publish fields or wrong identity in failure %s', async key => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data: { ...f.failed, [key]: f.receipt[key as keyof typeof f.receipt] }, error: null })
  await expect(failRecordingJob(f.lease, f.error, f.options)).rejects.toThrow(unavailable)
  expect(f.rpc).toHaveBeenCalledTimes(1)
})
it.each([null, [], {}, 'SECRET'])('rejects malformed receipt %j', async data => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data, error: null })
  await expect(publishRecordingJob(f.lease, f.candidate, f.options)).rejects.toThrow(unavailable)
})
it.each(['2026-02-30T00:00:00Z', '2026-11-04T00:00:00.000998Z', '2026-11-04T00:00:30.000001Z',
  '2026-11-04T00:00:30.000002Z', '2026-11-04T00:00:00.0010000Z', '2026-11-04T01:00:00+01:00'])
('requires a real UTC finished timestamp within the lease and after prepared at microsecond precision: %s', async finishedAt => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data: { ...f.receipt, finishedAt }, error: null })
  await expect(publishRecordingJob(f.lease, f.candidate, f.options)).rejects.toThrow(unavailable)
})
it('rejects failure before server time by one microsecond', async () => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data: { ...f.failed, finishedAt: '2026-11-04T00:00:00.000000Z' }, error: null })
  await expect(failRecordingJob(f.lease, f.error, f.options)).rejects.toThrow(unavailable)
})
it.each([{ state: 'reserved', preparedAt: null }, { assetId: uuid('9') }, { objectKey: 'private/other' }, { byteSize: 0 },
  { durationMs: 0 }, { mimeType: 'text/html' }, { sha256: 'BAD' }, { extra: true }])
('rejects invalid or unprepared candidate before RPC %j', async invalid => {
  const f = fixture()
  await expect(publishRecordingJob(f.lease, { ...f.candidate, ...invalid } as RecordingOutputCandidate, f.options)).rejects.toThrow(unavailable)
  expect(f.rpc).not.toHaveBeenCalled()
})
it.each([{ state: 'leased' }, { attempt: 0 }, { attempt: 4 }, { workerId: 'bad worker' }, { deadline: 0 }, { deadline: Infinity },
  { canClearLocalDrafts: true }, { schemaVersion: 2 }, { projectId: '../private' }, { serverNow: '2026-02-30T00:00:00Z' },
  { leaseExpiresAt: '2026-11-04T00:02:00.000002Z' }, { extra: true }])
('rejects invalid lease before RPC %j', async invalid => {
  const f = fixture()
  await expect(publishRecordingJob({ ...f.lease, ...invalid } as RecordingJobLease, f.candidate, f.options)).rejects.toThrow(unavailable)
  expect(f.rpc).not.toHaveBeenCalled()
})
it.each([0, -1, 60001, NaN, 1.5])('rejects invalid timeout %s before dispatch', async timeoutMs => {
  const f = fixture()
  await expect(publishRecordingJob(f.lease, f.candidate, { ...f.options, timeoutMs })).rejects.toThrow(unavailable)
  expect(f.rpc).not.toHaveBeenCalled()
})
it.each([
  new Error('recording_source_missing'), { code: 'recording_source_missing', disposition: 'permanent' },
  Object.assign(Object.create(RecordingProcessingError.prototype), { code: 'recording_source_missing', disposition: 'permanent' }),
  { name: 'RecordingProcessingError', code: 'unknown', disposition: 'permanent' },
  new RecordingProcessingError('recording_source_read_temporary', 'SECRET'),
])('rejects forged/unknown/transient errors before dispatch %#', async error => {
  const f = fixture()
  await expect(failRecordingJob(f.lease, error as RecordingProcessingError, f.options)).rejects.toThrow(unavailable)
  expect(f.rpc).not.toHaveBeenCalled()
})
it('rejects unknown code even when constructing the real error', () => {
  expect(() => new RecordingProcessingError('unknown' as never, 'SECRET')).toThrow('Unknown recording processing error code')
})
it.each(['publish', 'fail'])('does not dispatch %s after prior cancellation', async action => {
  const f = fixture(); const controller = new AbortController(); controller.abort()
  const options = { ...f.options, signal: controller.signal }
  await expect(action === 'publish' ? publishRecordingJob(f.lease, f.candidate, options) : failRecordingJob(f.lease, f.error, options)).rejects.toThrow(unavailable)
  expect(f.rpc).not.toHaveBeenCalled()
})
it.each(['timeout', 'caller', 'transport', 'sql rejection', 'lease deadline'])('retains ambiguous %s outcome without retry, fallback failure or deletion', async mode => {
  const f = fixture(); const controller = new AbortController()
  if (mode === 'transport') f.query.retry.mockRejectedValue(new Error('SECRET /private/key'))
  else if (mode === 'sql rejection') f.query.retry.mockResolvedValue({ data: null, error: { message: 'SECRET candidate exists' } })
  else f.query.retry.mockImplementation(() => new Promise(() => {}))
  if (mode === 'caller') setTimeout(() => controller.abort(), 5)
  if (mode === 'lease deadline') f.lease = { ...f.lease, deadline: performance.now() + 5 }
  await expect(publishRecordingJob(f.lease, f.candidate, { ...f.options, timeoutMs: 20, signal: controller.signal })).rejects.toThrow(unavailable)
  expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.query.abortSignal.mock.calls[0][0].aborted).toBe(true)
})
it('sanitizes a post-candidate permanent failure SQL rejection without further action', async () => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data: null, error: { message: 'SECRET candidate exists' } })
  await expect(failRecordingJob(f.lease, f.error, f.options)).rejects.toThrow(unavailable)
  expect(f.rpc).toHaveBeenCalledTimes(1)
})
it('pins caller inputs across the RPC await', async () => {
  const f = fixture()
  f.query.retry.mockImplementation(async () => {
    Object.assign(f.candidate, { sha256: 'c'.repeat(64) }); Object.assign(f.lease, { assetId: uuid('9') })
    return { data: f.receipt, error: null }
  })
  expect(await publishRecordingJob(f.lease, f.candidate, f.options)).toEqual(f.receipt)
})
