import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { setup, USER, OTHER, PROJECT, METADATA } from '../pg17-recording-flow/fixture.mjs'
import { databaseHttp, SERVICE_KEY } from '../recording-flow-browser/database-http.mjs'
import { compileServer } from '../recording-flow-browser/compile-server.mjs'
import { compileModule } from './compile-module.mjs'
const require = createRequire(import.meta.url), JSZip = require('jszip'), { chromium, expect } = require('@playwright/test')
const inputPath = resolve(process.argv[2] || '')
if (!process.argv[2]) throw new Error('Provide a passed Chrome results.json containing savedObjects')
const input = JSON.parse(await readFile(inputPath, 'utf8'))
if (input.status !== 'passed' || input.channel !== 'chrome') throw new Error('Input must be a passed actual Chrome recording')
const original = input.savedObjects.find(object => object.key.startsWith('recording-candidates/'))
if (!original || !/^[a-z0-9.-]+$/.test(original.filename)) throw new Error('Missing captured audio')
const audio = await readFile(join(dirname(inputPath), original.filename))
if (digest(audio) !== original.sha256 || audio.length !== original.byteSize) throw new Error('Input audio hash mismatch')
const evidence = join(root, 'docs/research/evidence/2026-11-07-g1-chrome', `export-${Date.now()}-${randomUUID()}`)
await mkdir(evidence, { recursive: true })
const report = { status: 'running', assertions: 0, actorConnections: [], sources: {}, checks: [],
  input: { path: inputPath, resultSha256: digest(await readFile(inputPath)), audioSha256: original.sha256 },
  boundary: 'Actual recording routes/worker, export/play handlers, project authorization, PG17 and Chrome. Synthetic token lookup plus local PostgREST/Storage adapters. Offline file playback uses a separate Chrome context; no physical second device.' }
const h = new Harness(report), previousFlag = process.env.MEDIA_ASSETS_ENABLED
let db, compiled, server, browser
async function source(path) { const bytes = await readFile(join(root, path)); report.sources[path] = digest(bytes); return bytes.toString() }
const OUTSIDER = '33333333-3333-4333-8333-333333333333', PENDING = '44444444-4444-4444-8444-444444444444', REMOVED = '55555555-5555-4555-8555-555555555555'
try {
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  await h.start(); await setup(h, source)
  await h.db.query(`ALTER TABLE projects ADD COLUMN name text DEFAULT 'Synthetic family A', ADD COLUMN description text DEFAULT 'G1 local archive';
    CREATE TABLE public.transcript_versions(id uuid,project_id uuid,story_id uuid,asset_id uuid);
    GRANT SELECT ON transcript_versions TO service_role;
    INSERT INTO auth.users VALUES('${OUTSIDER}'),('${PENDING}'),('${REMOVED}');
    INSERT INTO projects(id,facilitator_id,name) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${OUTSIDER}','Synthetic family B');
    INSERT INTO project_roles(project_id,user_id,role,status) VALUES('${PROJECT}','${PENDING}','storyteller','pending'),('${PROJECT}','${REMOVED}','storyteller','removed');`)
  const observationSql = (await source('supabase/migrations/20261029000002_export_observations.sql')).split('CREATE OR REPLACE FUNCTION public.read_operational_snapshot_v2()')[0]
  report.observations = { scope: 'Exact archive tables/guard/begin/finish/ACL prefix; unrelated operational aggregator excluded', sha256: digest(observationSql) }
  await h.db.query(observationSql)
  db = await databaseHttp(h)
  // Observation RPCs execute unchanged SQL. The rest use the existing HTTP SDK adapter.
  const baseRpc = db.admin.rpc.bind(db.admin)
  db.admin.rpc = (name, args) => {
    if (!['begin_archive_assembly_attempt', 'finish_archive_assembly_attempt'].includes(name)) return baseRpc(name, args)
    let signal
    const run = async () => {
      signal?.throwIfAborted()
      const c = await h.actorClient('service_role', USER)
      try {
        const values = name === 'begin_archive_assembly_attempt' ? [args.p_attempt_id] : [args.p_attempt_id, args.p_outcome]
        const sql = name === 'begin_archive_assembly_attempt' ? 'SELECT begin_archive_assembly_attempt($1::uuid) AS value' : 'SELECT finish_archive_assembly_attempt($1::uuid,$2::text) AS value'
        const result = await c.query(sql, values); signal?.throwIfAborted(); return { data: result.rows[0].value, error: null }
      } finally { await h.close(c) }
    }
    const query = { abortSignal(value) { signal = value; return query }, retry(value) { h.eq(value, false, 'observation disables retry'); return query }, then(resolve, reject) { return run().then(resolve, reject) } }
    return query
  }
  compiled = await compileServer(h.scratch, source, db.admin)
  const sessionId = randomUUID(), recordingHeaders = { authorization: 'Bearer synthetic-flow-session', 'content-type': 'application/json' }
  const record = async (name, data) => {
    const response = await compiled.routes[name].POST(new compiled.NextRequest('http://fixture.invalid/' + name, { method: 'POST', headers: recordingHeaders, body: JSON.stringify(data) }), { params: Promise.resolve({ sessionId }) })
    const value = await response.json()
    report.recordingResponses ??= []; report.recordingResponses.push({ name, status: response.status, value })
    h.ok(response.ok, 'actual ' + name + ' succeeds'); return value
  }
  const reserved = await record('save', { action: 'reserve', projectId: PROJECT, metadata: METADATA })
  const key = `projects/${PROJECT}/sessions/${sessionId}/0`
  db.objects.set(`audio-recordings/${USER}/${key}`, { bytes: audio, type: original.mimeType })
  const sealed = await record('seal', { projectId: PROJECT, storyId: reserved.intent.storyId, mimeType: original.mimeType,
    chunks: [{ index: 0, chunkId: sessionId + '-0', bucket: 'audio-recordings', objectKey: key, byteSize: audio.length, sha256: digest(audio) }] })
  const result = await compiled.host.runRecordingWorkerOnce({ admin: db.admin, storageUrl: 'https://storage.invalid', serviceRoleKey: SERVICE_KEY,
    fetch: db.transport, workerId: 'chrome-export-worker', ffmpeg: { executable: '/usr/local/bin/ffmpeg', timeoutMs: 60000, maxDurationMs: 1810000 } })
  h.eq(result.outcome, 'succeeded', 'actual worker republishes captured Chrome audio')
  const confirmed = await record('save', { action: 'confirm', projectId: PROJECT, manifestSha256: sealed.manifestSha256 })
  const authBoundary = join(h.scratch, 'archive-auth.cjs')
  const accounts = { owner: OTHER, active: USER, outsider: OUTSIDER, pending: PENDING, removed: REMOVED }
  report.accounts = Object.entries(accounts).map(([role, id]) => ({ id, role, email: `g1-${role}@example.test`, authentication: 'local synthetic bearer; no external account' }))
  await writeFile(authBoundary, `const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});const accounts=${JSON.stringify(accounts)};exports.getAuthenticatedUser=async request=>{const id=accounts[(request.headers.get('authorization')||'').replace(/^Bearer fixture-/, '')];return id?{ok:true,user:{id},headers:new Headers()}:{ok:false,response:NextResponse.json({error:'Local authentication required'},{status:401})}};`)
  const boundaries = { '@/lib/server/auth': authBoundary, '@/lib/supabase': join(h.scratch, 'server/fixture-boundary.cjs') }
  const exportRoute = await compileModule('app/api/projects/[id]/export/route.ts', join(h.scratch, 'archive-compiled'), source, boundaries)
  const playRoute = await compileModule('app/api/media/assets/[assetId]/play/route.ts', join(h.scratch, 'play-compiled'), source, boundaries)
  for (const path of ['experiments/g1-local/verify-export.mjs', 'experiments/g1-local/compile-module.mjs', 'experiments/recording-flow-browser/database-http.mjs', 'experiments/recording-flow-browser/compile-server.mjs']) await source(path)
  report.requests = []
  server = createServer(async (req, res) => {
    try {
      if (req.url === '/') { res.end('<!doctype html><title>Local G1 API verification</title><h1>G1 local export and permission verification</h1>'); return }
      const request = new compiled.NextRequest('http://127.0.0.1' + req.url, { method: req.method, headers: req.headers })
      const response = req.url.endsWith('/export') ? await exportRoute.POST(request, { params: Promise.resolve({ id: PROJECT }) })
        : await playRoute.GET(request, { params: Promise.resolve({ assetId: confirmed.assetId }) })
      report.requests.push({ path: req.url, status: response.status, role: req.headers.authorization?.replace('Bearer fixture-', '') })
      response.headers.forEach((value, key) => res.setHeader(key, value)); res.writeHead(response.status); res.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) { report.serverError = error.message; res.writeHead(500); res.end('fixture failed') }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true }); report.browser = browser.version()
  const context = await browser.newContext(), page = await context.newPage(); await page.goto(origin)
  const call = (role, kind = 'export') => page.evaluate(async ({ role, kind, project, asset }) => {
    const path = kind === 'export' ? `/api/projects/${project}/export` : `/api/media/assets/${asset}/play`
    const response = await fetch(path, { method: kind === 'export' ? 'POST' : 'GET', headers: role ? { Authorization: `Bearer fixture-${role}` } : {}, redirect: 'manual' })
    return { status: response.status, type: response.headers.get('content-type') }
  }, { role, kind, project: PROJECT, asset: confirmed.assetId })
  for (const [role, expected] of [[null, 401], ['outsider', 403], ['pending', 403], ['removed', 403], ['owner', 200], ['active', 200]]) {
    h.eq((await call(role)).status, expected, 'Chrome export role ' + role)
    if (expected !== 200) h.eq((await call(role, 'play')).status, expected, 'Chrome play role ' + role)
  }
  report.checks.push('Chrome requests enforce anonymous, family B, pending, removed, owner and active role matrix')
  const response = await fetch(`${origin}/api/projects/${PROJECT}/export`, { method: 'POST', headers: { Authorization: 'Bearer fixture-active' } })
  h.eq(response.status, 200, 'recorded story export succeeds')
  const zipBytes = Buffer.from(await response.arrayBuffer()), zip = await JSZip.loadAsync(zipBytes, { checkCRC32: true })
  await writeFile(join(evidence, 'archive.zip'), zipBytes)
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'))
  h.eq(manifest.assets.length, 1, 'one exported original')
  for (const asset of manifest.assets) {
    const bytes = await zip.file(`media/${asset.assetId}/${asset.filename}`).async('nodebuffer')
    h.eq(digest(bytes), asset.sha256, 'exported object hash'); h.eq(bytes.length, asset.byteSize, 'exported object length'); h.eq(digest(bytes), digest(audio), 'archive equals real Chrome original')
  }
  const extracted = join(evidence, 'offline')
  for (const item of Object.values(zip.files)) {
    if (item.dir) continue
    if (item.name.split('/').some(part => part === '..') || item.name.startsWith('/')) throw new Error('Unsafe archive entry')
    const path = join(extracted, item.name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, await item.async('nodebuffer'))
  }
  const offline = await browser.newContext({ offline: true }), offlinePage = await offline.newPage()
  report.offlineNetworkRequests = []; offlinePage.on('request', request => { if (/^https?:/.test(request.url())) report.offlineNetworkRequests.push(request.url()) })
  await offlinePage.goto(pathToFileURL(join(extracted, 'index.html')).href)
  const player = offlinePage.locator('audio'); await player.evaluate(audio => audio.play())
  await expect.poll(() => player.evaluate(audio => audio.currentTime)).toBeGreaterThan(0)
  report.offlineDuration = await player.evaluate(audio => { audio.pause(); return audio.duration })
  await offlinePage.screenshot({ path: join(evidence, 'offline-chrome.png'), fullPage: true })
  h.eq(report.offlineNetworkRequests, [], 'offline archive makes no remote request')
  report.checks.push('complete ZIP CRC and every original hash verified; file URL playback advances in a separate offline Chrome context')
  const stored = db.objects.get(`recording-candidates/${(await h.db.query('SELECT object_key FROM media_assets WHERE id=$1', [confirmed.assetId])).rows[0].object_key}`)
  const oldBytes = stored.bytes; stored.bytes = Buffer.from('damaged')
  h.eq((await call('active')).status, 409, 'corrupt bytes rejected'); stored.bytes = oldBytes
  const keyToRemove = [...db.objects].find(([, value]) => value === stored)[0]
  db.objects.delete(keyToRemove); h.eq((await call('active')).status, 409, 'missing bytes rejected'); db.objects.set(keyToRemove, stored)
  await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
  h.eq((await call('active')).status, 403, 'revocation blocks new export'); h.eq((await call('active', 'play')).status, 403, 'revocation blocks new playback')
  await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
  await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)', [PROJECT, sessionId, OTHER])
  h.eq((await call('active')).status, 409, 'session tombstone blocks archive'); h.eq((await call('active', 'play')).status, 409, 'session tombstone blocks playback')
  report.checks.push('corrupt/missing originals, actual role revocation and session tombstone block subsequent export/playback')
  report.archive = { byteSize: zipBytes.length, sha256: digest(zipBytes), manifest }
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = { message: error.message, label: error.label, stack: error.stack }; process.exitCode = 1 }
finally {
  await browser?.close()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  await db?.close(); compiled?.clear(); await h.cleanup()
  if (previousFlag === undefined) delete process.env.MEDIA_ASSETS_ENABLED; else process.env.MEDIA_ASSETS_ENABLED = previousFlag
  report.sourceDrift = []
  for (const [path, hash] of Object.entries(report.sources)) if (digest(await readFile(join(root, path))) !== hash) report.sourceDrift.push(path)
  if (report.sourceDrift.length || report.status !== 'passed') process.exitCode = 1
  await writeFile(join(evidence, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ evidence, status: report.status, checks: report.checks, error: report.error, cleanup: report.cleanup }, null, 2))
}
