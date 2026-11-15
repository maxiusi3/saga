export const FOUNDATION = 'supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql'
export const SEAL = 'supabase/migrations/20261102000001_recording_seal_manifest.sql'
export const LEASE = 'supabase/migrations/20261103000001_recording_worker_leases.sql'
export const USER = '11111111-1111-4111-8111-111111111111'
export const OTHER = '22222222-2222-4222-8222-222222222222'
export const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const STORY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
export const RPC = 'SELECT public.recording_job_lease($1::uuid,$2::text,$3::text,$4::integer,$5::integer) AS receipt'

export async function compileModules(h, source, application = false) {
  const compiledRoot = join(h.scratch, 'compiled')
  const names = ['lib/recording-chunk-location', ...[
    'consent-deletion', 'processing-jobs', 'recording-merge', 'recording-merge-executor',
    'recording-processing-error', 'recording-audio-decoder', 'recording-session-service',
    ...(application ? ['recording-job-input', 'recording-job-verifier', 'recording-job-lease', 'recording-job-worker'] : []),
  ].map(name => `lib/server/${name}`)]
  for (const name of names) {
    const text = await source(`packages/web/src/${name}.ts`)
    const compiled = ts.transpileModule(text, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    }, reportDiagnostics: true })
    h.eq(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${name} transpiles`)
    const output = compiled.outputText.replace(/require\((['"])@\/([^'"]+)\1\)/g,
      (_match, _quote, alias) => `require(${JSON.stringify(join(compiledRoot, alias))})`)
    const destination = join(compiledRoot, `${name}.js`)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, output)
  }
  return { ...require(join(compiledRoot, 'lib/server/recording-session-service.js')),
    ...(application ? { ...require(join(compiledRoot, 'lib/server/recording-job-lease.js')),
      ...require(join(compiledRoot, 'lib/server/recording-job-worker.js')) } : {}) }
}

export async function fixture(h, service, prepare, bytes = Buffer.from('synthetic-no-provider-audio'), mimeType = 'audio/webm;codecs=opus') {
  const sessionId = randomUUID()
  const jobId = randomUUID()
  const chunks = [], objects = new Map()
  const width = Math.ceil(bytes.length / 3)
  for (let offset = 0, index = 0; offset < bytes.length; offset += width, index++) {
    const body = Buffer.from(bytes.subarray(offset, offset + width))
    const objectKey = `projects/${PROJECT}/sessions/${sessionId}/${index}`
    chunks.push({ index, chunkId: `chunk-${index}`, bucket: 'audio-recordings', objectKey, byteSize: body.length, sha256: digest(body) })
    objects.set(`${USER}/${objectKey}`, body)
  }
  const sealed = prepare({ jobId, projectId: PROJECT, sessionId, actorId: USER, actorRole: 'storyteller', actorActive: true,
    storyId: STORY, mimeType, chunks })
  const manifest = { schemaVersion: 1, projectId: PROJECT, sessionId, userId: USER, storyId: STORY,
    assetId: sealed.task.assetId, mimeType, chunks: chunks.map(chunk => ({ ...chunk, storageObjectKey: `${USER}/${chunk.objectKey}` })) }
  const receipt = (await service.query('SELECT public.seal_recording_manifest($1::jsonb) AS receipt', [JSON.stringify(manifest)])).rows[0].receipt
  const columns = Object.keys(sealed.assetRecord)
  await service.query(`INSERT INTO public.media_assets(${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(sealed.assetRecord))
  const job = sealed.jobSnapshot
  await service.query(`INSERT INTO public.processing_jobs(id,project_id,asset_id,created_by,input_version,job_type,processor_version,
    model_config_version,parameter_version,idempotency_key,state,attempt_count,max_attempts)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [job.id,job.projectId,job.assetId,USER,job.inputVersion,job.jobType,
    job.processorVersion,job.modelConfigVersion,job.parameterVersion,sealed.task.idempotencyKey,job.state,job.attemptCount,job.maxAttempts])
  return { jobId, sessionId, assetId: sealed.task.assetId, manifestSha256: receipt.manifestSha256, manifest, sealed, bytes, objects, mimeType }
}

export async function rpc(client, id, action, worker = null, attempt = null, lease = null) {
  return (await client.query(RPC, [id, action, worker, attempt, lease])).rows[0].receipt
}

export async function outcome(client, args) {
  try { return { code: '00000', receipt: await rpc(client, ...args) } }
  catch (error) { return { code: error.code ?? 'QUERY_FAILED' } }
}

export async function state(h, id) {
  return (await h.db.query(`SELECT jsonb_build_object('job', to_jsonb(j), 'attempts',
    (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY attempt_no),'[]') FROM public.processing_attempts a WHERE a.job_id=j.id)) AS state
    FROM public.processing_jobs j WHERE j.id=$1`, [id])).rows[0].state
}

export async function denied(h, client, args, code, label) {
  const before = await state(h, args[0])
  h.eq((await outcome(client, args)).code, code, label)
  h.eq(await state(h, args[0]), before, `${label}: no partial job/attempt writes`)
}

export async function setup(h, source) {
  const foundation = await source(FOUNDATION)
  await h.db.query(`
    CREATE SCHEMA auth;
    CREATE ROLE anon LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE authenticated LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE service_role LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE metadata_reader LOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role, metadata_reader;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.projects (id uuid PRIMARY KEY, facilitator_id uuid REFERENCES auth.users(id));
    CREATE TABLE public.project_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES public.projects(id),
      user_id uuid REFERENCES auth.users(id), role text, status text, UNIQUE(project_id, user_id));
    CREATE TABLE public.project_members (project_id uuid REFERENCES public.projects(id), user_id uuid REFERENCES auth.users(id), status text);
    CREATE TABLE public.stories (id uuid PRIMARY KEY, project_id uuid REFERENCES public.projects(id), storyteller_id uuid REFERENCES auth.users(id));
    INSERT INTO auth.users VALUES ('${USER}'), ('${OTHER}');
    INSERT INTO public.projects VALUES ('${PROJECT}', '${OTHER}');
    INSERT INTO public.project_roles (project_id, user_id, role, status) VALUES ('${PROJECT}', '${USER}', 'storyteller', 'active');
    INSERT INTO public.stories VALUES ('${STORY}', '${PROJECT}', '${USER}');
  `)
  const tables = ['media_assets', 'deletion_requests', 'processing_jobs', 'processing_attempts', 'recording_sessions', 'recording_chunks']
  h.report.fixture = { syntheticPrerequisites: ['auth.users', 'auth.uid()', 'projects', 'project_roles', 'project_members', 'stories'],
    exactFoundationTables: tables, fullMigrations: [SEAL], livePostgrest: false, liveStorage: false }
  for (const table of tables) {
    const ddl = foundation.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?\n\\);`))?.[0]
    h.ok(ddl, `exact foundation ${table} DDL found`)
    await h.db.query(ddl)
  }
  for (const name of ['is_project_facilitator', 'is_active_project_member']) {
    const ddl = foundation.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\n\\$\\$;`))?.[0]
    h.ok(ddl, `exact foundation ${name} found`)
    await h.db.query(ddl)
  }
  await h.db.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role')
  await h.db.query(await source(SEAL))
}
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { digest } from '../pg17-routines/runtime.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
