import { createServer } from 'node:http'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { USER } from '../pg17-recording-worker/fixture.mjs'
import { rpc as finalize } from '../pg17-recording-finalization/fixture.mjs'
import { snapshot } from './fixture.mjs'

const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
const SECRET = 'synthetic-status-loopback-only'
const READ_KEYS = ['p_actor_id', 'p_project_id', 'p_session_id', 'p_manifest_sha256']
const WRITE_KEYS = ['p_job_id', 'p_action', 'p_worker_id', 'p_attempt', 'p_manifest_sha256', 'p_candidate_id', 'p_output', 'p_failure_code']

/** Restricted native substitute. Status requests run actual RPC inside READ ONLY. */
export async function statusHttp(h) {
  const events = h.report.httpRequests = [], transports = h.report.sdkRequests = []
  const pending = new Set(), sockets = new Set(), errors = []
  let current
  function json(res, status, value) {
    res.writeHead(status, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify(value))
  }
  async function handle(req, res) {
    const config = current
    const event = { case: config?.name, method: req.method, path: req.url, committed: false, readOnly: false,
      peerClosed: false, finished: false, responseFinished: false }
    events.push(event)
    const disconnected = new AbortController()
    const closed = () => { event.peerClosed = true; disconnected.abort() }
    res.once('close', closed); req.once('aborted', closed)
    res.once('finish', () => { event.responseFinished = true })
    let client, transaction = false
    try {
      h.ok(config, 'explicit HTTP scenario configured')
      h.eq(req.method, 'POST', 'SDK uses parameterized RPC POST')
      h.eq(req.headers.authorization, `Bearer ${SECRET}`, 'synthetic bearer stays inside loopback')
      const reading = req.url === '/rest/v1/rpc/read_recording_session_snapshot'
      h.ok(reading || (config.mode === 'publish-response-loss' && req.url === '/rest/v1/rpc/finalize_recording_job'), 'only explicit snapshot or lost-publication RPC allowed')
      const parts = []; let length = 0
      for await (const chunk of req) { length += chunk.length; h.ok(length <= 65536, 'bounded request body'); parts.push(chunk) }
      const input = JSON.parse(Buffer.concat(parts).toString())
      const keys = reading ? READ_KEYS : WRITE_KEYS
      h.eq(Object.keys(input).sort(), [...keys].sort(), 'exact RPC argument names from real SDK')
      event.input = input
      client = await h.actorClient('service_role', USER)
      await client.query(reading ? 'BEGIN READ ONLY' : 'BEGIN'); transaction = true
      event.readOnly = (await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on'
      const value = reading ? await snapshot(client, keys.map(key => input[key])) : await finalize(client, keys.map(key => input[key]))
      event.receipt = value
      await client.query('COMMIT'); transaction = false; event.committed = true
      if (config.mode === 'publish-response-loss') { h.eq(reading, false, 'lost response follows actual publication'); res.destroy(); return }
      if (config.mode === 'timeout' || config.mode === 'abort') {
        if (config.mode === 'abort') config.checkpoint?.()
        if (!disconnected.signal.aborted) await once(disconnected.signal, 'abort')
        return
      }
      if (config.mode === 'read-error') { json(res, 503, { message: 'SECRET database response' }); return }
      json(res, 200, config.mode === 'bad-envelope' ? { ...value, secretExtra: 'SECRET private value' } :
        config.mode === 'bad-identity' ? { ...value, actorId: '22222222-2222-4222-8222-222222222222' } : value)
    } catch (error) {
      if (transaction && client) await client.query('ROLLBACK')
      event.sqlstate = error.code ?? 'FIXTURE_FAILED'
      if (error.label || !/^[0-9A-Z]{5}$/.test(event.sqlstate)) errors.push(error.label ?? event.sqlstate)
      if (!res.destroyed) json(res, 400, { code: event.sqlstate, message: 'SECRET synthetic SQL diagnostic' })
    } finally {
      if (client) await h.close(client)
      res.removeListener('close', closed); req.removeListener('aborted', closed)
      event.finished = true
    }
  }
  const server = createServer((req, res) => {
    const task = handle(req, res).catch(error => { errors.push(error.label ?? error.code ?? 'HANDLER_FAILED'); res.destroy() })
    pending.add(task); void task.finally(() => pending.delete(task))
  })
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const origin = `http://127.0.0.1:${server.address().port}`
  const admin = createClient(origin, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false },
    global: { fetch: async (input, init) => {
      const request = new Request(input, init)
      h.eq(new URL(request.url).origin, origin, 'actual SDK transport stays on disposable loopback')
      const event = { case: current?.name, path: new URL(request.url).pathname, method: request.method, aborted: false, settled: false }
      transports.push(event)
      const abort = () => { event.aborted = true }
      request.signal.addEventListener('abort', abort, { once: true })
      try { return await fetch(request) }
      finally { event.settled = true; request.signal.removeEventListener('abort', abort) }
    } },
  })
  return { admin, events, transports, configure: config => { current = config },
    async drain() { await Promise.all([...pending]); h.eq(errors, [], 'native HTTP has no hidden fixture errors') },
    async close() {
      // Server.close may finish before already-destroyed sockets emit close.
      const closedSockets = Promise.all([...sockets].map(socket => once(socket, 'close')))
      server.closeAllConnections()
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      await Promise.all([...pending])
      await closedSockets
      h.report.httpCleanup = { listening: server.listening, pending: pending.size, sockets: sockets.size, errors,
        everyHandlerFinished: events.every(event => event.finished), everyTransportSettled: transports.every(event => event.settled) }
      h.eq(h.report.httpCleanup, { listening: false, pending: 0, sockets: 0, errors: [], everyHandlerFinished: true, everyTransportSettled: true }, 'all HTTP sockets, handlers and native fetch requests close')
    },
  }
}
