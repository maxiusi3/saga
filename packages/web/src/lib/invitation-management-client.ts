import { isAccessToken } from './invitation-acceptance-protocol'
import { senderDeadline } from './invitation-sender-deadline'
import {
  parseManagementInput,
  parseSourcesInput,
  parseManagementRows,
  parseSourcesRows,
  parseManagementResponse,
} from './invitation-management-protocol'

export class InvitationManagementError extends Error {
  constructor() {
    super('Invitation management could not be loaded.')
    this.name = 'InvitationManagementError'
  }
}
async function post<T>(
  path: string,
  value: unknown,
  token: string,
  parse: (value: unknown) => T | null,
  signal?: AbortSignal
): Promise<T> {
  if (!isAccessToken(token) || signal?.aborted) throw new InvitationManagementError()
  const deadline = senderDeadline(signal)
  try {
    const response = await deadline.run(
      fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(value),
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: deadline.signal,
      })
    )
    const body = await deadline.run(response.json())
    const items = response.ok ? parseManagementResponse(body, parse) : null
    if (!items) throw new InvitationManagementError()
    return items
  } catch {
    throw new InvitationManagementError()
  } finally {
    deadline.close()
  }
}
export function loadInvitationSources(value: unknown, token: string, signal?: AbortSignal) {
  const input = parseSourcesInput(value)
  if (!input) return Promise.reject(new InvitationManagementError())
  return post(
    '/api/invitations/sources',
    input,
    token,
    items => parseSourcesRows(items, input),
    signal
  )
}
export function loadManagedInvitations(value: unknown, token: string, signal?: AbortSignal) {
  const input = parseManagementInput(value)
  if (!input) return Promise.reject(new InvitationManagementError())
  return post(
    '/api/invitations/manage',
    input,
    token,
    items => parseManagementRows(items, input),
    signal
  )
}
