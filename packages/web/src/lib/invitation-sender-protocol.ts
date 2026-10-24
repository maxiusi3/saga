import {
  isInvitationToken, isRecord, isTimestamp, isUuid, parseStatusResponse,
  type InvitationFailureOutcome, type InvitationRole, type InvitationState, type InvitationStatusFields,
} from './invitation-acceptance-protocol'

export type SendOptions = { request_id: string; source_id: string; message?: string | null }
export type SendInput = SendOptions & { email: string; role: InvitationRole; message: string | null }
export type ReleaseInput = { invitation_id: string; reason: 'cancelled' | 'expired' }
export type LookupInput = { request_id: string; project_id: string; role: InvitationRole }
export type SendFields = { invitation_id: string; project_id: string; token: string; role: InvitationRole; status: InvitationState; expires_at: string; outcome: 'created' | 'reused' }
export type ReleaseFields = { invitation_id: string; project_id: string; status: 'declined' | 'expired'; outcome: 'released' | 'already_released' }
export type LookupFields = InvitationStatusFields & { token: string }
export type SendResponse = SendFields & { success: true }
export type ReleaseResponse = ReleaseFields & { success: true }
export type LookupResponse = LookupFields & { success: true; outcome: 'confirmed' }

export function isCanonicalUuid(value: unknown): value is string { return isUuid(value) && value === value.toLowerCase() }
function isRole(value: unknown): value is InvitationRole { return value === 'facilitator' || value === 'storyteller' }
function hasOnly(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).every(key => keys.includes(key)) }
const sendKeys = ['request_id', 'source_id', 'email', 'role', 'message']
export function isIncompleteLegacySend(value: unknown) {
  return isRecord(value) && hasOnly(value, sendKeys) && (!('request_id' in value) || !('source_id' in value))
}
export function parseSendInput(value: unknown): SendInput | null {
  if (!isRecord(value) || !hasOnly(value, sendKeys) || !isCanonicalUuid(value.request_id)
    || !isCanonicalUuid(value.source_id) || !isRole(value.role) || typeof value.email !== 'string') return null
  const email = value.email.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '')
  if (email.length > 254 || !/^[!-~]+@[!-~]+$/.test(email) || email.split('@').length !== 2) return null
  const message = value.message === undefined || value.message === null || value.message === '' ? null : value.message
  if (message !== null && (typeof message !== 'string' || Array.from(message).length > 2000)) return null
  return { request_id: value.request_id, source_id: value.source_id, email: email.toLowerCase(), role: value.role, message }
}
export function parseReleaseInput(value: unknown): ReleaseInput | null {
  if (!isRecord(value) || !hasOnly(value, ['invitation_id', 'reason']) || !isCanonicalUuid(value.invitation_id)
    || (value.reason !== 'cancelled' && value.reason !== 'expired')) return null
  return { invitation_id: value.invitation_id, reason: value.reason }
}
export function parseLookupInput(value: unknown): LookupInput | null {
  if (!isRecord(value) || !hasOnly(value, ['request_id', 'project_id', 'role']) || !isCanonicalUuid(value.request_id)
    || !isCanonicalUuid(value.project_id) || !isRole(value.role)) return null
  return { request_id: value.request_id, project_id: value.project_id, role: value.role }
}
function singleRow(data: unknown) { return Array.isArray(data) && data.length === 1 && isRecord(data[0]) ? data[0] : null }
export function parseSendRow(data: unknown, projectId: string, role: InvitationRole): SendFields | null {
  const row = singleRow(data)
  if (!row || !isCanonicalUuid(row.invitation_id) || !isCanonicalUuid(row.project_id) || row.project_id !== projectId
    || row.role !== role || !isRole(row.role) || !isInvitationToken(row.token) || !isTimestamp(row.expires_at)
    || (row.status !== 'pending' && row.status !== 'accepted' && row.status !== 'declined' && row.status !== 'expired')
    || (row.outcome !== 'created' && row.outcome !== 'reused') || (row.outcome === 'created' && row.status !== 'pending')) return null
  return { invitation_id: row.invitation_id, project_id: row.project_id, token: row.token, role: row.role, status: row.status, expires_at: row.expires_at, outcome: row.outcome }
}
export function parseReleaseRow(data: unknown, input: ReleaseInput): ReleaseFields | null {
  const row = singleRow(data)
  if (!row || !isCanonicalUuid(row.invitation_id) || row.invitation_id !== input.invitation_id || !isCanonicalUuid(row.project_id)
    || (row.status !== 'declined' && row.status !== 'expired') || row.status !== (input.reason === 'cancelled' ? 'declined' : 'expired')
    || (row.outcome !== 'released' && row.outcome !== 'already_released')) return null
  return { invitation_id: row.invitation_id, project_id: row.project_id, status: row.status, outcome: row.outcome }
}
export function parseLookupRow(data: unknown, input: LookupInput): LookupFields | null {
  const row = singleRow(data)
  if (!row || !isCanonicalUuid(row.invitation_id) || !isCanonicalUuid(row.project_id) || row.project_id !== input.project_id
    || row.role !== input.role || !isInvitationToken(row.token)
    || (row.user_id !== null && !isCanonicalUuid(row.user_id)) || (row.member_id !== null && !isCanonicalUuid(row.member_id))) return null
  // Sender recovery may describe a different accepted recipient. Do not pass the sender as an actor constraint.
  const fields = parseStatusResponse({ ...row, success: true, outcome: 'confirmed' })
  if (!fields) return null
  const { success: _, outcome: __, ...status } = fields
  return { ...status, token: row.token }
}
export function parseSendResponse(value: unknown, projectId: string, role: InvitationRole): SendResponse | null {
  const fields = isRecord(value) && value.success === true ? parseSendRow([value], projectId, role) : null
  return fields ? { success: true, ...fields } : null
}
export function parseReleaseResponse(value: unknown, input: ReleaseInput, expectedProjectId?: string): ReleaseResponse | null {
  const fields = isRecord(value) && value.success === true ? parseReleaseRow([value], input) : null
  return fields && (expectedProjectId === undefined || fields.project_id === expectedProjectId) ? { success: true, ...fields } : null
}
export function parseLookupResponse(value: unknown, input: LookupInput): LookupResponse | null {
  const fields = isRecord(value) && value.success === true && value.outcome === 'confirmed' ? parseLookupRow([value], input) : null
  return fields ? { success: true, outcome: 'confirmed', ...fields } : null
}
export function parseSenderFailure(value: unknown, status: number): InvitationFailureOutcome | null {
  if (!isRecord(value) || value.success !== false || typeof value.error !== 'string') return null
  const outcome = value.outcome
  if (value.can_query_status !== (outcome === 'unknown')) return null
  if (outcome === 'rejected' && [400, 403, 409].includes(status)) return outcome
  if (outcome === 'not_attempted' && [401, 503].includes(status)) return outcome
  return outcome === 'unknown' && status === 503 ? outcome : null
}
