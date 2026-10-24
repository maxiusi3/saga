const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const ts = require('typescript')
const { Client } = require('../t05-durable-worker/node_modules/pg')

const root = path.resolve(__dirname, '../..')
const reportPath = path.join(root, 'docs/research/evidence/2026-10-17-t02-compatibility', `run-${Date.now()}-${process.pid}.json`)
const snapshotFile = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T02-45-52-407Z.json'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG') && key !== 'DATABASE_URL'))
const command = (binary, args) => execFileSync(binary, args, {
  env, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
}).trim()
const report = { startedAt: new Date().toISOString(), status: 'running',
  scope: 'synthetic local data compatibility only; no remote access or production mutation',
  sources: {}, checks: [], runtime: { node: process.version } }
let scratch, clusterMayExist = false, requestedSignal, finishing = false
const clients = new Set()
function checkpoint() { if (requestedSignal) throw new Error('rehearsal interrupted') }
function onSignal(signal) { if (!finishing) requestedSignal = signal }
process.on('SIGTERM', onSignal)
process.on('SIGINT', onSignal)
const deadline = setTimeout(() => onSignal('deadline'), 120000)
function check(name, actual, expected) {
  checkpoint()
  assert.deepEqual(actual, expected, name)
  report.checks.push(name)
}
async function connect(database) {
  checkpoint()
  const client = new Client({ host: path.join(scratch, 'socket'), port: 5432,
    user: 'saga_t02_admin', database, ssl: false, password: 'synthetic-local-unused', connectionTimeoutMillis: 5000,
    options: '-c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000' })
  clients.add(client)
  client.on('error', () => {})
  client.once('end', () => clients.delete(client))
  await client.connect()
  checkpoint()
  check('local client ignores ambient SSL and credentials',
    [client.connectionParameters.ssl, client.connectionParameters.password], [false, 'synthetic-local-unused'])
  return client
}
const qi = name => `"${name.replaceAll('"', '""')}"`
async function main() {
  for (const name of ['experiments/t02-legacy-mapping/verify.cjs', 'experiments/t02-legacy-mapping/README.md',
    'packages/web/src/lib/legacy-media-reference.ts', 'packages/web/src/lib/legacy-story-media.ts',
    'packages/web/src/lib/__tests__/legacy-media-reference.test.ts', 'packages/web/src/lib/__tests__/legacy-story-media.test.ts']) {
    report.sources[name] = digest(await fs.readFile(path.join(root, name)))
  }
  const bytes = await fs.readFile(path.join(root, snapshotFile))
  report.snapshot = { path: snapshotFile, sha256: digest(bytes) }
  assert.equal(digest(bytes), 'bb808a1ce050947d21963ca91ec49c3adfa0ab80fe24f24f653f8c18bc6e6a4f')
  const snapshot = JSON.parse(bytes)
  report.runtime.postgres = command('postgres', ['--version'])
  report.runtime.pg = require('../t05-durable-worker/node_modules/pg/package.json').version
  report.runtime.typescript = ts.version
  scratch = await fs.mkdtemp('/tmp/saga-t02-')
  report.scratch = scratch
  checkpoint()
  await fs.mkdir(path.join(scratch, 'socket'), { mode: 0o700 })
  checkpoint()
  command('initdb', ['-D', path.join(scratch, 'data'), '-U', 'saga_t02_admin', '-A', 'trust', '--no-locale', '-E', 'UTF8'])
  checkpoint()
  clusterMayExist = true
  command('pg_ctl', ['-D', path.join(scratch, 'data'), '-l', path.join(scratch, 'postgres.log'), '-w', '-t', '20',
    '-o', `-k ${path.join(scratch, 'socket')} -p 5432 -c listen_addresses='' -c unix_socket_permissions=0700`, 'start'])
  checkpoint()
  const admin = await connect('postgres')
  await admin.query('CREATE DATABASE saga_t02_compatibility')
  await admin.end()
  const db = await connect('saga_t02_compatibility')
  check('TCP disabled', (await db.query('SHOW listen_addresses')).rows[0].listen_addresses, '')
  const selected = {
    stories: ['id', 'project_id', 'storyteller_id', 'user_id', 'title', 'audio_url', 'mastered_audio_url', 'photo_url', 'photo_urls', 'images'],
    project_roles: ['id', 'project_id', 'user_id', 'role', 'status'],
  }
  const fixture = ['CREATE SCHEMA auth;', 'CREATE TABLE auth.users(id uuid PRIMARY KEY);', 'CREATE TABLE public.projects(id uuid PRIMARY KEY);']
  for (const [table, fields] of Object.entries(selected)) {
    const columns = fields.map(field => {
      const col = snapshot.sections.columns.rows.find(c => c.schema_name === 'public' && c.table_name === table && c.column_name === field)
      assert.ok(col, `captured column ${table}.${field}`)
      assert.ok(['uuid', 'text', 'character varying(255)', 'text[]', 'jsonb[]'].includes(col.data_type))
      return `${qi(field)} ${col.data_type}${col.not_null ? ' NOT NULL' : ''}`
    })
    fixture.push(`CREATE TABLE public.${qi(table)} (${columns.join(',')});`)
  }
  const constraintNames = new Set(['stories_pkey', 'stories_project_id_fkey', 'stories_storyteller_id_fkey',
    'project_roles_pkey', 'project_roles_role_check', 'project_roles_status_check',
    'project_roles_user_id_project_id_role_key', 'project_roles_user_id_fkey', 'project_roles_project_id_fkey'])
  const constraints = snapshot.sections.constraints.rows.filter(c => c.schema_name === 'public' && constraintNames.has(c.constraint_name))
  assert.equal(constraints.length, constraintNames.size)
  for (const c of constraints) fixture.push(`ALTER TABLE public.${qi(c.table_name)} ADD CONSTRAINT ${qi(c.constraint_name)} ${c.definition};`)
  const indexes = snapshot.sections.indexes.rows.filter(i => i.schemaname === 'public' && i.tablename === 'project_roles' &&
    ['project_roles_project_user_unique', 'uq_project_roles_project_user'].includes(i.indexname))
  assert.equal(indexes.length, 2)
  for (const i of indexes) fixture.push(`${i.indexdef};`)
  report.fixture = { sql: fixture.join('\n'), sha256: digest(fixture.join('\n')), limits: 'selected column types/nullability and constraints only; no RLS/functions/triggers/defaults restore' }
  await db.query(report.fixture.sql)
  checkpoint()
  if (process.argv.includes('--signal-after-setup')) {
    report.phase = 'synthetic_fixture_ready'
    process.kill(process.pid, 'SIGTERM')
    await new Promise(resolve => setImmediate(resolve))
    checkpoint()
  }
  for (const moduleName of ['legacy-media-reference', 'legacy-story-media']) {
    const source = await fs.readFile(path.join(root, `packages/web/src/lib/${moduleName}.ts`), 'utf8')
    await fs.writeFile(path.join(scratch, `${moduleName}.js`), ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText)
    checkpoint()
  }
  const { planLegacyStoryMedia } = require(path.join(scratch, 'legacy-story-media.js'))
  const user = '30000000-0000-4000-8000-000000000001'
  const project = '20000000-0000-4000-8000-000000000001'
  const story = '10000000-0000-4000-8000-000000000001'
  await db.query('INSERT INTO auth.users VALUES ($1)', [user])
  await db.query('INSERT INTO public.projects VALUES ($1)', [project])
  await db.query(`INSERT INTO public.stories(id,project_id,storyteller_id,title,audio_url,photo_urls,images)
    VALUES ($1,$2,$3,'Synthetic only','stories/same.webm',ARRAY['alice/images/same.jpg','bob/images/same.jpg',NULL],
      ARRAY[$4::jsonb,'null'::jsonb,'"alice/images/same.jpg"'::jsonb,'4'::jsonb])`,
  [story, project, user, JSON.stringify({url:'https://fixture.supabase.co/storage/v1/object/sign/saga/alice/images/a.jpg?token=synthetic',thumbUrl:'alice/images/t.jpg'})])
  const before = (await db.query('SELECT md5(row_to_json(s)::text) AS hash FROM stories s')).rows[0].hash
  const input = (await db.query('SELECT * FROM stories')).rows[0]
  check('captured images type is jsonb array', (await db.query('SELECT pg_typeof(images)::text AS type FROM stories')).rows[0].type, 'jsonb[]')
  check('pg preserves JSON array slots', input.images, [
    {url:'https://fixture.supabase.co/storage/v1/object/sign/saga/alice/images/a.jpg?token=synthetic',thumbUrl:'alice/images/t.jpg'}, null, 'alice/images/same.jpg', 4,
  ])
  const context = { verifiedStorageHost: 'fixture.supabase.co', verifiedBucketsByField: {audio_url:'audio-recordings',images:'saga',photo_urls:'saga'} }
  const plan = planLegacyStoryMedia(input, context)
  check('driver row is schema compatible', plan.schemaCompatible, true)
  check('all driver source positions retained', plan.references.map(r => r.sourcePath), [
    '/audio_url','/photo_urls/0','/photo_urls/1','/photo_urls/2','/images/0/url','/images/0/thumbUrl','/images/1','/images/2','/images/3',
  ])
  check('invalid slots are visible unresolved observations', plan.references.filter(r => r.locator.status !== 'mapped').map(r => r.sourcePath),
    ['/photo_urls/2','/images/1','/images/3'])
  check('same basename retains separate exact locators', plan.references.slice(1,3).map(r => r.locator.objectKey), ['alice/images/same.jpg','bob/images/same.jpg'])
  check('no asset or ready state inferred', plan.references.some(r => r.assetId || r.state === 'ready'), false)
  const historical = (await db.query("SELECT '[{\"url\":\"alice/images/old.jpg\"}]'::jsonb AS images")).rows[0].images
  check('explicitly labeled historical jsonb array also projects', planLegacyStoryMedia({...input,images:historical,photo_urls:null,audio_url:null},context).references[0].locator.objectKey, 'alice/images/old.jpg')
  async function rejected(name, sql, args, code) {
    checkpoint()
    let actual
    try { await db.query(sql, args) } catch (error) { actual = error.code }
    check(name, actual, code)
  }
  await rejected('title NOT NULL cannot be omitted', 'INSERT INTO stories(id,project_id,storyteller_id) VALUES ($1,$2,$3)', ['10000000-0000-4000-8000-000000000002',project,user], '23502')
  await rejected('user_id cannot satisfy storyteller NOT NULL', "INSERT INTO stories(id,project_id,user_id,title) VALUES ($1,$2,$3,'Synthetic')", ['10000000-0000-4000-8000-000000000002',project,user], '23502')
  const insertRole = 'INSERT INTO project_roles(id,project_id,user_id,role,status) VALUES ($1,$2,$3,$4,$5)'
  const roleId = '40000000-0000-4000-8000-000000000001'
  await rejected('unknown role rejected by actual CHECK', insertRole,[roleId,project,user,'owner','active'],'23514')
  await rejected('unknown status rejected by actual CHECK', insertRole,[roleId,project,user,'storyteller','revoked'],'23514')
  await db.query(insertRole,[roleId,project,user,'storyteller','active'])
  await rejected('different role still conflicts on project/user uniqueness', insertRole,['40000000-0000-4000-8000-000000000002',project,user,'facilitator','active'],'23505')
  check('no source row mutation while projecting', (await db.query('SELECT md5(row_to_json(s)::text) AS hash FROM stories s')).rows[0].hash, before)
  await db.query('BEGIN')
  await db.query('UPDATE stories SET images=NULL WHERE id=$1',[story])
  await db.query('ROLLBACK')
  check('synthetic transaction rollback retains original columns', (await db.query('SELECT md5(row_to_json(s)::text) AS hash FROM stories s')).rows[0].hash, before)
  check('no target assets created', (await db.query("SELECT to_regclass('public.media_assets') AS target")).rows[0].target, null)
  report.status = 'passed'
}
async function cleanup() {
  const errors = []
  for (const client of [...clients]) {
    let timer
    try { await Promise.race([client.end(), new Promise((_, reject) => { timer=setTimeout(() => {
      client.connection.stream.destroy(); reject(new Error('client close timeout'))
    },2000) })]) } catch (error) { errors.push(error.message) } finally { clearTimeout(timer) }
  }
  if (scratch && clusterMayExist) {
    try { command('pg_ctl',['-D',path.join(scratch,'data'),'-m','immediate','-w','-t','10','stop']); clusterMayExist=false }
    catch { try { command('pg_ctl',['-D',path.join(scratch,'data'),'status']); errors.push('cluster still running') }
      catch (error) { if(error.status===3) clusterMayExist=false; else errors.push('cluster stop unconfirmed') } }
  }
  let removed=false
  if(scratch && !clusterMayExist) { await fs.rm(scratch,{recursive:true,force:true}); removed=await fs.access(scratch).then(()=>false,()=>true) }
  report.cleanup={clusterStopped:!clusterMayExist,tempDirectoryRemoved:removed,clientsRemaining:clients.size,errors}
  if(errors.length || clusterMayExist || clients.size) report.status='failed'
}
main().catch(error => {
  report.status=requestedSignal ? 'interrupted' : 'failed'
  if(requestedSignal) report.signal=requestedSignal
  else report.error={message:error.message,code:error.code}
}).finally(async () => {
  finishing=true;clearTimeout(deadline)
  try { await cleanup() } catch(error) { report.status='failed';report.cleanupError=error.message }
  report.finishedAt=new Date().toISOString()
  await fs.mkdir(path.dirname(reportPath),{recursive:true})
  await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,evidence:path.relative(root,reportPath),cleanup:report.cleanup,error:report.error}))
  process.exitCode=report.status==='passed' ? 0 : report.status==='interrupted' ? requestedSignal==='SIGINT' ? 130 : 143 : 1
})
