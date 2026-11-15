import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'

// This separate build adds the real pgcrypto/uuid-ossp extensions; the older
// pinned runtime and its evidence remain unchanged.
const runtime = process.env.G1_PG_BIN || '/tmp/saga-g1-runtime/install/bin'
const g3 = process.argv.some(arg => /^--g3-(delivery|archive|search|payment)$/.test(arg))
const g4 = process.argv.includes('--g4-pilot')
const evidence = join(root, g4 ? 'docs/research/evidence/2026-11-11-g4-pilot' : g3 ? 'docs/research/evidence/2026-11-11-g3-delivery' : 'docs/research/evidence/2026-11-07-g1-chrome', `migrations-${Date.now()}-${randomUUID()}`)
await mkdir(evidence, { recursive: true })
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
  await source('experiments/g1-local/verify-migrations.mjs')
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
  const compatibility = ['project_members', 'story_artifacts', 'public_archive_entries', 'waitlist']
  let legacySnapshot
  const legacyRows = async () => Object.fromEntries(await Promise.all(compatibility.map(async table =>
    [table, (await h.db.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY id`)).rows])))
  for (const path of files) {
    const sql = await source(path), started = performance.now()
    try { await h.db.query(sql); report.migrations.push({ path, status: 'passed', elapsedMs: Math.round(performance.now() - started) }) }
    catch (error) { report.migrations.push({ path, status: 'failed', code: error.code, message: error.message }); throw error }
    if (path.includes('/bootstrap/')) {
      // Exercise the restore path too: compatibility tables already contain
      // historical data and permissive client grants/policies on second use.
      await h.db.query(`
        INSERT INTO auth.users(id,email) VALUES ('11111111-1111-4111-8111-111111111111','legacy@example.invalid');
        INSERT INTO projects(id,name,facilitator_id) VALUES ('22222222-2222-4222-8222-222222222222','Legacy','11111111-1111-4111-8111-111111111111');
        INSERT INTO stories(id,project_id) VALUES ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222');
        INSERT INTO project_members(project_id,user_id) VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
        INSERT INTO story_artifacts(story_id,project_id,artifact_type,payload) VALUES ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','legacy','{"preserve":true}');
        INSERT INTO public_archive_entries(story_id,project_id,slug,title,summary) VALUES ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','legacy','Keep','Keep');
        INSERT INTO waitlist(email) VALUES ('legacy@example.invalid');
      `)
      for (const table of compatibility) await h.db.query(`GRANT ALL ON public.${table} TO anon,authenticated; CREATE POLICY legacy_permissive ON public.${table} USING (true) WITH CHECK (true)`)
      legacySnapshot = await legacyRows()
      await h.db.query(sql)
      h.eq(await legacyRows(), legacySnapshot, 'bootstrap rerun preserves every historical column/row')
    }
  }
  h.eq(await legacyRows(), legacySnapshot, 'full migration chain preserves compatibility rows')
  for (const table of compatibility) {
    h.eq((await h.db.query(`SELECT relrowsecurity FROM pg_class WHERE oid='public.${table}'::regclass`)).rows[0].relrowsecurity, true, table + ' RLS enabled')
    for (const role of ['anon','authenticated']) {
      for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
        h.eq((await h.db.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[role,'public.'+table,privilege])).rows[0].allowed,false,`${role} ${privilege} ${table} denied`)
      h.eq((await h.actor(role,null,`SELECT * FROM public.${table}`)).sqlstate,'42501',role + ' actual read denied')
    }
  }
  report.catalog = (await h.db.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','storage','invitation_candidate','entitlement_candidate') ORDER BY 1,2")).rows
  report.extensions = (await h.db.query('SELECT extname,extversion FROM pg_extension ORDER BY extname')).rows
  h.eq(report.migrations.length, files.length, 'all files applied')
  if (g4) {
    await source('experiments/pg17-g4-pilot/scenarios.mjs')
    const { pilotScenarios } = await import('../pg17-g4-pilot/scenarios.mjs')
    await pilotScenarios({ h, source, evidence })
  }
  if (process.argv.includes('--story-deletion')) {
    await source('experiments/pg17-story-deletion/scenarios.mjs')
    const { storyDeletionScenarios } = await import('../pg17-story-deletion/scenarios.mjs')
    await storyDeletionScenarios({ h, source, evidence })
  }
  if (process.argv.includes('--g2-review')) {
    await source('experiments/pg17-g2-review/scenarios.mjs')
    const { storyReviewScenarios } = await import('../pg17-g2-review/scenarios.mjs')
    await storyReviewScenarios({ h, source, evidence })
  }
  for (const [flag, path, name] of [
    ['--processing-recovery', '../pg17-processing-recovery/scenarios.mjs', 'processingRecoveryScenarios'],
    ['--processing-recovery', '../pg17-processing-recovery/adapter-scenarios.mjs', 'recoveryAdapterScenarios'],
    ['--processing-recovery', '../pg17-processing-recovery/publication-scenarios.mjs', 'publicationRecoveryScenarios'],
    ['--ai-edit', '../pg17-story-ai-edit/scenarios.mjs', 'storyAiEditScenarios'],
    ['--semantic-search', '../pg17-semantic-search/scenarios.mjs', 'semanticScenarios'],
    ['--hosting-reminders', '../pg17-hosting-reminders/scenarios.mjs', 'hostingReminderScenarios'],
  ]) {
    if (process.argv.includes(flag)) {
      await source('experiments/' + path.slice(3))
      const scenarios = await import(path)
      await scenarios[name]({ h, source, evidence })
    }
  }
  for (const part of ['search', 'archive', 'payment']) {
    if (process.argv.includes('--g3-delivery') || process.argv.includes(`--g3-${part}`)) {
      const path = `experiments/pg17-g3-delivery/${part}-scenarios.mjs`
      await source(path)
      const scenarios = await import(`../pg17-g3-delivery/${part}-scenarios.mjs`)
      await scenarios[`${part}Scenarios`]({ h, source, evidence })
    }
  }
  if (g3 && process.argv.includes('--chrome')) {
    await source('experiments/pg17-g3-delivery/chrome.mjs')
    const { deliveryChrome } = await import('../pg17-g3-delivery/chrome.mjs')
    await deliveryChrome({ h, source, evidence })
  }
  if (process.argv.includes('--backup')) {
    await source('experiments/g1-local/backup-rehearsal.mjs')
    const { rehearseBackup } = await import('./backup-rehearsal.mjs')
    report.backup = await rehearseBackup({ h, evidence, source })
  }
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = { message: error.message, code: error.code, label: error.label }; process.exitCode = 1 }
finally {
  await h.cleanup()
  report.sourceDrift = []
  for (const [path, hash] of Object.entries(report.sources)) if (digest(await readFile(join(root, path))) !== hash) report.sourceDrift.push(path)
  if (report.sourceDrift.length || report.status !== 'passed') process.exitCode = 1
  await writeFile(join(evidence, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ evidence, status: report.status, migrations: report.migrations, error: report.error, cleanup: report.cleanup }, null, 2))
}
