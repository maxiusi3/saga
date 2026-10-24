import { readFile, lstat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { root,here,digest } from './runtime.mjs'
const snapshotHash='8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e'
const captures=[
  {path:'docs/research/evidence/2026-10-17-routine-audit/capture-2026-10-17T13-06-48-036Z-944080d1-0721-4174-a482-dd4e812eab1e.json',hash:'feb2b22a900d372f6bcc24a912e1636789de16208d0c5975ece5d77998041c8f',privateHash:'f2f37cf33860c4bc6ba22ccec90e0cc0f6d44f311e6be9c6f2e15707d2a2bedc',count:12},
  {path:'docs/research/evidence/2026-10-17-pg17-routines/capture-trigger-2026-10-17T16-07-31-856Z-f3cb9d16-8c1a-49c0-9ccb-537c82cf218f.json',hash:'e876b1f1ed636b57ac110ae515b6158373bc981fcb3bd2c2398c7561eb61275e',privateHash:'45ec35ec3f9bf45741705d9fd2c7ce09953683e342dbe313fe7e482cb20067e5',count:1}
]
const relations=[['project_roles'],['project_roles'],[],['projects','project_roles','user_resource_wallets'],['notifications'],['user_resource_wallets'],['notifications'],['user_resource_wallets'],['user_resource_wallets','seat_transactions'],['project_members','projects'],['project_roles','export_requests'],['project_roles']]
export async function loadReviewed(h){
  const all=[];h.report.capture=[]
  for(const pin of captures){
    const b=await readFile(join(root,pin.path));h.eq(digest(b),pin.hash,'public capture pin');const c=JSON.parse(b)
    h.eq(c.status,'captured','capture succeeded');h.eq(c.targets.length,pin.count,'exact approved target count');h.eq(c.snapshotSha256,snapshotHash,'snapshot bound by captures');h.eq(c.privateCapture.sha256,pin.privateHash,'private pointer pin')
    const privatePath=join(root,c.privateCapture.relativePath)
    const st=await lstat(privatePath);h.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1,'private file regular single link');h.eq(st.mode&0o777,0o600,'private mode600')
    let dir=dirname(privatePath);h.eq((await lstat(dir)).mode&0o777,0o700,'private parent mode700')
    while(true){const d=await lstat(dir);h.ok(d.isDirectory()&&!d.isSymbolicLink(),'private ancestors regular directories');const next=dirname(dir);if(next===dir)break;dir=next}
    const raw=await readFile(privatePath);h.eq(digest(raw),pin.privateHash,'private bytes pinned');const parsed=JSON.parse(raw);h.eq(parsed.definitions.length,pin.count,'private count pinned')
    for(const [i,t] of c.targets.entries()){
      h.eq(t.status,'matched','definition reviewed digest matches');const found=parsed.definitions.filter(d=>d.schema_name==='public'&&d.function_name===t.function_name&&d.identity_arguments===t.identity_arguments)
      h.eq(found.length,1,'one exact overload');const d=found[0]
      h.eq(digest(d.definition),t.definitionSha256,'full definition sha256 pinned');h.eq(digest(d.definition,'md5'),t.actualDefinitionMd5,'full definition md5 pinned')
      // The public capture file hash fixes identities, declaration attributes and all
      // digests. Prior full semantic reviews are the dependency allowlist authority.
      d.safeId=pin.count===12?'F'+String(i+1).padStart(2,'0'):'T01';all.push(d)
    }
    h.report.capture.push({publicPath:pin.path,publicSha256:pin.hash,privateSha256:pin.privateHash,snapshotSha256:snapshotHash})
  }
  const manifest=JSON.parse(await readFile(join(here,'schema-manifest.json')))
  const bytes=await readFile(join(root,manifest.snapshotPath));h.eq(digest(bytes),snapshotHash,'reviewed schema snapshot pin')
  const s=JSON.parse(bytes).sections;const names=manifest.selected.tables.map(x=>x.table_name)
  for(const k of ['tables','columns','constraints','triggers'])h.eq(manifest.selected[k],s[k].rows.filter(x=>x.schema_name==='public'&&names.includes(x.table_name)),'materialized metadata exactly matches pinned selection')
  h.eq(manifest.selected.indexes,s.indexes.rows.filter(x=>x.schemaname==='public'&&names.includes(x.tablename)),'reviewed index selection complete')
  h.report.schema={counts:manifest.counts,differences:manifest.differences}
  h.report.replay=all.map((d,i)=>({id:d.safeId,name:d.function_name,identityArguments:d.identity_arguments,md5:digest(d.definition,'md5'),sha256:digest(d.definition),approvedRelations:i<12?relations[i]:[],review:i<12?'routine-audit/semantic-review.md':'pg17-routines/trigger-semantic-review.md'}))
  // Private package names are held only in memory, supplied as query parameters,
  // and never included in reports, assertions, console output or fixtures.
  const purchase=all.find(d=>d.safeId==='F09')
  h.privatePackages=[...purchase.definition.matchAll(/WHEN\s+'((?:[^']|'')+)'\s+THEN/gi)].map(m=>m[1].replaceAll("''","'"))
  h.eq(h.privatePackages.length,3,'three reviewed private package branches')
  return {all,manifest}
}
export async function replay(h,reviewed){
  const {db}=h;await db.query(await readFile(join(here,'fixture.sql'),'utf8'))
  await db.query('SET ROLE fixture_owner')
  for(const d of reviewed.all)await db.query(d.definition)
  for(const t of reviewed.manifest.selected.triggers){
    h.eq({enabled:t.enabled,bits:t.type_bitmask,schema:t.function_schema,name:t.function_name,args:t.function_identity_arguments,constraint:t.is_constraint,nargs:t.argument_count,condition:t.condition_present},{enabled:'O',bits:19,schema:'public',name:'update_updated_at_column',args:'',constraint:false,nargs:0,condition:false},'audited trigger binding shape')
    await db.query(`CREATE TRIGGER ${t.trigger_name} BEFORE UPDATE ON public.${t.table_name} FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()`)
  }
  await db.query('RESET ROLE')
  for(const d of reviewed.all){const types=d.identity_arguments.split(', ').filter(Boolean).map(a=>a.slice(a.indexOf(' ')+1)).join(',');d.identity=`public.${d.function_name}(${types})`
    const actual=(await db.query('SELECT pg_catalog.md5(pg_catalog.pg_get_functiondef($1::regprocedure)) AS md5',[d.identity])).rows[0].md5
    h.eq(actual,digest(d.definition,'md5'),'exact replay canonical definition digest')
  }
  h.report.runtime.replayedDefinitions=13
  await verifySchema(h,reviewed.manifest)
}
async function verifySchema(h,m){
  await h.db.query('SET search_path=pg_catalog,public')
  const names=m.selected.tables.map(t=>t.table_name)
  const cols=(await h.db.query(`SELECT n.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name,a.attnum::integer AS ordinal_position,pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,a.attnotnull AS not_null,a.attidentity AS identity,a.attgenerated AS generated,pg_catalog.pg_get_expr(ad.adbin,ad.adrelid) AS default_expression FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum WHERE n.nspname='public' AND c.relname=ANY($1) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,[names])).rows
  h.eq(cols,m.selected.columns,'all70 column shapes actual catalog')
  const constraints=(await h.db.query(`SELECT n.nspname AS schema_name,c.relname AS table_name,k.conname AS constraint_name,k.contype AS constraint_type,k.convalidated AS validated,pg_catalog.pg_get_constraintdef(k.oid) AS definition FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) ORDER BY c.relname,k.conname`,[names])).rows
  h.report.schema.constraintDifferences=constraints.filter((c,i)=>JSON.stringify(c)!==JSON.stringify(m.selected.constraints[i])).map(c=>({actual:c,expected:m.selected.constraints.find(x=>x.constraint_name===c.constraint_name&&x.table_name===c.table_name)}))
  const canonical=m.selected.constraints.map(c=>{if(!['notifications_type_check','project_members_role_check'].includes(c.constraint_name))return c;return {...c,definition:c.definition.replace(/\(\(ARRAY\[(.*?)\]\)::text\[\]\)/,(_,values)=>'(ARRAY['+values.split(', ').map(v=>'('+v+')::text').join(', ')+'])')}})
  h.eq(constraints,canonical,'all34 constraints match after two disclosed array-cast deparses')
  const indexes=(await h.db.query(`SELECT schemaname,tablename,indexname,indexdef FROM pg_catalog.pg_indexes WHERE schemaname='public' AND tablename=ANY($1) ORDER BY tablename,indexname`,[names])).rows
  h.eq(indexes,m.selected.indexes,'all34 indexes actual catalog')
  const ts=(await h.db.query(`SELECT c.relname AS table_name,t.tgname AS trigger_name,pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid)) AS md5 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relname=ANY($1) ORDER BY c.relname,t.tgname`,[names])).rows
  h.eq(ts,m.selected.triggers.map(t=>({table_name:t.table_name,trigger_name:t.trigger_name,md5:t.definition_hash_md5})),'three exact trigger binding hashes')
  h.report.schema.actualCatalogMatched=true
}
