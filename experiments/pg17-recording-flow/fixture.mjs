import { randomUUID } from 'node:crypto'
import { FOUNDATION, SEAL, LEASE, USER, OTHER, PROJECT } from '../pg17-recording-worker/fixture.mjs'
import { CANDIDATE, candidateRpc } from '../pg17-recording-candidates/fixture.mjs'
import { FINALIZATION, WORKER, rpc as finalize, args as finalArgs } from '../pg17-recording-finalization/fixture.mjs'
import { SNAPSHOT } from '../pg17-recording-status/fixture.mjs'
import { digest } from '../pg17-routines/runtime.mjs'
export { USER, OTHER, PROJECT }
export const FLOW = 'supabase/migrations/20261106000001_recording_story_save.sql'
export const METADATA = { title: 'Synthetic recording', content: '', transcript: '', happenedAt: '2026-11-06T00:00:00.000Z', recordingMode: 'chat', isPublic: false }
export const RPC = 'SELECT public.recording_story_save($1::uuid,$2::uuid,$3::uuid,$4::text,$5::jsonb,$6::text) AS value'
export async function save(client, sessionId, action = 'lookup', metadata = null, hash = null, actor = USER, project = PROJECT) {
  return (await client.query(RPC, [actor, project, sessionId, action, metadata && JSON.stringify(metadata), hash])).rows[0].value
}
export async function setup(h, source, migrate = true) {
  const foundation = await source(FOUNDATION)
  const bootstrap = await source('supabase/bootstrap/20260624000000_app_base_schema.sql')
  const storyDdl = bootstrap.match(/create table if not exists public\.stories \([\s\S]*?\n\);/)?.[0]
  h.ok(storyDdl, 'actual bootstrap story schema found')
  await h.db.query(`CREATE SCHEMA auth;
    CREATE ROLE anon LOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated LOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE service_role LOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE metadata_reader LOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role,metadata_reader;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.projects(id uuid PRIMARY KEY, facilitator_id uuid REFERENCES auth.users(id));
    CREATE TABLE public.project_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES public.projects(id),user_id uuid REFERENCES auth.users(id),role text,status text,UNIQUE(project_id,user_id));
    CREATE TABLE public.project_members(project_id uuid REFERENCES public.projects(id),user_id uuid REFERENCES auth.users(id),status text);
    ${storyDdl}
    INSERT INTO auth.users VALUES('${USER}'),('${OTHER}');
    INSERT INTO public.projects VALUES('${PROJECT}','${OTHER}');
    INSERT INTO public.project_roles(project_id,user_id,role,status) VALUES('${PROJECT}','${USER}','storyteller','active');`)
  h.report.fixture = { actualStorySchema: 'supabase/bootstrap/20260624000000_app_base_schema.sql', fullMigrations: [], syntheticPrerequisites: ['auth', 'projects', 'project_roles', 'project_members', 'storage'] }
  for (const table of ['media_assets', 'deletion_requests', 'processing_jobs', 'processing_attempts', 'recording_sessions', 'recording_chunks']) {
    const ddl = foundation.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?\n\\);`))?.[0]
    h.ok(ddl, `actual ${table} schema`); await h.db.query(ddl)
  }
  for (const name of ['is_project_facilitator', 'is_active_project_member']) {
    const ddl = foundation.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\n\\$\\$;`))?.[0]
    h.ok(ddl, `${name} exists`); await h.db.query(ddl)
  }
  await h.db.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text NOT NULL,metadata jsonb,UNIQUE(bucket_id,name));
    ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
    GRANT ALL ON storage.buckets,storage.objects TO service_role;`)
  for (const path of [SEAL, LEASE, CANDIDATE, FINALIZATION, SNAPSHOT, ...(migrate ? [FLOW] : [])]) {
    await h.db.query(await source(path)); h.report.fixture.fullMigrations.push(path)
  }
}
export async function fresh(h, service, prepare, publish = true, { attemptCount = 1 } = {}) {
  h.ok(Number.isInteger(attemptCount) && attemptCount >= 1 && attemptCount <= 3, 'fixture attempt count is bounded')
  const sessionId = randomUUID(), jobId = randomUUID(), bytes = Buffer.from('synthetic-recording-only')
  const reservation = await save(service, sessionId, 'reserve', METADATA), storyId = reservation.lookup.intent.storyId
  const chunks = [{ index: 0, chunkId: 'chunk-0', bucket: 'audio-recordings', objectKey: `projects/${PROJECT}/sessions/${sessionId}/0`, byteSize: bytes.length, sha256: digest(bytes) }]
  const sealed = prepare({ jobId, projectId: PROJECT, sessionId, actorId: USER, actorRole: 'storyteller', actorActive: true, storyId, mimeType: 'audio/webm', chunks })
  const manifest = { schemaVersion: 1, projectId: PROJECT, sessionId, userId: USER, storyId, assetId: sealed.task.assetId, mimeType: 'audio/webm',
    chunks: chunks.map(chunk => ({ ...chunk, storageObjectKey: `${USER}/${chunk.objectKey}` })) }
  const seal = (await service.query('SELECT public.seal_recording_manifest($1::jsonb) AS value', [JSON.stringify(manifest)])).rows[0].value
  const columns = Object.keys(sealed.assetRecord)
  await service.query(`INSERT INTO public.media_assets(${columns.join(',')}) VALUES(${columns.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(sealed.assetRecord))
  const j = sealed.jobSnapshot
  await service.query(`INSERT INTO processing_jobs(id,project_id,asset_id,created_by,input_version,job_type,processor_version,model_config_version,parameter_version,idempotency_key,state,attempt_count,max_attempts)
    VALUES($1,$2,$3,$4,1,'recording_merge','ffmpeg-merge-v1','none','default',$5,'queued',0,3)`, [j.id,PROJECT,sealed.task.assetId,USER,sealed.task.idempotencyKey])
  const f = { sessionId, storyId, jobId, assetId: sealed.task.assetId, manifestSha256: seal.manifestSha256, manifest, sealed, bytes, attemptCount, leaseTransitions: [] }
  if (publish) {
    // Let genuine leases expire on the PostgreSQL clock. No fabricated attempt
    // rows, altered deadlines, or timestamp rewrites construct valid controls.
    for (let attempt = 1; attempt < attemptCount; attempt++) {
      const claimed = (await service.query("SELECT recording_job_lease($1,'claim',$2,NULL,1000) AS value", [jobId, `${WORKER}-history-${attempt}`])).rows[0].value
      h.eq([claimed.state, claimed.attempt], ['leased', attempt], 'historical lease claimed by actual routine')
      await service.query('SELECT pg_sleep(greatest(0,extract(epoch FROM (lease_expires_at-clock_timestamp())))::double precision) FROM processing_jobs WHERE id=$1', [jobId])
      const recovered = (await service.query("SELECT recording_job_lease($1,'recover',NULL,NULL,NULL) AS value", [jobId])).rows[0].value
      h.eq([recovered.state, recovered.attempt], ['retry_wait', attempt], 'actual expired lease recovery permits retry')
      f.leaseTransitions.push({ claimed, recovered })
    }
    await service.query("SELECT recording_job_lease($1,'claim',$2,NULL,120000)", [jobId,WORKER])
    await service.query("SELECT recording_job_lease($1,'start',$2,$3,NULL)", [jobId,WORKER,attemptCount])
    f.candidateId = randomUUID(); f.output = { byteSize: bytes.length, sha256: digest(bytes), mimeType: 'audio/webm', durationMs: 1250 }
    await candidateRpc(service, [jobId,'reserve',WORKER,attemptCount,f.manifestSha256,f.candidateId,f.output])
    await candidateRpc(service, [jobId,'prepare',WORKER,attemptCount,f.manifestSha256,f.candidateId,f.output])
    const publicationArgs = finalArgs(f); publicationArgs[3] = attemptCount
    await finalize(service, publicationArgs)
  }
  return f
}

/** Compile the real save service graph for native SQL/application contract checks. */
export async function compileFlow(h, source) {
  const { createRequire } = await import('node:module'), { mkdir, writeFile } = await import('node:fs/promises')
  const { dirname, join, posix } = await import('node:path')
  const require = createRequire(import.meta.url), ts = require('typescript'), compiled = new Set(), targetRoot = join(h.scratch,'flow-compiled')
  async function compile(name) {
    if (compiled.has(name)) return
    compiled.add(name)
    const result = ts.transpileModule(await source(`packages/web/src/${name}.ts`), { compilerOptions: { target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true },reportDiagnostics:true })
    h.eq(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`${name} transpiles`)
    for (const [,target] of result.outputText.matchAll(/require\(["']([^"']+)["']\)/g)) {
      if(target.startsWith('@/'))await compile(target.slice(2))
      else if(target.startsWith('.'))await compile(posix.normalize(posix.join(posix.dirname(name),target)))
    }
    const destination=join(targetRoot,`${name}.js`)
    await mkdir(dirname(destination),{recursive:true})
    await writeFile(destination,result.outputText.replace(/require\((['"])@\/([^'"]+)\1\)/g,(_m,_q,alias)=>`require(${JSON.stringify(join(targetRoot,alias))})`))
  }
  await compile('lib/server/recording-story-save')
  return require(join(targetRoot,'lib/server/recording-story-save.js'))
}
