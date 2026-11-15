import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { dirname, join } from 'node:path'
const root=process.cwd(), directory=dirname(fileURLToPath(import.meta.url))
const load=p=>import(pathToFileURL(join(root,p)))
const {Harness,digest}=await load('experiments/pg17-routines/runtime.mjs')
const {setup,capture,snapshot,USER,OTHER,PROJECT}=await load('experiments/pg17-deletion-capture/fixture.mjs')
const {save,METADATA}=await load('experiments/pg17-recording-flow/fixture.mjs')
const {compileModules}=await load('experiments/pg17-recording-worker/fixture.mjs')
const report={status:'running',assertions:0,actorConnections:[],scenarios:[],sources:{},waits:[],timeline:[],productionSqlModified:false}
const h=new Harness(report)
const source=async p=>{const bytes=await readFile(join(root,p));report.sources[p]=digest(bytes);return bytes.toString()}
const outcome=async fn=>{try{return{code:'00000',value:await fn()}}catch(e){return{code:e.code,message:e.message}}}
async function wait(client,label,relation,mode){
 for(let n=0;n<300;n++){
  const row=(await h.db.query('SELECT pid,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[client.processID])).rows[0]
  const locks=(await h.db.query('SELECT relation::regclass::text AS relation,locktype,mode,granted FROM pg_locks WHERE pid=$1 ORDER BY locktype,relation,mode',[client.processID])).rows
  if(row.wait_event_type==='Lock'&&row.blockers.length&&locks.some(x=>x.relation===relation&&x.mode===mode&&!x.granted)){report.waits.push({label,...row,locks});return}
  await delay(3)
 }
 throw new Error(`missing real wait: ${label}`)
}
try{
 await source('experiments/pg17-routines/runtime.mjs');await source('experiments/pg17-deletion-capture/fixture.mjs');await source('experiments/pg17-recording-flow/fixture.mjs');await source('experiments/pg17-recording-worker/fixture.mjs')
 await h.start();await setup(h,source)
 const service=await h.actorClient('service_role',USER),sealer=await h.actorClient('service_role',USER),deleter=await h.actorClient('service_role',OTHER),gate=await h.client()
 const {prepareRecordingSessionSeal}=await compileModules(h,source)
 const sessionId=randomUUID(),jobId=randomUUID(),storyId=(await save(service,sessionId,'reserve',METADATA)).lookup.intent.storyId
 const bytes=Buffer.from('synthetic-existing-upload-before-seal'),chunks=[{index:0,chunkId:'chunk-0',bucket:'audio-recordings',objectKey:`projects/${PROJECT}/sessions/${sessionId}/0`,byteSize:bytes.length,sha256:digest(bytes)}]
 const prepared=prepareRecordingSessionSeal({jobId,projectId:PROJECT,sessionId,actorId:USER,actorRole:'storyteller',actorActive:true,storyId,mimeType:'audio/webm',chunks})
 const manifest={schemaVersion:1,projectId:PROJECT,sessionId,userId:USER,storyId,assetId:prepared.task.assetId,mimeType:'audio/webm',chunks:chunks.map(c=>({...c,storageObjectKey:`${USER}/${c.objectKey}`}))}
 report.manifest=manifest;report.syntheticBytesBase64=bytes.toString('base64')
 await h.db.query("INSERT INTO storage.buckets(id,name) VALUES('audio-recordings','audio-recordings') ON CONFLICT DO NOTHING")
 await h.db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('audio-recordings',$1,$2::jsonb)",[manifest.chunks[0].storageObjectKey,JSON.stringify({synthetic:true,byteSize:bytes.length,sha256:digest(bytes)})])
 report.before=await snapshot(h)
 await gate.query('BEGIN');await gate.query('LOCK TABLE public.recording_sessions IN EXCLUSIVE MODE')
 const sealPending=outcome(async()=>(await sealer.query('SELECT seal_recording_manifest($1::jsonb) AS value',[JSON.stringify(manifest)])).rows[0].value)
 await wait(sealer,'seal has passed tombstone check and waits at SELECT session FOR UPDATE','recording_sessions','RowShareLock')
 await deleter.query('BEGIN')
 const deletePending=outcome(()=>capture(deleter,{subjectId:storyId,requestId:randomUUID()}))
 await wait(deleter,'capture queues compatible source population lock behind seal','recording_sessions','ShareRowExclusiveLock')
 await gate.query('COMMIT');report.timeline.push('released scheduling gate; no routine/trigger modifications')
 const deleted=await deletePending;report.capture=deleted;h.eq(deleted.code,'00000','capture succeeds')
 await wait(sealer,'seal insert waits behind capture after both compatible population locks granted','recording_sessions','RowExclusiveLock')
 report.captureBeforeCommit={requests:(await deleter.query('SELECT * FROM deletion_requests')).rows,targets:(await deleter.query('SELECT * FROM deletion_targets')).rows,sessions:(await deleter.query('SELECT * FROM recording_sessions')).rows,chunks:(await deleter.query('SELECT * FROM recording_chunks')).rows}
 await deleter.query('COMMIT');report.timeline.push('capture committed')
 report.seal=await sealPending;report.timeline.push('seal returned after capture commit');report.after=await snapshot(h)
 report.replay=await capture(service,{subjectId:storyId,requestId:randomUUID()});report.afterReplay=await snapshot(h)
 const addresses=report.after.recording_chunks.filter(c=>c.session_id===sessionId).map(c=>({bucket:c.bucket,object_key:c.object_key}))
 report.uncapturedCoordinates=addresses.filter(c=>!report.after.deletion_targets.some(t=>t.bucket===c.bucket&&t.object_key===c.object_key))
 h.eq(report.seal.code,'00000','actual unmodified seal succeeds after capture commit')
 h.eq(report.captureBeforeCommit.sessions.length,0,'capture sees no persisted session')
 h.eq(report.captureBeforeCommit.chunks.length,0,'capture sees no persisted chunk')
 h.eq(report.capture.value.targetCount,1,'capture receipt only story metadata')
 h.eq(report.uncapturedCoordinates.length,1,'actual later committed chunk address is absent from immutable targets')
 h.eq(report.replay,report.capture.value,'replay cannot recover late source')
 h.eq(report.afterReplay,report.after,'replay leaves all rows unchanged')
 h.eq(report.after['storage.objects'],report.before['storage.objects'],'existing synthetic Storage metadata unchanged')
 report.status='reproduced'
}catch(error){report.status='failed';report.error={code:error.code,message:error.message,label:error.label};process.exitCode=1}
finally{await h.cleanup();report.currentSourceMismatch=[];for(const [p,hash]of Object.entries(report.sources)){if(digest(await readFile(join(root,p)))!==hash)report.currentSourceMismatch.push(p)}await writeFile(join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({directory,status:report.status,assertions:report.assertions,waits:report.waits.map(w=>w.label),capture:report.capture,seal:report.seal,uncapturedCoordinates:report.uncapturedCoordinates,error:report.error,cleanup:report.cleanup},null,2))}
