/** @jest-environment node */
import { loadOperationalSnapshot, operationalHealthFromSnapshot } from '../operational-snapshot'

const mockAdmin = jest.fn()
const mockRpc = jest.fn()
const mockAbort = jest.fn()
const mockRetry = jest.fn()
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))

const now = '2026-10-29T05:00:00.000Z'
const snapshot = () => ({
  schemaVersion: 2, observedAt: now,
  processing: { stalledJobsCount: 2, maxRunnableBacklogAgeSeconds: 1800, invalidJobCount: 0 },
  costs: { maxProjectKnownExposureCents: 751, unknownAttemptCostsCount: 0 },
  deletions: { overdueRequestsCount: 1, invalidRequestCount: 0 },
  exports: {
    scope: 'synchronous_archive_assembly', windowMinutes: 60,
    coverageStartedAt: '2026-10-29T03:00:00.000Z', windowComplete: true,
    integrityFailuresCount: 0, unsettledAttemptsCount: 0, invalidAttemptsCount: 0,
  },
})

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(now))
  jest.resetAllMocks()
  mockAdmin.mockReturnValue({ rpc: mockRpc })
  mockRpc.mockReturnValue({ abortSignal: mockAbort })
  mockAbort.mockReturnValue({ retry: mockRetry })
  mockRetry.mockResolvedValue({ data: snapshot(), error: null })
})
afterEach(() => jest.useRealTimers())

it('reads one current aggregate RPC with cancellation and no retry', async () => {
  const result = await loadOperationalSnapshot()
  expect(result).toEqual({ ok: true, snapshot: snapshot() })
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockRpc).toHaveBeenCalledWith('read_operational_snapshot_v2')
  expect(mockAbort).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(mockRetry).toHaveBeenCalledWith(false)
  expect(jest.getTimerCount()).toBe(0)
})

it.each([
  null, [], {}, { ...snapshot(), schemaVersion: 1 },
  { ...snapshot(), familyText: 'private transcript' },
  { ...snapshot(), processing: { ...snapshot().processing, objectKey: 'private' } },
  { ...snapshot(), observedAt: 'invalid' },
  { ...snapshot(), observedAt: 'Thu, 29 Oct 2026 05:00:00 GMT' },
  { ...snapshot(), costs: { maxProjectKnownExposureCents: 1 } },
  { ...snapshot(), deletions: [] },
  { ...snapshot(), observedAt: '2026-10-29T04:58:59Z' },
  { ...snapshot(), observedAt: '2026-10-29T05:00:06Z' },
])('rejects unsupported, private or stale response %j', async data => {
  mockRetry.mockResolvedValue({ data, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
})

it.each(['2026-10-29T04:59:00.000000+00:00', '2026-10-29T05:00:05Z'])('accepts freshness boundaries and PostgreSQL timestamps: %s', async observedAt => {
  mockRetry.mockResolvedValue({ data: { ...snapshot(), observedAt }, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: true, snapshot: { ...snapshot(), observedAt: new Date(observedAt).toISOString() } })
})

it.each([
  ['processing', 'stalledJobsCount'], ['processing', 'maxRunnableBacklogAgeSeconds'],
  ['processing', 'invalidJobCount'], ['costs', 'unknownAttemptCostsCount'],
  ['deletions', 'overdueRequestsCount'], ['deletions', 'invalidRequestCount'],
] as const)('validates the %s.%s counter', async (group, key) => {
  const data = snapshot()
  Object.assign(data[group], { [key]: -1 })
  mockRetry.mockResolvedValue({ data, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
})

it.each([null, -1, NaN, Infinity, 1.5, '12', Number.MAX_SAFE_INTEGER + 1])('rejects unsafe counts %s', async value => {
  mockRetry.mockResolvedValue({ data: { ...snapshot(), costs: { ...snapshot().costs, maxProjectKnownExposureCents: value } }, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
})

it('does not expose database errors or fall back to private rows', async () => {
  mockRetry.mockResolvedValue({ data: null, error: { message: 'private query/credentials' } })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'database_unavailable' })
  mockAdmin.mockImplementation(() => { throw new Error('private key') })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'not_configured' })
})

it('sanitizes thrown RPC errors and clears its deadline', async () => {
  mockRetry.mockRejectedValue(new Error('private query/credentials'))
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'database_unavailable' })
  mockRpc.mockImplementation(() => { throw new Error('private setup') })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'database_unavailable' })
  expect(jest.getTimerCount()).toBe(0)
})

it('bounds a transport that ignores AbortSignal', async () => {
  mockRetry.mockImplementation(() => new Promise(() => {}))
  const pending = loadOperationalSnapshot()
  await jest.advanceTimersByTimeAsync(5000)
  expect(await pending).toEqual({ ok: false, reason: 'request_interrupted' })
  expect(mockAbort.mock.calls[0][0].aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})

it('does not dispatch an already cancelled request', async () => {
  const controller = new AbortController()
  controller.abort()
  expect(await loadOperationalSnapshot(controller.signal)).toEqual({ ok: false, reason: 'request_interrupted' })
  expect(mockAdmin).not.toHaveBeenCalled()
})

it('propagates caller cancellation and drops a late result', async () => {
  const controller = new AbortController()
  let finish!: (value: unknown) => void
  mockRetry.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const pending = loadOperationalSnapshot(controller.signal)
  controller.abort()
  expect(await pending).toEqual({ ok: false, reason: 'request_interrupted' })
  finish({ data: snapshot(), error: null })
  expect(jest.getTimerCount()).toBe(0)
})

it('evaluates actual available metrics without manufacturing upload evidence', () => {
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: snapshot() }, '500')
  expect(health).toMatchObject({ status: 'critical', coverage: 'partial', source: 'database_ledger', observedAt: now })
  expect(health.alerts.map(item => item.code)).toEqual(['job_backlog_stalled', 'project_cost_anomaly', 'deletion_sla_breach'])
  expect(health.unavailableMetrics).toEqual(['uploads'])
  expect(health.snapshot).toEqual(snapshot())
})

it.each([
  null, {}, { ...snapshot().exports, objectKey: 'private' },
  { ...snapshot().exports, scope: 'client_download' }, { ...snapshot().exports, windowMinutes: 15 },
  { ...snapshot().exports, integrityFailuresCount: -1 }, { ...snapshot().exports, unsettledAttemptsCount: null },
  { ...snapshot().exports, invalidAttemptsCount: Infinity }, { ...snapshot().exports, coverageStartedAt: null },
  { ...snapshot().exports, coverageStartedAt: '2026-10-29T05:00:00.000001Z' },
  { ...snapshot().exports, coverageStartedAt: '2026-10-29T04:30:00Z', windowComplete: true },
  { ...snapshot().exports, windowComplete: false }, { ...snapshot().exports, windowComplete: 'true' },
])('rejects invalid or misleading export observations %j', async exports => {
  mockRetry.mockResolvedValue({ data: { ...snapshot(), exports }, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
})

it.each([
  ['2026-10-29T04:00:00.000000Z', true],
  ['2026-10-29T04:00:00.000001Z', false],
] as const)('checks the coverage boundary without losing PostgreSQL microseconds: %s', async (coverageStartedAt, windowComplete) => {
  mockRetry.mockResolvedValue({ data: { ...snapshot(), exports: { ...snapshot().exports, coverageStartedAt, windowComplete } }, error: null })
  expect(await loadOperationalSnapshot()).toMatchObject({ ok: true, snapshot: { exports: { windowComplete } } })
})

it('alerts on recorded integrity failures even with a short window or unsettled attempt', () => {
  const data = snapshot()
  data.exports = { ...data.exports, integrityFailuresCount: 2, unsettledAttemptsCount: 1, windowComplete: false, coverageStartedAt: now }
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health.alerts.map(a => a.code)).toContain('export_integrity_failure')
  expect(health.unavailableMetrics).toEqual(expect.arrayContaining(['uploads', 'export_observation_window', 'export_outcome_completeness']))
})

it('suppresses malformed export groups and keeps real zero observations from proving readiness', () => {
  const data = snapshot(); data.exports.integrityFailuresCount = 1; data.exports.invalidAttemptsCount = 1
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health.unavailableMetrics).toContain('exports')
  expect(health.alerts.map(a => a.code)).not.toContain('export_integrity_failure')
})

it.each([undefined, '', '500x', '-1', '1.5', 'Infinity', '9007199254740992'])('does not invent a budget cap from %s', budget => {
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: snapshot() }, budget)
  expect(health.unavailableMetrics).toContain('project_cost')
  expect(health.alerts.map(item => item.code)).not.toContain('project_cost_anomaly')
})

it('marks unknown costs incomplete while still alerting on a known over-budget lower bound', () => {
  const data = snapshot(); data.costs.unknownAttemptCostsCount = 1
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health.unavailableMetrics).toContain('project_cost_completeness')
  expect(health.alerts.map(item => item.code)).toContain('project_cost_anomaly')
})

it('suppresses invalid metric groups instead of interpreting their counts as healthy', () => {
  const data = snapshot(); data.processing.invalidJobCount = 1; data.deletions.invalidRequestCount = 1
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health.unavailableMetrics).toEqual(expect.arrayContaining(['processing', 'deletions']))
  expect(health.alerts.map(item => item.code)).toEqual(['project_cost_anomaly'])
})

it('keeps real empty database observations distinct from full operational readiness', () => {
  const data = snapshot()
  data.processing = { stalledJobsCount: 0, maxRunnableBacklogAgeSeconds: 0, invalidJobCount: 0 }
  data.costs.maxProjectKnownExposureCents = 0; data.deletions.overdueRequestsCount = 0
  expect(operationalHealthFromSnapshot({ ok: true, snapshot: data }, '0')).toMatchObject({
    status: 'unavailable', coverage: 'partial', alerts: [], source: 'database_ledger',
  })
  expect(operationalHealthFromSnapshot({ ok: false, reason: 'database_unavailable' }, '500')).toMatchObject({
    status: 'unavailable', source: 'unavailable', reason: 'database_unavailable', snapshot: null,
  })
})
