import { after, type NextResponse } from 'next/server'

/**
 * Copy the auth/session headers returned by `getAuthenticatedUser` onto a response
 * that was built without them, e.g. an access-denied response produced by an access
 * guard. Keeps refreshed Supabase auth cookies flowing back to the client.
 */
export function withAuthHeaders(response: NextResponse, headers: Headers): NextResponse {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}

/**
 * Run background work after the HTTP response is sent. `after()` keeps the work alive on
 * serverless runtimes (a bare floating promise can be dropped post-response); when called
 * outside a request scope (e.g. unit tests) `after()` throws, so fall back to a floating
 * promise. Failures are always caught and logged, never surfaced to the caller.
 */
export function runAfterResponse(task: () => Promise<unknown>): void {
  const safe = () =>
    Promise.resolve()
      .then(task)
      .catch(error => console.error('[after] background task failed', error))
  try {
    after(safe)
  } catch {
    void safe()
  }
}
