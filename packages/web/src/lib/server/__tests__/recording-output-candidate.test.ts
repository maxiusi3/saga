/** @jest-environment node */
import { reserveRecordingOutputCandidate, prepareRecordingOutputCandidate, type RecordingOutputCandidate } from '../recording-output-candidate'
import type { RecordingJobLease } from '../recording-job-lease'

const uuid = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`
function fixture() {
  const now = new Date().toISOString()
  const lease: RecordingJobLease = { schemaVersion: 1, jobId: uuid('1'), projectId: uuid('2'), assetId: uuid('3'), sessionId: uuid('4'),
    manifestSha256: 'a'.repeat(64), state: 'running', workerId: 'worker-1', attempt: 1, leaseExpiresAt: new Date(Date.now() + 30000).toISOString(),
    serverNow: now, deadline: performance.now() + 30000, canClearLocalDrafts: false }
  const id = uuid('5')
  const output = { byteSize: 10, sha256: 'b'.repeat(64), mimeType: 'audio/webm', durationMs: 2000 }
  const candidate: RecordingOutputCandidate = { schemaVersion: 1, candidateId: id, jobId: lease.jobId, projectId: lease.projectId,
    assetId: lease.assetId, sessionId: lease.sessionId, manifestSha256: lease.manifestSha256, workerId: lease.workerId, attempt: lease.attempt,
    state: 'reserved', bucket: 'recording-candidates', objectKey: `jobs/${lease.jobId}/attempts/1/${id}`, ...output,
    createdAt: now, preparedAt: null, canClearLocalDrafts: false }
  const query = { abortSignal: jest.fn(), retry: jest.fn() }
  query.abortSignal.mockReturnValue(query); query.retry.mockResolvedValue({ data: candidate, error: null })
  const rpc = jest.fn(() => query)
  const options = { admin: { rpc } as unknown as Parameters<typeof reserveRecordingOutputCandidate>[3]['admin'], timeoutMs: 1000 }
  return { lease, id, output, candidate, query, rpc, options }
}

it('reserves exact immutable identity without automatic retries', async () => {
  const f = fixture()
  const result = await reserveRecordingOutputCandidate(f.lease, f.id, f.output, f.options)
  expect(result).toEqual(f.candidate); expect(Object.isFrozen(result)).toBe(true)
  expect(f.rpc).toHaveBeenCalledWith('recording_output_candidate', { p_job_id: f.lease.jobId, p_action: 'reserve',
    p_worker_id: 'worker-1', p_attempt: 1, p_manifest_sha256: f.lease.manifestSha256, p_candidate_id: f.id, p_output: f.output })
  expect(f.query.retry).toHaveBeenCalledWith(false)
  expect(f.query.abortSignal.mock.calls[0][0].aborted).toBe(true)
})

it('prepares the same candidate with its immutable output', async () => {
  const f = fixture(); const prepared = { ...f.candidate, state: 'prepared', preparedAt: f.candidate.createdAt }
  f.query.retry.mockResolvedValue({ data: prepared, error: null })
  expect(await prepareRecordingOutputCandidate(f.lease, f.candidate, f.options)).toEqual(prepared)
  expect(f.rpc.mock.calls[0]).toEqual(['recording_output_candidate', expect.objectContaining({ p_action: 'prepare', p_output: f.output })])
})

it.each(['candidateId', 'jobId', 'projectId', 'assetId', 'sessionId', 'manifestSha256', 'workerId', 'attempt', 'state',
  'bucket', 'objectKey', 'byteSize', 'sha256', 'mimeType', 'durationMs', 'createdAt', 'preparedAt', 'schemaVersion', 'canClearLocalDrafts', 'extra'])
('rejects altered %s in a receipt', async key => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data: { ...f.candidate, [key]: 'invalid' }, error: null })
  await expect(reserveRecordingOutputCandidate(f.lease, f.id, f.output, f.options)).rejects.toThrow('recording_candidate_unavailable')
  expect(f.rpc).toHaveBeenCalledTimes(1)
})

it.each(['createdAt', 'objectKey', 'preparedAt'])('rejects drift in prepared %s', async field => {
  const f = fixture()
  f.query.retry.mockResolvedValue({ data: { ...f.candidate, state: 'prepared', preparedAt: f.candidate.createdAt,
    [field]: field === 'objectKey' ? 'other/path' : '1999-01-01T00:00:00Z' }, error: null })
  await expect(prepareRecordingOutputCandidate(f.lease, f.candidate, f.options)).rejects.toThrow()
})

it('rejects a prepared timestamp earlier by less than one millisecond', async () => {
  const f = fixture()
  f.candidate = { ...f.candidate, createdAt: '2026-11-03T00:00:00.000999Z' }
  f.query.retry.mockResolvedValue({ data: { ...f.candidate, state: 'prepared', preparedAt: '2026-11-03T00:00:00.000001Z' }, error: null })
  await expect(prepareRecordingOutputCandidate(f.lease, f.candidate, f.options)).rejects.toThrow('recording_candidate_unavailable')
})

it('accepts ordered PostgreSQL microsecond timestamps', async () => {
  const f = fixture()
  f.candidate = { ...f.candidate, createdAt: '2026-11-03T00:00:00.000999Z' }
  const prepared = { ...f.candidate, state: 'prepared', preparedAt: '2026-11-03T00:00:00.001000Z' }
  f.query.retry.mockResolvedValue({ data: prepared, error: null })
  await expect(prepareRecordingOutputCandidate(f.lease, f.candidate, f.options)).resolves.toEqual(prepared)
})

it.each([null, [], {}, { error: 'SECRET' }])('rejects missing or malformed responses %j', async data => {
  const f = fixture(); f.query.retry.mockResolvedValue({ data, error: null })
  await expect(reserveRecordingOutputCandidate(f.lease, f.id, f.output, f.options)).rejects.toThrow('recording_candidate_unavailable')
})

it.each([{ byteSize: 0 }, { byteSize: 104857601 }, { byteSize: 1.5 }, { durationMs: 0 }, { durationMs: 86400001 },
  { sha256: 'ABC' }, { mimeType: 'text/html' }])('refuses unsafe output %j before RPC', async invalid => {
  const f = fixture()
  await expect(reserveRecordingOutputCandidate(f.lease, f.id, { ...f.output, ...invalid }, f.options)).rejects.toThrow()
  expect(f.rpc).not.toHaveBeenCalled()
})

it.each([{ state: 'leased' }, { jobId: '../job' }, { attempt: 4 }, { workerId: '' }, { deadline: 0 }])
('refuses invalid/expired lease %j before RPC', async invalid => {
  const f = fixture()
  await expect(reserveRecordingOutputCandidate({ ...f.lease, ...invalid } as RecordingJobLease, f.id, f.output, f.options)).rejects.toThrow()
  expect(f.rpc).not.toHaveBeenCalled()
})

it('does not dispatch after prior cancellation', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort()
  await expect(reserveRecordingOutputCandidate(f.lease, f.id, f.output, { ...f.options, signal: controller.signal })).rejects.toThrow()
  expect(f.rpc).not.toHaveBeenCalled()
})

it.each(['timeout', 'caller', 'transport', 'error', 'late'])('fails closed on %s without replay', async mode => {
  const f = fixture(); const controller = new AbortController()
  if (mode === 'transport') f.query.retry.mockRejectedValue(new Error('SECRET'))
  else if (mode === 'error') f.query.retry.mockResolvedValue({ data: f.candidate, error: { message: 'SECRET' } })
  else f.query.retry.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 50)); return { data: f.candidate, error: null } })
  if (mode === 'caller') setTimeout(() => controller.abort(), 5)
  if (mode === 'late') f.lease = { ...f.lease, deadline: performance.now() + 5 }
  await expect(reserveRecordingOutputCandidate(f.lease, f.id, f.output, { ...f.options, timeoutMs: mode === 'late' ? 100 : 15,
    signal: controller.signal })).rejects.toThrow('recording_candidate_unavailable')
  expect(f.rpc).toHaveBeenCalledTimes(1)
  expect(f.query.abortSignal.mock.calls[0][0].aborted).toBe(true)
})
