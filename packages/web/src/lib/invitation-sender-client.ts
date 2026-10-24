import { isAccessToken } from './invitation-acceptance-protocol'
import { InvitationHttpError } from './invitation-acceptance-client'
import { senderDeadline } from './invitation-sender-deadline'
import { isCanonicalUuid, isIncompleteLegacySend, parseSendInput, parseReleaseInput, parseLookupInput, parseSendResponse, parseReleaseResponse, parseLookupResponse, parseSenderFailure } from './invitation-sender-protocol'

export function prepareInvitationSend(projectId: string, value: unknown) {
  if (isIncompleteLegacySend(value)) throw new InvitationHttpError('not_attempted', 503)
  const input = parseSendInput(value)
  if (!isCanonicalUuid(projectId) || !input) throw new InvitationHttpError('rejected', 400)
  return input
}
export function prepareInvitationRelease(value: unknown, expectedProjectId?: string) {
  const input = parseReleaseInput(value)
  if (!input || (expectedProjectId !== undefined && !isCanonicalUuid(expectedProjectId))) throw new InvitationHttpError('rejected', 400)
  return input
}
export function prepareInvitationLookup(value: unknown) {
  const input = parseLookupInput(value)
  if (!input) throw new InvitationHttpError('rejected', 400)
  return input
}
async function post<T>(path: string, input: unknown, accessToken: string, parse: (body: unknown) => T | null, signal?: AbortSignal): Promise<T> {
  if (!isAccessToken(accessToken)) throw new InvitationHttpError('not_attempted', 401)
  if (signal?.aborted) throw new InvitationHttpError('not_attempted', 503)
  const deadline = senderDeadline(signal)
  try {
    let response: Response, body: unknown
    try {
      response = await deadline.run(fetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input), credentials: 'omit', cache: 'no-store', redirect: 'error', signal: deadline.signal,
      }))
      body = await deadline.run(response.json())
    } catch { throw new InvitationHttpError('unknown') }
    if (!response.ok) throw new InvitationHttpError(parseSenderFailure(body, response.status) || 'unknown', response.status)
    const confirmed = parse(body)
    if (!confirmed) throw new InvitationHttpError('unknown', response.status)
    return confirmed
  } finally { deadline.close() }
}
export async function sendInvitationOverHttp(projectId: string, value: unknown, accessToken: string, signal?: AbortSignal) {
  const input = prepareInvitationSend(projectId, value)
  return post(`/api/projects/${projectId}/invitations`, input, accessToken, body => parseSendResponse(body, projectId, input.role), signal)
}
export async function releaseInvitationOverHttp(value: unknown, accessToken: string, expectedProjectId?: string, signal?: AbortSignal) {
  const input = prepareInvitationRelease(value, expectedProjectId)
  return post('/api/invitations/release', input, accessToken, body => parseReleaseResponse(body, input, expectedProjectId), signal)
}
export async function lookupInvitationOverHttp(value: unknown, accessToken: string, signal?: AbortSignal) {
  const input = prepareInvitationLookup(value)
  return post('/api/invitations/lookup', input, accessToken, body => parseLookupResponse(body, input), signal)
}
