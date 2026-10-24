import { authLocale, authReturnTarget, hasVerifiedSession, parseSessionReturn } from '../auth-return'
import { locales } from '@/i18n/config'
const token = 'v1_0123456789abcdef0123456789abcdef'
const target = (value: string, locale = 'en') => authReturnTarget(new URLSearchParams({ next: value }), locale)
test.each(locales)('accepts supported targets in locale %s', locale => {
  for (const path of ['/dashboard', '/dashboard/projects/ABC_123-4', `/invite/${token}`, `/accept-invitation?token=${token}`]) {
    expect(target(path, locale)).toBe(`/${locale}${path}`)
    expect(target(`/ja${path}`, locale)).toBe(`/ja${path}`)
  }
})
test.each([
  '', 'dashboard', '//outside.invalid', 'https://outside.invalid', '/dashboard/', '/dashboard//x',
  '/dashboard/..', '/dashboard/.', '/dashboard/%2e%2e', '/dashboard?code=secret', '/dashboard#fragment',
  '/dashboard?next=/invite/x', '/dashboard/hello world', '/dashboard/é', '/dashboard/\\escape',
  "/dashboard/'</script>", '/dashboard/"', '/auth/signin', '/api/invitations', '/zz/dashboard',
  '/invite/v1_0123456789ABCDEF0123456789abcdef', `/invite/${token}/extra`,
  `/accept-invitation?token=${token}&token=${token}`, `/accept-invitation?token=${token}&x=1`,
  `/accept-invitation?token=${token}#x`, '/dashboard/\n', '/dashboard/\u0000', '/dashboard/\u007f',
  '/dashboard/' + 'a'.repeat(2048), '%2Fdashboard', '/%65n/dashboard', '/dashboard/%252e',
])('falls back for unsupported target %j', value => expect(target(value, 'fr')).toBe('/fr/dashboard'))
test('uses current safe locale on missing/duplicate targets and invalid locales', () => {
  expect(authLocale('evil')).toBe('en')
  expect(authReturnTarget(new URLSearchParams(), 'ko')).toBe('/ko/dashboard')
  expect(authReturnTarget(new URLSearchParams('next=/ja/dashboard&next=/fr/dashboard'), 'pt')).toBe('/pt/dashboard')
  expect(authReturnTarget(new URLSearchParams('next=%252Fdashboard'), 'en')).toBe('/en/dashboard')
  expect(authReturnTarget(new URLSearchParams('next=%2Fdashboard'), 'en')).toBe('/en/dashboard')
  expect(target('/dashboard/' + 'a'.repeat(2037))).toHaveLength(2051)
})
test.each([null, {}, { session: null, user: null }, { session: {}, user: { id: 'fake' } }])('rejects incomplete session data %j', value => expect(hasVerifiedSession(value)).toBe(false))
test('requires matching UUID provider user and complete session', () => {
  const user = { id: '11111111-1111-4111-8111-111111111111' }
  const session = { access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_at: 2_000_000_000, expires_in: 3600, user }
  expect(hasVerifiedSession({ session, user })).toBe(true)
  for (const key of Object.keys(session)) expect(hasVerifiedSession({ session: { ...session, [key]: undefined }, user })).toBe(false)
  expect(hasVerifiedSession({ session, user: { id: '22222222-2222-4222-8222-222222222222' } })).toBe(false)
  expect(hasVerifiedSession({ session: { ...session, expires_at: 1 }, user })).toBe(false)
})
test('session parsing supports a single query or fragment pair, never second-decodes', () => {
  expect(parseSessionReturn(new URLSearchParams('access_token=a&refresh_token=r'), new URLSearchParams())).toEqual({ kind: 'session', credentials: { access_token: 'a', refresh_token: 'r' } })
  expect(parseSessionReturn(new URLSearchParams(), new URLSearchParams('access_token=a&refresh_token=r'))).toMatchObject({ kind: 'session' })
  expect(parseSessionReturn(new URLSearchParams('access_token=%2525&refresh_token=r'), new URLSearchParams())).toEqual({ kind: 'invalid' })
})

test.each([' ', '\t', 'has space', 'has\nnewline', '\u0000', 'bad%token', '<script>'])('rejects malformed output session token %j without imposing the URL input length limit', value => {
  const user = { id: '11111111-1111-4111-8111-111111111111' }
  const session = { access_token: 'a'.repeat(8000), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 2_000_000_000, user }
  expect(hasVerifiedSession({ session, user })).toBe(true)
  expect(hasVerifiedSession({ session: { ...session, access_token: value }, user })).toBe(false)
  expect(hasVerifiedSession({ session: { ...session, refresh_token: value }, user })).toBe(false)
})
