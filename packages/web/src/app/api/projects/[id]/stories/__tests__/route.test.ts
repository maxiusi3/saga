/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedClient = jest.fn()
const createRouteHandlerClient = jest.fn()
const getSupabaseAdmin = jest.fn()
const from = jest.fn()

jest.mock('@/lib/server/authenticated-client', () => ({
  getAuthenticatedClient: (...args: unknown[]) => getAuthenticatedClient(...args),
}))

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: (...args: unknown[]) => createRouteHandlerClient(...args),
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdmin(...args),
}))

function projectRolesQuery() {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: { id: 'role-1' }, error: null })),
          })),
        })),
      })),
    })),
  }
}

function projectQuery() {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn(() => Promise.resolve({
          data: { facilitator_id: 'facilitator-1' },
          error: null,
        })),
      })),
    })),
  }
}

const insert = jest.fn(() => ({
  select: jest.fn(() => ({
    single: jest.fn(() => Promise.resolve({
      data: {
        id: 'story-1',
        project_id: 'project-1',
        storyteller_id: 'user-1',
        title: 'Typed story',
      },
      error: null,
    })),
  })),
}))

function storiesQuery() {
  return { insert }
}

describe('/api/projects/[id]/stories', () => {
  beforeEach(() => {
    insert.mockClear()
    from.mockImplementation((table: string) => {
      if (table === 'project_roles') return projectRolesQuery()
      if (table === 'projects') return projectQuery()
      if (table === 'stories') return storiesQuery()
      return { select: jest.fn() }
    })
    getAuthenticatedClient.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      client: { from },
    })
    createRouteHandlerClient.mockReturnValue({
      auth: {
        getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: new Error('no cookie') })),
      },
    })
    getSupabaseAdmin.mockImplementation(() => {
      throw new Error('service role unavailable')
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('creates a text story from bearer auth without requiring the service role key', async () => {
    const request = new NextRequest('http://localhost/api/projects/project-1/stories', {
      method: 'POST',
      headers: {
        authorization: 'Bearer user-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Typed story',
        content: 'Typed body',
        transcript: 'Typed body',
        audio_duration: 0,
        happened_at: '2026-06-26T00:00:00.000Z',
        recording_mode: 'chat',
        is_public: false,
      }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'project-1' }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      story: {
        id: 'story-1',
        project_id: 'project-1',
        storyteller_id: 'user-1',
        title: 'Typed story',
      },
    })
    expect(getAuthenticatedClient).toHaveBeenCalledWith(request)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'project-1',
      storyteller_id: 'user-1',
      user_id: 'user-1',
      title: 'Typed story',
      content: 'Typed body',
      transcript: 'Typed body',
      audio_duration: 0,
      recording_mode: 'chat',
      is_public: false,
      status: 'ready',
    }))
  })
})
