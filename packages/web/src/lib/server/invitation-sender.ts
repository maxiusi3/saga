import { senderDeadline } from '@/lib/invitation-sender-deadline'
import { createClient } from '@supabase/supabase-js'
import { isConfirmedProviderUser, isRecord, readBearer, type InvitationFailureOutcome } from '@/lib/invitation-acceptance-protocol'
import { isCanonicalUuid, isIncompleteLegacySend, parseSendInput, parseReleaseInput, parseLookupInput, parseSendRow, parseReleaseRow, parseLookupRow } from '@/lib/invitation-sender-protocol'

const responseHeaders = { 'Cache-Control': 'no-store', Vary: 'Authorization' }
function failure(status: number, outcome: InvitationFailureOutcome) {
  return Response.json({ success: false, outcome,
    error: outcome === 'rejected' ? 'Invitation request rejected.' : 'Invitation result could not be confirmed.',
    can_query_status: outcome === 'unknown',
  }, { status, headers: responseHeaders })
}
export function invitationSenderUnavailable() { return failure(503, 'not_attempted') }
function sqlFailure(error: unknown, fallback: InvitationFailureOutcome) {
  const code = isRecord(error) ? error.code : undefined
  const status = code === '42501' ? 403 : code === '22023' ? 400 : ['23502', '23503', '23505', '23514'].includes(String(code)) ? 409 : 503
  return failure(status, status === 503 ? fallback : 'rejected')
}
async function handle(request: Request, mode: 'send' | 'release' | 'lookup', projectId?: string) {
  if (process.env.INVITATION_TRANSACTIONS_ENABLED !== 'true') return invitationSenderUnavailable()
  const deadline = senderDeadline(request.signal)
  let operationAttempted = false
  const uncertain = () => operationAttempted ? 'unknown' as const : 'not_attempted' as const
  try {
    if (deadline.signal.aborted) return invitationSenderUnavailable()
    if (mode === 'send' && !isCanonicalUuid(projectId)) return failure(400, 'rejected')
    let body: unknown
    try { body = await deadline.run(request.json()) }
    catch { return failure(deadline.signal.aborted ? 503 : 400, deadline.signal.aborted ? 'not_attempted' : 'rejected') }
    if (mode === 'send' && isIncompleteLegacySend(body)) return invitationSenderUnavailable()
    const send = mode === 'send' ? parseSendInput(body) : null
    const release = mode === 'release' ? parseReleaseInput(body) : null
    const lookup = mode === 'lookup' ? parseLookupInput(body) : null
    if (!send && !release && !lookup) return failure(400, 'rejected')
    const bearer = readBearer(request.headers.get('authorization'))
    if (!bearer) return failure(401, 'not_attempted')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return invitationSenderUnavailable()
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        headers: { Authorization: `Bearer ${bearer}` },
        fetch: async (input, init) => {
          try {
            if (deadline.signal.aborted) throw new Error('Interrupted')
            // Only an actual outgoing operation fetch makes the result uncertain.
            const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname
            if (path.endsWith(`/rpc/${mode}`)) operationAttempted = true
            const response = await deadline.run(fetch(input, { ...init, signal: deadline.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' }))
            const text = await deadline.run(response.text())
            return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers })
          } catch {
            // auth-js may log raw transport exceptions. Return a fixed synthetic error instead.
            return Response.json({ code: 'INVITATION_TRANSPORT_UNAVAILABLE', message: 'Invitation service unavailable.' }, { status: 503 })
          }
        },
      },
    })
    const { data, error } = await deadline.run(supabase.auth.getUser(bearer))
    if (deadline.signal.aborted) return invitationSenderUnavailable()
    if (error) {
      const denied = error.status === 401 || error.status === 403 || (error.status === 400 && ['bad_jwt', 'session_not_found', 'user_not_found'].includes(error.code || ''))
      return failure(denied ? 401 : 503, 'not_attempted')
    }
    if (!isRecord(data.user) || !isCanonicalUuid(data.user.id)) return invitationSenderUnavailable()
    if (!isConfirmedProviderUser(data.user)) return failure(403, 'rejected')
    const parameters = send ? { p_project_id: projectId, p_request_id: send.request_id, p_invitee_email: send.email, p_role: send.role, p_source_id: send.source_id, p_message: send.message }
      : release ? { p_invitation_id: release.invitation_id, p_reason: release.reason } : { request_id: lookup!.request_id }
    // Release has no sender lookup precondition: SQL alone authorizes rightful cleanup.
    const result = await deadline.run(supabase.schema('invitation_candidate').rpc(mode, parameters).abortSignal(deadline.signal).retry(false))
    if (deadline.signal.aborted) return failure(503, uncertain())
    if (result.error) return sqlFailure(result.error, uncertain())
    const confirmed = send ? parseSendRow(result.data, projectId!, send.role) : release ? parseReleaseRow(result.data, release) : parseLookupRow(result.data, lookup!)
    if (!confirmed) return failure(503, uncertain())
    return Response.json({ success: true, ...(lookup ? { outcome: 'confirmed' } : {}), ...confirmed }, { headers: responseHeaders })
  } catch { return failure(503, uncertain()) }
  finally { deadline.close() }
}
export function handleInvitationSend(request: Request, projectId: string) { return handle(request, 'send', projectId) }
export function handleInvitationRelease(request: Request) { return handle(request, 'release') }
export function handleInvitationLookup(request: Request) { return handle(request, 'lookup') }
