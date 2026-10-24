import { createClient } from '@supabase/supabase-js'
import {
  isConfirmedProviderUser, isInvitationToken, isRecord, isUuid,
  parseAcceptanceRow, parseInvitationBody, parseStatusRow, readBearer,
  type InvitationFailureOutcome,
} from '@/lib/invitation-acceptance-protocol'

const responseHeaders = { 'Cache-Control': 'no-store', Vary: 'Authorization' }
function failure(status: number, outcome: InvitationFailureOutcome) {
  return Response.json({
    success: false, outcome,
    error: outcome === 'rejected' ? 'Invitation request rejected.' : 'Invitation result could not be confirmed.',
    can_query_status: outcome === 'unknown',
  }, { status, headers: responseHeaders })
}
function sqlFailure(error: unknown, fallback: InvitationFailureOutcome) {
  const code = isRecord(error) ? error.code : undefined
  const status = code === '42501' ? 403 : code === '22023' ? 400
    : ['23502', '23503', '23505', '23514'].includes(String(code)) ? 409 : 503
  return failure(status, status === 503 ? fallback : 'rejected')
}

function operationDeadline(caller: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  caller.addEventListener('abort', abort, { once: true })
  if (caller.aborted) abort()
  const timer = setTimeout(abort, 10_000)
  return {
    signal: controller.signal,
    async run<T>(work: PromiseLike<T>): Promise<T> {
      let onAbort: () => void = () => {}
      const cancelled = new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error('Invitation operation interrupted.'))
        controller.signal.addEventListener('abort', onAbort, { once: true })
        if (controller.signal.aborted) onAbort()
      })
      try { return await Promise.race([work, cancelled]) }
      finally { controller.signal.removeEventListener('abort', onAbort) }
    },
    close() {
      clearTimeout(timer)
      caller.removeEventListener('abort', abort)
      controller.abort()
    },
  }
}

async function handle(request: Request, mode: 'accept' | 'status', tokenFromPath?: string) {
  // This gate precedes body parsing, configuration reads and client construction.
  if (process.env.INVITATION_TRANSACTIONS_ENABLED !== 'true') return failure(503, 'not_attempted')
  const deadline = operationDeadline(request.signal)
  let acceptAttempted = false
  const uncertain = () => mode === 'status' || acceptAttempted ? 'unknown' as const : 'not_attempted' as const
  try {
    if (deadline.signal.aborted) return failure(503, 'not_attempted')
    const bearer = readBearer(request.headers.get('authorization'))
    if (!bearer) return failure(401, 'not_attempted')
    let token: string
    let assertedUserId: string | undefined
    if (tokenFromPath !== undefined) {
      // The URL adapter has already decoded once. Body identity is not consumed here.
      if (!isInvitationToken(tokenFromPath)) return failure(400, 'rejected')
      token = tokenFromPath
    } else {
      let body: unknown
      try { body = await deadline.run(request.json()) }
      catch { return failure(deadline.signal.aborted ? 503 : 400, deadline.signal.aborted ? 'not_attempted' : 'rejected') }
      const input = parseInvitationBody(body)
      if (!input) return failure(400, 'rejected')
      token = input.token
      assertedUserId = input.userId
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return failure(503, 'not_attempted')

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        headers: { Authorization: `Bearer ${bearer}` },
        fetch: async (input, init) => {
          try {
            if (deadline.signal.aborted) throw new Error('Interrupted')
            if (new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname.endsWith('/rpc/accept')) acceptAttempted = true
            const response = await deadline.run(fetch(input, {
              ...init, signal: deadline.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
            }))
            // Bound the body read as well as response headers. Catch transport failures
            // here: auth-js otherwise logs raw rejected fetch errors to console.
            const body = await deadline.run(response.text())
            return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
          } catch {
            return Response.json({ code: 'INVITATION_TRANSPORT_UNAVAILABLE', message: 'Invitation service unavailable.' }, { status: 503 })
          }
        },
      },
    })
    const { data, error } = await deadline.run(supabase.auth.getUser(bearer))
    if (deadline.signal.aborted) return failure(503, 'not_attempted')
    if (error) {
      const denied = error.status === 401 || error.status === 403
        || (error.status === 400 && ['bad_jwt', 'session_not_found', 'user_not_found'].includes(error.code || ''))
      return failure(denied ? 401 : 503, 'not_attempted')
    }
    const user: unknown = data.user
    if (!isRecord(user) || !isUuid(user.id)) return failure(503, 'not_attempted')
    if (!isConfirmedProviderUser(user)) return failure(403, 'rejected')
    if (assertedUserId !== undefined && assertedUserId !== user.id) return failure(403, 'rejected')

    const candidate = supabase.schema('invitation_candidate')
    const state = await deadline.run(candidate.rpc('status', { p_token: token }).abortSignal(deadline.signal).retry(false))
    if (deadline.signal.aborted) return failure(503, uncertain())
    if (state.error) return sqlFailure(state.error, uncertain())
    const expected = parseStatusRow(state.data, token, user.id)
    if (!expected) return failure(503, uncertain())
    if (mode === 'status') return Response.json({ success: true, outcome: 'confirmed', ...expected }, { headers: responseHeaders })

    // A confirmed pre-read establishes consistency expectations, never success.
    const accepted = await deadline.run(candidate.rpc('accept', { token }).abortSignal(deadline.signal).retry(false))
    if (deadline.signal.aborted) return failure(503, uncertain())
    if (accepted.error) return sqlFailure(accepted.error, uncertain())
    const result = parseAcceptanceRow(accepted.data, expected, user.id)
    if (!result) return failure(503, uncertain())
    return Response.json({ success: true, ...result }, { headers: responseHeaders })
  } catch {
    return failure(503, uncertain())
  } finally {
    deadline.close()
  }
}

export async function handleInvitationAcceptance(request: Request, tokenFromPath?: string) {
  return handle(request, 'accept', tokenFromPath)
}
export async function handleInvitationStatus(request: Request, tokenFromUrl?: string) {
  return handle(request, 'status', tokenFromUrl)
}
