/** @jest-environment node */
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const mockAuth = jest.fn()
const mockAccess = jest.fn()
const mockAdmin = jest.fn()
const mockFrom = jest.fn()
const mockRpc = jest.fn()
const mockRetry = jest.fn()
const mockAbort = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockAccess(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))

const asset = {
  id: 'asset-123', project_id: 'project-123', kind: 'original_audio', state: 'pending_upload',
  story_id: 'story-123', version: 1, bucket: 'audio-recordings', object_key: 'private/object',
}
const id = '11111111-1111-4111-8111-111111111111'
const reportToken = 'A'.repeat(43)
const finish = { action: 'finish', attemptId: id, reportToken, outcome: 'client_succeeded' }
const binding = (assetId: string, userId: string, token: string) => createHash('sha256').update(JSON.stringify([assetId, userId, token])).digest('hex')
function query(data: unknown, error: unknown = null) {
  const chain: any = {
    select: jest.fn(() => chain), eq: jest.fn(() => chain), in: jest.fn(() => chain), not: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({ data, error })),
    then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
  }
  return chain
}
function request(body: unknown = { action: 'begin' }, signal?: AbortSignal) {
  return new NextRequest('http://localhost/api/media/assets/asset-123/upload-attempts', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}
const invoke = (req = request(), assetId = asset.id) => POST(req, { params: Promise.resolve({ assetId }) })

beforeEach(() => {
  jest.resetAllMocks()
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  const headers = new Headers()
  headers.append('Set-Cookie', 'session-a=refreshed; Path=/')
  headers.append('Set-Cookie', 'session-b=refreshed; Path=/')
  mockAuth.mockResolvedValue({ ok: true, user: { id: 'user-123' }, headers })
  mockAccess.mockResolvedValue({ ok: true })
  mockAdmin.mockReturnValue({ from: mockFrom, rpc: mockRpc })
  mockFrom.mockImplementation(table => query(table === 'media_assets' ? asset : []))
  mockRpc.mockImplementation((_name, args) => {
    mockRetry.mockResolvedValue({ data: { schemaVersion: 1, attemptId: args.p_attempt_id, state: args.p_outcome ?? 'started' }, error: null })
    return { abortSignal: mockAbort }
  })
  mockAbort.mockReturnValue({ retry: mockRetry })
})
afterEach(() => { delete process.env.MEDIA_ASSETS_ENABLED; jest.useRealTimers() })

it('authenticates and generates independent random credentials bound to the loaded asset and user', async () => {
  const req = request()
  const res = await invoke(req)
  const body = await res.json()
  expect(body).toEqual({ schemaVersion: 1, attemptId: expect.stringMatching(/^[a-f0-9-]{36}$/), reportToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), state: 'started' })
  expect(mockAuth).toHaveBeenCalledWith(req)
  expect(mockRpc).toHaveBeenCalledWith('begin_browser_upload_attempt', {
    p_attempt_id: body.attemptId, p_binding_hash: binding(asset.id, 'user-123', body.reportToken),
  })
  expect(mockAccess).toHaveBeenCalledTimes(2)
  expect(mockAccess).toHaveBeenCalledWith(asset.project_id, { id: 'user-123' })
  expect(mockFrom.mock.calls.map(([table]) => table)).toEqual(['media_assets', 'media_assets', 'deletion_requests', 'media_assets', 'deletion_requests'])
  expect(mockRetry).toHaveBeenCalledWith(false)
  expect(res.status).toBe(200)
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(res.headers.getSetCookie()).toEqual(['session-a=refreshed; Path=/', 'session-b=refreshed; Path=/'])
  const other = await (await invoke()).json()
  expect(other.attemptId).not.toBe(body.attemptId)
  expect(other.reportToken).not.toBe(body.reportToken)
})

it.each(['pending_upload', 'uploaded', 'verifying', 'ready', 'quarantined'])('finishes for eligible current state %s with no token echo', async state => {
  mockFrom.mockImplementation(table => query(table === 'media_assets' ? { ...asset, state } : []))
  const res = await invoke(request(finish))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ schemaVersion: 1, attemptId: id, state: 'client_succeeded' })
  expect(mockRpc).toHaveBeenCalledWith('finish_browser_upload_attempt', {
    p_attempt_id: id, p_binding_hash: binding(asset.id, 'user-123', reportToken), p_outcome: 'client_succeeded',
  })
})

it.each(['client_succeeded', 'client_failed', 'client_conflict', 'client_cancelled'])('accepts only defined outcome %s', async outcome => {
  expect((await invoke(request({ ...finish, outcome }))).status).toBe(200)
})

it.each([null, [], {}, { action: 'unknown' }, { action: 'begin', attemptId: id },
  { action: 'begin', userId: 'other' }, { action: 'begin', assetId: 'other' }, { action: 'begin', startedAt: 'yesterday' },
  { action: 'begin', objectKey: 'private' }, { ...finish, outcome: 'succeeded' }, { ...finish, error: 'private text' },
  { ...finish, attemptId: 'invalid' }, { ...finish, reportToken: 'A'.repeat(42) },
  { ...finish, reportToken: 'A'.repeat(43) + '\n' }, { ...finish, reportToken: '='.repeat(43) },
])('rejects body outside the exact allowlist %j', async body => {
  expect((await invoke(request(body))).status).toBe(400)
  expect(mockRpc).not.toHaveBeenCalled()
})

it('rejects invalid JSON and invalid asset IDs', async () => {
  expect((await invoke(new NextRequest('http://localhost/api/media/assets/asset-123/upload-attempts', { method: 'POST', body: '{' }))).status).toBe(400)
  expect((await invoke(request(), '../other')).status).toBe(400)
  expect(mockRpc).not.toHaveBeenCalled()
})

it('requires authentication before loading or writing', async () => {
  mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
  const res = await invoke()
  expect(res.status).toBe(401)
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(mockFrom).not.toHaveBeenCalled()
  expect(mockRpc).not.toHaveBeenCalled()
})

it.each([undefined, 'false', 'TRUE', '1'])('requires exact enabled flag %j', async flag => {
  if (flag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
  else process.env.MEDIA_ASSETS_ENABLED = flag
  expect((await invoke()).status).toBe(404)
  expect(mockFrom).not.toHaveBeenCalled()
})

it.each(['uploaded', 'verifying', 'ready', 'quarantined', 'deleted'])('does not begin for state %s', async state => {
  mockFrom.mockImplementation(table => query(table === 'media_assets' ? { ...asset, state } : []))
  expect((await invoke()).status).toBe(409)
  expect(mockRpc).not.toHaveBeenCalled()
})

it.each([{ kind: 'original_image' }, { state: 'deleted' }, { tombstone_at: 'today' }])('rejects ineligible finish %j', async patch => {
  mockFrom.mockImplementation(table => query(table === 'media_assets' ? { ...asset, ...patch } : []))
  expect((await invoke(request(finish))).status).toBe(409)
  expect(mockRpc).not.toHaveBeenCalled()
})

it.each(['begin', 'finish'])('preserves permission failure before %s', async action => {
  mockAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Denied' }, { status: 403 }) })
  expect((await invoke(request(action === 'begin' ? { action } : finish))).status).toBe(403)
  expect(mockRpc).not.toHaveBeenCalled()
})

it.each(['user', 'asset', 'token'])('cannot finish another binding by changing %s', async change => {
  const expected = binding(asset.id, 'user-123', reportToken)
  if (change === 'user') mockAuth.mockResolvedValue({ ok: true, user: { id: 'other-user' }, headers: new Headers() })
  if (change === 'asset') mockFrom.mockImplementation(table => query(table === 'media_assets' ? { ...asset, id: 'other-asset' } : []))
  mockRpc.mockImplementation((_name, args) => {
    expect(args.p_binding_hash).not.toBe(expected)
    mockRetry.mockResolvedValue({ data: null, error: { message: 'binding mismatch private' } })
    return { abortSignal: mockAbort }
  })
  const res = await invoke(request(change === 'token' ? { ...finish, reportToken: 'B'.repeat(43) } : finish))
  expect(res.status).toBe(503)
  expect(await res.text()).not.toMatch(/private|reportToken/)
})

it.each(['begin', 'finish'])('reauthorizes after confirmed %s before responding', async action => {
  mockRpc.mockImplementation((_name, args) => {
    mockAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Denied' }, { status: 403 }) })
    mockRetry.mockResolvedValue({ data: { schemaVersion: 1, attemptId: args.p_attempt_id, state: args.p_outcome ?? 'started' }, error: null })
    return { abortSignal: mockAbort }
  })
  const res = await invoke(request(action === 'begin' ? { action } : finish))
  expect(res.status).toBe(403)
  expect(await res.text()).not.toMatch(/attemptId|reportToken/)
  expect(res.headers.getSetCookie()).toHaveLength(2)
  expect(mockRpc).toHaveBeenCalledTimes(1)
})

it.each(['story deletion', 'asset deletion', 'identity', 'missing'])('discards confirmed receipt after %s during RPC', async change => {
  mockRpc.mockImplementation((_name, args) => {
    mockFrom.mockImplementation(table => table === 'media_assets'
      ? query(change === 'missing' ? null : change === 'identity' ? { ...asset, version: 2 } : asset)
      : query(change.includes('deletion') ? [{ subject_id: change === 'story deletion' ? asset.story_id : asset.id, tombstone_at: 'today' }] : []))
    mockRetry.mockResolvedValue({ data: { schemaVersion: 1, attemptId: args.p_attempt_id, state: 'started' }, error: null })
    return { abortSignal: mockAbort }
  })
  const res = await invoke()
  expect(res.status).toBe(change === 'missing' ? 404 : 409)
  expect(await res.text()).not.toMatch(/attemptId|reportToken/)
})

it('fails closed on asset load/database errors with no private details', async () => {
  mockFrom.mockReturnValue(query(null, { message: 'private db error' }))
  const res = await invoke()
  expect(res.status).toBe(503)
  expect(await res.text()).not.toContain('private')
  expect(mockRpc).not.toHaveBeenCalled()
  mockAdmin.mockImplementation(() => { throw new Error('secret') })
  expect((await invoke()).status).toBe(503)
})

it('uses shipped columns for the asset guard and no table mutation', async () => {
  const q = query(asset)
  mockFrom.mockImplementation(table => table === 'media_assets' ? q : query([]))
  expect((await invoke()).status).toBe(200)
  expect(q.select.mock.calls.every(([columns]: [string]) => columns === '*')).toBe(true)
  expect(q.eq.mock.calls.every(([column]: [string]) => column === 'id')).toBe(true)
  expect(q.not).not.toHaveBeenCalled()
})

it('begins with the request signal but finishes on an independent bounded signal', async () => {
  jest.useFakeTimers()
  const caller = new AbortController()
  mockRpc.mockImplementation(() => {
    mockRetry.mockImplementation(() => new Promise(() => {}))
    return { abortSignal: mockAbort }
  })
  const pending = invoke(request(finish, caller.signal))
  await jest.advanceTimersByTimeAsync(0)
  caller.abort()
  expect(mockAbort.mock.calls[0][0].aborted).toBe(false)
  await jest.advanceTimersByTimeAsync(5000)
  expect((await pending).status).toBe(503)
  expect(mockRpc).toHaveBeenCalledTimes(1)
  mockRpc.mockClear()
  expect((await invoke(request({ action: 'begin' }, caller.signal))).status).toBe(503)
  expect(mockRpc).not.toHaveBeenCalled()
})

it.each(['begin', 'finish'])('rejects unknown %s receipts without publishing credentials', async action => {
  mockRpc.mockImplementation((_name, args) => {
    mockRetry.mockResolvedValue({ data: { schemaVersion: 1, attemptId: args.p_attempt_id, state: args.p_outcome ?? 'started', privateText: 'private' }, error: null })
    return { abortSignal: mockAbort }
  })
  const res = await invoke(request(action === 'begin' ? { action } : finish))
  expect(res.status).toBe(503)
  expect(await res.text()).not.toMatch(/attemptId|reportToken|private/)
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockAccess).toHaveBeenCalledTimes(1)
})

describe.each(['begin', 'finish'])('%s guard failures', action => {
  describe.each(['before RPC', 'after RPC'])('%s', phase => {
    const afterRpc = phase === 'after RPC'

    it.each(['asset database', 'deletion database', 'invalid identity', 'project database', 'thrown access'])('sanitizes %s failures to 503', async failure => {
      let assetReads = 0
      let deletionReads = 0
      let accessChecks = 0
      mockFrom.mockImplementation(table => {
        if (table === 'media_assets') {
          const fail = ++assetReads === (afterRpc ? 3 : 2)
          if (fail && failure === 'asset database') return query(null, { message: 'private asset database failure' })
          return query(fail && failure === 'invalid identity' ? { ...asset, version: null } : asset)
        }
        const fail = ++deletionReads === (afterRpc ? 2 : 1)
        return fail && failure === 'deletion database' ? query(null, { message: 'private deletion database failure' }) : query([])
      })
      mockAccess.mockImplementation(async () => {
        const fail = ++accessChecks === (afterRpc ? 2 : 1)
        if (fail && failure === 'thrown access') throw new Error('private access failure')
        if (fail && failure === 'project database') return { ok: false, response: NextResponse.json({ error: 'private project database failure' }, { status: 500 }) }
        return { ok: true }
      })
      const res = await invoke(request(action === 'begin' ? { action } : finish))
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'Upload observation is unavailable' })
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(res.headers.getSetCookie()).toEqual(['session-a=refreshed; Path=/', 'session-b=refreshed; Path=/'])
      expect(mockRpc).toHaveBeenCalledTimes(afterRpc ? 1 : 0)
    })

    it.each([401, 403, 404, 409, 400, 502, 503])('preserves only authorization/state status %s', async status => {
      if (afterRpc) mockAccess.mockResolvedValueOnce({ ok: true })
      mockAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Guard failure' }, { status }) })
      const res = await invoke(request(action === 'begin' ? { action } : finish))
      const preserved = [401, 403, 404, 409].includes(status)
      expect(res.status).toBe(preserved ? status : 503)
      expect(await res.json()).toEqual({ error: preserved ? 'Guard failure' : 'Upload observation is unavailable' })
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(res.headers.getSetCookie()).toEqual(['session-a=refreshed; Path=/', 'session-b=refreshed; Path=/'])
      expect(mockRpc).toHaveBeenCalledTimes(afterRpc ? 1 : 0)
    })
  })
})
