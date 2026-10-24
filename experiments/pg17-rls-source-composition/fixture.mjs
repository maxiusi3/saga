import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root, digest } from '../pg17-routines/runtime.mjs'

export const snapshotPath = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json'
export const policyPath = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T02-45-52-407Z.json'
export const qid = s => '"' + s.replaceAll('"', '""') + '"'
const relations = [['public','stories'],['storage','buckets'],['storage','objects']]
const selected = x => relations.some(([s,t]) => (x.schema_name ?? x.schemaname) === s && (x.table_name ?? x.tablename) === t)
export async function extendFixture(h) {
  const bytes = await readFile(join(root,snapshotPath))
  h.eq(digest(bytes),'8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e','fixed metadata snapshot')
  const s = JSON.parse(bytes).sections
  const m = Object.fromEntries(['tables','columns','constraints','indexes','triggers'].map(k => [k,s[k].rows.filter(selected)]))
  h.report.fixture = {snapshotPath, snapshotSha256:digest(bytes), selected:m, omissions:m.triggers.filter(t=>t.schema_name==='storage'), differences:[
    'Synthetic auth.users and request GUC identity; no Auth/JWT/PostgREST validation.',
    'storage.buckettype is a local enum containing only observed STANDARD; complete enum labels were not captured.',
    'Seven Storage trigger bindings are deliberately omitted because reviewed function bodies were not captured; no guessed behavior.',
    'storage.foldername is the disclosed old RLS local SQL shim; Storage HTTP and service role inheritance are not reproduced.',
    'Storage object ordinal 13 is preserved by creating then dropping an inert text placeholder.',
    'Owners are local fixture_owner, not production postgres or supabase_storage_admin.',
    'Synthetic project/story deleted_at and all t02 asset, verification, observation and binding tables are test-only.',
    'Historical ledger source-project mutation races run before the RLS immutable-story trigger is installed. All final integration checks run with that trigger and candidate RLS active.'
  ]}
  await h.db.query(`CREATE SCHEMA storage AUTHORIZATION fixture_owner;
    SET ROLE fixture_owner; SET search_path=pg_catalog,public;
    CREATE TYPE storage.buckettype AS ENUM ('STANDARD');
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;`)
  for (const [schema,table] of relations) {
    const cols=m.columns.filter(c=>c.schema_name===schema&&c.table_name===table), definitions=[]
    let ordinal=1
    for (const c of cols) {
      while(ordinal<c.ordinal_position) definitions.push(qid('_omitted_ordinal_'+ordinal++)+' text')
      definitions.push(`${qid(c.column_name)} ${c.data_type}${c.generated ? ` GENERATED ALWAYS AS (${c.default_expression}) STORED` : c.default_expression ? ` DEFAULT ${c.default_expression}` : ''}${c.not_null?' NOT NULL':''}`)
      ordinal++
    }
    await h.db.query(`CREATE TABLE ${qid(schema)}.${qid(table)} (${definitions.join(',')})`)
    if(table==='objects') await h.db.query('ALTER TABLE storage.objects DROP COLUMN _omitted_ordinal_13')
  }
  // Referenced primary keys must exist before the captured self-reference FK.
  for(const c of [...m.constraints].sort((a,b)=>Number(!['p','u'].includes(a.constraint_type))-Number(!['p','u'].includes(b.constraint_type)))) await h.db.query(`ALTER TABLE ${qid(c.schema_name)}.${qid(c.table_name)} ADD CONSTRAINT ${qid(c.constraint_name)} ${c.definition}`)
  for(const i of m.indexes) if(!m.constraints.some(c=>c.schema_name===i.schemaname&&c.constraint_name===i.indexname&&['p','u'].includes(c.constraint_type))) await h.db.query(i.indexdef)
  const trigger=m.triggers.find(t=>t.schema_name==='public')
  h.eq([trigger.enabled,trigger.type_bitmask,trigger.function_name,trigger.argument_count,trigger.condition_present],['O',19,'update_updated_at_column',0,false],'fourth reviewed trigger binding')
  await h.db.query(`CREATE TRIGGER ${qid(trigger.trigger_name)} BEFORE UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()`)
  for(const t of m.tables) await h.db.query(`ALTER TABLE ${qid(t.schema_name)}.${qid(t.table_name)} ENABLE ROW LEVEL SECURITY`)
  await h.db.query('RESET ROLE; SET search_path=pg_catalog,public')
  const cols=(await h.db.query(`SELECT n.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name,a.attnum::integer AS ordinal_position,format_type(a.atttypid,a.atttypmod) AS data_type,a.attnotnull AS not_null,a.attidentity AS identity,a.attgenerated AS generated,pg_get_expr(ad.adbin,ad.adrelid) AS default_expression FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum WHERE (n.nspname,c.relname) IN (('public','stories'),('storage','buckets'),('storage','objects')) AND a.attnum>0 AND NOT a.attisdropped ORDER BY n.nspname,c.relname,a.attnum`)).rows
  h.eq(cols,m.columns,'all additional column shapes and ordinals')
  const constraints=(await h.db.query(`SELECT n.nspname AS schema_name,c.relname AS table_name,k.conname AS constraint_name,k.contype AS constraint_type,k.convalidated AS validated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname,c.relname) IN (('public','stories'),('storage','buckets'),('storage','objects')) ORDER BY n.nspname,c.relname,k.conname`)).rows
  h.eq(constraints,m.constraints,'all additional constraints')
  const indexes=(await h.db.query(`SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE (schemaname,tablename) IN (('public','stories'),('storage','buckets'),('storage','objects')) ORDER BY schemaname,tablename,indexname`)).rows
  h.eq(indexes,m.indexes,'all additional indexes including partial C collation indexes')
  h.eq((await h.db.query(`SELECT md5(pg_get_triggerdef(oid)) AS md5 FROM pg_trigger WHERE tgname='update_stories_updated_at'`)).rows[0].md5,trigger.definition_hash_md5,'fourth exact trigger hash')
  h.eq((await h.db.query(`SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND NOT t.tgisinternal`)).rows[0].n,0,'omitted Storage triggers are not fabricated')
  h.report.fixture.actualCatalogMatched=true
  await h.db.query('ALTER TABLE public.projects ADD COLUMN deleted_at timestamptz; ALTER TABLE public.stories ADD COLUMN deleted_at timestamptz')
  const ledger=await readFile(join(root,'experiments/t02-source-ledger/schema.sql'),'utf8')
  h.eq(ledger.split('CREATE ROLE saga_anon NOLOGIN;').length,2,'one synthetic ledger suffix boundary')
  await h.db.query(ledger.slice(ledger.indexOf('CREATE ROLE saga_anon NOLOGIN;')))
  await h.db.query('ALTER ROLE saga_anon LOGIN NOSUPERUSER NOBYPASSRLS; ALTER ROLE saga_authenticated LOGIN NOSUPERUSER NOBYPASSRLS')
  await h.db.query(`GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.projects,public.project_roles,public.project_members,public.stories,storage.objects TO anon,authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid(),auth.role(),storage.foldername(text) TO anon,authenticated;
    INSERT INTO storage.buckets(id,name) VALUES ('saga','saga'),('audio-recordings','audio-recordings'),('unrelated','unrelated')`)
}

export async function installPolicies(h) {
  const bytes=await readFile(join(root,policyPath))
  h.eq(digest(bytes),'bb808a1ce050947d21963ca91ec49c3adfa0ab80fe24f24f653f8c18bc6e6a4f','fixed old policy snapshot')
  const names=new Set(['public.projects','public.project_roles','public.project_members','public.stories','storage.objects'])
  const policies=JSON.parse(bytes).sections.policies.rows.filter(p=>names.has(p.schemaname+'.'+p.tablename))
  h.eq(policies.length,32,'all old policy graph predicates')
  for(const p of policies) await h.db.query(`CREATE POLICY ${qid(p.policyname)} ON ${qid(p.schemaname)}.${qid(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(r=>r==='public'?'PUBLIC':qid(r)).join(',')}${p.qual?` USING (${p.qual})`:''}${p.with_check?` WITH CHECK (${p.with_check})`:''}`)
  h.report.replayedPolicies=policies
}
