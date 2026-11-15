import { randomUUID } from 'node:crypto'
import { capture,fresh,multipleChunks,materialize,snapshot,USER,OTHER,PROJECT } from './fixture.mjs'
import { rpc as finalize,args as finalArgs } from '../pg17-recording-finalization/fixture.mjs'
import { blockedRegistration } from './registration-check.mjs'
const FOREIGN='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
async function outcome(fn){try{return{code:'00000',value:await fn()}}catch(e){return{code:e.code??'ERROR',message:e.message}}}
export async function fix1Regressions(h,service,prepare,source) {
  h.report.fix1Observations=[]
  await h.scenario('I1 actual reserve then seal before registration captures chunks with no invented asset/job',async()=>{
    for(const mixed of [false,true]) {
      const registered=mixed?await fresh(h,service,prepare):null
      const f=await multipleChunks(h,service,prepare,2,registered?.storyId??null,false)
      await materialize(h,f);if(registered)await materialize(h,registered)
      const before=await snapshot(h),result=await outcome(()=>capture(service,{subjectId:f.storyId,requestId:randomUUID()})),after=await snapshot(h)
      h.report.fix1Observations.push({name:mixed?'mixed registered and sealed-only':'sealed-only',fixture:f,before,result,after})
      h.eq(result.code,'00000','legitimate sealed-before-registration story capture succeeds')
      const request=result.value,targets=after.deletion_targets.filter(t=>t.deletion_request_id===request.id)
      const coordinates=[...before.recording_chunks.filter(c=>c.session_id===f.sessionId),...(registered?before.recording_chunks.filter(c=>c.session_id===registered.sessionId):[]),...(registered?before.media_assets.filter(a=>a.id===registered.assetId):[])]
      const expected=[`story:${f.storyId}`,...(registered?[`asset:${registered.assetId}`]:[]),...coordinates.map(c=>`storage:${c.bucket}:${c.object_key}`)].sort()
      h.eq(targets.map(t=>t.target_id).sort(),expected,'only actual story/assets/chunks/candidate coordinates are captured')
      h.eq(after.media_assets.some(a=>a.id===f.assetId),false,'no phantom media asset');h.eq(after.processing_jobs.some(j=>j.id===f.jobId),false,'no phantom processing job')
      for(const table of ['stories','recording_sessions','recording_chunks','recording_output_candidates','processing_attempts','recording_story_intents','storage.objects','synthetic_files'])h.eq(after[table],before[table],`${table}: complete evidence unchanged`)
      if(!registered){h.eq(after.media_assets,before.media_assets,'no asset mutations in sealed-only capture');h.eq(after.processing_jobs,before.processing_jobs,'no job mutations in sealed-only capture')}
      const seal=await outcome(()=>service.query('SELECT seal_recording_manifest($1::jsonb)',[JSON.stringify(f.manifest)]))
      const registration=await blockedRegistration(h,source,service,f)
      const publication=await outcome(()=>finalize(service,finalArgs({...f,candidateId:randomUUID(),output:{byteSize:f.bytes.length,sha256:f.manifest.chunks[0].sha256,mimeType:'audio/webm',durationMs:1}})))
      h.report.fix1Observations.push({name:'post-capture blockers',before:after,seal,registration,publication,after:await snapshot(h)})
      h.eq(seal.code,'23505','actual seal replay blocked');h.eq(registration.status,409,'actual seal endpoint blocks before registration');h.eq(publication.code,'23505','actual publication cannot create an absent job/asset')
      h.eq(await snapshot(h),after,'blocked seal/registration/publication preserve every row and physical synthetic byte')
    }
  })
  await h.scenario('I1 existing intended asset with another project/story/chain is rejected',async()=>{
    await h.db.query('INSERT INTO projects(id,facilitator_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[FOREIGN,OTHER])
    for(const binding of ['foreign_project','foreign_story','foreign_owner','another_session']) {
      const f=await multipleChunks(h,service,prepare,1,null,false),other=binding==='foreign_story'?await fresh(h,service,prepare,false):null
      const a={...f.sealed.assetRecord,project_id:binding==='foreign_project'?FOREIGN:PROJECT,story_id:binding==='foreign_story'?other.storyId:f.storyId,created_by:binding==='foreign_owner'?OTHER:USER}
      const keys=Object.keys(a);await h.db.query(`INSERT INTO media_assets(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(a))
      if(binding==='another_session') {
        const duplicate=await multipleChunks(h,service,prepare,1,f.storyId,false)
        await h.db.query("UPDATE recording_sessions SET seal_input=jsonb_set(seal_input,'{assetId}',to_jsonb($2::text)) WHERE id=$1",[duplicate.sessionId,f.assetId])
      }
      const before=await snapshot(h),result=await outcome(()=>capture(service,{subjectId:f.storyId,requestId:randomUUID()})),after=await snapshot(h)
      h.report.fix1Observations.push({name:binding,before,result,after});h.eq(result.code,'23505','existing conflicting asset fails closed');h.eq(after,before,'conflict rejects without writes')
    }
  })
}
