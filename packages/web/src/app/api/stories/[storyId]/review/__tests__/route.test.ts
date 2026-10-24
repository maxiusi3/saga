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

const user = { id: 'clara-member' } as any
const headers = new Headers({ 'Set-Cookie': 'session=refreshed' })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/stories/story-alpha-1/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/stories/[storyId]/review', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ ok: true, user, headers })
    mockProjectAccess.mockResolvedValue({ ok: true })
  })

  it('records a family dispute decision preserving both storyteller memory and family alternative', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stories') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({ data: { id: 'story-alpha-1', project_id: 'proj-alpha' }, error: null })),
        }
        return chain
      }
      if (table === 'deletion_requests') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          not: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({ data: null, error: null })),
        }
        return chain
      }
      if (table === 'story_assertions') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({
            data: {
              id: 'assert-1',
              project_id: 'proj-alpha',
              story_id: 'story-alpha-1',
              transcript_version_id: 'tv-1',
              segment_id: 'seg-1',
              assertion_type: 'year_date',
              subject: '1968',
              claim_text: 'Boat rebuilt in 1968',
              source_quote: 'in 1968',
              start_ms: 0,
              end_ms: 12000,
              date_precision: 'exact',
              memory_attribution: 'storyteller_memory',
              verification_status: 'verified',
              review_decision: 'unreviewed',
              is_severe_fabrication: false,
            },
            error: null,
          })),
          update: jest.fn(() => chain),
          then: (resolve: (val: unknown) => void) => resolve({ error: null }),
        }
        return chain
      }
      return {}
    })

    const response = await POST(
      makeRequest({
        operation: 'decide_assertion',
        assertionId: 'assert-1',
        action: 'dispute',
        disputedAlternativeText: 'Aunt Clara remembers the harbor storm was autumn 1969.',
      }),
      { params: Promise.resolve({ storyId: 'story-alpha-1' }) },
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.assertion.verificationStatus).toBe('disputed')
    expect(payload.assertion.memoryAttribution).toBe('disputed_memory')
    expect(payload.assertion.disputedAlternativeText).toContain('autumn 1969')
    expect(payload.assertion.disputedBy).toBe('clara-member')
  })

  it('blocks revision approval with 409 when unresolved severe fabrication exists', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stories') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({ data: { id: 'story-alpha-1', project_id: 'proj-alpha' }, error: null })),
        }
        return chain
      }
      if (table === 'deletion_requests') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          not: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({ data: null, error: null })),
        }
        return chain
      }
      if (table === 'story_revisions') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => ({
            data: {
              id: 'rev-1',
              project_id: 'proj-alpha',
              story_id: 'story-alpha-1',
              transcript_version_id: 'tv-1',
              revision_number: 1,
              status: 'draft',
              title: 'Draft Title',
              body: 'Draft Body',
              summary: 'Summary',
              provenance_links: [],
              content_sha256: 'a'.repeat(64),
              created_by: 'clara-member',
            },
            error: null,
          })),
        }
        return chain
      }
      if (table === 'story_assertions') {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: [
                {
                  id: 'assert-severe',
                  project_id: 'proj-alpha',
                  story_id: 'story-alpha-1',
                  transcript_version_id: 'tv-1',
                  segment_id: 'seg-1',
                  assertion_type: 'person',
                  subject: 'Invented Stranger',
                  claim_text: 'Invented Stranger was there',
                  verification_status: 'unverified_rejected',
                  review_decision: 'unreviewed',
                  is_severe_fabrication: true,
                },
              ],
              error: null,
            }),
        }
        return chain
      }
      return {}
    })

    const response = await POST(
      makeRequest({
        operation: 'approve_revision',
        revisionId: 'rev-1',
      }),
      { params: Promise.resolve({ storyId: 'story-alpha-1' }) },
    )

    expect(response.status).toBe(409)
    const payload = await response.json()
    expect(payload.error).toMatch(/g2_approval_blocked/)
  })
})
