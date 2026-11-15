import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
export const ORIGIN = 'https://storage.invalid'
export const SECRET = 'synthetic-local-candidate-no-real-permission'

// The only substitution is the known synthetic origin. Native fetch owns every
// HTTP request, response body and abort; this is not the cloud TLS boundary.
export function applicationClient(loopback, events = []) {
  const destination = new URL(loopback)
  if (destination.protocol !== 'http:' || destination.hostname !== '127.0.0.1') throw new Error('Invalid loopback fixture')
  const transport = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin !== ORIGIN) throw new Error('Unexpected remote fixture origin')
    const event = { method: request.method, path: url.pathname, redirect: request.redirect,
      cache: request.cache, aborted: false, settled: false }
    events.push(event)
    const abort = () => { event.aborted = true }
    request.signal.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetch(`${destination.origin}${url.pathname}${url.search}`, {
        method: request.method, headers: request.headers, body: request.body, duplex: 'half',
        redirect: request.redirect, cache: request.cache, signal: request.signal,
      })
      if (url.pathname.startsWith('/storage/') && response.body) {
        const body = response.body, cancel = body.cancel, getReader = body.getReader
        event.bodyCancelCalled = false; event.readers = []
        body.cancel = function (...args) { event.bodyCancelCalled = true; return cancel.apply(this, args) }
        body.getReader = function (...args) {
          const reader = getReader.apply(this, args), cancel = reader.cancel, release = reader.releaseLock
          const observation = { closed: false, cancelCalled: false, released: false }
          event.readers.push(observation)
          reader.closed.then(() => { observation.closed = true }, () => { observation.closed = true })
          reader.cancel = function (...args) { observation.cancelCalled = true; return cancel.apply(this, args) }
          reader.releaseLock = function (...args) { const result = release.apply(this, args); observation.released = true; return result }
          return reader
        }
      }
      return response
    } finally {
      event.settled = true
      request.signal.removeEventListener('abort', abort)
    }
  }
  return { transport, admin: createClient(ORIGIN, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport },
  }) }
}
