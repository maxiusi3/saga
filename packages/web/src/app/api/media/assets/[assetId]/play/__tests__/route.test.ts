/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '../route'
const mockAccess = jest.fn()
jest.mock('../../access/route', () => ({ GET: (...args: unknown[]) => mockAccess(...args) }))
const assetId = '11111111-1111-4111-8111-111111111111'
const context = { params: Promise.resolve({ assetId }) }
const request = () => new NextRequest(`http://localhost/api/media/assets/${assetId}/play`)
it.each(['https://storage.invalid/signed', 'http://127.0.0.1:54321/storage/signed'])('uses guarded access and preserves cookies for %s', async signedUrl => {
  const response = NextResponse.json({ signedUrl })
  response.headers.append('Set-Cookie', 'a=1; Path=/'); response.headers.append('Set-Cookie', 'b=2; Path=/')
  mockAccess.mockResolvedValue(response)
  const result = await GET(request(), context)
  expect(result.status).toBe(307); expect(result.headers.get('Location')).toBe(signedUrl)
  expect(result.headers.get('Cache-Control')).toBe('no-store'); expect(result.headers.getSetCookie()).toEqual(response.headers.getSetCookie())
})
it.each([401, 403, 404, 409, 500])('returns guarded denial %s without redirect', async status => {
  mockAccess.mockResolvedValue(NextResponse.json({ error: 'denied' }, { status }))
  const result = await GET(request(), context)
  expect(result.status).toBe(status); expect(result.headers.get('Location')).toBeNull()
})
it('rejects a malformed playback identity', async () => {
  mockAccess.mockClear()
  expect((await GET(request(), { params: Promise.resolve({ assetId: 'bad' }) })).status).toBe(400)
  expect(mockAccess).not.toHaveBeenCalled()
})
