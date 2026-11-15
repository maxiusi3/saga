import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {writeFile} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {root} from '../pg17-routines/runtime.mjs'
import {compileModule} from '../g1-local/compile-module.mjs'
import {buildBrowser} from '../recording-flow-browser/build.mjs'
import {databaseHttp,SERVICE_KEY} from '../recording-flow-browser/database-http.mjs'
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test'),{NextRequest}=require('next/server')
const digest=value=>createHash('sha256').update(value).digest('hex')
const json=(res,body,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body))}
const listen=server=>new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done)})
const close=async server=>{if(server?.listening){server.closeAllConnections();await new Promise(done=>server.close(done))}}
const word=(text,start,end,speaker_id='speaker_0',type='word')=>({text,start,end,speaker_id,type})
const responseBody={text:'Grandma planted the tree. I remember the apples.',language_code:'eng',words:[
 word('Grandma',0,.5),word(' ',.5,.5,'speaker_0','spacing'),word('planted',.5,1),word(' ',1,1,'speaker_0','spacing'),word('the',1,1.3),word(' ',1.3,1.3,'speaker_0','spacing'),word('tree.',1.3,2),word(' ',2,2,'speaker_0','spacing'),
 word('I',3,3.2,'speaker_1'),word(' ',3.2,3.2,'speaker_1','spacing'),word('remember',3.2,4,'speaker_1'),word(' ',4,4,'speaker_1','spacing'),word('the',4,4.2,'speaker_1'),word(' ',4.2,4.2,'speaker_1','spacing'),word('apples.',4.2,5.5,'speaker_1'),
]}

/** Native PG and production handlers; only declared Auth/Storage/provider transports are synthetic. */
export async function transcriptionChrome({h,source,evidence,owner,member,other,project}) {
 const report={status:'running',checks:[],requests:[],providerRequests:[],errors:[],boundary:'Production StoryReviewPanel and StoryTranscriptionControl, production GET/POST transcription/review/play routes, Supabase SDK, complete native PG17 schema, and installed Google Chrome. Auth identities, loopback PostgREST/Storage/provider transport, tone WAV, and timed provider response are controlled synthetic substitutes. No paid/live ASR, real speech accuracy, or semantic audio alignment claim.'}
 h.report.transcriptionChrome=report
 const envKeys=['MEDIA_ASSETS_ENABLED','G2_TRANSCRIPTION_ENABLED','ELEVENLABS_API_KEY','G2_ASR_POLICY_EVIDENCE','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']
 const priorEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]])),priorFetch=globalThis.fetch
 let db,browser,appServer,providerServer
 const submitted=[]
 try {
  const rate=16000,samples=rate*6,wav=Buffer.alloc(44+samples*2)
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40)
  for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*(i<rate*3?440:660)/rate)*4000),44+i*2)
  await writeFile(join(evidence,'transcription-source.wav'),wav)
  const stories=[]
  for(const name of ['successful transcription','invalid transcription','recoverable transcription']) {
   const story=randomUUID(),asset=randomUUID(),key=`${owner}/projects/${project}/${story}/source.wav`
   await h.db.query('INSERT INTO stories(id,project_id,user_id,storyteller_id,title,transcript,audio_duration,status) VALUES($1,$2,$3,$3,$4,NULL,6,\'ready\')',[story,project,owner,name])
   await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,byte_size,sha256,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/wav',$6,$7,6000,'ready')",[asset,project,story,owner,key,wav.length,digest(wav)])
   await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[story,`/api/media/assets/${asset}/play`])
   stories.push({story,asset,key})
  }
  const [success,invalid,recoverable]=stories
  report.stories=stories.map(({story,asset})=>({story,asset}));report.source={bytes:wav.length,sha256:digest(wav),durationMs:6000,mimeType:'audio/wav'}
  await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2",[project,member])
  db=await databaseHttp(h,{allowedFunctions:['story_review','reserve_story_transcription','read_story_transcription_status','begin_story_transcription','release_story_transcription']})
  for(const story of stories)db.objects.set(`audio-recordings/${story.key}`,{bytes:wav,type:'audio/wav'})
  const seam=join(h.scratch,'g2-transcription-boundary.cjs');globalThis.__g2TranscriptionAdmin=db.admin
  await writeFile(seam,`const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});exports.getSupabaseAdmin=()=>globalThis.__g2TranscriptionAdmin;exports.getAuthenticatedUser=async request=>{const value=request.headers.get('authorization')||'';const id=value.replace('Bearer synthetic-g2-','');return ['${owner}','${member}','${other}'].includes(id)?{ok:true,user:{id},headers:new Headers()}:{ok:false,response:NextResponse.json({error:'Synthetic authentication required'},{status:401})}};`)
  const seams={'@/lib/supabase':seam,'@/lib/server/auth':seam}
  const route=await compileModule('app/api/stories/[storyId]/transcribe/route.ts',join(h.scratch,'g2-transcription-routes'),source,seams)
  const review=await compileModule('app/api/stories/[storyId]/review/route.ts',join(h.scratch,'g2-transcription-review-routes'),source,seams)
  const play=await compileModule('app/api/media/assets/[assetId]/play/route.ts',join(h.scratch,'g2-transcription-play-routes'),source,seams)
  const build=await buildBrowser(h.scratch,{entry:join(root,'experiments/pg17-g2-review/entry.tsx'),boundary:join(root,'experiments/pg17-g2-review/boundaries.tsx'),content:[join(root,'packages/web/src/components/stories/**/*.tsx')]})
  for(const file of build.dependencies)await source(relative(root,file))
  const policy={provider:'elevenlabs',accountOrOrgId:'synthetic-g2-no-provider-account',modelId:'scribe_v2',allowedRegions:['us'],trainingOptOutConfirmed:true,zeroDataRetentionConfirmed:true,maxRetentionDaysAllowed:0,evidenceDate:new Date().toISOString(),evidenceReference:'synthetic-g2-policy-test-only'}
  Object.assign(process.env,{MEDIA_ASSETS_ENABLED:'true',G2_TRANSCRIPTION_ENABLED:'true',ELEVENLABS_API_KEY:'synthetic-g2-provider-no-real-permission',G2_ASR_POLICY_EVIDENCE:JSON.stringify(policy),NEXT_PUBLIC_SUPABASE_URL:db.origin,SUPABASE_SERVICE_ROLE_KEY:SERVICE_KEY})
  let mode='success',withdrawStory=null
  providerServer=createServer(async(req,res)=>{
   try {
    h.eq(req.method,'POST','provider receives POST');h.eq(req.url,'/v1/speech-to-text?enable_logging=false','provider receives retention-safe path')
    h.eq(req.headers['xi-api-key'],'synthetic-g2-provider-no-real-permission','only synthetic provider credential')
    const chunks=[];for await(const chunk of req)chunks.push(chunk)
    const form=await new Request('http://127.0.0.1'+req.url,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)}).formData()
    const file=form.get('file');h.ok(file&&typeof file.arrayBuffer==='function','provider receives multipart audio');const bytes=Buffer.from(await file.arrayBuffer())
    h.eq(digest(bytes),digest(wav),'provider received exact pinned audio');h.eq(form.get('model_id'),'scribe_v2','server pinned ASR model');h.eq(form.get('timestamps_granularity'),'word','word timing requested');h.eq(form.get('diarize'),'true','speaker diarization requested');h.eq(form.get('tag_audio_events'),'true','audio events retained')
    report.providerRequests.push({mode,path:req.url,bytes:bytes.length,sha256:digest(bytes),model:form.get('model_id')})
    if(mode==='withdraw')await h.db.query('UPDATE consent_records SET withdrawn_at=clock_timestamp() WHERE subject_id=$1 AND purpose=\'cloud_ai\' AND withdrawn_at IS NULL',[withdrawStory])
    json(res,mode==='invalid'?{text:'Unusable incomplete provider response.',language_code:'eng',words:[]}:responseBody)
   }catch(error){report.errors.push({surface:'provider',message:error.message,label:error.label});json(res,{error:'Controlled provider fixture failed'},500)}
  })
  await listen(providerServer)
  const providerOrigin=`http://127.0.0.1:${providerServer.address().port}`
  globalThis.fetch=(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
   if(url.href==='https://api.elevenlabs.io/v1/speech-to-text?enable_logging=false')return priorFetch(providerOrigin+url.pathname+url.search,init)
   if(url.origin===db.origin){if(mode==='storage-error'&&url.pathname.startsWith('/storage/v1/object/'))return Promise.resolve(Response.json({error:'Controlled Storage503'},{status:503}));return priorFetch(input,init)}
   throw new Error('G2 local fixture blocked undeclared network destination')
  }
  appServer=createServer(async(req,res)=>{
   try {
    const url=new URL(req.url,'http://127.0.0.1'),chosen=stories.find(item=>item.story===url.searchParams.get('story'))??success
    if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G2 configured transcription</title><link rel="stylesheet" href="/flow.css"><div id="root"></div><script>window.g2Config=${JSON.stringify({owner,story:chosen.story,project,locale:'en'})}</script><script src="/flow.js"></script></html>`);return}
    if(url.pathname==='/flow.js'){res.setHeader('content-type','text/javascript');res.end(build.bundle);return}
    if(url.pathname==='/flow.css'){res.setHeader('content-type','text/css');res.end(build.css);return}
    const chunks=[];for await(const chunk of req)chunks.push(chunk)
    const headers={...req.headers},body=Buffer.concat(chunks)
    if(url.pathname.endsWith('/play'))headers.authorization=`Bearer synthetic-g2-${owner}`
    const request=new NextRequest('http://127.0.0.1'+req.url,{method:req.method,headers,...(req.method==='POST'?{body}:{})})
    const storyMatch=/^\/api\/stories\/([a-f0-9-]+)\/(transcribe|review)$/.exec(url.pathname),assetMatch=/^\/api\/media\/assets\/([a-f0-9-]+)\/play$/.exec(url.pathname)
    let response
    if(storyMatch&&['GET','POST'].includes(req.method)){
     if(req.method==='POST'&&storyMatch[2]==='transcribe')submitted.push({story:storyMatch[1],actor:headers.authorization,body:JSON.parse(body.toString())})
     response=await (storyMatch[2]==='transcribe'?route:review)[req.method](request,{params:Promise.resolve({storyId:storyMatch[1]})})
    }else if(assetMatch)response=await play.GET(request,{params:Promise.resolve({assetId:assetMatch[1]})})
    else {json(res,{error:'Unknown fixture route'},404);return}
    report.requests.push({method:req.method,path:url.pathname,status:response.status})
    response.headers.forEach((value,key)=>res.setHeader(key,value));res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()))
   }catch(error){report.errors.push({surface:'app',message:error.message,label:error.label});json(res,{error:'Local route failure'},500)}
  })
  await listen(appServer);const origin=`http://127.0.0.1:${appServer.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version()
  const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',error=>report.errors.push({surface:'chrome',message:error.message}))
  const auth=actor=>({Authorization:`Bearer synthetic-g2-${actor}`})
  const getConfig=async story=>(await (await page.request.get(`${origin}/api/stories/${story}/transcribe`,{headers:auth(owner)})).json()).transcription
  const post=async(story,body,actor=owner)=>page.request.post(`${origin}/api/stories/${story}/transcribe`,{headers:auth(actor),data:body})
  const config=await getConfig(success.story);h.eq(config.ready,true,'configured adapter available');h.eq(config.pendingRequestId,null,'initial request ledger empty')
  const input=()=>({requestId:randomUUID(),consent:true,policyVersion:config.policyVersion,expectedVersion:0})
  h.eq((await post(success.story,input(),other)).status(),403,'outsider cannot trigger provider')
  h.eq((await post(success.story,{...input(),consent:false})).status(),403,'unconsented request denied')
  await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2",[project,member])
  h.eq((await post(success.story,input(),member)).status(),403,'revoked member cannot trigger provider')
  await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2",[project,member])
  process.env.G2_ASR_POLICY_EVIDENCE=JSON.stringify({...policy,trainingOptOutConfirmed:false})
  h.eq((await post(success.story,input())).status(),503,'unverified provider policy denied')
  process.env.G2_ASR_POLICY_EVIDENCE=JSON.stringify(policy)
  h.eq(report.providerRequests.length,0,'all access consent policy denials make zero provider requests')
  report.checks.push('outsider, revoked member, missing consent, invalid policy: zero provider requests')
  await page.goto(origin);const start=page.getByRole('button',{name:'Transcribe saved audio',exact:true})
  await expect(start).toBeDisabled();await expect(page.getByRole('checkbox')).toBeVisible();await page.screenshot({path:join(evidence,'chrome-transcription-before.png'),fullPage:true})
  await page.getByRole('checkbox').check();await start.click();await expect(page.getByText('Transcript with source audio',{exact:true})).toBeVisible()
  await expect(page.locator('ol > li')).toHaveCount(2);await expect(page.getByRole('button',{name:'Approve this version',exact:true})).toBeDisabled()
  const state=(await h.db.query("SELECT story_review($1,$2,'read',NULL,NULL,'{}') r",[owner,success.story])).rows[0].r
  h.eq(state.transcript.alignment_status,'aligned','actual adapter timing persisted');h.eq(state.transcript.provider,'elevenlabs','configured provider provenance persisted');h.eq(state.transcript.model,'scribe_v2','configured model provenance persisted');h.eq(state.transcript.segments.map(segment=>[segment.start_ms,segment.end_ms,segment.confidence]),[[0,2000,null],[3000,5500,null]],'timing real controlled provider fields; confidence unknown')
  h.eq((await h.db.query('SELECT transcript FROM stories WHERE id=$1',[success.story])).rows[0].transcript,'Grandma planted the tree.\n\nI remember the apples.','full source text persisted exactly as segment join')
  h.eq(report.providerRequests.length,1,'one explicit click sends one provider request')
  const original=submitted.findLast(item=>item.story===success.story&&item.actor===`Bearer synthetic-g2-${owner}`&&item.body.policyVersion===config.policyVersion&&item.body.consent===true).body
  h.eq((await post(success.story,original)).status(),200,'completed same request safely replayed');h.eq(report.providerRequests.length,1,'completed replay does not re-invoke provider')
  await page.reload();await expect(page.getByText('Transcript with source audio',{exact:true})).toBeVisible()
  await page.locator('ol > li').nth(1).getByRole('button',{name:/Listen to source/}).click();await expect.poll(()=>page.locator('audio').evaluate(audio=>audio.currentTime)).toBeGreaterThan(3.1)
  h.ok(await page.locator('audio').evaluate(audio=>!audio.paused&&audio.currentTime<5.5),'provider timestamp controls actual playable source');await page.locator('audio').evaluate(audio=>audio.pause())
  await page.screenshot({path:join(evidence,'chrome-transcription-after.png'),fullPage:true});report.checks.push('explicit Chrome consent and submit','actual adapter multipart bytes and config','durable aligned transcript and unknown confidence','completed request replay makes zero extra calls','reload and timed audio seek')
  // Withdrawal during an in-flight provider response must not create another transcript.
  mode='withdraw';withdrawStory=success.story
  const withdrawn=await post(success.story,{...input(),revisionId:state.revision.id,expectedVersion:state.revision.edit_version})
  h.eq(withdrawn.status(),403,'consent withdrawal during provider wait rejects result');h.eq((await h.db.query('SELECT count(*)::int n FROM transcript_versions WHERE story_id=$1',[success.story])).rows[0].n,1,'withdrawal preserves only the original transcript')
  report.checks.push('consent withdrawn during provider response rejects ingestion')
  mode='invalid';await page.goto(`${origin}/?story=${invalid.story}`);await expect(page.getByRole('button',{name:'Transcribe saved audio',exact:true})).toBeDisabled();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Transcribe saved audio',exact:true}).click()
  await expect(page.getByText('A transcription request is unresolved. Reload to check before sending audio again.',{exact:true})).toBeVisible()
  const failedRequest=submitted.findLast(item=>item.story===invalid.story).body,calls=report.providerRequests.length
  h.eq(calls,3,'one success, one consent withdrawal, one invalid provider response')
  h.eq((await h.db.query('SELECT count(*)::int n FROM transcript_versions WHERE story_id=$1',[invalid.story])).rows[0].n,0,'invalid provider creates no transcript')
  h.eq((await h.db.query('SELECT count(*)::int n FROM story_revisions WHERE story_id=$1',[invalid.story])).rows[0].n,0,'invalid provider creates no review draft')
  h.eq((await getConfig(invalid.story)).pendingRequestId,failedRequest.requestId,'GET reports durable unresolved request identity')
  h.eq((await post(invalid.story,failedRequest)).status(),409,'same unresolved request cannot resend');h.eq((await post(invalid.story,input())).status(),409,'fresh ID cannot bypass unresolved request')
  await page.reload();await expect(page.getByText('A transcription request is unresolved. Reload to check before sending audio again.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Transcribe saved audio',exact:true})).toHaveCount(0)
  h.eq(report.providerRequests.length,calls,'reload and retries make no extra provider calls');await page.screenshot({path:join(evidence,'chrome-transcription-error.png'),fullPage:true})
  report.checks.push('invalid provider response creates no draft','pending identity survives reload','same and new IDs cannot repeat unknown outbound request')
  mode='storage-error';await page.goto(`${origin}/?story=${recoverable.story}`)
  await expect(page.getByRole('button',{name:'Transcribe saved audio',exact:true})).toBeDisabled();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Transcribe saved audio',exact:true}).click()
  await expect(page.getByText('A transcription request is unresolved. Reload to check before sending audio again.',{exact:true})).toBeVisible()
  const recoveryRequest=submitted.findLast(item=>item.story===recoverable.story).body
  h.eq(report.providerRequests.length,calls,'Storage503 fails before any extra provider request')
  h.eq((await getConfig(recoverable.story)).retryableRequestId,recoveryRequest.requestId,'server readiness exposes only safe pre-send retry')
  mode='success';await page.reload();const retryButton=page.getByRole('button',{name:'Retry transcription',exact:true})
  await expect(retryButton).toBeDisabled();await page.screenshot({path:join(evidence,'chrome-transcription-retry-before.png'),fullPage:true})
  await page.getByRole('checkbox').check();await retryButton.click();await expect(page.getByText('Transcript with source audio',{exact:true})).toBeVisible()
  h.eq(submitted.findLast(item=>item.story===recoverable.story).body.requestId,recoveryRequest.requestId,'browser retry retains exact request identity')
  h.eq(report.providerRequests.length,calls+1,'explicit browser retry sends exactly one provider request')
  h.eq((await h.db.query('SELECT preparation_attempt FROM story_transcription_requests WHERE story_id=$1',[recoverable.story])).rows[0].preparation_attempt,2,'same request records both preparation attempts')
  await page.screenshot({path:join(evidence,'chrome-transcription-retry-after.png'),fullPage:true})
  report.checks.push('Storage503 before outbound remains retryable','reload and explicit renewed consent retry same request','exactly one provider send after safe retry')
  h.eq(report.errors,[],'no unexpected Chrome or handler exceptions');report.status='passed'
 }catch(error){report.status='failed';report.failure={code:error.code,label:error.label,message:error.message};throw error}
 finally {
  const cleanupErrors=[]
  for(const dispose of [()=>browser?.close(),()=>close(appServer),()=>close(providerServer),()=>db?.close()]){try{await dispose()}catch(error){cleanupErrors.push(error.message)}}
  globalThis.fetch=priorFetch;delete globalThis.__g2TranscriptionAdmin
  for(const key of envKeys){if(priorEnv[key]===undefined)delete process.env[key];else process.env[key]=priorEnv[key]}
  report.cleanup={globalsRestored:true,errors:cleanupErrors}
  if(cleanupErrors.length)report.status='failed'
  await writeFile(join(evidence,'transcription-chrome-report.json'),JSON.stringify(report,null,2)+'\n')
  if(cleanupErrors.length)throw new Error('G2 transcription fixture cleanup failed')
 }
}
