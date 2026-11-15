import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { gzipSync } from 'node:zlib'
import { digest } from '../pg17-routines/runtime.mjs'
import { USER, RPC } from '../pg17-recording-worker/fixture.mjs'
import { CANDIDATE_RPC } from './fixture.mjs'
import { SECRET } from './application-client.mjs'

export async function nativeHttpFixture(h) {
  const requests = h.report.applicationRequests = []
  const objects = new Map(), sockets = new Set(), pending = new Set(), errors = []
  const tables = new Set(['processing_jobs', 'media_assets', 'recording_sessions', 'recording_chunks',
    'projects', 'project_roles', 'stories', 'deletion_requests'])
  const columns = new Map()
  for (const table of tables) columns.set(table, new Set((await h.db.query(
    'SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped', [table])).rows.map(row => row.attname)))
  const objectRoot = join(h.scratch, 'native-storage-objects')
  await mkdir(objectRoot)
  let current
  const waitForClose = signal => new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  async function body(req, maximum = 104857600) {
    const parts = []; let length = 0
    for await (const part of req) {
      length += part.length
      if (length > maximum) throw new Error('Synthetic request exceeds limit')
      parts.push(part)
    }
    return Buffer.concat(parts)
  }
  function json(res, value, status = 200, headers = {}) {
    res.writeHead(status, { 'content-type': 'application/json', 'connection': 'close', ...headers })
    res.end(JSON.stringify(value))
  }
  async function commitObject(key, bytes, client) {
    h.ok(!objects.has(key), 'native object store refuses all overwrites')
    const file = join(objectRoot, digest(key))
    await writeFile(file, bytes, { flag: 'wx' })
    await client.query(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('recording-candidates',$1,$2::jsonb)`,
      [key, JSON.stringify({ byteSize: bytes.length, sha256: digest(bytes) })])
    objects.set(key, { bytes: Buffer.from(bytes), file, sha256: digest(bytes) })
  }
  async function handle(req, res) {
    const config = current
    const url = new URL(req.url, 'http://127.0.0.1')
    const event = { case: config?.name, method: req.method, path: url.pathname, kind: 'query', action: null,
      committed: false, aborted: false, handlerFinished: false, responseFinished: false, receivedBytes: 0 }
    requests.push(event)
    const controller = new AbortController()
    const abort = () => { event.aborted = true; controller.abort(new Error('Native peer disconnected')) }
    req.once('aborted', abort)
    res.once('close', () => { if (!res.writableFinished) abort() })
    res.once('finish', () => { event.responseFinished = true })
    let client
    const abortQuery = () => client?.connection?.stream?.destroy(new Error('Native request cancelled'))
    try {
      h.ok(config, 'native server has one explicit synthetic attempt')
      h.eq(req.headers.authorization, `Bearer ${SECRET}`, 'native request carries synthetic service bearer')
      client = await h.actorClient('service_role', USER)
      controller.signal.addEventListener('abort', abortQuery, { once: true })
      controller.signal.throwIfAborted()
      if (url.pathname.startsWith('/storage/v1/object/')) {
        h.eq(req.headers.apikey, SECRET, 'Storage request carries synthetic API key')
        const location = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length))
        if (location.startsWith('audio-recordings/')) {
          event.kind = 'input-read'
          h.eq(req.method, 'GET', 'input Storage is read-only')
          const bytes = config.f.objects.get(location.slice('audio-recordings/'.length))
          h.ok(bytes, 'input bytes come from the exact sealed synthetic key')
          res.writeHead(200, { 'content-type': config.f.mimeType, 'content-length': bytes.length, 'connection': 'close' })
          res.end(bytes)
          return
        }
        h.ok(location.startsWith('recording-candidates/'), 'only dedicated candidate bucket is writable')
        const key = location.slice('recording-candidates/'.length)
        const row = (await client.query(`SELECT * FROM recording_output_candidates WHERE job_id=$1 AND object_key=$2`, [config.f.jobId, key])).rows[0]
        h.ok(row, 'real reserved candidate exists before native Storage I/O')
        if (req.method === 'POST') {
          event.kind = 'candidate-upload'
          h.eq(row.state, 'reserved', 'upload never targets a prepared candidate')
          h.eq(req.headers['x-upsert'], 'false', 'native POST explicitly refuses upsert')
          h.eq(req.headers['content-type'], row.mime_type, 'native upload MIME matches registered metadata')
          h.eq(Number(req.headers['content-length']), Number(row.byte_size), 'native upload declares exact length')
          const bytes = await body(req)
          event.receivedBytes = bytes.length
          h.eq(bytes.length, Number(row.byte_size), 'native server reads the entire actual file stream')
          h.eq(digest(bytes), row.sha256, 'native server hashes actual streamed upload bytes')
          if (config.mode === 'conflict' && !objects.has(key)) {
            await commitObject(key, Buffer.from('preexisting-immutable-object'), client)
            event.seededConflict = true
          }
          if (objects.has(key)) { json(res, { message: 'SECRET synthetic existing object' }, 409); return }
          await commitObject(key, bytes, client)
          event.committed = true
          if (config.mode === 'upload-response-lost' || config.mode === 'kill-upload') {
            event.responseLost = true
            config.checkpoint?.('upload', event)
            await waitForClose(controller.signal)
            return
          }
          json(res, { key: 'synthetic-private-candidate' }, 201)
          return
        }
        event.kind = 'candidate-readback'
        h.eq(req.method, 'GET', 'candidate has only immutable POST and GET, never deletion')
        const stored = objects.get(key)
        h.ok(stored, 'readback retrieves independently stored bytes')
        event.objectSha256 = stored.sha256
        const mode = config.mode
        if (mode === 'redirect') {
          res.writeHead(307, { location: '/unexpected-redirect', connection: 'close' }); res.end(); return
        }
        let bytes = await readFile(stored.file)
        h.eq(digest(bytes), stored.sha256, 'native GET reads the persisted object file independently of upload memory')
        if (mode === 'short') bytes = bytes.subarray(0, bytes.length - 1)
        if (mode === 'long') bytes = Buffer.concat([bytes, Buffer.from([0])])
        if (mode === 'hash-corrupt') { bytes = Buffer.from(bytes); bytes[bytes.length - 1] ^= 1 }
        if (mode === 'encoding') bytes = gzipSync(bytes)
        event.responseBytes = bytes.length
        event.registeredBytes = stored.bytes.length
        event.responseEncoding = mode === 'encoding' ? 'gzip' : 'identity'
        event.responseSha256 = digest(bytes)
        const headers = { 'content-type': row.mime_type, 'connection': 'close' }
        if (mode === 'encoding') headers['content-encoding'] = 'gzip'
        if (!['short', 'long', 'encoding'].includes(mode)) headers['content-length'] = stored.bytes.length
        res.writeHead(200, headers)
        if (['stall', 'cancel', 'job-cancel', 'revoke'].includes(mode)) {
          res.write(bytes.subarray(0, 1))
          event.partialBytes = 1
          if (mode === 'cancel') {
            await delay(40, undefined, { signal: controller.signal }); config.abort()
          } else if (mode === 'job-cancel') {
            await h.db.query('UPDATE processing_jobs SET cancel_requested_at=clock_timestamp() WHERE id=$1', [config.f.jobId])
            event.cancellationRequested = true
          } else if (mode === 'revoke') {
            await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2", [config.f.manifest.projectId, USER])
            event.accessRevoked = true
          }
          await waitForClose(controller.signal)
          return
        }
        if (config.readbackDelayMs) {
          const width = Math.ceil(bytes.length / 4)
          for (let offset = 0; offset < bytes.length; offset += width) {
            res.write(bytes.subarray(offset, offset + width))
            await delay(config.readbackDelayMs / 4, undefined, { signal: controller.signal })
          }
          res.end()
        } else {
          // write/end separately keeps short/long cases chunked and exercises the
          // worker's stream bound, not just its Content-Length preflight.
          res.write(bytes); res.end()
        }
        return
      }
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        event.kind = 'rpc'
        h.eq(req.method, 'POST', 'database mutations use only explicit native RPC adapter')
        const args = JSON.parse((await body(req, 65536)).toString())
        event.action = args.p_action
        let receipt
        if (url.pathname === '/rest/v1/rpc/recording_job_lease') {
          event.rpc = 'lease'
          h.eq(Object.keys(args).sort(), ['p_job_id', 'p_action', 'p_worker_id', 'p_attempt', 'p_lease_ms'].sort(), 'five exact lease RPC arguments')
          receipt = (await client.query(RPC, [args.p_job_id, args.p_action, args.p_worker_id, args.p_attempt, args.p_lease_ms])).rows[0].receipt
        } else {
          h.eq(url.pathname, '/rest/v1/rpc/recording_output_candidate', 'only exact candidate RPC adapter is supported')
          event.rpc = 'candidate'
          h.eq(Object.keys(args).sort(), ['p_job_id', 'p_action', 'p_worker_id', 'p_attempt', 'p_manifest_sha256', 'p_candidate_id', 'p_output'].sort(), 'seven exact candidate RPC arguments')
          receipt = (await client.query(CANDIDATE_RPC, [args.p_job_id, args.p_action, args.p_worker_id, args.p_attempt,
            args.p_manifest_sha256, args.p_candidate_id, args.p_output])).rows[0].receipt
        }
        event.committed = true; event.receiptState = receipt.state
        if (event.rpc === 'candidate' && ((config.mode === 'reserve-response-lost' && args.p_action === 'reserve') ||
          (['prepare-response-lost', 'kill-prepare'].includes(config.mode) && args.p_action === 'prepare'))) {
          event.responseLost = true
          config.checkpoint?.('prepare', event)
          await waitForClose(controller.signal)
          return
        }
        json(res, receipt)
        return
      }
      h.eq(req.method, 'GET', 'non-RPC database route is read-only')
      const table = url.pathname.slice('/rest/v1/'.length)
      h.ok(tables.has(table), 'query table is explicitly allowlisted')
      const params = [], where = []
      const quote = name => { h.ok(columns.get(table).has(name), 'query column allowlisted'); return `"${name}"` }
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset'].includes(key)) continue
        const col = quote(key)
        if (value.startsWith('eq.')) { params.push(value.slice(3)); where.push(`${col}=$${params.length}`) }
        else if (value.startsWith('cs.')) { params.push(value.slice(3)); where.push(`${col} @> $${params.length}::jsonb`) }
        else if (value.startsWith('in.(') && value.endsWith(')')) { params.push(value.slice(4, -1).split(',')); where.push(`${col}::text=ANY($${params.length}::text[])`) }
        else if (value === 'not.is.null') where.push(`${col} IS NOT NULL`)
        else throw new Error('Unsupported native fixture query filter')
      }
      const clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
      const total = Number((await client.query(`SELECT count(*) AS n FROM public.${table}${clause}`, params)).rows[0].n)
      const select = url.searchParams.get('select') ?? '*', projection = select === '*' ? '*' : select.split(',').map(quote).join(',')
      const order = url.searchParams.get('order')
      h.ok(!order || order === 'chunk_index.asc', 'only explicit chunk order supported')
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1000)
      h.ok(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 2001, 'safe query pagination bounds')
      params.push(limit, offset)
      const rows = (await client.query(`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') AS rows FROM
        (SELECT ${projection} FROM public.${table}${clause}${order ? ' ORDER BY chunk_index ASC' : ''} LIMIT $${params.length - 1} OFFSET $${params.length}) t`, params)).rows[0].rows
      json(res, rows, 200, { 'content-range': rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}` })
    } catch (error) {
      if (controller.signal.aborted) { event.aborted = true; return }
      if (/^[A-Z0-9]{5}$/.test(error.code ?? '') && error.code !== 'ERROR') {
        event.sqlstate = error.code
        json(res, { code: error.code, message: 'SECRET synthetic SQL provider body' }, 409)
      } else {
        event.fixtureFailure = error.label ?? error.message
        errors.push(error)
        if (!res.headersSent) json(res, { message: 'SECRET synthetic fixture failure' }, 500)
        else res.destroy()
      }
    } finally {
      controller.signal.removeEventListener('abort', abortQuery)
      if (client) await h.close(client)
      event.handlerFinished = true
    }
  }
  const server = createServer((req, res) => {
    const work = handle(req, res)
    pending.add(work)
    work.catch(error => errors.push(error)).finally(() => pending.delete(work))
  })
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const loopback = `http://127.0.0.1:${server.address().port}`
  async function settle() {
    const deadline = performance.now() + 5000
    while ((pending.size || sockets.size) && performance.now() < deadline) await delay(10)
    h.eq(pending.size, 0, 'all native request handlers and PG clients settle')
    h.eq(sockets.size, 0, 'all native HTTP sockets close after attempt')
    if (errors.length) throw errors[0]
  }
  return { requests, objects, loopback, setCase(value) { current = value }, settle,
    async close() {
      const closed = new Promise(resolve => server.close(resolve))
      server.closeAllConnections()
      await closed
      await Promise.allSettled([...pending])
      h.report.nativeHttpCleanup = { listening: server.listening, socketsRemaining: sockets.size, handlersRemaining: pending.size, fixtureErrors: errors.length }
    },
  }
}
