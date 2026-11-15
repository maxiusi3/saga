import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { digest } from '../pg17-routines/runtime.mjs'
import { USER, PROJECT, RPC as LEASE_RPC } from '../pg17-recording-worker/fixture.mjs'
import { CANDIDATE_RPC } from '../pg17-recording-candidates/fixture.mjs'
import { rpc as finalizeRpc, state } from '../pg17-recording-finalization/fixture.mjs'
import { SECRET } from '../pg17-recording-candidates/application-client.mjs'

/** Synthetic PostgREST-shaped adapter. All worker mutations execute intact SQL RPCs. */
export async function terminalHttp(h) {
  const events = h.report.requests = [], pending = new Set(), sockets = new Set(), errors = []
  const objects = new Map(), inputs = new Map(), tables = new Map()
  for (const table of ['processing_jobs', 'media_assets', 'recording_sessions', 'recording_chunks',
    'projects', 'project_roles', 'stories', 'deletion_requests']) {
    tables.set(table, new Set((await h.db.query('SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped', [table])).rows.map(row => row.attname)))
  }
  const objectRoot = join(h.scratch, 'storage')
  await mkdir(objectRoot)
  let current
  const json = (res, value, status = 200, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', connection: 'close', ...headers }); res.end(JSON.stringify(value))
  }
  async function body(req, maximum) {
    const parts = []; let size = 0
    for await (const part of req) { size += part.length; h.ok(size <= maximum, 'bounded native request body'); parts.push(part) }
    return Buffer.concat(parts)
  }
  async function stream(res, bytes, signal, milliseconds = 0) {
    const width = Math.ceil(bytes.length / 4)
    for (let offset = 0; offset < bytes.length; offset += width) {
      signal.throwIfAborted()
      res.write(bytes.subarray(offset, offset + width))
      if (milliseconds) await delay(milliseconds / 4, undefined, { signal })
    }
    res.end()
  }
  async function handle(req, res) {
    const config = current, url = new URL(req.url, 'http://127.0.0.1')
    const event = { case: config?.name, index: events.length, at: performance.now(), method: req.method,
      path: url.pathname, query: Object.fromEntries(url.searchParams), kind: 'query', committed: false, finished: false, aborted: false, responseFinished: false }
    events.push(event)
    const controller = new AbortController()
    const abort = () => { if (!res.writableFinished) { event.aborted = true; controller.abort() } }
    const finish = () => { event.responseFinished = true }
    req.once('aborted', abort); res.once('close', abort); res.once('finish', finish)
    let client, transaction = false
    const abortQuery = () => client?.connection?.stream?.destroy()
    try {
      h.ok(config, 'one explicit synthetic attempt configured')
      h.eq(req.headers.authorization, `Bearer ${SECRET}`, 'only synthetic service credentials used')
      client = await h.actorClient('service_role', USER)
      controller.signal.addEventListener('abort', abortQuery, { once: true })
      controller.signal.throwIfAborted()
      if (url.pathname.startsWith('/storage/v1/object/')) {
        h.eq(req.headers.apikey, SECRET, 'Storage request carries synthetic API key')
        const location = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length))
        if (location.startsWith('audio-recordings/')) {
          event.kind = 'input-read'
          h.eq(req.method, 'GET', 'source objects are read-only')
          const stored = inputs.get(location.slice('audio-recordings/'.length))
          h.ok(stored, 'input is a sealed source object')
          const bytes = await readFile(stored.file)
          event.storedSha256 = digest(bytes)
          h.eq(event.storedSha256, stored.sha256, 'disk-backed source bytes unchanged')
          if (config.mode === 'bad-source-hash') bytes[0] ^= 1
          event.sentSha256 = digest(bytes); event.sentBytes = bytes.length
          res.writeHead(200, { 'content-type': config.f.mimeType, 'content-length': bytes.length, connection: 'close' })
          await stream(res, bytes, controller.signal)
          return
        }
        h.ok(location.startsWith('recording-candidates/'), 'only private candidate bucket can be written')
        const key = location.slice('recording-candidates/'.length)
        const row = (await client.query('SELECT * FROM recording_output_candidates WHERE job_id=$1 AND object_key=$2', [config.f.jobId, key])).rows[0]
        h.ok(row, 'real reservation exists before candidate I/O')
        if (req.method === 'POST') {
          event.kind = 'candidate-upload'
          h.eq(row.state, 'reserved', 'only reserved candidates accept an upload')
          h.eq(req.headers['x-upsert'], 'false', 'upload explicitly forbids overwrite')
          h.eq(req.headers['content-type'], row.mime_type, 'upload MIME matches reservation')
          h.eq(Number(req.headers['content-length']), Number(row.byte_size), 'upload declares reserved byte size')
          const bytes = await body(req, 104857600)
          h.eq(bytes.length, Number(row.byte_size), 'entire streamed file upload received')
          h.eq(digest(bytes), row.sha256, 'streamed upload matches reserved hash')
          h.eq(objects.has(key), false, 'candidate is immutable')
          const file = join(objectRoot, digest(key))
          await writeFile(file, bytes, { flag: 'wx' })
          await client.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('recording-candidates',$1,$2::jsonb)",
            [key, JSON.stringify({ byteSize: bytes.length, sha256: digest(bytes) })])
          objects.set(key, { file, sha256: digest(bytes), byteSize: bytes.length })
          event.receivedBytes = bytes.length; event.sha256 = digest(bytes); event.committed = true
          json(res, { key }, 201); return
        }
        event.kind = 'candidate-readback'
        h.eq(req.method, 'GET', 'no deletion, overwrite or other candidate mutation')
        const stored = objects.get(key)
        h.ok(stored, 'readback uses actual persisted object')
        const bytes = await readFile(stored.file)
        h.eq(digest(bytes), stored.sha256, 'candidate bytes intact before readback')
        if (config.mode === 'post-candidate-error') bytes[bytes.length - 1] ^= 1
        event.sentSha256 = digest(bytes); event.sentBytes = bytes.length
        res.writeHead(200, { 'content-type': row.mime_type, 'content-length': bytes.length, connection: 'close' })
        await stream(res, bytes, controller.signal, config.readbackMs)
        return
      }
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        event.kind = 'rpc'
        h.eq(req.method, 'POST', 'all database mutations are explicit RPCs')
        const args = event.input = JSON.parse((await body(req, 65536)).toString())
        event.action = args.p_action
        let receipt
        if (url.pathname === '/rest/v1/rpc/recording_job_lease') {
          event.rpc = 'lease'
          const names = ['p_job_id', 'p_action', 'p_worker_id', 'p_attempt', 'p_lease_ms']
          h.eq(Object.keys(args).sort(), names.toSorted(), 'five exact lease arguments')
          if (config.mode === 'revoke-before-publication' && args.p_action === 'check' && config.localCleanupSettled()) {
            await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
            event.accessRevoked = true
          }
          receipt = (await client.query(LEASE_RPC, names.map(name => args[name]))).rows[0].receipt
        } else if (url.pathname === '/rest/v1/rpc/recording_output_candidate') {
          event.rpc = 'candidate'
          const names = ['p_job_id', 'p_action', 'p_worker_id', 'p_attempt', 'p_manifest_sha256', 'p_candidate_id', 'p_output']
          h.eq(Object.keys(args).sort(), names.toSorted(), 'seven exact candidate arguments')
          receipt = (await client.query(CANDIDATE_RPC, names.map(name => args[name]))).rows[0].receipt
        } else {
          event.rpc = 'finalize'
          h.eq(url.pathname, '/rest/v1/rpc/finalize_recording_job', 'only finalization RPC dispatches terminal state')
          const names = ['p_job_id', 'p_action', 'p_worker_id', 'p_attempt', 'p_manifest_sha256', 'p_candidate_id', 'p_output', 'p_failure_code']
          h.eq(Object.keys(args).sort(), names.toSorted(), 'eight exact terminal arguments')
          event.localCleanupBeforeTerminal = await config.cleanupAtTerminal()
          event.before = await state(h, config.f)
          await client.query('BEGIN'); transaction = true
          receipt = await finalizeRpc(client, names.map(name => args[name]))
          await client.query('COMMIT'); transaction = false
          event.committed = true; event.after = await state(h, config.f)
          event.receipt = receipt
          if (config.mode === 'response-loss') { event.responseLost = true; res.destroy(); return }
          if (config.mode === 'malformed-receipt') { json(res, { ...receipt, unexpected: 'SECRET synthetic malformed receipt' }); return }
        }
        event.committed = true; event.receipt = receipt
        json(res, receipt); return
      }
      h.eq(req.method, 'GET', 'non-RPC database routes remain read-only')
      const table = url.pathname.slice('/rest/v1/'.length), columns = tables.get(table)
      h.ok(columns, 'allowlisted query table')
      const quote = name => { h.ok(columns.has(name), 'allowlisted query column'); return `"${name}"` }
      const params = [], predicates = []
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset'].includes(key)) continue
        const column = quote(key)
        if (value.startsWith('eq.')) { params.push(value.slice(3)); predicates.push(`${column}=$${params.length}`) }
        else if (value.startsWith('cs.')) { params.push(value.slice(3)); predicates.push(`${column} @> $${params.length}::jsonb`) }
        else if (value.startsWith('in.(') && value.endsWith(')')) { params.push(value.slice(4, -1).split(',')); predicates.push(`${column}::text=ANY($${params.length}::text[])`) }
        else if (value === 'not.is.null') predicates.push(`${column} IS NOT NULL`)
        else throw new Error('Unsupported fixture filter')
      }
      const where = predicates.length ? ` WHERE ${predicates.join(' AND ')}` : ''
      const total = Number((await client.query(`SELECT count(*) AS n FROM public.${table}${where}`, params)).rows[0].n)
      const select = url.searchParams.get('select') ?? '*', projection = select === '*' ? '*' : select.split(',').map(quote).join(',')
      const order = url.searchParams.get('order'), offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1000)
      h.ok(!order || order === 'chunk_index.asc', 'only chunk order supported')
      h.ok(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 2001, 'bounded query pagination')
      params.push(limit, offset)
      const rows = (await client.query(`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') AS rows FROM
        (SELECT ${projection} FROM public.${table}${where}${order ? ' ORDER BY chunk_index ASC' : ''} LIMIT $${params.length - 1} OFFSET $${params.length}) t`, params)).rows[0].rows
      json(res, rows, 200, { 'content-range': rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}` })
    } catch (error) {
      if (transaction && client) { await client.query('ROLLBACK'); event.rolledBack = true }
      if (controller.signal.aborted) return
      event.sqlstate = error.code ?? 'FIXTURE_FAILED'
      if (error.label || !/^[0-9A-Z]{5}$/.test(event.sqlstate)) errors.push(error.label ?? error.message)
      if (!res.destroyed) json(res, { code: event.sqlstate, message: 'SECRET synthetic provider message' }, 400)
    } finally {
      controller.signal.removeEventListener('abort', abortQuery)
      req.removeListener('aborted', abort); res.removeListener('close', abort); res.removeListener('finish', finish)
      if (client) await h.close(client)
      event.finished = true; event.finishedAt = performance.now()
      event.responseFinished = res.writableFinished
      event.fixtureListenersRemoved = !req.listeners('aborted').includes(abort) && !res.listeners('close').includes(abort)
    }
  }
  const server = createServer((req, res) => {
    const work = handle(req, res).catch(error => { errors.push(error.label ?? error.message); res.destroy() })
    pending.add(work); void work.finally(() => pending.delete(work))
  })
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  async function settle() {
    const deadline = performance.now() + 5000
    while ((pending.size || sockets.size) && performance.now() < deadline) await delay(10)
    h.eq(pending.size, 0, 'all native handlers and their PG clients settled')
    h.eq(sockets.size, 0, 'all request sockets closed')
    h.eq(errors, [], 'no fixture errors')
  }
  return { events, objects, inputs, loopback: `http://127.0.0.1:${server.address().port}`, settle,
    async configure(config) {
      current = config
      for (const [key, bytes] of config.f.objects) {
        const file = join(objectRoot, digest(key))
        await writeFile(file, bytes, { flag: 'wx' })
        inputs.set(key, { file, sha256: digest(bytes), byteSize: bytes.length })
      }
    },
    async close() {
      const closed = new Promise(resolve => server.close(resolve))
      server.closeAllConnections(); await closed; await settle()
      h.report.httpCleanup = { listening: server.listening, pending: pending.size, sockets: sockets.size, errors,
        everyHandlerFinished: events.every(event => event.finished), fixtureListenersRemoved: events.every(event => event.fixtureListenersRemoved) }
      h.eq(h.report.httpCleanup, { listening: false, pending: 0, sockets: 0, errors: [], everyHandlerFinished: true, fixtureListenersRemoved: true }, 'HTTP fixture fully cleaned')
    },
  }
}
