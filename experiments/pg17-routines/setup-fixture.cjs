// Maintainer-only generation from the exact independently reviewed public snapshot.
const fs = require('node:fs'); const crypto = require('node:crypto'); const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const snapshotPath = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json';
const bytes = fs.readFileSync(path.join(root, snapshotPath));
const hash = crypto.createHash('sha256').update(bytes).digest('hex');
if (hash !== '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e') throw Error('Snapshot pin mismatch');
const s = JSON.parse(bytes).sections;
const tables = ['projects','project_roles','project_members','user_resource_wallets','seat_transactions','notifications','export_requests'];
const selected = Object.fromEntries(['tables','columns','constraints','triggers'].map(k => [k,s[k].rows.filter(r=>r.schema_name==='public'&&tables.includes(r.table_name))]));
selected.indexes=s.indexes.rows.filter(r=>r.schemaname==='public'&&tables.includes(r.tablename));
const q = x => { if(!/^[a-z_]+$/.test(x)) throw Error('Identifier not approved'); return '"'+x+'"' };
const types = new Set(['uuid','text','jsonb','boolean','integer','bigint','timestamp with time zone','character varying(20)','character varying(50)','character varying(255)','character varying(500)']);
const defaults = new Set(['gen_random_uuid()','extensions.uuid_generate_v4()','now()',"'pending'::text","'active'::text","'interactive'::text","'paid'::text","'active'::character varying","'{}'::jsonb",'false','0']);
let sql = `-- Public schema materialized from the pinned, reviewed metadata. Synthetic identity/ACL environment.\nCREATE ROLE fixture_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\n`;
for(const role of ['anon','authenticated','metadata_reader','service_role']) sql+=`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\n`;
sql+=`REVOKE CREATE ON SCHEMA public FROM PUBLIC;\nGRANT USAGE ON SCHEMA public TO anon, authenticated, metadata_reader, service_role;\nGRANT USAGE, CREATE ON SCHEMA public TO fixture_owner;\nCREATE SCHEMA auth AUTHORIZATION fixture_owner;\nCREATE SCHEMA extensions AUTHORIZATION fixture_owner;\nSET ROLE fixture_owner;\nSET search_path=pg_catalog,public,auth,extensions;\nCREATE TABLE auth.users (id uuid PRIMARY KEY);\nCREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;\n-- Disclosed local UUID shim; this is not the original uuid-ossp extension.\nCREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql VOLATILE SET search_path = '' AS $$ SELECT pg_catalog.gen_random_uuid() $$;\n`;
for(const table of tables){const cols=selected.columns.filter(c=>c.table_name===table); sql+=`CREATE TABLE public.${q(table)} (\n`+cols.map(c=>{if(!types.has(c.data_type)||c.identity||c.generated||c.default_expression&&!defaults.has(c.default_expression))throw Error('Column not approved');return `  ${q(c.column_name)} ${c.data_type}${c.not_null?' NOT NULL':''}${c.default_expression?' DEFAULT '+c.default_expression:''}`}).join(',\n')+'\n);\n';}
for(const c of [...selected.constraints].sort((a,b)=>Number(!['p','u'].includes(a.constraint_type))-Number(!['p','u'].includes(b.constraint_type)))){if(!c.validated||!['p','u','c','f'].includes(c.constraint_type)||/[;]|--|\/\*/.test(c.definition)) throw Error('Constraint not approved');sql+=`ALTER TABLE public.${q(c.table_name)} ADD CONSTRAINT ${q(c.constraint_name)} ${c.definition};\n`;}
for(const i of selected.indexes){if(selected.constraints.some(c=>['p','u'].includes(c.constraint_type)&&c.constraint_name===i.indexname))continue;if(!/^CREATE (UNIQUE )?INDEX [a-z_]+ ON public\.[a-z_]+ USING btree \([a-z_, ]+\)$/.test(i.indexdef))throw Error('Index not approved');sql+=i.indexdef+';\n';}
for(const t of tables) sql+=`ALTER TABLE public.${q(t)} ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON public.${q(t)} FROM PUBLIC, anon, authenticated, metadata_reader, service_role;\n`;
sql+=`RESET ROLE;\nGRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, metadata_reader, service_role;\n`;
fs.writeFileSync(path.join(__dirname,'fixture.sql'),sql);
const diff={snapshotPath,snapshotSha256:hash,selected,counts:Object.fromEntries(Object.entries(selected).map(([k,v])=>[k,v.length])),differences:[
'auth.users has only synthetic id primary key; auth.uid reads a local session GUC and does not verify JWT.',
'extensions.uuid_generate_v4 is a local SQL shim to pg_catalog.gen_random_uuid; original extension runtime omitted.',
'Objects owned by a private nonlogin non-superuser fixture_owner instead of production postgres.',
'RLS enabled and not forced as captured; production policies omitted and caller table grants revoked. This is stricter than production and does not validate its direct-table authorization.',
'Only seven relevant public tables and three captured trigger bindings; other public/auth/storage objects and external workers omitted.',
'Four independent caller login roles, no inheritance or bypass. Actual Supabase/PostgREST role inheritance, claims verification and service bypass not reproduced.',
'No rules/extension hooks/remote data; native upstream PostgreSQL 17.4 is not complete Supabase.'
]};
fs.writeFileSync(path.join(__dirname,'schema-manifest.json'),JSON.stringify(diff,null,2)+'\n');
const bin=path.join(root,'.superpowers/sdd/2026-10-17-upgrade-pg17-routines/runtime/install/bin');
const binaries=Object.fromEntries(['postgres','pg_ctl','initdb'].map(x=>[x,crypto.createHash('sha256').update(fs.readFileSync(path.join(bin,x))).digest('hex')]));
if(binaries.postgres!=='81214d9c55486f6babdc14f772d2d938870f9b985d7b31aa577e66af0ccba36d')throw Error('Runtime pin mismatch');
fs.writeFileSync(path.join(__dirname,'runtime-pins.json'),JSON.stringify(binaries,null,2)+'\n');
console.log(JSON.stringify({counts:diff.counts,binaries}));
