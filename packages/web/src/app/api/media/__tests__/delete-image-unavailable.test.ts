/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../delete-image/route'

const mockAuth = jest.fn()
const mockAdmin = jest.fn()
const mockStorage = jest.fn()
const mockRemove = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))

const refreshedCookies = [
  'session.0=first; Path=/; HttpOnly; Expires=Fri, 23 Oct 2026 12:00:00 GMT',
  'session.1=second; Path=/; HttpOnly',
]
const authHeaders = () => {
  const headers = new Headers({ 'X-Auth-Mode': 'cookie', 'Cache-Control': 'public, max-age=600' })
  refreshedCookies.forEach(cookie => headers.append('Set-Cookie', cookie))
  return headers
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ ok: true, user: { id: 'alice' }, headers: authHeaders() })
  mockAdmin.mockReturnValue({ storage: { from: mockStorage } })
  mockStorage.mockReturnValue({ remove: mockRemove })
  mockRemove.mockResolvedValue({ data: [], error: null })
})

it.each([
  ['owned paths', JSON.stringify({ paths: ['alice/images/photo.png', 'alice/images/photo-thumb.png'] })],
  ['another uploader', JSON.stringify({ paths: ['bob/images/photo.png'] })],
  ['empty paths', JSON.stringify({ paths: [] })],
  ['malformed JSON', '{'],
  ['invalid path type', JSON.stringify({ paths: [null] })],
])('refuses %s without parsing paths or creating an admin client', async (_name, body) => {
  const request = new NextRequest('http://localhost/api/media/delete-image', { method: 'POST', body })
  const read = jest.spyOn(request, 'json')

  const response = await POST(request)

  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({
    code: 'MEDIA_DELETION_UNAVAILABLE',
    error: expect.stringMatching(/temporarily unavailable/i),
  })
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('X-Auth-Mode')).toBe('cookie')
  expect(response.headers.getSetCookie()).toEqual(refreshedCookies)
  expect(read).not.toHaveBeenCalled()
  expect(mockAdmin).not.toHaveBeenCalled()
  expect(mockStorage).not.toHaveBeenCalled()
  expect(mockRemove).not.toHaveBeenCalled()
})

it.each([401, 503])('retains authentication rejection %s and all headers without reading the body', async status => {
  const rejection = NextResponse.json({ error: 'Authentication rejected' }, { status })
  authHeaders().forEach((value, name) => {
    if (name !== 'set-cookie') rejection.headers.set(name, value)
  })
  refreshedCookies.forEach(cookie => rejection.headers.append('Set-Cookie', cookie))
  mockAuth.mockResolvedValue({ ok: false, response: rejection })
  const request = new NextRequest('http://localhost/api/media/delete-image', { method: 'POST', body: '{' })
  const read = jest.spyOn(request, 'json')

  const response = await POST(request)

  expect(response).toBe(rejection)
  expect(response.status).toBe(status)
  expect(await response.json()).toEqual({ error: 'Authentication rejected' })
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('X-Auth-Mode')).toBe('cookie')
  expect(response.headers.getSetCookie()).toEqual(refreshedCookies)
  expect(read).not.toHaveBeenCalled()
  expect(mockAdmin).not.toHaveBeenCalled()
  expect(mockStorage).not.toHaveBeenCalled()
})
