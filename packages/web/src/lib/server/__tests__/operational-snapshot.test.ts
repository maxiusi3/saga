/** @jest-environment node */
import { loadOperationalSnapshot, operationalHealthFromSnapshot } from '../operational-snapshot'

const mockAdmin = jest.fn()
const mockRpc = jest.fn()
const mockAbort = jest.fn()
const mockRetry = jest.fn()
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))

const now = '2026-10-29T05:00:00.000Z'
const releaseHash = 'a'.repeat(64)
const snapshot = () => ({
  schemaVersion: 4 as const, observedAt: now,
  processing: { stalledJobsCount: 2, maxRunnableBacklogAgeSeconds: 1800, invalidJobCount: 0 },
  costs: { maxProjectKnownExposureCents: 751, unknownAttemptCostsCount: 0 },
  deletions: { overdueRequestsCount: 1, invalidRequestCount: 0 },
  exports: {
    scope: 'synchronous_archive_assembly' as const, windowMinutes: 60 as const,
    coverageStartedAt: '2026-10-29T03:00:00.000Z', windowComplete: true,
    integrityFailuresCount: 0, unsettledAttemptsCount: 0, invalidAttemptsCount: 0,
  },
  uploads: {
    scope: 'project_hub_audio_put_reports' as const, windowMinutes: 60 as const,
    coverageStartedAt: '2026-10-29T03:00:00.000Z', windowComplete: true,
    evaluatedAttemptsCount: 0, reportedFailuresCount: 0, reportedCancellationsCount: 0,
    unsettledAttemptsCount: 0, invalidAttemptsCount: 0,
  },
  collectionCoverage: {
    exports: {
      scope: 'synchronous_archive_assembly' as const, windowMinutes: 60 as const,
      releaseHash, cutoverAt: '2026-10-29T03:00:00.000Z', cutoverWindowComplete: true,
      matchingBuildAttemptsCount: 0, unattributedAttemptsCount: 0,
      staleBuildAttemptsCount: 0, invalidBuildAttemptsCount: 0, buildCoverageComplete: true,
    },
    uploads: {
      scope: 'project_hub_audio_put_reports' as const, windowMinutes: 60 as const,
      releaseHash, cutoverAt: '2026-10-29T03:00:00.000Z', cutoverWindowComplete: true,
      matchingBuildAttemptsCount: 0, unattributedAttemptsCount: 0,
      staleBuildAttemptsCount: 0, invalidBuildAttemptsCount: 0, buildCoverageComplete: true,
    },
  },
})

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(now))
  jest.resetAllMocks()
  process.env.OPERATIONAL_COLLECTOR_BUILD_HASH = releaseHash
  mockAdmin.mockReturnValue({ rpc: mockRpc })
  mockRpc.mockReturnValue({ abortSignal: mockAbort })
  mockAbort.mockReturnValue({ retry: mockRetry })
  mockRetry.mockResolvedValue({ data: snapshot(), error: null })
})
afterEach(() => {
  delete process.env.OPERATIONAL_COLLECTOR_BUILD_HASH
  jest.useRealTimers()
})

it('reads one current v4 aggregate RPC with cancellation and no retry', async () => {
  const result = await loadOperationalSnapshot()
  expect(result).toEqual({ ok: true, snapshot: snapshot() })
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockRpc).toHaveBeenCalledWith('read_operational_snapshot_v4')
  expect(mockAbort).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(mockRetry).toHaveBeenCalledWith(false)
  expect(jest.getTimerCount()).toBe(0)
})

it.each([
  null, [], {}, { ...snapshot(), schemaVersion: 1 }, { ...snapshot(), schemaVersion: 3 },
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
  expect(health.unavailableMetrics).toEqual(['upload_collection_coverage'])
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
  const base = snapshot()
  mockRetry.mockResolvedValue({
    data: {
      ...base,
      exports: { ...base.exports, coverageStartedAt, windowComplete },
      collectionCoverage: {
        ...base.collectionCoverage,
        exports: { ...base.collectionCoverage.exports, buildCoverageComplete: windowComplete },
      },
    },
    error: null,
  })
  expect(await loadOperationalSnapshot()).toMatchObject({ ok: true, snapshot: { exports: { windowComplete } } })
})

it('alerts on recorded integrity failures even with a short window, unsettled attempt or incomplete build coverage', () => {
  const data = snapshot()
  data.exports = { ...data.exports, integrityFailuresCount: 2, unsettledAttemptsCount: 1, windowComplete: false, coverageStartedAt: now }
  data.collectionCoverage.exports = { ...data.collectionCoverage.exports, matchingBuildAttemptsCount: 3, buildCoverageComplete: false }
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health.alerts.map(a => a.code)).toContain('export_integrity_failure')
  expect(health.unavailableMetrics).toEqual(expect.arrayContaining([
    'upload_collection_coverage', 'export_observation_window', 'export_outcome_completeness', 'export_collection_coverage',
  ]))
})

it('suppresses malformed export groups and keeps real zero observations from proving readiness', () => {
  const data = snapshot(); data.exports.integrityFailuresCount = 1; data.exports.invalidAttemptsCount = 1
  data.collectionCoverage.exports.buildCoverageComplete = false
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health.unavailableMetrics).toContain('exports')
  expect(health.unavailableMetrics).toContain('export_collection_coverage')
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

it.each([
  null, {}, { ...snapshot().uploads, rawToken: 'private' },
  { ...snapshot().uploads, scope: 'storage_verified' }, { ...snapshot().uploads, windowMinutes: 15 },
  { ...snapshot().uploads, reportedFailuresCount: 1 }, { ...snapshot().uploads, coverageStartedAt: null },
  { ...snapshot().uploads, coverageStartedAt: '2026-10-29T05:00:00.000001Z' },
  { ...snapshot().uploads, coverageStartedAt: '2026-02-30T00:00:00Z' },
  { ...snapshot().uploads, coverageStartedAt: '2026-10-29T04:30:00Z', windowComplete: true },
  { ...snapshot().uploads, windowComplete: false }, { ...snapshot().uploads, windowComplete: 'true' },
])('rejects invalid or misleading upload observations %j', async uploads => {
  mockRetry.mockResolvedValue({ data: { ...snapshot(), uploads }, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
})

it.each(['evaluatedAttemptsCount', 'reportedFailuresCount', 'reportedCancellationsCount', 'unsettledAttemptsCount', 'invalidAttemptsCount'] as const)(
  'strictly validates upload counter %s', async key => {
    for (const value of [-1, null, '1', 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
      mockRetry.mockResolvedValue({ data: { ...snapshot(), uploads: { ...snapshot().uploads, [key]: value } }, error: null })
      expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
    }
  },
)

it.each([
  ['2026-10-29T04:00:00.000000Z', true],
  ['2026-10-29T04:00:00.000001Z', false],
] as const)('preserves upload coverage microsecond boundary %s', async (coverageStartedAt, windowComplete) => {
  const base = snapshot()
  mockRetry.mockResolvedValue({
    data: {
      ...base,
      uploads: { ...base.uploads, coverageStartedAt, windowComplete },
      collectionCoverage: {
        ...base.collectionCoverage,
        uploads: { ...base.collectionCoverage.uploads, buildCoverageComplete: windowComplete },
      },
    },
    error: null,
  })
  expect(await loadOperationalSnapshot()).toMatchObject({ ok: true, snapshot: { uploads: { windowComplete } } })
})

it('rejects old v2 and v3 snapshots rather than falling back to another RPC', async () => {
  const { collectionCoverage: _cov, ...v3 } = snapshot()
  mockRetry.mockResolvedValueOnce({ data: { ...v3, schemaVersion: 3 }, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
  const { uploads: _uploads, ...v2 } = v3
  mockRetry.mockResolvedValueOnce({ data: { ...v2, schemaVersion: 2 }, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
  expect(mockRpc).toHaveBeenCalledTimes(2)
})

it.each([[20, 2, 'warning'], [8, 2, 'critical']] as const)('alerts on a complete client-reported %s/%s window with explicit provenance', (evaluated, failures, severity) => {
  const data = snapshot()
  Object.assign(data.uploads, { evaluatedAttemptsCount: evaluated, reportedFailuresCount: failures, reportedCancellationsCount: 100 })
  data.collectionCoverage.uploads.matchingBuildAttemptsCount = evaluated + 100
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health.alerts).toContainEqual(expect.objectContaining({
    code: 'upload_failure_spike', severity, summary: expect.stringMatching(/^Client-reported upload failure rate/),
  }))
  expect(health.alerts[0].summary).toContain(`(${failures}/${evaluated})`)
  expect(health.unavailableMetrics).toContain('upload_collection_coverage')
  expect(health.coverage).toBe('partial')
})

it.each([
  { invalidAttemptsCount: 1 }, { unsettledAttemptsCount: 1 },
  { windowComplete: false, coverageStartedAt: now },
])('suppresses partial upload denominators %j', patch => {
  const data = snapshot()
  Object.assign(data.uploads, { evaluatedAttemptsCount: 5, reportedFailuresCount: 5 }, patch)
  data.collectionCoverage.uploads.buildCoverageComplete = false
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health.unavailableMetrics).toContain('uploads')
  expect(health.unavailableMetrics).toContain('upload_collection_coverage')
  expect(health.unavailableMetrics).toContain('windowComplete' in patch ? 'upload_observation_window' : 'upload_outcome_completeness')
  expect(health.alerts.map(a => a.code)).not.toContain('upload_failure_spike')
  expect(health.status).toBe('critical')
})

it('recomputes health after coverage/cost/export gaps instead of appending them to healthy/complete', () => {
  const data = snapshot()
  data.processing = { stalledJobsCount: 0, maxRunnableBacklogAgeSeconds: 0, invalidJobCount: 0 }
  data.costs = { maxProjectKnownExposureCents: 0, unknownAttemptCostsCount: 1 }
  data.deletions.overdueRequestsCount = 0
  Object.assign(data.exports, { windowComplete: false, coverageStartedAt: now, unsettledAttemptsCount: 1 })
  Object.assign(data.collectionCoverage.exports, { matchingBuildAttemptsCount: 1, buildCoverageComplete: false })
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
  expect(health).toMatchObject({ status: 'unavailable', coverage: 'partial', alerts: [] })
  expect(health.unavailableMetrics).toEqual(expect.arrayContaining([
    'project_cost_completeness', 'export_observation_window', 'export_outcome_completeness',
    'export_collection_coverage', 'upload_collection_coverage',
  ]))
})

it.each(['exports', 'uploads'] as const)('rejects year-zero %s coverage outside the database wire epoch', async group => {
  const data = snapshot(); data[group].coverageStartedAt = '0000-01-01T00:00:00.000Z'
  mockRetry.mockResolvedValue({ data, error: null })
  expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
})

describe('v4 deployment collection coverage validation and health evaluation', () => {
  it.each([
    null,
    {},
    { ...snapshot().collectionCoverage, extra: true },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, scope: 'wrong' } },
    { ...snapshot().collectionCoverage, uploads: { ...snapshot().collectionCoverage.uploads, windowMinutes: 30 } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, releaseHash: 'UPPERCASE' } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, releaseHash: null, cutoverAt: '2026-10-29T03:00:00.000Z', cutoverWindowComplete: false, buildCoverageComplete: false } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, releaseHash: null, cutoverAt: null, cutoverWindowComplete: true, buildCoverageComplete: false } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, releaseHash: null, cutoverAt: null, cutoverWindowComplete: false, matchingBuildAttemptsCount: 1, buildCoverageComplete: false } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, cutoverAt: '2026-10-29T04:30:00.000Z', cutoverWindowComplete: true } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, cutoverAt: '2026-10-29T05:00:00.000001Z', cutoverWindowComplete: false, buildCoverageComplete: false } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, unattributedAttemptsCount: 1, buildCoverageComplete: true } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, staleBuildAttemptsCount: 1, buildCoverageComplete: true } },
    { ...snapshot().collectionCoverage, exports: { ...snapshot().collectionCoverage.exports, invalidBuildAttemptsCount: 1, buildCoverageComplete: true } },
    { ...snapshot().collectionCoverage, uploads: { ...snapshot().collectionCoverage.uploads, matchingBuildAttemptsCount: 1 } },
  ])('rejects malformed or contradictory collectionCoverage payload %j', async collectionCoverage => {
    mockRetry.mockResolvedValue({ data: { ...snapshot(), collectionCoverage }, error: null })
    expect(await loadOperationalSnapshot()).toEqual({ ok: false, reason: 'invalid_snapshot' })
  })

  it.each([
    ['2026-10-29T04:00:00.000000Z', true],
    ['2026-10-29T04:00:00.000001Z', false],
  ] as const)('preserves microsecond cutoverWindowComplete boundary: %s', async (cutoverAt, cutoverWindowComplete) => {
    const base = snapshot()
    mockRetry.mockResolvedValue({
      data: {
        ...base,
        collectionCoverage: {
          ...base.collectionCoverage,
          exports: {
            ...base.collectionCoverage.exports,
            cutoverAt,
            cutoverWindowComplete,
            buildCoverageComplete: cutoverWindowComplete,
          },
        },
      },
      error: null,
    })
    const res = await loadOperationalSnapshot()
    expect(res).toMatchObject({
      ok: true,
      snapshot: {
        collectionCoverage: {
          exports: { cutoverWindowComplete, buildCoverageComplete: cutoverWindowComplete },
        },
      },
    })
  })

  it('distinguishes mature ledger windowComplete from unsealed or incomplete deployment collection coverage', () => {
    const data = snapshot()
    data.collectionCoverage.exports = {
      ...data.collectionCoverage.exports,
      releaseHash: null, cutoverAt: null, cutoverWindowComplete: false, buildCoverageComplete: false,
    }
    data.collectionCoverage.uploads = {
      ...data.collectionCoverage.uploads,
      releaseHash: null, cutoverAt: null, cutoverWindowComplete: false,
      unattributedAttemptsCount: 10, buildCoverageComplete: false,
    }
    Object.assign(data.uploads, { evaluatedAttemptsCount: 10, reportedFailuresCount: 5 })
    const health = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
    expect(data.exports.windowComplete).toBe(true)
    expect(data.uploads.windowComplete).toBe(true)
    expect(health.unavailableMetrics).toContain('export_collection_coverage')
    expect(health.unavailableMetrics).toContain('upload_collection_coverage')
    expect(health.unavailableMetrics).toContain('uploads')
    expect(health.unavailableMetrics).not.toContain('export_observation_window')
    expect(health.unavailableMetrics).not.toContain('upload_observation_window')
    expect(health.alerts.map(a => a.code)).not.toContain('upload_failure_spike')
  })

  it('marks collection coverage incomplete when runtime OPERATIONAL_COLLECTOR_BUILD_HASH mismatches sealed releaseHash or is malformed', () => {
    const data = snapshot()
    Object.assign(data.uploads, { evaluatedAttemptsCount: 10, reportedFailuresCount: 5 })
    data.collectionCoverage.uploads.matchingBuildAttemptsCount = 10

    process.env.OPERATIONAL_COLLECTOR_BUILD_HASH = 'b'.repeat(64)
    const mismatched = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
    expect(mismatched.unavailableMetrics).toEqual(expect.arrayContaining([
      'export_collection_coverage', 'upload_collection_coverage', 'uploads',
    ]))
    expect(mismatched.alerts.map(a => a.code)).not.toContain('upload_failure_spike')

    process.env.OPERATIONAL_COLLECTOR_BUILD_HASH = 'invalid-hash'
    const malformed = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
    expect(malformed.unavailableMetrics).toEqual(expect.arrayContaining([
      'export_collection_coverage', 'upload_collection_coverage', 'uploads',
    ]))

    process.env.OPERATIONAL_COLLECTOR_BUILD_HASH = releaseHash
    const matched = operationalHealthFromSnapshot({ ok: true, snapshot: data }, '500')
    expect(matched.unavailableMetrics).not.toContain('export_collection_coverage')
    expect(matched.unavailableMetrics).toContain('upload_collection_coverage')
    expect(matched.alerts.map(a => a.code)).toContain('upload_failure_spike')
  })
})

it('does not let a reader without a collector build identity claim sealed-release coverage', () => {
  delete process.env.OPERATIONAL_COLLECTOR_BUILD_HASH
  const health = operationalHealthFromSnapshot({ ok: true, snapshot: snapshot() }, '500')
  expect(health.unavailableMetrics).toEqual(expect.arrayContaining(['export_collection_coverage', 'upload_collection_coverage']))
})
