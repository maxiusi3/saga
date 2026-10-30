/** @jest-environment node */
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { getSupabaseAdmin } from '@/lib/supabase'
import { requireCurrentMediaAsset } from '../media-asset-guard'

const mockProjectAccess = jest.fn()
jest.mock('../project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockProjectAccess(...args) }))

const user = { id: 'alice' } as User
const asset = { id: 'asset-1', project_id: 'project-1', story_id: 'story-1', bucket: 'saga',
  object_key: 'stored/exact/key', kind: 'original_image', state: 'ready', version: 1 }

function fixture(current: unknown = asset, ledger: unknown = []) {
  const events: string[] = []
  const select = jest.fn()
  const eq = jest.fn()
  const subjects = jest.fn()
  const from = jest.fn((table: string) => {
    const result = { data: table === 'media_assets' ? current : ledger, error: null }
    const chain: any = {
      select: (value: unknown) => { select(table, value); return chain },
      eq: (...args: unknown[]) => { eq(table, ...args); return chain },
      in: (...args: unknown[]) => { subjects(...args); return chain },
      not: () => chain,
      maybeSingle: async () => { events.push(table); return result },
      then: (resolve: (value: unknown) => unknown) => { events.push(table); return Promise.resolve(result).then(resolve) },
    }
    return chain
  })
  mockProjectAccess.mockImplementation(async () => { events.push('permission'); return { ok: true } })
  const admin = { from } as unknown as ReturnType<typeof getSupabaseAdmin>
  return { admin, events, from, select, eq, subjects }
}

beforeEach(() => jest.resetAllMocks())

it('checks project access, pinned asset, then the asset/story ledger as the last await', async () => {
  const f = fixture()
  expect(await requireCurrentMediaAsset(f.admin, user, asset, ['ready'])).toEqual({ ok: true })
  expect(f.events).toEqual(['permission', 'media_assets', 'deletion_requests'])
  expect(mockProjectAccess).toHaveBeenCalledWith(asset.project_id, user)
  expect(f.select).toHaveBeenCalledWith('media_assets', '*')
  expect(f.eq).toHaveBeenCalledWith('deletion_requests', 'project_id', asset.project_id)
  expect(f.subjects).toHaveBeenCalledWith('subject_id', [asset.id, asset.story_id])
})

it.each(['id', 'project_id', 'story_id', 'bucket', 'object_key', 'kind', 'state', 'version'])('rejects a changed pinned %s', async field => {
  const f = fixture({ ...asset, [field]: field === 'version' ? 2 : 'changed' })
  const result = await requireCurrentMediaAsset(f.admin, user, asset, ['ready'])
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.response.status).toBe(409)
  expect(f.events).toEqual(['permission', 'media_assets'])
})

it.each([
  { id: undefined }, { project_id: undefined }, { bucket: undefined }, { object_key: undefined },
  { kind: undefined }, { version: undefined }, { version: 0 }, { version: '1' }, { story_id: 42 },
])('fails closed even if both snapshots contain invalid identity %j', async invalid => {
  const malformed = { ...asset, ...invalid }
  const f = fixture(malformed)
  const result = await requireCurrentMediaAsset(f.admin, user, malformed, ['ready'])
  expect(result.ok).toBe(false)
  expect(f.events).not.toContain('deletion_requests')
})

it('does not reload data after a denied project check', async () => {
  const f = fixture()
  const denied = { ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  mockProjectAccess.mockResolvedValue(denied)
  expect(await requireCurrentMediaAsset(f.admin, user, asset, ['ready'])).toBe(denied)
  expect(f.from).not.toHaveBeenCalled()
})

it.each([null, {}, 'invalid'])('fails closed on malformed deletion evidence %j', async ledger => {
  const f = fixture(asset, ledger)
  const result = await requireCurrentMediaAsset(f.admin, user, asset, ['ready'])
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.response.status).toBe(500)
})

it('allows quarantine only for the response to the matching committed quarantine', async () => {
  const quarantined = { ...asset, state: 'quarantined', version: 2 }
  const f = fixture(quarantined)
  expect(await requireCurrentMediaAsset(f.admin, user, quarantined, ['quarantined'])).toEqual({ ok: true })
  expect((await requireCurrentMediaAsset(f.admin, user, quarantined, ['ready'])).ok).toBe(false)
})

it('catches rejected database promises without returning provider text', async () => {
  const f = fixture()
  f.from.mockImplementation(() => { throw new Error('private provider detail') })
  const result = await requireCurrentMediaAsset(f.admin, user, asset, ['ready'])
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.response.status).toBe(500)
    expect(await result.response.text()).not.toContain('private provider detail')
  }
})
