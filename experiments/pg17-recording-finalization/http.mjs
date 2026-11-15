import { createServer } from 'node:http'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { USER } from '../pg17-recording-worker/fixture.mjs'
import { rpc } from './fixture.mjs'

const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
const SECRET = 'synthetic-finalization-loopback-only'
const ARGUMENTS = ['p_job_id', 'p_action', 'p_worker_id', 'p_attempt', 'p_manifest_sha256', 'p_candidate_id', 'p_output', 'p_failure_code']

/** PostgREST-shaped substitute only. All terminal mutations run the actual RPC in PG17. */
export async function finalizationHttp(h) {
  const events = h.report.httpRequests = [], transports = h.report.sdkRequests = []
  const pending = new Set(), sockets = new Set(), errors = []
  let current
  function json(res, status, value) {
    res.writeHead(status, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify(value))
  }
  async function handle(req, res) {
    const config = current
    const event = { case: config?.name, method: req.method, path: req.url, committed: false, rolledBack: false,
      peerClosed: false, finished: false, responseFinished: false }
    events.push(event)
    const disconnected = new AbortController()
    const closed = () => { event.peerClosed = true; disconnected.abort() }
    res.once('close', closed); req.once('aborted', closed)
    res.once('finish', () => { event.responseFinished = true })
    let client, transaction = false
    try {
      h.ok(config, 'one explicit HTTP scenario configured')
      h.eq(req.method, 'POST', 'only POST dispatches terminal mutations')
      h.eq(req.url, '/rest/v1/rpc/finalize_recording_job', 'no direct writes, reads, Storage or fallback RPC')
      h.eq(req.headers.authorization, `Bearer ${SECRET}`, 'synthetic bearer only')
      const chunks = []; let length = 0
      for await (const chunk of req) { length += chunk.length; h.ok(length <= 65536, 'bounded synthetic request body'); chunks.push(chunk) }
      const input = JSON.parse(Buffer.concat(chunks).toString())
      h.eq(Object.keys(input).sort(), [...ARGUMENTS].sort(), 'exact eight RPC arguments')
      event.input = input
      client = await h.actorClient('service_role', USER)
      await client.query('BEGIN'); transaction = true
      const value = await rpc(client, ARGUMENTS.map(key => input[key]))
      event.receipt = value
      if (config.mode === 'cancel-before-commit' || config.mode === 'timeout-before-commit') {
        config.checkpoint?.()
        if (!disconnected.signal.aborted) await once(disconnected.signal, 'abort')
        await client.query('ROLLBACK'); transaction = false; event.rolledBack = true
        return
      }
      await client.query('COMMIT'); transaction = false; event.committed = true
      if (config.mode === 'response-loss') { res.destroy(); return }
      if (config.mode === 'cancel-after-commit') {
        config.checkpoint?.()
        if (!disconnected.signal.aborted) await once(disconnected.signal, 'abort')
        return
      }
      json(res, 200, config.mode === 'bad-receipt' ? { ...value, unexpected: 'SECRET must not escape' } : value)
    } catch (error) {
      if (transaction && client) { await client.query('ROLLBACK'); transaction = false; event.rolledBack = true }
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
      h.eq(new URL(request.url).origin, origin, 'SDK transport stays on disposable loopback')
      const event = { case: current?.name, path: new URL(request.url).pathname, method: request.method, aborted: false, settled: false }
      transports.push(event)
      const abort = () => { event.aborted = true }
      request.signal.addEventListener('abort', abort, { once: true })
      try { return await fetch(request) }
      finally { event.settled = true; request.signal.removeEventListener('abort', abort) }
    } },
  })
  return {
    admin, events, transports, configure: config => { current = config },
    async drain() { await Promise.all([...pending]); h.eq(errors, [], 'all native handlers succeed or reject with explicit SQLSTATE') },
    async close() {
      server.closeAllConnections()
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      await Promise.all([...pending])
      h.report.httpCleanup = { listening: server.listening, pending: pending.size, sockets: sockets.size, errors,
        everyHandlerFinished: events.every(event => event.finished), everyTransportSettled: transports.every(event => event.settled) }
      h.eq(h.report.httpCleanup, { listening: false, pending: 0, sockets: 0, errors: [], everyHandlerFinished: true, everyTransportSettled: true },
        'server, sockets, handlers and native fetch requests all close')
    },
  }
}
