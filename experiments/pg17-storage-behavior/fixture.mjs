import { readFile,lstat,open } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname,join } from 'node:path'
import { createRequire } from 'node:module'
import { root,digest } from '../pg17-routines/runtime.mjs'
import { qid,snapshotPath } from '../pg17-rls-source-composition/fixture.mjs'
const require=createRequire(import.meta.url)
const {loadPinnedTargets,TARGET_SQL,TRIGGER_SQL,validateTriggerRows}=require('../../scripts/inspect-supabase-storage.cjs')
const {validateRows}=require('../../scripts/inspect-supabase-routines.cjs')
export const capturePath='docs/research/evidence/2026-10-23-storage-definition-capture/capture-storage-2026-10-23T10-39-09-891Z-703d8318-8589-48d0-ba55-e519f02b74fa.json'
export const privatePath='supabase/.temp/routine-audit/capture-storage-2026-10-23T10-39-09-891Z-703d8318-8589-48d0-ba55-e519f02b74fa.json'
export const enumSource='docs/research/evidence/2026-10-23-supabase-feedback/user-query-results.json'
const captureHash='eb5e76b7d39a8eeff4b1fc59ee37704b4278dd531ee0b287673f38ad8ea024a1'
const privateHash='f0574a22dda946436936d65234a07302f8b9100862d431f11535c9074a12cf4f'
const selected=x=>(x.schema_name??x.schemaname)==='storage'&&['buckets','objects'].includes(x.table_name??x.tablename)

export async function loadCapture(h) {
  const publicBytes=await readFile(join(root,capturePath))
  h.eq(digest(publicBytes),captureHash,'exact public capture bytes')
  const capture=JSON.parse(publicBytes),snapshotBytes=await readFile(join(root,snapshotPath))
  h.eq(digest(snapshotBytes),capture.snapshotSha256,'exact historical snapshot bytes')
  h.eq([capture.status,capture.privateCapture.relativePath,capture.privateCapture.sha256],['captured',privatePath,privateHash],'fixed private pointer')
  for(const [path,hash] of Object.entries(capture.sourceSha256))h.eq(digest(await readFile(join(root,path))),hash,'capture validator source fixed')
  let directory=dirname(join(root,privatePath))
  h.eq((await lstat(directory)).mode&0o7777,0o700,'private parent mode0700')
  while(true) {
    const s=await lstat(directory);h.ok(s.isDirectory()&&!s.isSymbolicLink(),'private ancestors ordinary directories')
    const parent=dirname(directory);if(parent===directory)break;directory=parent
  }
  const file=await open(join(root,privatePath),constants.O_RDONLY|constants.O_NOFOLLOW)
  let bytes
  try {
    const s=await file.stat();h.ok(s.isFile()&&s.nlink===1,'private capture single-link regular file');h.eq(s.mode&0o7777,0o600,'private capture mode0600')
    bytes=await file.readFile();h.eq(digest(bytes),privateHash,'exact private bytes before parse')
    const end=await file.stat();h.eq([end.dev,end.ino,end.size,end.mtimeMs],[s.dev,s.ino,s.size,s.mtimeMs],'private descriptor stable during read')
  } finally {await file.close()}
  const parsed=JSON.parse(bytes),targets=loadPinnedTargets(snapshotBytes)
  h.eq([parsed.status,parsed.snapshotSha256,parsed.conditionFormat],['captured',capture.snapshotSha256,'pg_node_tree'],'private capture provenance')
  h.eq(parsed.functions,capture.functions,'private function manifest equals public');h.eq(parsed.triggers,capture.triggers,'private trigger manifest equals public')
  const functions=validateRows(parsed.definitions.functions,targets.functions),triggers=validateTriggerRows(parsed.definitions.triggers,targets.triggers)
  h.eq(functions.targets,capture.functions,'all six identities attributes SHA256 and MD5')
  h.eq(triggers.targets,capture.triggers,'all seven identities attributes argument bytes conditions SHA256 and MD5')
  h.eq([functions.status,triggers.status],['captured','captured'],'no private target drift')
  h.eq([parsed.definitions.functions.length,parsed.definitions.triggers.length],[6,7],'exact target counts')
  const args=triggers.privateRows.filter(t=>t.argument_count===1).map(t=>Buffer.from(t.arguments_hex,'hex').subarray(0,-1).toString('utf8'))
  h.eq(args.length,2,'two single role arguments');h.eq(args[0],args[1],'both bindings use same R');h.ok(/^[a-z_][a-z0-9_]*$/.test(args[0]),'role parameter identifier')
  const s=JSON.parse(snapshotBytes).sections
  const metadata=Object.fromEntries(['tables','columns','constraints','indexes'].map(k=>[k,s[k].rows.filter(selected)]))
  h.report.capture={publicPath:capturePath,publicSha256:captureHash,privateSha256:privateHash,fileMode:'0600',directoryMode:'0700',snapshotPath,snapshotSha256:capture.snapshotSha256,functions:capture.functions,triggers:capture.triggers}
  return {functions:functions.privateRows,triggers:triggers.privateRows,targets,metadata,R:args[0],owner:targets.functions[0].owner}
}

export async function roles(h,capture) {
  h.roles={ordinary:'storage_test_ordinary',member:'storage_test_member',R:capture.R,superuser:'rehearsal_admin',bypass:'storage_test_bypass',familyA:'storage_family_a',familyB:'storage_family_b',removed:'storage_removed'}
  h.eq(new Set([...Object.values(h.roles),capture.owner]).size,9,'synthetic role identities distinct')
  await h.db.query(`CREATE ROLE ${qid(capture.owner)} NOLOGIN NOSUPERUSER NOBYPASSRLS`)
  for(const [alias,role] of Object.entries(h.roles))if(alias!=='superuser')await h.db.query(`CREATE ROLE ${qid(role)} LOGIN NOSUPERUSER ${alias==='bypass'?'BYPASSRLS':'NOBYPASSRLS'}`)
  await h.db.query(`GRANT ${qid(h.roles.R)} TO ${qid(h.roles.member)}`)
  const ownerAttributes=(await h.db.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=$1',[capture.owner])).rows[0]
  h.eq(ownerAttributes,{rolcanlogin:false,rolsuper:false,rolbypassrls:false,rolinherit:true},'actual synthetic owner role attributes')
  h.report.syntheticRoleGraph={scope:'Local test graph only. No production pg_auth_members, service connection, JWT or role-switch equivalence.',owner:{alias:'captured_owner',actualCatalog:ownerAttributes},roles:[{alias:'ordinary',memberOfR:false,superuser:false,bypassRls:false},{alias:'member',memberOfR:true,superuser:false,bypassRls:false},{alias:'R',memberOfR:true,superuser:false,bypassRls:false},{alias:'superuser',memberOfR:true,superuser:true,bypassRls:true},{alias:'bypass',memberOfR:false,superuser:false,bypassRls:true},...['familyA','familyB','removed'].map(alias=>({alias,memberOfR:false,superuser:false,bypassRls:false}))],membershipEdges:[['member','R']],roleNamesInTriggerArguments:'withheld; R is used in reports'}
}

export async function fixture(h,capture,{missingTriggers=false,oldEnum=false}={}) {
  const {metadata:m,owner}=capture
  await h.db.query(`CREATE SCHEMA storage AUTHORIZATION ${qid(owner)}; SET ROLE ${qid(owner)}; SET search_path=pg_catalog,public;
    CREATE TYPE storage.buckettype AS ENUM (${oldEnum?"'STANDARD'":"'STANDARD','ANALYTICS','VECTOR'"})`)
  for(const table of ['buckets','objects']) {
    const definitions=[];let ordinal=1
    for(const c of m.columns.filter(c=>c.table_name===table)) {
      while(ordinal<c.ordinal_position)definitions.push(qid('_omitted_ordinal_'+ordinal++)+' text')
      definitions.push(`${qid(c.column_name)} ${c.data_type}${c.generated?` GENERATED ALWAYS AS (${c.default_expression}) STORED`:c.default_expression?` DEFAULT ${c.default_expression}`:''}${c.not_null?' NOT NULL':''}`);ordinal++
    }
    await h.db.query(`CREATE TABLE storage.${qid(table)} (${definitions.join(',')})`)
    if(table==='objects')await h.db.query('ALTER TABLE storage.objects DROP COLUMN _omitted_ordinal_13')
  }
  for(const c of [...m.constraints].sort((a,b)=>Number(!['p','u'].includes(a.constraint_type))-Number(!['p','u'].includes(b.constraint_type))))await h.db.query(`ALTER TABLE storage.${qid(c.table_name)} ADD CONSTRAINT ${qid(c.constraint_name)} ${c.definition}`)
  for(const i of m.indexes)if(!m.constraints.some(c=>c.constraint_name===i.indexname&&['p','u'].includes(c.constraint_type)))await h.db.query(i.indexdef)
  // This is the only replay of private text: verified in memory, no emitted SQL.
  for(const f of capture.functions)await h.db.query(f.definition)
  if(!missingTriggers)for(const t of capture.triggers)await h.db.query(t.definition)
  await h.db.query('ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; RESET ROLE; SET search_path=pg_catalog,public')
  for(const role of Object.values(h.roles))await h.db.query(`GRANT USAGE ON SCHEMA storage TO ${qid(role)}; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.buckets,storage.objects TO ${qid(role)}`)
  for(const table of ['buckets','objects'])await h.db.query(`CREATE POLICY synthetic_exercise ON storage.${table} TO PUBLIC USING (true) WITH CHECK (true)`)
  await catalog(h,capture,{missingTriggers,oldEnum})
}

export async function catalog(h,capture,{missingTriggers=false,oldEnum=false}={}) {
  await h.scenario('catalog '+(missingTriggers?'missing-trigger RED':oldEnum?'old-enum RED':'exact complete fixture'),async()=>{
    const m=capture.metadata
    const columns=(await h.db.query(`SELECT n.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name,a.attnum::integer AS ordinal_position,format_type(a.atttypid,a.atttypmod) AS data_type,a.attnotnull AS not_null,a.attidentity AS identity,a.attgenerated AS generated,pg_get_expr(ad.adbin,ad.adrelid) AS default_expression FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum WHERE n.nspname='storage' AND c.relname IN ('buckets','objects') AND a.attnum>0 AND NOT a.attisdropped ORDER BY n.nspname,c.relname,a.attnum`)).rows
    h.eq(columns,m.columns,'all selected column shapes including dropped ordinal')
    const constraints=(await h.db.query(`SELECT n.nspname AS schema_name,c.relname AS table_name,k.conname AS constraint_name,k.contype AS constraint_type,k.convalidated AS validated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' ORDER BY 1,2,3`)).rows
    h.eq(constraints,m.constraints,'all selected constraints unchanged')
    h.eq((await h.db.query("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='storage' ORDER BY 1,2,3")).rows,m.indexes,'all selected indexes unchanged')
    const tables=(await h.db.query(`SELECT n.nspname AS schema_name,c.relname AS table_name,c.relkind,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname IN ('buckets','objects') ORDER BY 1,2`)).rows
    h.eq(tables,m.tables,'table owner and RLS catalog match, synthetic owner attributes disclosed')
    const functionRows=(await h.db.query(TARGET_SQL,[JSON.stringify(capture.targets.functions)])).rows
    const functions=validateRows(functionRows,capture.targets.functions)
    h.eq(functions.targets,h.report.capture.functions,'six exact installed definitions and function attributes')
    const triggerRows=(await h.db.query(TRIGGER_SQL,[JSON.stringify(capture.targets.triggers)])).rows
    const triggers=validateTriggerRows(triggerRows,capture.targets.triggers)
    if(missingTriggers)h.eq(triggers.targets.map(x=>x.status),Array(7).fill('missing'),'seven omissions detected')
    else h.eq(triggers.targets,h.report.capture.triggers,'seven exact installed bindings arguments and conditions')
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND NOT t.tgisinternal")).rows[0].n,missingTriggers?0:7,'no extra storage trigger')
    const labels=(await h.db.query("SELECT enumlabel FROM pg_enum WHERE enumtypid='storage.buckettype'::regtype ORDER BY enumsortorder")).rows.map(x=>x.enumlabel)
    h.eq(labels,oldEnum?['STANDARD']:['STANDARD','ANALYTICS','VECTOR'],'ordered enum labels')
    h.report.catalogChecks??=[]
    h.report.catalogChecks.push({missingTriggers,oldEnum,columns:columns.length,constraints:constraints.length,indexes:m.indexes.length,functions:6,triggers:missingTriggers?0:7,enumLabels:labels,matched:true,enumSource,enumSourceBoundary:'User-returned labels; execution time and project ref not supplied. Not a new remote capture.'})
  })
}
