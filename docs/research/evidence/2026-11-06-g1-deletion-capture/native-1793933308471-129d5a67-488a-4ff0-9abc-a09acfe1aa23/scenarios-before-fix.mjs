import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { fresh,capture,snapshot,multipleChunks,prepareCandidate,materialize,USER,OTHER,PROJECT } from './fixture.mjs'
import { save,METADATA } from '../pg17-recording-flow/fixture.mjs'
import { candidateRpc } from '../pg17-recording-candidates/fixture.mjs'
import { rpc as finalize,args as finalArgs,WORKER } from '../pg17-recording-finalization/fixture.mjs'
import { digest } from '../pg17-routines/runtime.mjs'
const THIRD='33333333-3333-4333-8333-333333333333', FOREIGN='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
async function outcome(fn) {try{return{code:'00000',value:await fn()}}catch(e){return{code:e.code??'ERROR',message:e.message}}}
export async function scenarios(h,service,prepare,app,admin) {
  const report=h.report;report.observations??=[];report.waits=[]
  const record=(name,before,after,result)=>report.observations.push({name,before,after,result})
  async function waiting(client,label) {
    for(let n=0;n<300;n++) {
      const row=(await h.db.query('SELECT pid,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[client.processID])).rows[0]
      if(row.wait_event_type==='Lock'&&row.blockers.length) {
        report.waits.push({label,...row,locks:(await h.db.query('SELECT pid,relation::regclass::text AS relation,locktype,mode,granted FROM pg_locks WHERE pid=$1 ORDER BY locktype,relation,mode',[client.processID])).rows});h.ok(true,label);return
      }
      await delay(5)
    }
    h.ok(false,`${label}: actual lock wait required`)
  }
  async function deny(name,fn,codes=['23505']) {
    const before=await snapshot(h),result=await outcome(fn),after=await snapshot(h);record(name,before,after,result)
    h.ok(codes.includes(result.code),`${name}: rejected expected SQLSTATE`);h.eq(after,before,`${name}: every full row and physical synthetic byte unchanged`)
  }
  function targetsFrom(before,assetIds,sessionIds,kind,subject) {
    const targets=new Map()
    for(const a of before.media_assets.filter(a=>assetIds.includes(a.id))) {
      targets.set(`asset:${a.id}`,{target_id:`asset:${a.id}`,kind:'media_asset',bucket:null,object_key:null})
    }
    const sources=[...before.media_assets.filter(a=>assetIds.includes(a.id)),...before.recording_chunks.filter(c=>sessionIds.includes(c.session_id)),...before.recording_output_candidates.filter(c=>assetIds.includes(c.asset_id))]
    for(const c of sources)targets.set(`storage:${c.bucket}:${c.object_key}`,{target_id:`storage:${c.bucket}:${c.object_key}`,kind:'storage_object',bucket:c.bucket,object_key:c.object_key})
    if(kind==='story')targets.set(`story:${subject}`,{target_id:`story:${subject}`,kind:'story',bucket:null,object_key:null})
    return [...targets.values()].sort((a,b)=>a.target_id.localeCompare(b.target_id))
  }
  function assertCapture(before,after,receipt,assetIds,sessionIds,kind,subject) {
    const selected=after.deletion_targets.filter(t=>t.deletion_request_id===receipt.id)
    const minimal=selected.map(({target_id,kind,bucket,object_key})=>({target_id,kind,bucket,object_key})).sort((a,b)=>a.target_id.localeCompare(b.target_id))
    h.eq(minimal,targetsFrom(before,assetIds,sessionIds,kind,subject),'durable targets equal complete observed source coordinates')
    h.eq(receipt.targetCount,selected.length,'receipt reports exact durable count');h.eq(receipt.physicalDeletionComplete,false,'capture only')
    const request=after.deletion_requests.find(r=>r.id===receipt.id)
    h.eq(request.capture_version,1,'explicit capture version');h.eq(request.subject_type,kind,'explicit subject kind')
    h.eq([...request.capture_targets].sort((a,b)=>a.target_id.localeCompare(b.target_id)),[...selected].sort((a,b)=>a.target_id.localeCompare(b.target_id)),'durable full target snapshot')
    const normalize=t=>Date.parse(t)
    h.eq(normalize(request.tombstone_at),normalize(receipt.tombstoneAt),'receipt keeps tombstone timestamp')
    for(const table of ['stories','recording_sessions','recording_chunks','recording_output_candidates','processing_attempts','recording_story_intents','storage.objects','synthetic_files'])h.eq(after[table],before[table],`${table}: existing evidence unchanged`)
    for(const a of before.media_assets) {
      const actual=after.media_assets.find(r=>r.id===a.id)
      h.eq(actual,assetIds.includes(a.id)?{...a,state:'deleting',updated_at:request.tombstone_at}:a,'asset exact transition or unchanged sibling')
    }
    for(const j of before.processing_jobs) {
      const actual=after.processing_jobs.find(r=>r.id===j.id),cancel=assetIds.includes(j.asset_id)&&!['succeeded','failed','cancelled'].includes(j.state)&&j.cancel_requested_at===null
      h.eq(actual,cancel?{...j,cancel_requested_at:request.tombstone_at,updated_at:request.tombstone_at}:j,'unfinished job cancellation flag only; terminal tuple unchanged')
    }
  }
  await h.scenario('actual service accepts full native capture and exact same-ID or subject replay',async()=>{
    const f=await fresh(h,service,prepare);await materialize(h,f)
    const input={actorId:OTHER,projectId:PROJECT,subjectId:f.storyId,subjectType:'story',requestId:randomUUID()}
    const before=await snapshot(h),receipt=await app.submitMediaDeletionRequest(input,{admin}),after=await snapshot(h)
    record('published via actual adapter',before,after,receipt);report.publishedCapture={receipt,request:after.deletion_requests.find(r=>r.id===receipt.id),targets:after.deletion_targets.filter(t=>t.deletion_request_id===receipt.id),before,after}
    assertCapture(before,after,receipt,[f.assetId],[f.sessionId],'story',f.storyId)
    for(const requestId of [input.requestId,randomUUID()]) {
      const replay=await app.submitMediaDeletionRequest({...input,requestId},{admin});h.eq(replay,receipt,'immutable public receipt replay');h.eq(await snapshot(h),after,'replay changes no source/request/target row')
    }
    record('exact replays',after,await snapshot(h),receipt)
    await deny('confirmation after tombstone',()=>save(service,f.sessionId,'confirm',null,f.manifestSha256),['42501'])
  })
  await h.scenario('three real sealed chunks plus a separate retained reserved candidate deduplicate published alias',async()=>{
    const f=await multipleChunks(h,service,prepare),pending=await multipleChunks(h,service,prepare,1,f.storyId)
    await prepareCandidate(h,service,f);await finalize(service,finalArgs(f))
    await prepareCandidate(h,service,pending,'reserved');await materialize(h,f);await materialize(h,pending)
    const before=await snapshot(h),receipt=await capture(service,{subjectId:f.storyId,requestId:randomUUID()}),after=await snapshot(h)
    record('multiple chunks retained and published candidates',before,after,receipt);assertCapture(before,after,receipt,[f.assetId,pending.assetId],[f.sessionId,pending.sessionId],'story',f.storyId)
    h.eq(receipt.targetCount,10,'story + two assets + four chunks + two candidates + actual pending asset address')
    h.eq(after.deletion_targets.filter(t=>t.deletion_request_id===receipt.id&&t.object_key===`jobs/${f.jobId}/attempts/1/${f.candidateId}`).length,1,'published asset/candidate alias appears once')
  })
  await h.scenario('pending candidate capture preserves live lease/attempt and requests cancellation without finalizing',async()=>{
    const f=await fresh(h,service,prepare,false);await prepareCandidate(h,service,f);await materialize(h,f)
    const before=await snapshot(h),receipt=await capture(service,{subjectId:f.storyId,requestId:randomUUID()}),after=await snapshot(h)
    record('pending prepared candidate capture',before,after,receipt);assertCapture(before,after,receipt,[f.assetId],[f.sessionId],'story',f.storyId)
    await deny('publication after capture',()=>finalize(service,finalArgs(f)),['42501'])
    await deny('pending confirmation after capture',()=>save(service,f.sessionId,'confirm',null,f.manifestSha256),['42501'])
  })
  await h.scenario('story scope includes actual legacy assets; asset scope leaves a same-story sibling and other story untouched',async()=>{
    for(const kind of ['story','media_asset']) {
      const f=await fresh(h,service,prepare),other=await fresh(h,service,prepare),sibling=randomUUID()
      await h.db.query(`INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,state) VALUES($1,$2,$3,$4,'saga',$5,'original_image','image/png','ready')`,[sibling,PROJECT,f.storyId,USER,`${USER}/projects/${PROJECT}/assets/${sibling}/original`])
      await materialize(h,f);await materialize(h,other)
      const subject=kind==='story'?f.storyId:f.assetId,before=await snapshot(h),receipt=await capture(service,{subjectId:subject,subjectType:kind,requestId:randomUUID()}),after=await snapshot(h)
      record(`${kind} scope`,before,after,receipt);assertCapture(before,after,receipt,kind==='story'?[f.assetId,sibling]:[f.assetId],[f.sessionId],kind,subject)
      h.eq(after.media_assets.find(a=>a.id===other.assetId),before.media_assets.find(a=>a.id===other.assetId),'other story asset untouched')
    }
    const reservation=await save(service,randomUUID(),'reserve',METADATA),story=reservation.lookup.intent.storyId
    const before=await snapshot(h),receipt=await capture(service,{subjectId:story,requestId:randomUUID()}),after=await snapshot(h)
    record('metadata-only story',before,after,receipt);assertCapture(before,after,receipt,[],[],'story',story);h.eq(receipt.targetCount,1,'empty story still captures actual metadata')
  })
  await h.scenario('manager authorization and malformed or legacy identity fail closed',async()=>{
    const f=await fresh(h,service,prepare,false)
    for(const args of [{actorId:USER},{actorId:randomUUID()},{projectId:FOREIGN},{subjectId:randomUUID()},{subjectType:'session'},{subjectType:null},{requestId:null}])
      await deny(`invalid identity ${JSON.stringify(args)}`,()=>capture(service,{subjectId:f.storyId,requestId:randomUUID(),...args}),['42501','22023'])
    await h.db.query('INSERT INTO auth.users VALUES($1);',[THIRD]);await h.db.query('INSERT INTO projects VALUES($1,$2)',[FOREIGN,THIRD])
    await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'facilitator','inactive')",[PROJECT,THIRD])
    await deny('inactive facilitator',()=>capture(service,{actorId:THIRD,subjectId:f.storyId,requestId:randomUUID()}),['42501'])
    await h.db.query("UPDATE project_roles SET status='active' WHERE user_id=$1",[THIRD])
    const before=await snapshot(h),receipt=await capture(service,{actorId:THIRD,subjectId:f.storyId,requestId:randomUUID()}),after=await snapshot(h)
    record('active facilitator allowed',before,after,receipt);assertCapture(before,after,receipt,[f.assetId],[f.sessionId],'story',f.storyId)
    const legacy=await fresh(h,service,prepare,false)
    await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)',[PROJECT,legacy.storyId,OTHER])
    await deny('legacy request without capture rejected',()=>capture(service,{subjectId:legacy.storyId,requestId:randomUUID()}))
    const block=await fresh(h,service,prepare,false)
    await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)',[PROJECT,block.sessionId,OTHER])
    await deny('session blocker',()=>capture(service,{subjectId:block.storyId,requestId:randomUUID()}))
    for(const role of ['anon','authenticated','metadata_reader']) {
      const client=await h.actorClient(role,USER,'service_role')
      await deny(`${role} cannot spoof RPC role`,()=>capture(client,{subjectId:block.storyId,requestId:randomUUID()}),['42501']);await h.close(client)
    }
    await h.db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
    const result=await outcome(()=>capture(h.db,{subjectId:block.storyId,requestId:randomUUID()}));await h.db.query('ROLLBACK');h.eq(result.code,'22023','repeatable read rejected')
  })
  await h.scenario('unsafe paths, cross-project relationships and foreign physical aliases abort complete capture',async()=>{
    const mutations=[
      ['unsafe traversal',f=>h.db.query("UPDATE media_assets SET object_key=$2 WHERE id=$1",[f.assetId,`${USER}/projects/${PROJECT}/../foreign`])],
      ['foreign asset prefix',f=>h.db.query('UPDATE media_assets SET object_key=$2 WHERE id=$1',[f.assetId,`${USER}/projects/${FOREIGN}/assets/${f.assetId}/original`])],
      ['foreign candidate metadata',f=>h.db.query('UPDATE recording_output_candidates SET project_id=$2 WHERE id=$1',[f.candidateId,FOREIGN])],
      ['foreign chunk relationship',f=>h.db.query('UPDATE recording_chunks SET project_id=$2 WHERE session_id=$1',[f.sessionId,FOREIGN])],
      ['foreign asset alias of candidate',f=>h.db.query(`INSERT INTO media_assets(id,project_id,created_by,bucket,object_key,kind,mime_type,state) VALUES($1,$2,$3,'recording-candidates',$4,'original_audio','audio/webm','ready')`,[randomUUID(),FOREIGN,THIRD,`jobs/${f.jobId}/attempts/1/${f.candidateId}`])],
      ['candidate rebind into another session',async f=>{const other=await fresh(h,service,prepare,false);await h.db.query('UPDATE recording_output_candidates SET session_id=$2 WHERE id=$1',[f.candidateId,other.sessionId])}],
    ]
    for(const [name,mutate] of mutations) {
      const f=await fresh(h,service,prepare,false);await prepareCandidate(h,service,f);await materialize(h,f);await mutate(f)
      await deny(name,()=>capture(service,{subjectId:f.storyId,requestId:randomUUID()}))
    }
  })
  await h.scenario('missing or altered durable target rejects replay, and request IDs cannot cross subjects or actors',async()=>{
    const a=await fresh(h,service,prepare),b=await fresh(h,service,prepare),id=randomUUID()
    const first=await capture(service,{subjectId:a.storyId,requestId:id});await capture(service,{subjectId:b.storyId,requestId:randomUUID()})
    await deny('collision checked before existing subject replay',()=>capture(service,{subjectId:b.storyId,requestId:id}))
    await deny('different actor cannot reuse request id',()=>capture(service,{actorId:THIRD,subjectId:a.storyId,requestId:id}))
    await h.db.query("UPDATE deletion_targets SET object_key=object_key||'/tampered' WHERE deletion_request_id=$1 AND kind='storage_object'",[first.id])
    await deny('target tampering rejects replay',()=>capture(service,{subjectId:a.storyId,requestId:id}))
    await h.db.query('DELETE FROM deletion_targets WHERE deletion_request_id=$1',[first.id])
    await deny('missing target population rejects replay',()=>capture(service,{subjectId:a.storyId,requestId:id}))
  })
  await h.scenario('publication before deletion waits then captures committed candidate key without guessed old path',async()=>{
    const f=await fresh(h,service,prepare,false);await prepareCandidate(h,service,f);await materialize(h,f)
    const first=await h.actorClient('service_role',USER),second=await h.actorClient('service_role',OTHER),before=await snapshot(h)
    await first.query('BEGIN');await finalize(first,finalArgs(f))
    const pending=outcome(()=>capture(second,{subjectId:f.storyId,requestId:randomUUID()}))
    await waiting(second,'delete waits for publication fence');await first.query('COMMIT');const result=await pending,after=await snapshot(h)
    record('publication then deletion',before,after,result);h.eq(result.code,'00000','capture succeeds after committed publication')
    const keys=after.deletion_targets.filter(t=>t.deletion_request_id===result.value.id&&t.kind==='storage_object').map(t=>t.object_key).sort()
    h.eq(keys,[f.manifest.chunks[0].storageObjectKey,`jobs/${f.jobId}/attempts/1/${f.candidateId}`].sort(),'fresh snapshot captures committed addresses only')
    h.eq(after.synthetic_files,before.synthetic_files,'publication/capture leaves physical bytes intact');await h.close(first);await h.close(second)
  })
  await h.scenario('deletion before publication makes waiting actual finalizer fail without mutation',async()=>{
    const f=await fresh(h,service,prepare,false);await prepareCandidate(h,service,f);await materialize(h,f)
    const first=await h.actorClient('service_role',OTHER),second=await h.actorClient('service_role',USER),before=await snapshot(h)
    await first.query('BEGIN');const receipt=await capture(first,{subjectId:f.storyId,requestId:randomUUID()})
    const pending=outcome(()=>finalize(second,finalArgs(f)));await waiting(second,'publication waits for deletion fence');await first.query('COMMIT')
    const result=await pending,after=await snapshot(h);record('deletion then publication',before,after,{receipt,result})
    h.eq(result.code,'42501','waiting publication rejected after tombstone');assertCapture(before,after,receipt,[f.assetId],[f.sessionId],'story',f.storyId)
    await h.close(first);await h.close(second)
  })
  await h.scenario('candidate reservation before capture waits for source writer and includes new reserved address',async()=>{
    const f=await fresh(h,service,prepare,false);await materialize(h,f)
    await service.query("SELECT recording_job_lease($1,'claim',$2,NULL,120000)",[f.jobId,WORKER]);await service.query("SELECT recording_job_lease($1,'start',$2,1,NULL)",[f.jobId,WORKER])
    const first=await h.actorClient('service_role',USER),second=await h.actorClient('service_role',OTHER),before=await snapshot(h),id=randomUUID(),output={byteSize:f.bytes.length,sha256:digest(f.bytes),mimeType:'audio/webm',durationMs:1250}
    await first.query('BEGIN');await candidateRpc(first,[f.jobId,'reserve',WORKER,1,f.manifestSha256,id,output])
    const pending=outcome(()=>capture(second,{subjectId:f.storyId,requestId:randomUUID()}));await waiting(second,'capture waits for reserved candidate source');await first.query('COMMIT')
    const result=await pending,after=await snapshot(h);record('reserve then capture',before,after,result)
    h.eq(result.code,'00000','capture sees committed reservation');h.eq(after.deletion_targets.filter(t=>t.deletion_request_id===result.value.id&&t.object_key===`jobs/${f.jobId}/attempts/1/${id}`).length,1,'reserved address captured once')
    h.eq(after.processing_attempts,before.processing_attempts,'live attempt preserved');await h.close(first);await h.close(second)
  })
  await h.scenario('two concurrent submissions converge; concurrent request-ID collision cannot create second capture',async()=>{
    for(const collision of [false,true]) {
      const a=await fresh(h,service,prepare,false),b=collision?await fresh(h,service,prepare,false):a
      const first=await h.actorClient('service_role',OTHER),second=await h.actorClient('service_role',OTHER),id=randomUUID(),before=await snapshot(h)
      await first.query('BEGIN');const receipt=await capture(first,{subjectId:a.storyId,requestId:id})
      const pending=outcome(()=>capture(second,{subjectId:b.storyId,requestId:collision?id:randomUUID()}));await waiting(second,collision?'collision waits for capture':'same subject waits for capture');await first.query('COMMIT')
      const result=await pending,after=await snapshot(h);record(collision?'concurrent ID collision':'concurrent same subject',before,after,{receipt,result})
      h.eq(result.code,collision?'23505':'00000','concurrent result');if(!collision)h.eq(result.value,receipt,'same subject gets identical capture')
      assertCapture(before,after,receipt,[a.assetId],[a.sessionId],'story',a.storyId);await h.close(first);await h.close(second)
    }
  })
  await h.scenario('current authority and subject ownership are read after actual lock waits',async()=>{
    for(const kind of ['owner','facilitator','subject']) {
      const f=await fresh(h,service,prepare,false),first=await h.client(),second=await h.actorClient('service_role',OTHER)
      const sql=kind==='owner'?'UPDATE projects SET facilitator_id=$1 WHERE id=$2':kind==='facilitator'?"UPDATE project_roles SET status='inactive' WHERE user_id=$1 AND project_id=$2":'UPDATE stories SET project_id=$1 WHERE id=$2'
      const values=kind==='owner'?[USER,PROJECT]:kind==='facilitator'?[THIRD,PROJECT]:[FOREIGN,f.storyId]
      const before=await snapshot(h);await first.query('BEGIN');await first.query(sql,values)
      const pending=outcome(()=>capture(second,{actorId:kind==='facilitator'?THIRD:OTHER,subjectId:f.storyId,requestId:randomUUID()}));await waiting(second,`${kind} revocation/binding wait`);await first.query('COMMIT')
      const result=await pending,after=await snapshot(h);record(`${kind} change while waiting`,before,after,result);h.eq(result.code,'42501','fresh authorization/ownership rejects')
      h.eq(after.deletion_requests,before.deletion_requests,'wait denial creates no request');h.eq(after.deletion_targets,before.deletion_targets,'wait denial creates no targets');h.eq(after.media_assets,before.media_assets,'wait denial changes no assets');h.eq(after.processing_jobs,before.processing_jobs,'wait denial changes no jobs')
      if(kind==='owner')await first.query('UPDATE projects SET facilitator_id=$1 WHERE id=$2',[OTHER,PROJECT])
      if(kind==='facilitator')await first.query("UPDATE project_roles SET status='active' WHERE user_id=$1 AND project_id=$2",[THIRD,PROJECT])
      if(kind==='subject')await first.query('UPDATE stories SET project_id=$1 WHERE id=$2',[PROJECT,f.storyId])
      await h.close(first);await h.close(second)
    }
  })
  await h.scenario('target/asset/cancellation failures, suppressed writes and later trigger tampering roll back all tuples',async()=>{
    const injections=[
      ['target insert error','deletion_targets','BEFORE INSERT',"RAISE EXCEPTION 'synthetic target failure' USING ERRCODE='P0001';"],
      ['asset update error','media_assets','BEFORE UPDATE',"RAISE EXCEPTION 'synthetic asset failure' USING ERRCODE='P0001';"],
      ['cancellation update error','processing_jobs','BEFORE UPDATE',"RAISE EXCEPTION 'synthetic cancellation failure' USING ERRCODE='P0001';"],
      ['suppressed request','deletion_requests','BEFORE INSERT','RETURN NULL;'],
      ['suppressed target','deletion_targets','BEFORE INSERT','RETURN NULL;'],
      ['suppressed asset','media_assets','BEFORE UPDATE','RETURN NULL;'],
      ['suppressed cancellation','processing_jobs','BEFORE UPDATE','RETURN NULL;'],
      ['altered target','deletion_targets','BEFORE INSERT',"NEW.object_key := CASE WHEN NEW.kind='storage_object' THEN NEW.object_key||'/changed' ELSE NEW.object_key END; RETURN NEW;"],
      ['altered request','deletion_requests','BEFORE INSERT',"NEW.tombstone_at := NEW.tombstone_at + interval '1 second'; RETURN NEW;"],
      ['later trigger alters asset','processing_jobs','AFTER UPDATE',"UPDATE media_assets SET state='ready' WHERE id=NEW.asset_id; RETURN NEW;"],
      ['later trigger alters candidate','processing_jobs','AFTER UPDATE',"UPDATE recording_output_candidates SET sha256=repeat('f',64) WHERE job_id=NEW.id; RETURN NEW;"],
      ['later trigger inserts source phantom','processing_jobs','AFTER UPDATE',"INSERT INTO media_assets(project_id,story_id,created_by,bucket,object_key,kind,mime_type) SELECT project_id,story_id,created_by,'saga',created_by::text||'/projects/'||project_id::text||'/injected/'||gen_random_uuid()::text,'original_image','image/png' FROM media_assets WHERE id=NEW.asset_id; RETURN NEW;"],
    ]
    for(const [name,table,timing,body] of injections) {
      const f=await fresh(h,service,prepare,false);await prepareCandidate(h,service,f);await materialize(h,f)
      const sql=`CREATE FUNCTION public.capture_test_trigger() RETURNS trigger LANGUAGE plpgsql AS $t$ BEGIN ${body} END $t$; CREATE TRIGGER capture_test_trigger ${timing} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.capture_test_trigger();`
      await h.db.query(sql)
      try {await deny(name,()=>capture(service,{subjectId:f.storyId,requestId:randomUUID()}),['23505','23503','P0001']);report.observations.at(-1).injectionSql=sql}
      finally{await h.db.query(`DROP TRIGGER capture_test_trigger ON public.${table}; DROP FUNCTION public.capture_test_trigger();`)}
    }
  })
}
