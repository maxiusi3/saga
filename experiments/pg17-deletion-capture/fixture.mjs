import { setup as setupFlow, fresh, USER, OTHER, PROJECT } from '../pg17-recording-flow/fixture.mjs'
import { FOUNDATION } from '../pg17-recording-worker/fixture.mjs'
export { fresh, USER, OTHER, PROJECT }
export const MIGRATION = 'supabase/migrations/20261106000002_media_deletion_capture.sql'
export const SEAL_FENCE_MIGRATION = 'supabase/migrations/20261106000003_recording_seal_deletion_fence.sql'
export async function setup(h, source, migrate = true, sealFence = true) {
  await setupFlow(h, source)
  await h.db.query("SET timezone='UTC'")
  const ddl = (await source(FOUNDATION)).match(/CREATE TABLE IF NOT EXISTS public\.deletion_targets \([\s\S]*?\n\);/)?.[0]
  h.ok(ddl, 'actual foundation deletion_targets DDL extracted unchanged')
  await h.db.query(ddl)
  await h.db.query(`ALTER TABLE deletion_targets ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON deletion_targets FROM PUBLIC,anon,authenticated;
    GRANT ALL ON deletion_targets TO service_role;
    CREATE POLICY deletion_targets_service ON deletion_targets FOR ALL TO service_role USING (true) WITH CHECK (true);`)
  const requestPolicy=(await source(FOUNDATION)).match(/CREATE POLICY "deletion_requests_select_active_member"[\s\S]*?;/)?.[0]
  h.ok(requestPolicy,'actual foundation request read policy found')
  await h.db.query(`ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY; GRANT SELECT ON deletion_requests TO authenticated; ${requestPolicy}
    CREATE POLICY deletion_requests_service_read ON deletion_requests FOR SELECT TO service_role USING (true);`)
  h.report.fixture.actualRequestReadPolicy=requestPolicy
  h.report.fixture.actualDeletionTargetsDdl = ddl
  if (migrate) {
    await h.db.query(await source(MIGRATION)); h.report.fixture.fullMigrations.push(MIGRATION)
    if (sealFence) { await h.db.query(await source(SEAL_FENCE_MIGRATION)); h.report.fixture.fullMigrations.push(SEAL_FENCE_MIGRATION) }
  }
}
export async function capture(client, { actorId = OTHER, projectId = PROJECT, subjectId, subjectType = 'story', requestId }) {
  return (await client.query('SELECT public.request_media_deletion($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid) AS value', [actorId,projectId,subjectId,subjectType,requestId])).rows[0].value
}
export async function snapshot(h) {
  const result = {}
  for (const table of ['projects','project_roles','stories','media_assets','recording_sessions','recording_chunks','processing_jobs','processing_attempts','recording_output_candidates','recording_story_intents','deletion_requests','deletion_targets','storage.objects']) {
    result[table] = (await h.db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.row)
  }
  result.synthetic_files={}
  const {readFile}=await import('node:fs/promises')
  for(const [key,path] of h.syntheticFiles??[])result.synthetic_files[key]=(await readFile(path)).toString('base64')
  return result
}

/** Compile the actual adapter; SQL transport below replaces only PostgREST. */
export async function compileCapture(h, source) {
  const { createRequire }=await import('node:module'), { writeFile }=await import('node:fs/promises'), { join }=await import('node:path')
  const require=createRequire(import.meta.url), ts=require('typescript')
  const text=await source('packages/web/src/lib/server/media-deletion-capture.ts')
  const result=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true})
  h.eq(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'actual deletion adapter transpiles')
  const destination=join(h.scratch,'media-deletion-capture.cjs');await writeFile(destination,result.outputText)
  return require(destination)
}
export function applicationAdmin(h, service) {
  return {rpc(name,args) {
    h.eq(name,'request_media_deletion','actual application selects capture RPC')
    const q={abortSignal(signal){h.ok(signal instanceof AbortSignal,'application forwards abort signal');return q},retry(value){h.eq(value,false,'application disables retries');return q},
      then(resolve,reject){return capture(service,{actorId:args.p_actor_id,projectId:args.p_project_id,subjectId:args.p_subject_id,subjectType:args.p_subject_type,requestId:args.p_request_id})
        .then(data=>({data,error:null}),error=>({data:null,error:{code:error.code}})).then(resolve,reject)}}
    return q
  }}
}
export async function prepareCandidate(h, service, f, state='prepared') {
  const { randomUUID }=await import('node:crypto'), { digest }=await import('../pg17-routines/runtime.mjs')
  const { candidateRpc }=await import('../pg17-recording-candidates/fixture.mjs'), { WORKER }=await import('../pg17-recording-finalization/fixture.mjs')
  f.attemptCount=f.attemptCount??1
  await service.query("SELECT recording_job_lease($1,'claim',$2,NULL,120000)",[f.jobId,WORKER])
  await service.query("SELECT recording_job_lease($1,'start',$2,$3,NULL)",[f.jobId,WORKER,f.attemptCount])
  f.candidateId=randomUUID();f.output={byteSize:f.bytes.length,sha256:digest(f.bytes),mimeType:'audio/webm',durationMs:1250}
  await candidateRpc(service,[f.jobId,'reserve',WORKER,f.attemptCount,f.manifestSha256,f.candidateId,f.output])
  if(state==='prepared')await candidateRpc(service,[f.jobId,'prepare',WORKER,f.attemptCount,f.manifestSha256,f.candidateId,f.output])
  return f
}
export async function multipleChunks(h, service, prepare, count=3, existingStory=null, register=true) {
  const { randomUUID }=await import('node:crypto'), { digest }=await import('../pg17-routines/runtime.mjs'), { save,METADATA }=await import('../pg17-recording-flow/fixture.mjs')
  const sessionId=randomUUID(),jobId=randomUUID(),storyId=existingStory??(await save(service,sessionId,'reserve',METADATA)).lookup.intent.storyId
  const chunkBodies=Array.from({length:count},(_,i)=>Buffer.from(`synthetic-chunk-${i}`)),bytes=Buffer.concat(chunkBodies)
  const chunks=chunkBodies.map((body,index)=>({index,chunkId:`chunk-${index}`,bucket:'audio-recordings',objectKey:`projects/${PROJECT}/sessions/${sessionId}/${index}`,byteSize:body.length,sha256:digest(body)}))
  const sealed=prepare({jobId,projectId:PROJECT,sessionId,actorId:USER,actorRole:'storyteller',actorActive:true,storyId,mimeType:'audio/webm',chunks})
  const manifest={schemaVersion:1,projectId:PROJECT,sessionId,userId:USER,storyId,assetId:sealed.task.assetId,mimeType:'audio/webm',chunks:chunks.map(c=>({...c,storageObjectKey:`${USER}/${c.objectKey}`}))}
  const seal=(await service.query('SELECT seal_recording_manifest($1::jsonb) AS value',[JSON.stringify(manifest)])).rows[0].value
  if (register) {
  const columns=Object.keys(sealed.assetRecord)
  await service.query(`INSERT INTO media_assets(${columns.join(',')}) VALUES(${columns.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(sealed.assetRecord))
  await service.query(`INSERT INTO processing_jobs(id,project_id,asset_id,created_by,input_version,job_type,processor_version,model_config_version,parameter_version,idempotency_key,state)
    VALUES($1,$2,$3,$4,1,'recording_merge','ffmpeg-merge-v1','none','default',$5,'queued')`,[jobId,PROJECT,sealed.task.assetId,USER,sealed.task.idempotencyKey])
  }
  return {sessionId,jobId,storyId,assetId:sealed.task.assetId,sealed,manifest,manifestSha256:seal.manifestSha256,bytes,chunkBodies,attemptCount:1}
}
export async function materialize(h, f) {
  const { writeFile }=await import('node:fs/promises'), { join }=await import('node:path'), { digest }=await import('../pg17-routines/runtime.mjs')
  h.syntheticFiles??=new Map()
  const sources=(await h.db.query(`SELECT bucket,object_key FROM media_assets WHERE id=$1 UNION SELECT bucket,object_key FROM recording_chunks WHERE session_id=$2
    UNION SELECT bucket,object_key FROM recording_output_candidates WHERE asset_id=$1`,[f.assetId,f.sessionId])).rows
  for(const row of sources) {
    const key=`${row.bucket}:${row.object_key}`,path=join(h.scratch,`synthetic-${digest(key)}`)
    if(h.syntheticFiles.has(key))continue
    const chunk=f.manifest.chunks.find(c=>c.storageObjectKey===row.object_key),body=chunk?f.chunkBodies?.[chunk.index]??f.bytes:f.bytes
    await writeFile(path,body);h.syntheticFiles.set(key,path)
    await h.db.query('INSERT INTO storage.buckets(id,name) VALUES($1,$1) ON CONFLICT DO NOTHING',[row.bucket])
    await h.db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',[row.bucket,row.object_key,JSON.stringify({synthetic:true,byteSize:body.length,sha256:digest(body)})])
  }
}
