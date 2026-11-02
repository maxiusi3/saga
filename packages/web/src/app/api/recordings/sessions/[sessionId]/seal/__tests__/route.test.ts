/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const mockAuth = jest.fn()
const mockProjectAccess = jest.fn()
const mockFrom = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockProjectAccess(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ from: (...args: unknown[]) => mockFrom(...args) }) }))

type Row = Record<string, unknown>
const chunks = [{ index: 0, chunkId: 'chunk-0', bucket: 'audio-recordings',
  objectKey: 'projects/proj-1/sessions/session-alpha-1/0', byteSize: 2048, sha256: 'a'.repeat(64) }]
const body = { projectId: 'proj-1', storyId: 'story-1', mimeType: 'audio/webm', chunks }
const headers = new Headers()
headers.append('Set-Cookie', 'one=refreshed; Path=/')
headers.append('Set-Cookie', 'two=refreshed; Path=/')
let rows: Record<string, Row[]>
let fail: { table: string; operation: 'read' | 'insert'; afterCommit?: boolean; throws?: boolean } | undefined
let afterJobInsert: (() => void) | undefined
let originalFlag: string | undefined

function makeRequest(value: unknown = body) {
  return new NextRequest('http://localhost/api/recordings/sessions/session-alpha-1/seal', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value),
  })
}
const seal = (value: unknown = body) => POST(makeRequest(value), { params: Promise.resolve({ sessionId: 'session-alpha-1' }) })

// Emulate only the query/uniqueness contracts exercised by this route, not PostgreSQL.
function query(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let payload: Row | undefined
  async function execute(single: boolean) {
    const operation = payload ? 'insert' : 'read'
    const fault = fail?.table === table && fail.operation === operation ? fail : undefined
    if (fault) fail = undefined
    if (fault?.throws) throw new Error('private database failure details')
    if (fault && !fault.afterCommit) return { data: null, error: { code: 'XX000' } }
    if (payload) {
      const stored = rows[table] ??= []
      if (stored.some(row => row.id === payload!.id || (row.idempotency_key === payload!.idempotency_key &&
          (table === 'processing_jobs' || row.project_id === payload!.project_id)))) {
        return { data: null, error: { code: '23505' } }
      }
      const row = { cancel_requested_at: null, result_ref: null, ...payload }
      stored.push(structuredClone(row))
      if (table === 'processing_jobs') afterJobInsert?.()
      return fault ? { data: null, error: { code: 'XX000' } } : { data: structuredClone(row), error: null }
    }
    const selected = (rows[table] ?? []).filter(row => filters.every(filter => filter(row)))
    if (single && selected.length > 1) return { data: null, error: { code: 'PGRST116' } }
    return { data: structuredClone(single ? selected[0] ?? null : selected), error: null }
  }
  const chain = {
    select: (_columns?: string) => chain,
    eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return chain },
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return chain },
    not: (key: string, _operator: string, _value: unknown) => { filters.push(row => row[key] != null); return chain },
    insert: (value: Row) => { payload = structuredClone(value); return chain },
    single: () => execute(true),
    maybeSingle: () => execute(true),
    then: (resolve: (result: Awaited<ReturnType<typeof execute>>) => unknown, reject: (error: unknown) => unknown) => execute(false).then(resolve, reject),
  }
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
  originalFlag = process.env.MEDIA_ASSETS_ENABLED
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user: { id: 'alice' }, headers })
  mockProjectAccess.mockResolvedValue({ ok: true })
  rows = { media_assets: [], processing_jobs: [], deletion_requests: [],
    project_roles: [{ id: 'role-1', project_id: 'proj-1', user_id: 'alice', role: 'storyteller', status: 'active' }],
    stories: [{ id: 'story-1', project_id: 'proj-1', storyteller_id: 'alice' }] }
  fail = undefined
  afterJobInsert = undefined
  mockFrom.mockImplementation(query)
})
afterEach(() => {
  if (originalFlag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
  else process.env.MEDIA_ASSETS_ENABLED = originalFlag
})

it('registers once and replays the actual filtered asset/job without duplicate rows or cleanup permission', async () => {
  const first = await seal()
  expect(first.status).toBe(202)
  const created = await first.json()
  const second = await seal()
  expect(second.status).toBe(202)
  expect(await second.json()).toMatchObject({ idempotentReplay: true, canClearLocalDrafts: false,
    asset: { id: created.asset.id }, job: { id: created.job.id } })
  expect(rows.media_assets).toHaveLength(1)
  expect(rows.processing_jobs).toHaveLength(1)
  expect(second.headers.get('cache-control')).toBe('no-store')
  expect(second.headers.getSetCookie()).toEqual(headers.getSetCookie())
})

it('concurrent identical seals converge on one asset and one job using insert conflicts', async () => {
  const responses = await Promise.all([seal(), seal(), seal()])
  expect(responses.map(response => response.status)).toEqual([202, 202, 202])
  const payloads = await Promise.all(responses.map(response => response.json()))
  expect(new Set(payloads.map(payload => payload.asset.id)).size).toBe(1)
  expect(new Set(payloads.map(payload => payload.job.id)).size).toBe(1)
  expect(rows.media_assets).toHaveLength(1)
  expect(rows.processing_jobs).toHaveLength(1)
})

it.each([false, true])('repairs a failed job registration afterCommit=%s on explicit retry without replacing the asset', async afterCommit => {
  fail = { table: 'processing_jobs', operation: 'insert', afterCommit }
  expect((await seal()).status).toBe(500)
  const original = structuredClone(rows.media_assets)
  expect(original).toHaveLength(1)
  expect(rows.processing_jobs).toHaveLength(afterCommit ? 1 : 0)
  const retried = await seal()
  expect(retried.status).toBe(202)
  expect((await retried.json()).canClearLocalDrafts).toBe(false)
  expect(rows.media_assets).toEqual(original)
  expect(rows.processing_jobs).toHaveLength(1)
})

it('reconciles an asset insert whose commit succeeded but acknowledgement failed', async () => {
  fail = { table: 'media_assets', operation: 'insert', afterCommit: true }
  expect((await seal()).status).toBe(500)
  const id = rows.media_assets[0].id
  expect((await seal()).status).toBe(202)
  expect(rows.media_assets.map(row => row.id)).toEqual([id])
  expect(rows.processing_jobs).toHaveLength(1)
})

it.each(['manifest', 'mime', 'story', 'owner', 'object', 'version'])('rejects conflicting %s without overwriting a registered capture', async mode => {
  await seal()
  let retry: unknown = body
  if (mode === 'manifest') retry = { ...body, chunks: [{ ...chunks[0], sha256: 'b'.repeat(64) }] }
  if (mode === 'mime') retry = { ...body, mimeType: 'audio/ogg' }
  if (mode === 'story') { rows.stories.push({ ...rows.stories[0], id: 'story-2' }); retry = { ...body, storyId: 'story-2' } }
  if (mode === 'owner') rows.media_assets[0].created_by = 'bob'
  if (mode === 'object') rows.media_assets[0].object_key = 'elsewhere'
  if (mode === 'version') rows.media_assets[0].version = 2
  const before = structuredClone(rows)
  expect((await seal(retry)).status).toBe(409)
  expect(rows).toEqual(before)
})

it.each(['project_id', 'asset_id', 'created_by', 'job_type', 'input_version', 'processor_version', 'parameter_version', 'model_config_version'])('rejects mismatched job %s', async field => {
  await seal()
  rows.processing_jobs[0][field] = 'wrong'
  expect((await seal()).status).toBe(409)
  expect(rows.processing_jobs).toHaveLength(1)
})

it.each(['cancelled', 'failed', 'outcome_unknown', 'unknown'])('does not acknowledge terminal or unknown job state %s as a successful seal', async state => {
  await seal()
  rows.processing_jobs[0].state = state
  expect((await seal()).status).toBe(409)
})

it('ready asset alone is not confirmation; even a coherent completed replay cannot authorize local cleanup', async () => {
  await seal()
  const asset = rows.media_assets[0]
  asset.state = 'ready'
  expect((await seal()).status).toBe(409)
  Object.assign(asset, { sha256: 'c'.repeat(64), duration_ms: 1000, verified_at: '2026-11-02T00:00:00.000Z', content_verified_at: '2026-11-02T00:00:00.000Z' })
  Object.assign(rows.processing_jobs[0], { state: 'succeeded', result_ref: asset.id })
  const response = await seal()
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ idempotentReplay: true, canClearLocalDrafts: false })
  rows.processing_jobs = []
  expect((await seal()).status).toBe(409)
  expect(rows.processing_jobs).toHaveLength(0)
})

it.each(['project_roles', 'stories', 'deletion_requests', 'media_assets', 'processing_jobs'])('fails closed on %s lookup failure, not treating it as absence', async table => {
  fail = { table, operation: 'read' }
  const response = await seal()
  expect(response.status).toBe(500)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(rows.processing_jobs).toHaveLength(0)
})

it('contains unexpected database exceptions without exposing details', async () => {
  fail = { table: 'media_assets', operation: 'read', throws: true }
  const response = await seal()
  expect(response.status).toBe(500)
  expect(await response.text()).not.toContain('private database')
})

it.each(['pending', 'removed', 'member', 'facilitator', 'missing'])('does not promote %s to an active storyteller', async mode => {
  if (mode === 'missing') rows.project_roles = []
  else if (['pending', 'removed'].includes(mode)) rows.project_roles[0].status = mode
  else rows.project_roles[0].role = mode
  expect((await seal()).status).toBe(403)
  expect(rows.media_assets).toHaveLength(0)
})

it.each(['project', 'owner', 'missing'])('rejects a story with wrong %s', async mode => {
  if (mode === 'project') rows.stories[0].project_id = 'proj-b'
  if (mode === 'owner') rows.stories[0].storyteller_id = 'bob'
  if (mode === 'missing') rows.stories = []
  expect((await seal()).status).toBe(mode === 'missing' ? 404 : 403)
  expect(rows.media_assets).toHaveLength(0)
})

it.each(['story-1', 'session-alpha-1'])('rejects an active deletion tombstone for %s', async subject => {
  rows.deletion_requests.push({ subject_id: subject, project_id: 'proj-1', tombstone_at: '2026-11-02T00:00:00.000Z' })
  expect((await seal()).status).toBe(409)
  expect(rows.media_assets).toHaveLength(0)
})

it.each(['role', 'deletion'])('revalidates %s after a job write, without authorizing cleanup or deleting the partial rows', async mode => {
  afterJobInsert = () => {
    if (mode === 'role') rows.project_roles[0].status = 'removed'
    else rows.deletion_requests.push({ subject_id: 'story-1', project_id: 'proj-1', tombstone_at: '2026-11-02T00:00:00.000Z' })
  }
  expect((await seal()).status).toBe(mode === 'role' ? 403 : 409)
  expect(rows.media_assets).toHaveLength(1)
  expect(rows.processing_jobs).toHaveLength(1)
})

it.each(['false', '1', 'TRUE'])('keeps feature flag %s disabled', async value => {
  process.env.MEDIA_ASSETS_ENABLED = value
  expect((await seal()).status).toBe(404)
  expect(mockFrom).not.toHaveBeenCalled()
})

it('preserves unauthenticated refusal without querying storage', async () => {
  mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
  const response = await seal()
  expect(response.status).toBe(401)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(mockFrom).not.toHaveBeenCalled()
})

it.each([null, { ...body, chunks: [] }, { ...body, chunks: [null] }, { ...body, mimeType: 'text/html' },
  { ...body, projectId: '../proj' }, { ...body, chunks: Array.from({ length: 2001 }, () => chunks[0]) }])('rejects malformed or over-limit manifest %# before writes', async value => {
  expect((await seal(value)).status).toBe(400)
  expect(rows.media_assets).toHaveLength(0)
})
