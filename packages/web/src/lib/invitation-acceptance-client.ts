import {
  isAccessToken, isInvitationToken, isRecord, parseAcceptanceResponse, parseStatusResponse,
  type InvitationFailureOutcome,
} from '@/lib/invitation-acceptance-protocol'

export class InvitationHttpError extends Error {
  readonly canQueryStatus: boolean
  constructor(readonly outcome: InvitationFailureOutcome, readonly status?: number) {
    super(outcome === 'unknown' ? 'Invitation result is unknown. Query its status before trying again.'
      : outcome === 'rejected' ? 'Invitation request rejected.' : 'Invitation was not attempted.')
    this.name = 'InvitationHttpError'
    this.canQueryStatus = outcome === 'unknown'
  }
}

async function postInvitation<T>(path: string, token: string, accessToken: string, parse: (value: unknown) => T | null): Promise<T> {
  if (!isInvitationToken(token)) throw new InvitationHttpError('rejected', 400)
  if (!isAccessToken(accessToken)) throw new InvitationHttpError('not_attempted', 401)
  let response: Response
  let body: unknown
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token }), credentials: 'omit', cache: 'no-store', redirect: 'error',
    })
    body = await response.json()
  } catch {
    // A lost response can follow a committed acceptance. Never retry a write here.
    throw new InvitationHttpError('unknown')
  }
  if (!response.ok) {
    const outcome = isRecord(body) && body.success === false
      && (body.outcome === 'not_attempted' || body.outcome === 'rejected' || body.outcome === 'unknown')
      ? body.outcome : 'unknown'
    throw new InvitationHttpError(outcome, response.status)
  }
  const confirmed = parse(body)
  if (!confirmed) throw new InvitationHttpError('unknown', response.status)
  return confirmed
}

export function acceptInvitationOverHttp(token: string, accessToken: string) {
  return postInvitation('/api/invitations/accept', token, accessToken, parseAcceptanceResponse)
}
export function getInvitationStatusOverHttp(token: string, accessToken: string) {
  return postInvitation('/api/invitations/status', token, accessToken, parseStatusResponse)
}
