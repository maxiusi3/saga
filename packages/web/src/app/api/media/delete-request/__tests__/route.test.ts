/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const mockAuth = jest.fn()
const mockProjectAccess = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockProjectAccess(...args) }))
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const user = { id: 'alice' } as any
const headers = new Headers({ 'Set-Cookie': 'session=refreshed' })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/media/delete-request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/media/delete-request', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.MEDIA_ASSETS_ENABLED = 'true'
    mockAuth.mockResolvedValue({ ok: true, user, headers })
    mockProjectAccess.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    delete process.env.MEDIA_ASSETS_ENABLED
  })

  it('returns 404 when MEDIA_ASSETS_ENABLED is not enabled', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED
    const response = await POST(makeRequest({ projectId: 'proj-1', assetId: 'asset-1' }))
    expect(response.status).toBe(404)
  })

  it('rejects cross-family or revoked access before reading assets', async () => {
    mockProjectAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    })
    const response = await POST(makeRequest({ projectId: 'proj-beta', assetId: 'asset-1' }))
    expect(response.status).toBe(403)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('creates a deletion tombstone, transitions assets to deleting, and cancels active jobs', async () => {
    const updatedTables: string[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === 'projects') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({ data: { id: 'proj-1', facilitator_id: 'alice' }, error: null })),
        }
        return chain
      }
      if (table === 'media_assets') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          update: jest.fn(() => {
            updatedTables.push('media_assets')
            return chain
          }),
          in: jest.fn(() => chain),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: [
                {
                  id: 'asset-1',
                  project_id: 'proj-1',
                  story_id: 'story-1',
                  bucket: 'audio-recordings',
                  object_key: 'alice/projects/proj-1/assets/asset-1/original',
                  state: 'ready',
                },
              ],
              error: null,
            }),
        }
        return chain
      }
      if (table === 'deletion_requests') {
        const chain: any = {
          insert: jest.fn(() => chain),
          select: jest.fn(() => chain),
          single: jest.fn(async () => ({
            data: { id: 'del-1', project_id: 'proj-1', subject_id: 'asset-1', state: 'requested' },
            error: null,
          })),
        }
        return chain
      }
      if (table === 'processing_jobs') {
        const chain: any = {
          update: jest.fn(() => {
            updatedTables.push('processing_jobs')
            return chain
          }),
          in: jest.fn(() => chain),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        }
        return chain
      }
      return {}
    })

    const response = await POST(makeRequest({ projectId: 'proj-1', assetId: 'asset-1' }))
    expect(response.status).toBe(202)
    const payload = await response.json()
    expect(payload.deletionRequest.subjectId).toBe('asset-1')
    expect(payload.deletionRequest.tombstoneAt).toBeTruthy()
    expect(updatedTables).toEqual(['media_assets', 'processing_jobs'])
  })
})
