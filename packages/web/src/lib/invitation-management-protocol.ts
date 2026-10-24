import {
  isRecord,
  isTimestamp,
  type InvitationRole,
  type InvitationState,
} from './invitation-acceptance-protocol'
import { isCanonicalUuid } from './invitation-sender-protocol'

export type SourcesInput = { project_id: string; role: InvitationRole }
export type ManagementInput = { project_id: string; after?: string }
export type InvitationSource = SourcesInput & { source_id: string; remaining: number }
export type ManagedInvitation = {
  invitation_id: string
  project_id: string
  invitee_email: string
  role: InvitationRole
  status: InvitationState
  expires_at: string
  created_at: string
  request_id: string | null
}
function only(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every(key => keys.includes(key))
}
function role(value: unknown): value is InvitationRole {
  return value === 'storyteller' || value === 'facilitator'
}
export function parseSourcesInput(value: unknown): SourcesInput | null {
  return isRecord(value) &&
    only(value, ['project_id', 'role']) &&
    isCanonicalUuid(value.project_id) &&
    role(value.role)
    ? { project_id: value.project_id, role: value.role }
    : null
}
export function parseManagementInput(value: unknown): ManagementInput | null {
  if (
    !isRecord(value) ||
    !only(value, ['project_id', 'after']) ||
    !isCanonicalUuid(value.project_id) ||
    ('after' in value && !isCanonicalUuid(value.after))
  )
    return null
  return {
    project_id: value.project_id,
    ...(typeof value.after === 'string' ? { after: value.after } : {}),
  }
}
export function parseSourcesRows(value: unknown, input: SourcesInput): InvitationSource[] | null {
  if (!Array.isArray(value) || value.length > 100) return null
  const items: InvitationSource[] = []
  let previous = ''
  for (const row of value) {
    if (
      !isRecord(row) ||
      !isCanonicalUuid(row.source_id) ||
      row.source_id <= previous ||
      row.project_id !== input.project_id ||
      row.role !== input.role ||
      !Number.isSafeInteger(row.remaining) ||
      (row.remaining as number) < 1 ||
      (row.remaining as number) > 2147483647
    )
      return null
    items.push({
      source_id: row.source_id,
      project_id: input.project_id,
      role: input.role,
      remaining: row.remaining as number,
    })
    previous = row.source_id
  }
  return items
}
export function parseManagementRows(
  value: unknown,
  input: ManagementInput
): ManagedInvitation[] | null {
  if (!Array.isArray(value) || value.length > 50) return null
  const items: ManagedInvitation[] = []
  let previous = input.after || ''
  for (const row of value) {
    if (
      !isRecord(row) ||
      !isCanonicalUuid(row.invitation_id) ||
      row.invitation_id <= previous ||
      row.project_id !== input.project_id ||
      !role(row.role) ||
      typeof row.status !== 'string' ||
      !['pending', 'accepted', 'declined', 'expired'].includes(row.status) ||
      typeof row.invitee_email !== 'string' ||
      row.invitee_email.length > 254 ||
      !/^[!-~]+@[!-~]+$/.test(row.invitee_email) ||
      row.invitee_email.split('@').length !== 2 ||
      row.invitee_email !== row.invitee_email.toLowerCase() ||
      !isTimestamp(row.expires_at) ||
      !isTimestamp(row.created_at) ||
      Date.parse(row.expires_at) <= Date.parse(row.created_at) ||
      (row.request_id !== null && !isCanonicalUuid(row.request_id))
    )
      return null
    items.push({
      invitation_id: row.invitation_id,
      project_id: input.project_id,
      invitee_email: row.invitee_email,
      role: row.role,
      status: row.status as InvitationState,
      expires_at: row.expires_at,
      created_at: row.created_at,
      request_id: row.request_id as string | null,
    })
    previous = row.invitation_id
  }
  return items
}
export function parseManagementResponse<T>(
  value: unknown,
  parse: (items: unknown) => T | null
): T | null {
  return isRecord(value) && value.success === true ? parse(value.items) : null
}
