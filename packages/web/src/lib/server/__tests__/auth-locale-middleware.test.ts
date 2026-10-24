/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '../../../../middleware'
const mockIntl = jest.fn((_request: NextRequest) => NextResponse.next())
// Keep the framework's ESM routing implementation outside this unit boundary;
// assert this project's middleware forwards requests instead of rewriting auth.
jest.mock('next-intl/middleware', () => () => (request: NextRequest) => mockIntl(request))
beforeEach(() => jest.clearAllMocks())
test.each(['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'pt'])('delegates canonical %s callback and its unchanged query to locale middleware', locale => {
  const request = new NextRequest(`https://synthetic.invalid/${locale}/auth/callback?code=synthetic&next=%2Fdashboard`)
  expect(middleware(request).status).toBe(200)
  expect(mockIntl).toHaveBeenCalledWith(request)
})
test('historical malformed domain path is delegated instead of redirected to auth callback', () => {
  const request = new NextRequest('https://synthetic.invalid/saga-web-livid.vercel.app?code=synthetic')
  const response = middleware(request)
  expect(response.headers.get('location')).toBeNull()
  expect(mockIntl).toHaveBeenCalledWith(request)
})
