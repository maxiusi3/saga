/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { GET } from '../route'

const getAuthenticatedClient = jest.fn()
const from = jest.fn()
const select = jest.fn()
const eq = jest.fn()
const single = jest.fn()
const maybeSingle = jest.fn()

jest.mock('@/lib/server/authenticated-client', () => ({
  getAuthenticatedClient: (...args: unknown[]) => getAuthenticatedClient(...args),
}))

function queryBuilder(table: string) {
  if (table === 'projects') {
    return { select }
  }

  if (table === 'project_roles') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    }
  }

  if (table === 'stories') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ count: 0, error: null })),
      })),
    }
  }

  return { select: jest.fn() }
}

describe('/api/projects/[id]/overview', () => {
  beforeEach(() => {
    single.mockResolvedValue({
      data: {
        id: 'project-1',
        name: 'Smoke project',
        facilitator_id: 'user-1',
      },
      error: null,
    })
    eq.mockReturnValue({ single })
    select.mockReturnValue({ eq })
    from.mockImplementation(queryBuilder)
    getAuthenticatedClient.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      client: { from },
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns an owned project overview with a facilitator role without requiring the admin client', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/project-1/overview'),
      { params: Promise.resolve({ id: 'project-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      project: {
        id: 'project-1',
        name: 'Smoke project',
        facilitator_id: 'user-1',
        user_role: 'facilitator',
        is_owner: true,
      },
      members: [],
      storyCount: 0,
    })
    expect(getAuthenticatedClient).toHaveBeenCalledWith(expect.any(NextRequest))
    expect(from).toHaveBeenCalledWith('projects')
    expect(select).toHaveBeenCalledWith('*')
    expect(eq).toHaveBeenCalledWith('id', 'project-1')
  })

  it('returns auth denial before querying project data', async () => {
    getAuthenticatedClient.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await GET(
      new NextRequest('http://localhost/api/projects/project-1/overview'),
      { params: Promise.resolve({ id: 'project-1' }) },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(from).not.toHaveBeenCalled()
  })
})
