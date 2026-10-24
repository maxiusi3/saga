import { createClient } from '@supabase/supabase-js'
import { senderDeadline } from '@/lib/invitation-sender-deadline'
import { isConfirmedProviderUser, isRecord, readBearer } from '@/lib/invitation-acceptance-protocol'
import { isCanonicalUuid } from '@/lib/invitation-sender-protocol'
import {
  parseSourcesInput,
  parseManagementInput,
  parseSourcesRows,
  parseManagementRows,
} from '@/lib/invitation-management-protocol'

const headers = { 'Cache-Control': 'no-store', Vary: 'Authorization' }
function failure(status: number) {
  // A read failure says nothing about the outcome of an earlier send/release.
  return Response.json(
    { success: false, error: 'Invitation management is unavailable.' },
    { status, headers }
  )
}
async function handle(request: Request, mode: 'sources' | 'manage') {
  if (
    process.env.INVITATION_MANAGEMENT_ENABLED !== 'true' ||
    process.env.INVITATION_TRANSACTIONS_ENABLED !== 'true'
  )
    return failure(503)
  const deadline = senderDeadline(request.signal)
  try {
    if (deadline.signal.aborted) return failure(503)
    let body: unknown
    try {
      body = await deadline.run(request.json())
    } catch {
      return failure(deadline.signal.aborted ? 503 : 400)
    }
    const source = mode === 'sources' ? parseSourcesInput(body) : null
    const management = mode === 'manage' ? parseManagementInput(body) : null
    if (!source && !management) return failure(400)
    const bearer = readBearer(request.headers.get('authorization'))
    if (!bearer) return failure(401)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return failure(503)
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        headers: { Authorization: `Bearer ${bearer}` },
        fetch: async (input, init) => {
          try {
            if (deadline.signal.aborted) throw new Error('Interrupted')
            const response = await deadline.run(
              fetch(input, {
                ...init,
                signal: deadline.signal,
                cache: 'no-store',
                credentials: 'omit',
                redirect: 'error',
              })
            )
            const text = await deadline.run(response.text())
            return new Response(text, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            })
          } catch {
            return Response.json(
              {
                code: 'INVITATION_TRANSPORT_UNAVAILABLE',
                message: 'Invitation service unavailable.',
              },
              { status: 503 }
            )
          }
        },
      },
    })
    const { data, error } = await deadline.run(client.auth.getUser(bearer))
    if (deadline.signal.aborted) return failure(503)
    if (error)
      return failure(
        error.status === 401 ||
          error.status === 403 ||
          (error.status === 400 &&
            ['bad_jwt', 'session_not_found', 'user_not_found'].includes(error.code || ''))
          ? 401
          : 503
      )
    if (!isRecord(data.user) || !isCanonicalUuid(data.user.id)) return failure(503)
    if (!isConfirmedProviderUser(data.user)) return failure(403)
    const result = await deadline.run(
      client
        .schema('invitation_candidate')
        .rpc(
          source ? 'available_sources' : 'management_list',
          source
            ? { p_project_id: source.project_id, p_role: source.role }
            : { p_project_id: management!.project_id, p_after: management!.after || null }
        )
        .abortSignal(deadline.signal)
        .retry(false)
    )
    if (deadline.signal.aborted) return failure(503)
    if (result.error) {
      const code = result.error.code
      return failure(
        code === '42501'
          ? 403
          : code === '22023'
            ? 400
            : ['23502', '23503', '23505', '23514'].includes(code)
              ? 409
              : 503
      )
    }
    const items = source
      ? parseSourcesRows(result.data, source)
      : parseManagementRows(result.data, management!)
    return items ? Response.json({ success: true, items }, { headers }) : failure(503)
  } catch {
    return failure(503)
  } finally {
    deadline.close()
  }
}
export function handleInvitationSources(request: Request) {
  return handle(request, 'sources')
}
export function handleInvitationManagement(request: Request) {
  return handle(request, 'manage')
}
