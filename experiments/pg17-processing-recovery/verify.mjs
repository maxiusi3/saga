import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'

// This separate build adds the real pgcrypto/uuid-ossp extensions; the older
// pinned runtime and its evidence remain unchanged.
const runtime = process.env.G1_PG_BIN || '/tmp/saga-g1-runtime/install/bin'
const evidence=join(root,'docs/research/evidence/2026-11-13-audit-repair/recovery',`native-${Date.now()}-${randomUUID()}`)
await mkdir(evidence,{recursive:true})
const report = { status: 'running', assertions: 0, actorConnections: [], sources: {}, migrations: [],
  boundary: 'Actual complete repository bootstrap/migration files on native PG17.4 with real extensions. Minimal synthetic Supabase auth/storage platform schemas; no hosted PostgREST/Auth/Storage qualification.' }
const h = new Harness(report)
h.command = function (name, args, timeout = 30000) {
  return execFileSync(join(runtime, name), args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
// This complete platform fixture gives service_role its real BYPASSRLS flag;
// older isolated RPC fixtures deliberately use NOBYPASSRLS. Verify each actual
// connection instead of borrowing their different role assertion.
h.actorClient = async function (role, user, claimRole = role) {
  if (!['anon','authenticated','service_role'].includes(role)) throw new Error('Unexpected role')
  const client = await this.client(role)
  try {
    const identity = (await client.query('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]
    this.eq(identity,{current_user:role,session_user:role,rolsuper:false,rolbypassrls:role==='service_role'},'actual platform role flags')
    if (!report.actorConnections.some(r=>r.current_user===role)) report.actorConnections.push(identity)
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[user??'',claimRole])
    return client
  } catch (error) { await this.close(client); throw error }
}
async function source(path) {
  const bytes = await readFile(join(root, path)); report.sources[path] = digest(bytes); return bytes.toString()
}
try {
  report.runtime.binaryDirectory = runtime
  report.runtime.postgres = h.command('postgres', ['--version'])
  h.eq(report.runtime.postgres, 'postgres (PostgreSQL) 17.4', 'PG17.4')
  report.runtime.binarySha256 = {}
  for (const name of ['postgres', 'pg_ctl', 'initdb', 'pg_dump', 'pg_restore']) report.runtime.binarySha256[name] = digest(await readFile(join(runtime, name)))
  h.scratch = await mkdtemp('/tmp/saga-g1-chain-'); report.scratch = h.scratch
  await mkdir(join(h.scratch, 'socket'), { mode: 0o700 })
  h.command('initdb', ['-D', join(h.scratch, 'data'), '-U', 'rehearsal_admin', '-A', 'trust', '--no-locale', '-E', 'UTF8'])
  h.clusterMayExist = true
  h.command('pg_ctl', ['-D', join(h.scratch, 'data'), '-l', join(h.scratch, 'postgres.log'), '-w', '-o', `-k ${h.scratch}/socket -c listen_addresses='' -c unix_socket_permissions=0700`, 'start'])
  h.config = { host: join(h.scratch, 'socket'), port: 5432, ssl: false, connectionTimeoutMillis: 5000, query_timeout: 30000,
    options: '-c statement_timeout=25000 -c search_path=public,extensions,auth,pg_catalog' }
  const admin = await h.client('rehearsal_admin', 'postgres')
  await admin.query('CREATE DATABASE saga_pg17_rehearsal'); await h.close(admin); h.db = await h.client()
  await source('experiments/pg17-processing-recovery/verify.mjs')
  await h.db.query(`
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
    CREATE ROLE anon LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE authenticated LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE service_role LOGIN NOSUPERUSER BYPASSRLS;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text NOT NULL,owner uuid,metadata jsonb,UNIQUE(bucket_id,name));
    ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,auth,storage,extensions TO anon,authenticated,service_role;
    GRANT ALL ON storage.buckets,storage.objects TO service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
  `)
  const files = ['supabase/bootstrap/20260624000000_app_base_schema.sql',
    ...(await readdir(join(root, 'supabase/migrations'))).filter(name => name.endsWith('.sql')).sort().map(name => 'supabase/migrations/' + name)]
  for(const path of files) {
    if(/2026111300000[2-9]/.test(path))continue
    await h.db.query(await source(path));report.migrations.push({path,status:'passed'})
  }
  const {processingRecoveryScenarios}=await import('./scenarios.mjs')
  await source('experiments/pg17-processing-recovery/scenarios.mjs')
  await processingRecoveryScenarios({h,source,evidence})
  const {recoveryAdapterScenarios}=await import('./adapter-scenarios.mjs')
  await source('experiments/pg17-processing-recovery/adapter-scenarios.mjs')
  await recoveryAdapterScenarios({h,source,evidence})
  const {publicationRecoveryScenarios}=await import('./publication-scenarios.mjs')
  await source('experiments/pg17-processing-recovery/publication-scenarios.mjs')
  await publicationRecoveryScenarios({h,source,evidence})
  if(process.argv.includes('--chrome')) {
   const owner=randomUUID(),member=randomUUID(),other=randomUUID(),project=randomUUID()
   await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$4),($2,$5),($3,$6)',[owner,member,other,'recovery-ui-owner@example.invalid','recovery-ui-member@example.invalid','recovery-ui-other@example.invalid'])
   await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'Recovery UI',owner])
   await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,member])
   await source('experiments/pg17-g2-review/transcription-chrome.mjs')
   const {transcriptionChrome}=await import('../pg17-g2-review/transcription-chrome.mjs')
   await transcriptionChrome({h,source,evidence,owner,member,other,project})
  }
  report.status='passed'
} catch(error) {report.status='failed';report.error={code:error.code,message:error.message,label:error.label,where:error.where};process.exitCode=1}
finally {await h.cleanup();await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,assertions:report.assertions,evidence,error:report.error}))}
