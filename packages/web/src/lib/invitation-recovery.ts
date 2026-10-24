import { isRecord, type InvitationRole } from './invitation-acceptance-protocol'
import { isCanonicalUuid } from './invitation-sender-protocol'

export type InvitationRecovery = {
  version: 1
  actor_id: string
  project_id: string
  request_id: string
  role: InvitationRole
}
export function invitationRecoveryKey(actor: string, project: string) {
  return `saga:invitation-recovery:v1:${actor}:${project}`
}
function parse(value: unknown, actor: string, project: string): InvitationRecovery | null {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 5 ||
    !['version', 'actor_id', 'project_id', 'request_id', 'role'].every(key => key in value) ||
    value.version !== 1 ||
    value.actor_id !== actor ||
    value.project_id !== project ||
    !isCanonicalUuid(actor) ||
    !isCanonicalUuid(project) ||
    !isCanonicalUuid(value.request_id) ||
    (value.role !== 'storyteller' && value.role !== 'facilitator')
  )
    return null
  return {
    version: 1,
    actor_id: actor,
    project_id: project,
    request_id: value.request_id,
    role: value.role,
  }
}
export function readInvitationRecovery(
  actor: string,
  project: string
): { ticket: InvitationRecovery | null; blocked: boolean } {
  try {
    if (!isCanonicalUuid(actor) || !isCanonicalUuid(project)) return { ticket: null, blocked: true }
    const raw = sessionStorage.getItem(invitationRecoveryKey(actor, project))
    if (raw === null) return { ticket: null, blocked: false }
    const ticket = parse(JSON.parse(raw), actor, project)
    return { ticket, blocked: !ticket }
  } catch {
    return { ticket: null, blocked: true }
  }
}
export function saveInvitationRecovery(value: InvitationRecovery): boolean {
  try {
    const ticket = parse(value, value.actor_id, value.project_id)
    if (!ticket) return false
    const existing = readInvitationRecovery(ticket.actor_id, ticket.project_id)
    if (existing.blocked || existing.ticket) return false
    sessionStorage.setItem(
      invitationRecoveryKey(ticket.actor_id, ticket.project_id),
      JSON.stringify(ticket)
    )
    return (
      readInvitationRecovery(ticket.actor_id, ticket.project_id).ticket?.request_id ===
      ticket.request_id
    )
  } catch {
    return false
  }
}
export function clearInvitationRecovery(ticket: InvitationRecovery): boolean {
  try {
    const existing = readInvitationRecovery(ticket.actor_id, ticket.project_id)
    if (existing.blocked || existing.ticket?.request_id !== ticket.request_id) return false
    sessionStorage.removeItem(invitationRecoveryKey(ticket.actor_id, ticket.project_id))
    const current = readInvitationRecovery(ticket.actor_id, ticket.project_id)
    return !current.blocked && !current.ticket
  } catch {
    return false
  }
}
