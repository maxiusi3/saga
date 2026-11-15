import {randomUUID,createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {databaseHttp,SERVICE_KEY} from '../recording-flow-browser/database-http.mjs'
import {compileModule} from '../g1-local/compile-module.mjs'
const require=createRequire(import.meta.url),{createClient}=require('@supabase/supabase-js')

/** Production TypeScript + SDK + SQL, with declared loopback Storage/provider transports. */
export async function recoveryAdapterScenarios({h,source}) {
 const {transcribeStory,getTranscriptionConfiguration}=await compileModule('lib/server/story-transcription.ts',join(h.scratch,'recovery-adapter'),source)
 const owner=randomUUID(),project=randomUUID(),audio=Buffer.from('controlled recovery audio bytes')
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[owner,'adapter-recovery@example.invalid'])
 await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'Adapter recovery synthetic',owner])
 const db=await databaseHttp(h,{allowedFunctions:['story_review','reserve_story_transcription','read_story_transcription_status','begin_story_transcription','release_story_transcription']})
 let calls=0,storageFailure=false,providerFailure=false,loseRpc=null
 const provider=createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk)
  const form=await new Request('http://127.0.0.1'+req.url,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)}).formData()
  h.eq(Buffer.from(await form.get('file').arrayBuffer()),audio,'controlled HTTP provider receives exact pinned bytes')
  h.eq(form.get('model_id'),'scribe_v2','real multipart adapter model')
  calls++;res.writeHead(providerFailure?503:200,{'content-type':'application/json'});res.end(JSON.stringify({text:'Recovered exact words.',language_code:'eng',words:[{text:'Recovered exact words.',start:0,end:1,type:'word',speaker_id:'speaker_0'}]}))
 })
 await new Promise((resolve,reject)=>{provider.once('error',reject);provider.listen(0,'127.0.0.1',resolve)})
 const env={MEDIA_ASSETS_ENABLED:'true',G2_TRANSCRIPTION_ENABLED:'true',ELEVENLABS_API_KEY:'synthetic-key',NEXT_PUBLIC_SUPABASE_URL:db.origin,SUPABASE_SERVICE_ROLE_KEY:SERVICE_KEY,
  G2_ASR_POLICY_EVIDENCE:JSON.stringify({provider:'elevenlabs',accountOrOrgId:'synthetic-recovery',modelId:'scribe_v2',allowedRegions:['us'],trainingOptOutConfirmed:true,zeroDataRetentionConfirmed:true,maxRetentionDaysAllowed:0,evidenceDate:new Date().toISOString(),evidenceReference:'controlled-local-only'})}
 const policy=getTranscriptionConfiguration({env})
 const client=createClient(db.origin,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url)
  if(url.origin!==db.origin)throw new Error('Remote SDK traffic forbidden')
  const response=await fetch(input,init)
  if(loseRpc&&url.pathname.endsWith('/'+loseRpc)&&response.ok){await response.arrayBuffer();loseRpc=null;throw new Error('Controlled response loss after SQL commit')}
  return response
 }}})
 const transport=async(input,init)=>{
  const url=new URL(String(input))
  if(url.origin===db.origin)return storageFailure?new Response('controlled Storage503',{status:503}):fetch(input,init)
  if(url.href==='https://api.elevenlabs.io/v1/speech-to-text?enable_logging=false')return fetch(`http://127.0.0.1:${provider.address().port}${url.pathname}${url.search}`,init)
  throw new Error('Remote provider traffic forbidden')
 }
 const fixture=async()=>{
  const story=randomUUID(),asset=randomUUID(),requestId=randomUUID(),key=`${owner}/projects/${project}/${story}/source.webm`
  await h.db.query('INSERT INTO stories(id,project_id,user_id,transcript) VALUES($1,$2,$3,NULL)',[story,project,owner])
  await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,byte_size,sha256,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/webm',$6,$7,5000,'ready')",[asset,project,story,owner,key,audio.length,createHash('sha256').update(audio).digest('hex')])
  await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[story,`/api/media/assets/${asset}/play`])
  db.objects.set('audio-recordings/'+key,{bytes:audio,type:'audio/webm'})
  return {story,request:{requestId,expectedVersion:0,consent:true,policyVersion:policy.policyVersion}}
 }
 const run=f=>transcribeStory(owner,f.story,f.request,{admin:client,env,fetch:transport})
 const rejects=async(f,code)=>{try{await run(f);throw new Error('Expected recovery rejection')}catch(error){h.eq(error.code??error.status,code,'adapter failure is explicit '+code)}}
 try {
  const storage=await fixture();storageFailure=true;await rejects(storage,'unavailable');storageFailure=false
  h.eq(calls,0,'Storage503 never sends to provider')
  const prep=(await h.db.query('SELECT * FROM story_transcription_requests WHERE story_id=$1',[storage.story])).rows[0]
  h.eq(prep.execution_phase,'preparing','Storage503 is durably pre-send')
  const restored=await run(storage);h.eq(restored.transcript.segments[0].text,'Recovered exact words.','retry commits actual provider output');h.eq(calls,1,'retry calls provider once')
  h.eq((await h.db.query('SELECT preparation_attempt FROM story_transcription_requests WHERE story_id=$1',[storage.story])).rows[0].preparation_attempt,2,'same durable request has bounded retry count')
  await run(storage);h.eq(calls,1,'completed replay never sends again')
  const lostReserve=await fixture();loseRpc='reserve_story_transcription';await rejects(lostReserve,503);h.eq(calls,1,'lost reservation reply sends no bytes')
  await rejects(lostReserve,'transcription_pending')
  await h.db.query("UPDATE story_transcription_requests SET preparation_lease_until=clock_timestamp()-interval '1 second' WHERE story_id=$1",[lostReserve.story])
  await run(lostReserve);h.eq(calls,2,'lost process reservation recovers after durable expiry')
  const lostBegin=await fixture();loseRpc='begin_story_transcription';await rejects(lostBegin,503);await rejects(lostBegin,'transcription_pending');h.eq(calls,2,'lost outbound permit response never blindly sends')
  h.eq((await h.db.query('SELECT execution_phase FROM story_transcription_requests WHERE story_id=$1',[lostBegin.story])).rows[0].execution_phase,'outbound','unknown permit outcome stays durably conservative')
  const rejected=await fixture();providerFailure=true;await rejects(rejected,'provider_unavailable');providerFailure=false;await rejects(rejected,'transcription_pending');h.eq(calls,3,'rejected provider attempt is not repeated')
  const concurrent=await fixture(),results=await Promise.allSettled([run(concurrent),run(concurrent)])
  h.eq(results.filter(r=>r.status==='fulfilled').length,1,'real SDK concurrent call has one winner');h.eq(calls,4,'real SDK concurrent call sends exactly once')
  h.report.recoveryAdapter={status:'passed',providerCalls:calls,checks:['storage503-release-retry','reservation-ack-loss-expiry','outbound-permit-ack-loss-no-resend','provider503-no-resend','concurrent-SDK-single-send','completed-idempotent-replay'],boundary:'Actual production TS, Supabase SDK, native PG17 and loopback HTTP multipart provider with synthetic credentials/audio. No remote traffic or provider-quality claim.'}
 } finally {provider.closeAllConnections();await new Promise(resolve=>provider.close(resolve));await db.close()}
}
