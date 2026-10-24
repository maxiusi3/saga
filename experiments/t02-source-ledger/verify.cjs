const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const ts = require('typescript')
const { Client } = require('../t05-durable-worker/node_modules/pg')
const { seed, run } = require('./scenarios.cjs')

const root = path.resolve(__dirname, '../..')
const label = process.argv.find(a=>a.startsWith('--label='))?.slice(8) || 'normal'
assert.match(label, /^[a-z0-9-]+$/)
const evidence = path.join(root, 'docs/research/evidence/2026-10-17-t02-source-ledger')
const reportPath = path.join(evidence, `${label}-${Date.now()}-${process.pid}.json`)
const snapshotFile = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T02-45-52-407Z.json'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const env = Object.fromEntries(Object.entries(process.env).filter(([key])=> !key.startsWith('PG') && key !== 'DATABASE_URL'))
const command = (binary,args)=>execFileSync(binary,args,{env,encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']}).trim()
const report = {startedAt:new Date().toISOString(),label,status:'running',
  scope:'synthetic local PostgreSQL source ledger only; no real Storage or production authorization verification',
  sources:{},checks:[],lockEvidence:[],runtime:{node:process.version}}
let scratch, clusterMayExist=false, requestedSignal, finishing=false
const clients = new Set()
function checkpoint(){if(requestedSignal)throw new Error('rehearsal interrupted')}
function onSignal(signal){if(!finishing)requestedSignal=signal}
process.on('SIGTERM',onSignal);process.on('SIGINT',onSignal)
const deadline=setTimeout(()=>onSignal('deadline'),120000)
function check(name,actual,expected){checkpoint();assert.deepEqual(actual,expected,name);report.checks.push(name)}
async function connect(){
  checkpoint()
  const client=new Client({host:path.join(scratch,'socket'),port:5432,user:'saga_t02_admin',database:'saga_t02_ledger',
    ssl:false,password:'synthetic-local-unused',connectionTimeoutMillis:5000,
    options:'-c statement_timeout=10000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=15000'})
  clients.add(client);client.on('error',()=>{});client.once('end',()=>clients.delete(client))
  await client.connect();checkpoint()
  check('local client ignores ambient SSL and credentials',
    [client.connectionParameters.ssl,client.connectionParameters.password],[false,'synthetic-local-unused'])
  return client
}
async function main(){
  await fs.mkdir(evidence,{recursive:true})
  for(const name of ['schema.sql','ledger.cjs','scenarios.cjs','verify.cjs','README.md']){
    const bytes=await fs.readFile(path.join(__dirname,name))
    report.sources[`experiments/t02-source-ledger/${name}`]=digest(bytes)
    if(/(?:^|-)red-/.test(label))await fs.writeFile(path.join(evidence,`${label}-${name}.txt`),bytes)
  }
  for(const name of ['legacy-media-reference','legacy-story-media']){
    report.sources[`packages/web/src/lib/${name}.ts`]=digest(await fs.readFile(path.join(root,`packages/web/src/lib/${name}.ts`)))
  }
  const bytes=await fs.readFile(path.join(root,snapshotFile))
  report.snapshot={path:snapshotFile,sha256:digest(bytes)}
  assert.equal(digest(bytes),'bb808a1ce050947d21963ca91ec49c3adfa0ab80fe24f24f653f8c18bc6e6a4f')
  const snapshot=JSON.parse(bytes)
  for(const [column,type] of [['images','jsonb[]'],['photo_urls','text[]'],['title','text'],['storyteller_id','uuid']]){
    const saved=snapshot.sections.columns.rows.find(c=>c.schema_name==='public'&&c.table_name==='stories'&&c.column_name===column)
    check(`pinned actual stories.${column} type`,saved.data_type,type)
  }
  report.runtime.postgres=command('postgres',['--version'])
  report.runtime.pg=require('../t05-durable-worker/node_modules/pg/package.json').version
  report.runtime.typescript=ts.version
  scratch=await fs.mkdtemp('/tmp/saga-t02-ledger-');report.scratch=scratch;checkpoint()
  await fs.mkdir(path.join(scratch,'socket'),{mode:0o700});checkpoint()
  command('initdb',['-D',path.join(scratch,'data'),'-U','saga_t02_admin','-A','trust','--no-locale','-E','UTF8']);checkpoint()
  clusterMayExist=true
  command('pg_ctl',['-D',path.join(scratch,'data'),'-l',path.join(scratch,'postgres.log'),'-w','-t','20',
    '-o',`-k ${path.join(scratch,'socket')} -p 5432 -c listen_addresses='' -c unix_socket_permissions=0700`,'start']);checkpoint()
  command('createdb',['-h',path.join(scratch,'socket'),'-p','5432','-U','saga_t02_admin','saga_t02_ledger'])
  const db=await connect()
  check('TCP disabled',(await db.query('SHOW listen_addresses')).rows[0].listen_addresses,'')
  await db.query(await fs.readFile(path.join(__dirname,'schema.sql'),'utf8'))
  const columns=(await db.query(`SELECT c.relname AS table_name,a.attname AS column_name,
    format_type(a.atttypid,a.atttypmod) AS data_type,a.attnotnull AS not_null
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('stories','project_roles') AND a.attnum>0 AND NOT a.attisdropped
      AND a.attname<>'deleted_at' ORDER BY c.relname,a.attnum`)).rows
  report.fixture={selectedColumns:columns,syntheticAdditions:'project/story tombstones; experimental asset/verification/ledger tables',
    limits:'selected types/nullability and required constraints; no restoration of defaults, all indexes, production RLS or triggers'}
  for(const column of columns){
    const saved=snapshot.sections.columns.rows.find(c=>c.schema_name==='public'&&c.table_name===column.table_name&&c.column_name===column.column_name)
    check(`actual fixture ${column.table_name}.${column.column_name} matches captured type and nullability`,
      [column.data_type,column.not_null],[saved.data_type,saved.not_null])
  }
  await seed(db);checkpoint()
  if(process.argv.includes('--signal-after-setup')){
    report.phase='synthetic_fixture_ready';process.kill(process.pid,'SIGTERM')
    await new Promise(resolve=>setImmediate(resolve));checkpoint()
  }
  for(const moduleName of ['legacy-media-reference','legacy-story-media']){
    const source=await fs.readFile(path.join(root,`packages/web/src/lib/${moduleName}.ts`),'utf8')
    await fs.writeFile(path.join(scratch,`${moduleName}.js`),ts.transpileModule(source,{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
    }).outputText);checkpoint()
  }
  const {planLegacyStoryMedia}=require(path.join(scratch,'legacy-story-media.js'))
  await run({db,connect,planLegacyStoryMedia,check,checkpoint,report})
  report.status='passed'
}
async function cleanup(){
  const errors=[]
  for(const client of [...clients]){
    let timer
    try{await Promise.race([client.end(),new Promise((_,reject)=>{timer=setTimeout(()=>{
      client.connection.stream.destroy();reject(new Error('client close timeout'))
    },2000)})])}catch(error){errors.push(error.message)}finally{clearTimeout(timer)}
  }
  if(scratch&&clusterMayExist){
    try{command('pg_ctl',['-D',path.join(scratch,'data'),'-m','immediate','-w','-t','10','stop']);clusterMayExist=false}
    catch{try{command('pg_ctl',['-D',path.join(scratch,'data'),'status']);errors.push('cluster still running')}
      catch(error){if(error.status===3)clusterMayExist=false;else errors.push('cluster stop unconfirmed')}}
  }
  let removed=false
  if(scratch&&!clusterMayExist){await fs.rm(scratch,{recursive:true,force:true});removed=await fs.access(scratch).then(()=>false,()=>true)}
  report.cleanup={clusterStopped:!clusterMayExist,tempDirectoryRemoved:removed,clientsRemaining:clients.size,errors}
  if(errors.length||clusterMayExist||clients.size)report.status='failed'
}
main().catch(error=>{
  report.status=requestedSignal?'interrupted':'failed'
  if(requestedSignal)report.signal=requestedSignal
  else report.error={message:error.message,code:error.code,actual:error.actual,expected:error.expected,stack:error.stack}
}).finally(async()=>{
  finishing=true;clearTimeout(deadline)
  try{await cleanup()}catch(error){report.status='failed';report.cleanupError=error.message}
  report.finishedAt=new Date().toISOString()
  await fs.mkdir(evidence,{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,evidence:path.relative(root,reportPath),cleanup:report.cleanup,error:report.error}))
  process.exitCode=report.status==='passed'?0:report.status==='interrupted'?requestedSignal==='SIGINT'?130:143:1
})
