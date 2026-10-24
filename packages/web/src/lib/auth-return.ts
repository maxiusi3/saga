import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { isInvitationToken, isRecord, isUuid } from '@/lib/invitation-acceptance-protocol'

export const AUTH_RETURN_ERROR = 'Error: Authentication could not be confirmed. Please sign in again.'
export const EMAIL_AUTH_TYPES = ['email', 'magiclink', 'invite', 'signup', 'recovery', 'email_change'] as const
export function authLocale(value: unknown): Locale {
  return locales.includes(value as Locale) ? value as Locale : defaultLocale
}

// Input must already have been decoded once by URLSearchParams. Never trim or decode it again.
export function authReturnTarget(params: Pick<URLSearchParams, 'getAll'>, currentLocale: unknown): string {
  const fallback = `/${authLocale(currentLocale)}/dashboard`
  const values = params.getAll('next')
  if (values.length !== 1) return fallback
  const value = values[0]
  if (!value || value.length > 2048 || /[^\x21-\x7e]|[%\\#'"<>]/.test(value)) return fallback
  const segments = value.split('/')
  const explicitLocale = locales.includes(segments[1] as Locale) ? segments[1] as Locale : null
  const path = explicitLocale ? value.slice(explicitLocale.length + 1) : value
  const valid = /^\/dashboard(?:\/[A-Za-z0-9_-]+)*$/.test(path)
    || (path.startsWith('/invite/') && isInvitationToken(path.slice('/invite/'.length)))
    || (path.startsWith('/accept-invitation?token=') && isInvitationToken(path.slice('/accept-invitation?token='.length)))
  return valid ? `/${explicitLocale || authLocale(currentLocale)}${path}` : fallback
}

export function removeLegacyAuthNext(): void {
  // Accessing the storage getter can itself throw, before removeItem runs.
  try { window.localStorage.removeItem('auth_next') } catch { /* best effort; never read or restore */ }
}

export function isAuthCredential(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096
    && !/[\s\x00-\x1f\x7f]/.test(value)
}
function isSessionToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._~+/-]+=*$/.test(value)
}
export function hasVerifiedSession(data: unknown): boolean {
  if (!isRecord(data) || !isRecord(data.session) || !isRecord(data.user)) return false
  const session = data.session
  return isUuid(data.user.id) && isRecord(session.user) && session.user.id === data.user.id
    && isSessionToken(session.access_token) && isSessionToken(session.refresh_token)
    && session.token_type === 'bearer'
    && typeof session.expires_in === 'number' && Number.isFinite(session.expires_in) && session.expires_in > 0
    && typeof session.expires_at === 'number' && Number.isFinite(session.expires_at) && session.expires_at > Date.now() / 1000
}

type SessionReturn = { kind: 'none' | 'invalid' } | { kind: 'session'; credentials: { access_token: string; refresh_token: string } }
export function parseSessionReturn(query: URLSearchParams, fragment: URLSearchParams): SessionReturn {
  const merged = new URLSearchParams(query)
  fragment.forEach((value, key) => merged.append(key, value))
  const identityKeys = ['access_token', 'refresh_token', 'token_type', 'type', 'expires_in', 'expires_at', 'provider_token', 'provider_refresh_token', 'code', 'token_hash']
  if (['error', 'error_code', 'error_description'].some(key => merged.has(key))) return { kind: 'invalid' }
  if (!identityKeys.some(key => merged.has(key))) return { kind: 'none' }
  if (identityKeys.some(key => merged.getAll(key).length > 1) || merged.has('code') || merged.has('token_hash')) return { kind: 'invalid' }
  const access = merged.get('access_token'), refresh = merged.get('refresh_token')
  if (!isAuthCredential(access) || !isAuthCredential(refresh)
    || !isSessionToken(access) || !isSessionToken(refresh)
    || (merged.has('token_type') && merged.get('token_type') !== 'bearer')
    || (merged.has('type') && !EMAIL_AUTH_TYPES.includes(merged.get('type') as typeof EMAIL_AUTH_TYPES[number]))
    || ['expires_in', 'expires_at'].some(key => merged.has(key) && !/^[0-9]{1,12}$/.test(merged.get(key)!))
    || ['provider_token', 'provider_refresh_token'].some(key => merged.has(key) && !isAuthCredential(merged.get(key)))) return { kind: 'invalid' }
  return { kind: 'session', credentials: { access_token: access, refresh_token: refresh } }
}
