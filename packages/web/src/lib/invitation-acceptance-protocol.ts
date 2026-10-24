export type InvitationRole = 'facilitator' | 'storyteller'
export type InvitationState = 'pending' | 'accepted' | 'declined' | 'expired'
export type InvitationFailureOutcome = 'not_attempted' | 'rejected' | 'unknown'
export type InvitationStatusFields = {
  invitation_id: string
  project_id: string
  role: InvitationRole
  status: InvitationState
  expires_at: string
  is_expired: boolean
  user_id: string | null
  member_id: string | null
  joined_at: string | null
}
export type InvitationAcceptanceFields = {
  invitation_id: string
  project_id: string
  user_id: string
  member_id: string
  role: InvitationRole
  status: 'accepted'
  joined_at: string
  outcome: 'accepted' | 'already_accepted'
}
export type InvitationAcceptanceResponse = InvitationAcceptanceFields & { success: true }
export type InvitationStatusResponse = InvitationStatusFields & { success: true; outcome: 'confirmed' }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function isInvitationToken(value: unknown): value is string {
  return typeof value === 'string' && value.length === 35 && /^v1_[0-9a-f]{32}$/.test(value)
}
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
export function isAccessToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._~+/-]+=*$/.test(value) && !/\s/.test(value)
}
export function readBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/i)
  return match && isAccessToken(match[1]) ? match[1] : null
}

export function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) return false
  const [, year, month, day, hour, minute, second, zone] = match
  const y = Number(year), m = Number(month), d = Number(day)
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return m >= 1 && m <= 12 && d >= 1 && d <= monthDays[m - 1]
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59
    && (zone === 'Z' || (Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4)) <= 59))
}
function isRole(value: unknown): value is InvitationRole {
  return value === 'facilitator' || value === 'storyteller'
}

export function isConfirmedProviderUser(value: unknown): value is { id: string; email: string; email_confirmed_at: string } {
  if (!isRecord(value) || !isUuid(value.id) || typeof value.email !== 'string' || !isTimestamp(value.email_confirmed_at)) return false
  // Match candidate._email: outer ASCII whitespace only, no Unicode/provider folding.
  const email = value.email.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '')
  return /^[!-~]+@[!-~]+$/.test(email) && email.split('@').length === 2
}

export function parseInvitationBody(value: unknown): { token: string; userId?: string } | null {
  if (!isRecord(value) || !isInvitationToken(value.token)
    || Object.keys(value).some(key => key !== 'token' && key !== 'user_id')) return null
  if ('user_id' in value) return isUuid(value.user_id) ? { token: value.token, userId: value.user_id } : null
  return { token: value.token }
}
function singleRow(data: unknown): Record<string, unknown> | null {
  return Array.isArray(data) && data.length === 1 && isRecord(data[0]) ? data[0] : null
}
function statusFields(row: unknown, actorId?: string): InvitationStatusFields | null {
  if (!isRecord(row) || !isUuid(row.invitation_id) || !isUuid(row.project_id) || !isRole(row.role)
    || !isTimestamp(row.expires_at) || typeof row.is_expired !== 'boolean') return null
  const status = row.status
  if (status !== 'pending' && status !== 'accepted' && status !== 'declined' && status !== 'expired') return null
  if (status === 'accepted') {
    if (!isUuid(row.user_id) || (actorId !== undefined && row.user_id !== actorId)
      || !isUuid(row.member_id) || !isTimestamp(row.joined_at)) return null
  } else if (row.user_id !== null || row.member_id !== null || row.joined_at !== null) return null
  if (status === 'expired' && row.is_expired !== true) return null
  return {
    invitation_id: row.invitation_id, project_id: row.project_id, role: row.role, status,
    expires_at: row.expires_at, is_expired: row.is_expired,
    user_id: row.user_id as string | null, member_id: row.member_id as string | null,
    joined_at: row.joined_at as string | null,
  }
}
export function parseStatusRow(data: unknown, token: string, actorId: string): InvitationStatusFields | null {
  const row = singleRow(data)
  return row && isInvitationToken(row.token) && row.token === token ? statusFields(row, actorId) : null
}
function acceptanceFields(row: unknown): InvitationAcceptanceFields | null {
  if (!isRecord(row) || !isUuid(row.invitation_id) || !isUuid(row.project_id)
    || !isUuid(row.user_id) || !isUuid(row.member_id) || !isRole(row.role)
    || row.status !== 'accepted' || !isTimestamp(row.joined_at)
    || (row.outcome !== 'accepted' && row.outcome !== 'already_accepted')) return null
  return {
    invitation_id: row.invitation_id, project_id: row.project_id, user_id: row.user_id,
    member_id: row.member_id, role: row.role, status: row.status, joined_at: row.joined_at, outcome: row.outcome,
  }
}
export function parseAcceptanceRow(data: unknown, expected: InvitationStatusFields, actorId: string): InvitationAcceptanceFields | null {
  const row = acceptanceFields(singleRow(data))
  if (!row || row.invitation_id !== expected.invitation_id || row.project_id !== expected.project_id
    || row.role !== expected.role || row.user_id !== actorId) return null
  if (expected.status === 'accepted' && (row.member_id !== expected.member_id || row.joined_at !== expected.joined_at
    || row.outcome !== 'already_accepted')) return null
  return row
}
export function parseAcceptanceResponse(value: unknown): InvitationAcceptanceResponse | null {
  if (!isRecord(value) || value.success !== true) return null
  const fields = acceptanceFields(value)
  return fields ? { success: true, ...fields } : null
}
export function parseStatusResponse(value: unknown): InvitationStatusResponse | null {
  if (!isRecord(value) || value.success !== true || value.outcome !== 'confirmed') return null
  const fields = statusFields(value)
  return fields ? { success: true, outcome: 'confirmed', ...fields } : null
}
