/** @jest-environment node */

import { NextRequest } from 'next/server'
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
  return new NextRequest('http://localhost/api/recordings/sessions/session-alpha-1/seal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validChunks = [
  {
    index: 0,
    chunkId: 'chunk-0',
    bucket: 'audio-recordings' as const,
    objectKey: 'projects/proj-1/sessions/session-alpha-1/0',
    byteSize: 2048,
    sha256: 'a'.repeat(64),
  },
]

describe('POST /api/recordings/sessions/[sessionId]/seal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.MEDIA_ASSETS_ENABLED = 'true'
    mockAuth.mockResolvedValue({ ok: true, user, headers })
    mockProjectAccess.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    delete process.env.MEDIA_ASSETS_ENABLED
  })

  it('replays existing asset and job idempotently without creating duplicates', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'deletion_requests') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          not: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({ data: null, error: null })),
        }
        return chain
      }
      if (table === 'media_assets') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({
            data: { id: 'asset-existing', state: 'ready', project_id: 'proj-1' },
            error: null,
          })),
        }
        return chain
      }
      if (table === 'processing_jobs') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({
            data: { id: 'job-existing', state: 'succeeded', asset_id: 'asset-existing' },
            error: null,
          })),
        }
        return chain
      }
      return {}
    })

    const response = await POST(
      makeRequest({
        projectId: 'proj-1',
        storyId: 'story-1',
        mimeType: 'audio/webm',
        chunks: validChunks,
      }),
      { params: Promise.resolve({ sessionId: 'session-alpha-1' }) },
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.idempotentReplay).toBe(true)
    expect(payload.canClearLocalDrafts).toBe(true)
    expect(payload.asset.id).toBe('asset-existing')
  })

  it('rejects session seal with 409 when target story has an active deletion tombstone', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'deletion_requests') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          not: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({
            data: { id: 'del-1', tombstone_at: '2026-10-24T12:00:00.000Z' },
            error: null,
          })),
        }
        return chain
      }
      return {}
    })

    const response = await POST(
      makeRequest({
        projectId: 'proj-1',
        storyId: 'story-deleted',
        mimeType: 'audio/webm',
        chunks: validChunks,
      }),
      { params: Promise.resolve({ sessionId: 'session-alpha-1' }) },
    )

    expect(response.status).toBe(409)
  })
})
