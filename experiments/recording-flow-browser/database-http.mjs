import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { USER } from '../pg17-recording-flow/fixture.mjs'
const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
export const SERVICE_KEY = 'synthetic-flow-service-no-real-permission'
const FUNCTIONS = new Set(['recording_story_save', 'seal_recording_manifest', 'recording_job_lease',
  'recording_output_candidate', 'finalize_recording_job', 'read_recording_session_snapshot',
  'request_media_deletion', 'request_story_deletion', 'purge_story_content', 'media_deletion_execute'])

/** Local PostgREST/Storage transport substitute; every row and RPC uses real PG. */
export async function databaseHttp(h, options = {}) {
  const functions = new Set([...FUNCTIONS, ...(options.allowedFunctions || [])])
  const columns = new Map(), procedures = new Map(), objects = new Map(), requests = [], pending = new Set()
  for (const schema of ['public', 'storage']) {
    const tables = (await h.db.query('SELECT tablename FROM pg_tables WHERE schemaname=$1', [schema])).rows
    for (const { tablename } of tables) columns.set(`${schema}.${tablename}`, new Set((await h.db.query(
      'SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped', [`${schema}.${tablename}`])).rows.map(r => r.attname)))
  }
  for (const row of (await h.db.query("SELECT p.proname,p.proargnames,p.proargtypes::regtype[]::text[] AS types FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")).rows) {
    if (functions.has(row.proname)) procedures.set(row.proname, row)
  }
  function json(res, value, status = 200, headers = {}) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(value)) }
  function serveObject(req, res, object) {
    const size = object.bytes.length
    const headers = { 'content-type': object.type, 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' }
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
      const start = match?.[1] ? Number(match[1]) : match?.[2] ? Math.max(0, size - Number(match[2])) : NaN
      const end = match?.[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
        res.writeHead(416, { ...headers, 'content-range': `bytes */${size}`, 'content-length': 0 }); res.end(); return
      }
      res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 })
      res.end(object.bytes.subarray(start, end + 1)); return
    }
    res.writeHead(200, { ...headers, 'content-length': size }); res.end(object.bytes)
  }
  async function read(req) {
    let size = 0; const chunks = []
    for await (const chunk of req) { size += chunk.length; if (size > 104857600) throw new Error('fixture body limit'); chunks.push(chunk) }
    return Buffer.concat(chunks)
  }
  const id = name => { if (!/^[a-z_][a-z_0-9]*$/.test(name)) throw new Error('unsafe fixture identifier'); return `"${name}"` }
  async function handle(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1'), event = { method: req.method, path: url.pathname, status: null, ...(req.headers.range ? { range: req.headers.range } : {}) }
    requests.push(event)
    let client
    try {
      if (req.method === 'GET' && url.pathname.startsWith('/storage/v1/object/sign/') && url.searchParams.get('token') === 'synthetic-signed-flow') {
        const object = objects.get(decodeURIComponent(url.pathname.slice('/storage/v1/object/sign/'.length)))
        if (!object) return json(res, { message: 'fixture object missing' }, 404)
        serveObject(req, res, object); return
      }
      if (req.headers.authorization !== `Bearer ${SERVICE_KEY}`) return json(res, { message: 'synthetic service required' }, 401)
      client = await h.actorClient('service_role', USER)
      // Match the UTC database session used by the application/PostgREST contract.
      await client.query("SET timezone='UTC'")
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').at(-1), proc = procedures.get(name)
        if (!proc || req.method !== 'POST') throw new Error('unsupported fixture RPC')
        const args = JSON.parse((await read(req)).toString())
        if (Object.keys(args).some(k => !proc.proargnames.includes(k)) || proc.proargnames.some(k => !(k in args))) throw new Error('wrong fixture RPC arguments')
        const values = proc.proargnames.map((k, i) => proc.types[i] === 'jsonb' && args[k] != null ? JSON.stringify(args[k]) : args[k])
        const query = `SELECT public.${id(name)}(${proc.types.map((type, i) => `$${i + 1}::${type}`).join(',')}) AS value`
        const value = (await client.query(query, values)).rows[0].value
        event.rpc = name; event.committed = true
        return json(res, value)
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.slice('/rest/v1/'.length), schema = String(req.headers['accept-profile'] || req.headers['content-profile'] || 'public')
        const allowed = columns.get(`${schema}.${table}`)
        if (!allowed) throw new Error('unsupported fixture table')
        const column = name => { if (!allowed.has(name)) throw new Error('unsupported fixture column'); return id(name) }
        const selected = url.searchParams.get('select') || '*'
        const select = selected === '*' ? '*' : selected.split(',').map(column).join(',')
        const values = [], predicates = [], bind = value => { values.push(value); return `$${values.length}` }
        const splitTerms = text => {
          const terms=[];let depth=0,start=0
          for(let index=0;index<text.length;index++){
            if(text[index]==='(')depth++
            else if(text[index]===')')depth--
            else if(text[index]===','&&depth===0){terms.push(text.slice(start,index));start=index+1}
            if(depth<0||depth>8)throw new Error('unsupported fixture filter nesting')
          }
          if(depth!==0)throw new Error('unbalanced fixture filter')
          terms.push(text.slice(start));if(terms.some(term=>!term)||terms.length>100)throw new Error('unsupported fixture filter terms')
          return terms
        }
        const comparison = (key,expression) => {
          const col=column(key)
          if (expression.startsWith('eq.')) return `${col} = ${bind(expression.slice(3))}`
          if (expression.startsWith('in.(') && expression.endsWith(')')) return `${col} IN (${splitTerms(expression.slice(4,-1)).map(v=>bind(v.replace(/^"|"$/g,''))).join(',')})`
          if (expression === 'is.null') return `${col} IS NULL`
          if (expression === 'not.is.null') return `${col} IS NOT NULL`
          if (expression.startsWith('cs.')) return `${col} @> ${bind(JSON.stringify(JSON.parse(expression.slice(3))))}::jsonb`
          if (expression.startsWith('lte.')) return `${col} <= ${bind(expression.slice(4))}`
          if (expression.startsWith('gt.')) return `${col} > ${bind(expression.slice(3))}`
          throw new Error('unsupported fixture comparison')
        }
        const filterTerm = (term,depth=0) => {
          if(depth>8||term.length>4096)throw new Error('unsupported fixture filter size')
          const logical=/^(and|or)\((.*)\)$/.exec(term)
          if(logical)return '('+splitTerms(logical[2]).map(item=>filterTerm(item,depth+1)).join(logical[1]==='and'?' AND ':' OR ')+')'
          const leaf=/^([a-z_][a-z_0-9]*)\.(.+)$/.exec(term)
          if(!leaf)throw new Error('unsupported fixture filter leaf')
          return comparison(leaf[1],leaf[2])
        }
        for (const [key, expression] of url.searchParams) {
          if (['select', 'order', 'limit', 'offset'].includes(key)) continue
          if(key==='or'&&expression.startsWith('(')&&expression.endsWith(')'))predicates.push(filterTerm('or'+expression))
          else predicates.push(comparison(key,expression))
        }
        const where = predicates.length ? ` WHERE ${predicates.join(' AND ')}` : ''
        const qualified = `${id(schema)}.${id(table)}`
        let rows, total
        if (req.method === 'GET') {
          total = Number((await client.query(`SELECT count(*) AS n FROM ${qualified}${where}`, values)).rows[0].n)
          let tail = ''
          if (url.searchParams.has('order')) tail += ' ORDER BY ' + url.searchParams.get('order').split(',').map(term => {
            const [key, direction = 'asc', nulls] = term.split('.')
            if (!['asc', 'desc'].includes(direction) || (nulls && !['nullsfirst', 'nullslast'].includes(nulls))) throw new Error('unsupported fixture order')
            return column(key) + ' ' + direction + (nulls ? ' NULLS ' + (nulls === 'nullsfirst' ? 'FIRST' : 'LAST') : '')
          }).join(',')
          if (url.searchParams.has('limit')) { const n = Number(url.searchParams.get('limit')); if (!Number.isInteger(n) || n < 0 || n > 3000) throw new Error('fixture limit'); tail += ` LIMIT ${n}` }
          if (url.searchParams.has('offset')) { const n = Number(url.searchParams.get('offset')); if (!Number.isSafeInteger(n) || n < 0 || n > 25000) throw new Error('fixture offset'); tail += ` OFFSET ${n}` }
          rows = (await client.query(`SELECT to_jsonb(t) AS value FROM (SELECT ${select} FROM ${qualified}${where}${tail}) t`, values)).rows.map(r => r.value)
        } else if (req.method === 'POST') {
          const body = JSON.parse((await read(req)).toString()), keys = Object.keys(body)
          if (values.length || !keys.length || Array.isArray(body)) throw new Error('unsupported fixture insert')
          rows = (await client.query(`WITH inserted AS (INSERT INTO ${qualified}(${keys.map(column).join(',')}) VALUES(${keys.map(k => bind(typeof body[k] === 'object' && body[k] !== null ? JSON.stringify(body[k]) : body[k])).join(',')}) RETURNING ${select}) SELECT to_jsonb(t) AS value FROM inserted t`, values)).rows.map(r => r.value)
        } else throw new Error('unsupported fixture table method')
        const singular = String(req.headers.accept || '').includes('application/vnd.pgrst.object+json')
        if (singular && rows.length !== 1) return json(res, { code: 'PGRST116', message: 'fixture expected one row' }, 406)
        return json(res, singular ? rows[0] : rows, req.method === 'POST' ? 201 : 200, { 'content-range': `0-${Math.max(0, rows.length - 1)}/${total ?? rows.length}` })
      }
      if (url.pathname.startsWith('/storage/v1/object/sign/')) {
        const key = decodeURIComponent(url.pathname.slice('/storage/v1/object/sign/'.length))
        if (!objects.has(key)) return json(res, { message: 'fixture object missing' }, 404)
        return json(res, { signedURL: `/object/sign/${key}?token=synthetic-signed-flow` })
      }
      if (url.pathname.startsWith('/storage/v1/object/')) {
        const key = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length))
        if (req.method === 'POST') {
          if (req.headers['x-upsert'] !== 'false' || objects.has(key)) return json(res, { message: 'fixture object exists' }, 409)
          objects.set(key, { bytes: await read(req), type: req.headers['content-type'] || 'application/octet-stream' })
          return json(res, { Key: key }, 200)
        }
        const object = objects.get(key)
        if (!object) return json(res, { message: 'fixture object missing' }, 404)
        serveObject(req, res, object); return
      }
      throw new Error('unsupported fixture request')
    } catch (error) {
      event.error = error.code || error.message
      json(res, { code: error.code || 'FIXTURE', message: 'Local fixture operation failed' }, ['23505', '23514'].includes(error.code) ? 409 : error.code === '42501' ? 403 : 500)
    } finally { if (client) await h.close(client); event.status = res.statusCode }
  }
  const server = createServer((req, res) => { const task = handle(req, res); pending.add(task); task.finally(() => pending.delete(task)) })
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done) })
  const origin = `http://127.0.0.1:${server.address().port}`
  const admin = createClient(origin, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const transport = (input, init) => {
    const request = new Request(input, init), url = new URL(request.url)
    if (url.origin !== 'https://storage.invalid') throw new Error('remote transport denied')
    return fetch(origin + url.pathname + url.search, { method: request.method, headers: request.headers, body: request.body, duplex: 'half', signal: request.signal, redirect: 'error' })
  }
  return { origin, admin, transport, objects, requests,
    async close() { server.closeAllConnections(); await new Promise(done => server.close(done)); await Promise.allSettled([...pending]) } }
}
