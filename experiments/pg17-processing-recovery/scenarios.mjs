import {randomUUID,createHash} from 'node:crypto'

export async function processingRecoveryScenarios({h}) {
 const owner=randomUUID(),other=randomUUID(),project=randomUUID()
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$3),($2,$4)',[owner,other,'recovery@example.invalid','other-recovery@example.invalid'])
 await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'Recovery synthetic',owner])
 const createAudio=async(story)=>{
  const asset=randomUUID(),object=`${owner}/projects/${project}/${story}/${asset}.webm`
  await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,byte_size,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/webm',$6,5,5000,'ready')",[asset,project,story,owner,object,'a'.repeat(64)])
  return {asset,object}
 }
 const fixture=async()=>{
  const story=randomUUID(),request=randomUUID()
  // A playback pointer may only reference an existing asset once deletion fences exist.
  await h.db.query('INSERT INTO stories(id,project_id,user_id,transcript) VALUES($1,$2,$3,NULL)',[story,project,owner])
  const {asset,object}=await createAudio(story)
  await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[story,`/api/media/assets/${asset}/play`])
  const payload={source_hash:createHash('sha256').update('').digest('hex'),asset_id:asset,provider:'elevenlabs',model:'scribe_v2',region:'us',policy_version:'controlled-v1',consent:true,asset_version:1,asset_sha256:'a'.repeat(64),asset_bucket:'audio-recordings',asset_object_key:object}
  return {story,asset,request,payload}
 }
 const invoke=async(name,args,expected='00000',actor=owner)=>{
  const sql=`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS r`,r=await h.actor('service_role',actor,sql,args)
  if(r.sqlstate!==expected){try{await h.db.query(sql,args)}catch(error){h.report.recoveryDebug={message:error.message,where:error.where}}}
  h.eq(r.sqlstate,expected,`${name} expected ${expected}`);return r.rows?.[0]?.r
 }
 const reserve=f=>invoke('reserve_story_transcription',[owner,f.story,f.request,0,JSON.stringify(f.payload)])
 const begin=(f,token,expected)=>invoke('begin_story_transcription',[owner,f.story,f.request,token],expected)
 const release=(f,token)=>invoke('release_story_transcription',[owner,f.story,f.request,token])
 const status=f=>invoke('read_story_transcription_status',[owner,f.story,f.request])
 const f=await fixture(),first=await reserve(f)
 h.ok(first.leaseToken,'reservation must issue a durable lease token before any provider attempt')
 h.eq(first.status,'reserved','first sender owns preparation')
 h.eq((await reserve(f)).status,'pending','concurrent duplicate cannot share live lease')
 h.eq((await reserve({...f,request:randomUUID()})).status,'pending','new request cannot bypass live lease')
 h.eq((await status(f)).retryableRequestId,null,'live preparation is not retryable')
 h.eq((await release(f,first.leaseToken)).released,true,'confirmed pre-send failure releases only this lease')
 h.eq((await release(f,first.leaseToken)).released,true,'release is idempotent')
 h.eq((await status(f)).retryableRequestId,f.request,'released preparation exposes explicit retry')
 const second=await reserve(f);h.ok(second.leaseToken!==first.leaseToken,'retry changes token')
 h.eq((await begin(f,first.leaseToken)).started,false,'old owner cannot send after reclaim')
 h.eq((await release(f,first.leaseToken)).released,false,'old owner cannot release new lease')
 const concurrent=await Promise.all([begin(f,second.leaseToken),begin(f,second.leaseToken)])
 h.eq(concurrent.map(r=>r.started).sort(),[false,true],'one atomic outbound permit across concurrent callers')
 h.eq((await release(f,second.leaseToken)).released,false,'outbound never becomes retryable')
 await h.db.query("UPDATE story_transcription_requests SET preparation_lease_until=clock_timestamp()-interval '1 hour' WHERE story_id=$1",[f.story])
 h.eq((await reserve(f)).status,'pending','outbound remains pending after lease expiry')
 h.eq((await status(f)).retryableRequestId,null,'outbound status never offers retry')
 const ingest={source_hash:f.payload.source_hash,asset_id:f.asset,provider:'elevenlabs',model:'scribe_v2',region:'us',policy_version:'controlled-v1',local_worker:false,language:'en',segments:[{text:'Controlled spoken sentence.',start_ms:0,end_ms:1000,confidence:null,speaker_label:'speaker_0'}]}
 await invoke('story_review',[owner,f.story,'ingest_transcript',f.request,0,JSON.stringify(ingest)],'23505')
 const completed=await invoke('story_review',[owner,f.story,'ingest_transcript',f.request,0,JSON.stringify({...ingest,lease_token:second.leaseToken})])
 h.eq(completed.transcript.segments[0].text,ingest.segments[0].text,'token-bound actual result commits')
 h.eq((await status(f)).status,'completed','completion remains durable')
 const crashed=await fixture(),lost=await reserve(crashed)
 await h.db.query("UPDATE story_transcription_requests SET preparation_lease_until=clock_timestamp()-interval '1 second' WHERE story_id=$1",[crashed.story])
 h.eq((await status(crashed)).retryableRequestId,crashed.request,'process death before sending is recoverable after lease')
 const recovered=await reserve(crashed);h.ok(recovered.leaseToken!==lost.leaseToken,'crash recovery fences lost worker')
 for(let attempt=2;attempt<=5;attempt++) {
  const current=attempt===2?recovered:await reserve(crashed)
  h.eq(current.status,'reserved','bounded controlled preparation attempt '+attempt)
  await release(crashed,current.leaseToken)
 }
 h.eq((await reserve(crashed)).status,'pending','attempt budget exhausted')
 h.eq((await reserve({...crashed,request:randomUUID()})).status,'pending','new request cannot reset attempt budget')
 h.eq((await status(crashed)).retryableRequestId,null,'exhaustion is explicit nonretryable pending')
 const legacy=await fixture();await reserve(legacy)
 await h.db.query("UPDATE story_transcription_requests SET execution_phase='unknown',preparation_lease_token=NULL,preparation_lease_until=NULL,preparation_attempt=0 WHERE story_id=$1",[legacy.story])
 h.eq((await reserve(legacy)).status,'pending','legacy unknown reservation is never reissued')
 h.eq((await status(legacy)).retryableRequestId,null,'legacy status remains conservative')
 const retryPointer=await fixture(),pointerLease=await reserve(retryPointer)
 await release(retryPointer,pointerLease.leaseToken)
 const replacementAudio=await createAudio(retryPointer.story)
 for(const pointer of [null,`/api/media/assets/${replacementAudio.asset}/play`]) {
  await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[retryPointer.story,pointer])
  h.eq((await status(retryPointer)).retryableRequestId,null,'changed audio pointer cannot advertise safe retry')
  h.eq((await invoke('read_story_transcription_status',[owner,retryPointer.story,null])).retryableRequestId,null,'readiness GET never advertises changed audio pointer')
 }
 await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[retryPointer.story,`/api/media/assets/${retryPointer.asset}/play`])
 h.eq((await status(retryPointer)).retryableRequestId,retryPointer.request,'restoring the reserved audio identity permits safe retry')
 const changedAudio=await fixture(),audioLease=await reserve(changedAudio)
 h.eq((await begin(changedAudio,audioLease.leaseToken)).started,true,'audio identity pinned at outbound')
 const changedReplacement=await createAudio(changedAudio.story)
 await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[changedAudio.story,`/api/media/assets/${changedReplacement.asset}/play`])
 await invoke('story_review',[owner,changedAudio.story,'ingest_transcript',changedAudio.request,0,JSON.stringify({...ingest,asset_id:changedAudio.asset,lease_token:audioLease.leaseToken})],'23505')
 for(const kind of ['source','asset','consent','membership','deletion']) {
  const stale=await fixture(),r=await reserve(stale)
  if(kind==='source')await h.db.query("UPDATE stories SET transcript='changed' WHERE id=$1",[stale.story])
  if(kind==='asset')await h.db.query('UPDATE media_assets SET version=version+1 WHERE id=$1',[stale.asset])
  if(kind==='consent')await h.db.query('UPDATE consent_records SET withdrawn_at=clock_timestamp() WHERE subject_id=$1',[stale.story])
  if(kind==='membership')await h.db.query('UPDATE projects SET facilitator_id=$1 WHERE id=$2',[other,project])
  if(kind==='deletion')await invoke('request_story_deletion',[owner,project,stale.story,randomUUID()])
  await begin(stale,r.leaseToken,['consent','membership'].includes(kind)?'42501':'23505')
  if(kind==='membership')await h.db.query('UPDATE projects SET facilitator_id=$1 WHERE id=$2',[owner,project])
  if(kind==='deletion')h.eq((await h.db.query('SELECT count(*)::int n FROM story_transcription_requests WHERE story_id=$1',[stale.story])).rows[0].n,0,'G1 erases recovery identities')
  if(['source','asset','consent'].includes(kind)) {
   await release(stale,r.leaseToken)
   const readiness=await invoke('read_story_transcription_status',[owner,stale.story,null])
   h.eq(readiness.retryableRequestId,null,'readiness GET never crashes or advertises stale '+kind)
   h.eq(readiness.pendingRequestId,null,'readiness GET clears stale pre-send pending identity for '+kind)
   const updatedPayload={...stale.payload,...(kind==='source'?{source_hash:createHash('sha256').update('changed').digest('hex')}:kind==='asset'?{asset_version:2}:{})}
   const superseded=await invoke('reserve_story_transcription',[owner,stale.story,randomUUID(),0,JSON.stringify(updatedPayload)])
   h.eq(superseded.status,'reserved','new reservation supersedes stale pre-send '+kind)
   h.eq((await h.db.query('SELECT preparation_attempt FROM story_transcription_requests WHERE story_id=$1',[stale.story])).rows[0].preparation_attempt,2,'superseding stale pre-send row preserves attempt budget for '+kind)
  }
 }
 for(const role of ['anon','authenticated']) {
  for(const name of ['begin_story_transcription','release_story_transcription'])h.eq((await h.actor(role,owner,`SELECT public.${name}($1,$2,$3,$4)`,[owner,f.story,f.request,first.leaseToken])).sqlstate,'42501',role+' cannot '+name)
 }
 h.eq((await h.actor('service_role',other,'SELECT public.begin_story_transcription($1,$2,$3,$4)',[other,legacy.story,legacy.request,randomUUID()])).sqlstate,'42501','other family cannot take outbound permit')
 for(const name of ['story_review_before_recovery','reserve_story_transcription_before_recovery','read_story_transcription_status_before_recovery'])h.eq((await h.db.query("SELECT has_function_privilege('service_role',p.oid,'EXECUTE') allowed FROM pg_proc p WHERE proname=$1",[name])).rows[0].allowed,false,'private previous RPC cannot bypass '+name)
 h.report.processingRecovery={status:'passed',boundary:'Real native PG17 durable state, concurrent connections, synthetic families. No paid provider call.'}
}
