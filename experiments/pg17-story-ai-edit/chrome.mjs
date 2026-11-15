import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {writeFile} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {randomUUID} from 'node:crypto'
import {root} from '../pg17-routines/runtime.mjs'
import {compileModule} from '../g1-local/compile-module.mjs'
import {buildBrowser} from '../recording-flow-browser/build.mjs'
import {databaseHttp} from '../recording-flow-browser/database-http.mjs'
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test'),{NextRequest}=require('next/server')
const json=(res,body,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body))}
const listen=server=>new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done)})
const close=async server=>{if(server?.listening){server.closeAllConnections();await new Promise(done=>server.close(done))}}
export async function storyAiEditChrome({h,source,evidence,owner,member,other,project}){
 const report={status:'running',providerRequests:[],requests:[],errors:[],checks:[],boundary:'Production AI-edit/review handlers, SDK and complete PG17; actual StoryReviewPanel in installed Chrome. Synthetic auth, loopback HTTP provider and PostgREST substitutes. No real credentials, paid providers or human quality score.'};h.report.storyAiEditChrome=report
 const keys=['MEDIA_ASSETS_ENABLED','G2_AI_EDIT_ENABLED','ANTHROPIC_API_KEY','OPENAI_API_KEY','G2_AI_EDITOR_POLICY_EVIDENCE','G2_AI_REVIEWER_POLICY_EVIDENCE'],prior=Object.fromEntries(keys.map(k=>[k,process.env[k]])),priorFetch=globalThis.fetch
 let db,browser,providerServer,appServer,mode='success',targetStory=null
 const raw='Um, I left school in 1972 and, well, began working at the mill.',edited='I left school in 1972 and began working at the mill.'
 const createdStories=new Set()
 const create=async()=>{const story=randomUUID();createdStories.add(story);await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[story,project,owner,'A working life',raw]);const state=(await h.db.query("SELECT story_review($1,$2,'prepare',$3,NULL,'{}') r",[owner,story,randomUUID()])).rows[0].r;return {story,state}}
 try{
  const success=await create();db=await databaseHttp(h,{allowedFunctions:['story_review','story_ai_edit']});globalThis.__aiEditAdmin=db.admin
  const seam=join(h.scratch,'ai-edit-boundary.cjs');await writeFile(seam,`const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});exports.getSupabaseAdmin=()=>globalThis.__aiEditAdmin;exports.getAuthenticatedUser=async r=>{const id=(r.headers.get('authorization')||'').replace('Bearer synthetic-g2-','');return ['${owner}','${member}','${other}'].includes(id)?{ok:true,user:{id},headers:new Headers()}:{ok:false,response:NextResponse.json({error:'Synthetic auth required'},{status:401})}};`)
  const seams={'@/lib/supabase':seam,'@/lib/server/auth':seam}
  const route=await compileModule('app/api/stories/[storyId]/ai-edit/route.ts',join(h.scratch,'ai-edit-routes'),source,seams),reviewRoute=await compileModule('app/api/stories/[storyId]/review/route.ts',join(h.scratch,'ai-review-routes'),source,seams)
  const build=await buildBrowser(h.scratch,{entry:join(root,'experiments/pg17-g2-review/entry.tsx'),boundary:join(root,'experiments/pg17-g2-review/boundaries.tsx'),content:[join(root,'packages/web/src/components/stories/**/*.tsx')]});for(const p of build.dependencies)await source(relative(root,p))
  const policy=(provider,modelId)=>JSON.stringify({provider,modelId,accountOrOrgId:'synthetic-ai-only',allowedRegions:['us'],trainingOptOutConfirmed:true,zeroDataRetentionConfirmed:true,maxRetentionDaysAllowed:0,evidenceDate:new Date().toISOString(),evidenceReference:'controlled-http-fixture-not-provider-qualification'})
  Object.assign(process.env,{MEDIA_ASSETS_ENABLED:'true',G2_AI_EDIT_ENABLED:'true',ANTHROPIC_API_KEY:'synthetic-editor-key',OPENAI_API_KEY:'synthetic-reviewer-key',G2_AI_EDITOR_POLICY_EVIDENCE:policy('anthropic','claude-opus-5-5'),G2_AI_REVIEWER_POLICY_EVIDENCE:policy('openai','gpt-6-astra')})
  providerServer=createServer(async(req,res)=>{try{
   const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString());h.eq(req.method,'POST','provider HTTP POST')
   const isEditor=req.url==='/v1/messages';h.ok(isEditor||req.url==='/v1/responses','official adapter endpoint path')
   const data=JSON.parse(isEditor?body.messages[0].content:body.input);h.eq(data.segments[0].text,raw,'authoritative transcript sent');h.eq(body.model,isEditor?'claude-opus-5-5':'gpt-6-astra','configured model sent')
   h.eq(isEditor?req.headers['x-api-key']:req.headers.authorization,isEditor?'synthetic-editor-key':'Bearer synthetic-reviewer-key','only synthetic credentials')
   report.providerRequests.push({path:req.url,mode,model:body.model,paragraphs:data.paragraphs?.length??null})
   if(mode==='unknown'&&isEditor){req.socket.destroy();return}
   if(isEditor){const paragraphs=data.segments.map(s=>({text:edited,segmentId:mode==='false-source'?randomUUID():s.id,sourceQuote:s.text,startMs:s.start_ms,endMs:s.end_ms}));json(res,{id:'msg_controlled',model:body.model,stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({paragraphs})}],usage:{input_tokens:100,output_tokens:60}});return}
   h.eq(body.store,false,'OpenAI persistence disabled');h.eq(data.paragraphs[0].text,edited,'independent model receives actual edited prose')
   if(mode==='withdraw')await h.db.query("UPDATE consent_records SET withdrawn_at=clock_timestamp() WHERE subject_id=$1 AND provider='openai'",[targetStory])
   if(mode==='stale')await h.db.query("UPDATE stories SET transcript='Changed during fact review' WHERE id=$1",[targetStory])
   if(mode==='deleted')await h.db.query('SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,targetStory,randomUUID()])
   const paragraphs=data.paragraphs.map((_,index)=>({index,supported:mode!=='severe',severity:mode==='severe'?'severe':'none',risks:mode==='severe'?['invented event']:[]}))
   json(res,{id:'resp_controlled',model:body.model,status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({paragraphs})}]}],usage:{input_tokens:150,output_tokens:40}})
  }catch(e){report.errors.push({surface:'provider',message:e.message,label:e.label});json(res,{error:'Controlled fixture failure'},500)}})
  await listen(providerServer);const providerOrigin=`http://127.0.0.1:${providerServer.address().port}`
  globalThis.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(['https://api.anthropic.com/v1/messages','https://api.openai.com/v1/responses'].includes(url.href))return priorFetch(providerOrigin+url.pathname,init);if(url.origin===db.origin)return priorFetch(input,init);throw new Error('Undeclared network blocked by AI fixture')}
  appServer=createServer(async(req,res)=>{try{
   const url=new URL(req.url,'http://127.0.0.1')
   if(url.pathname==='/'){const story=createdStories.has(url.searchParams.get('story'))?url.searchParams.get('story'):success.story;res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI family review</title><link rel="stylesheet" href="/flow.css"><div id="root"></div><script>window.g2Config=${JSON.stringify({owner,story,project,locale:'en'})}</script><script src="/flow.js"></script></html>`);return}
   if(url.pathname==='/flow.js'){res.setHeader('content-type','text/javascript');res.end(build.bundle);return}if(url.pathname==='/flow.css'){res.setHeader('content-type','text/css');res.end(build.css);return}
   if(url.pathname.endsWith('/transcribe')){json(res,{transcription:{ready:false,pendingRequestId:null}});return}
   const match=/^\/api\/stories\/([a-f0-9-]+)\/(ai-edit|review)$/.exec(url.pathname);if(!match){json(res,{error:'Unknown local route'},404);return}
   const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks)
   const request=new NextRequest('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}:{})})
   const response=await (match[2]==='ai-edit'?route:reviewRoute)[req.method](request,{params:Promise.resolve({storyId:match[1]})});report.requests.push({path:req.url,method:req.method,status:response.status})
   response.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()))
  }catch(e){report.errors.push({surface:'app',message:e.message,label:e.label});json(res,{error:'Local route failure'},500)}})
  await listen(appServer);const origin=`http://127.0.0.1:${appServer.address().port}`;browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>report.errors.push({surface:'chrome',message:e.message}))
  const auth=actor=>({Authorization:`Bearer synthetic-g2-${actor}`}),getConfig=async f=>(await(await page.request.get(`${origin}/api/stories/${f.story}/ai-edit`,{headers:auth(owner)})).json()).aiEdit
  const config=await getConfig(success),input=(f,configValue=config)=>({requestId:randomUUID(),revisionId:f.state.revision.id,expectedVersion:f.state.revision.edit_version,consent:true,policyVersion:configValue.policyVersion}),post=(f,value,actor=owner)=>page.request.post(`${origin}/api/stories/${f.story}/ai-edit`,{headers:auth(actor),data:value})
  h.eq(config.ready,true,'production route configured')
  h.eq((await post(success,input(success),other)).status(),403,'outsider cannot send text')
  h.eq((await post(success,{...input(success),consent:false})).status(),400,'explicit consent required')
  h.eq((await post(success,{...input(success),body:'injected prose'})).status(),400,'caller cannot supply model prose')
  h.eq(report.providerRequests.length,0,'denied attempts make no external call')
  await page.goto(origin);const start=page.getByRole('button',{name:'Prepare AI edited draft',exact:true});await expect(start).toBeDisabled();await page.getByRole('checkbox').check();await page.screenshot({path:join(evidence,'chrome-ai-before.png'),fullPage:true});await start.click()
  await expect(page.locator('ol > li').getByText(edited,{exact:true})).toBeVisible();await expect(page.getByText(/AI edited · independently checked/)).toBeVisible();await expect(page.locator('blockquote').getByText(raw,{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Approve this version',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Accept',exact:true}).click();await expect(page.getByRole('button',{name:'Approve this version',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Approve this version',exact:true}).click();await expect(page.getByText(/Approved version/)).toBeVisible();await page.reload();await expect(page.locator('ol > li').getByText(edited,{exact:true})).toBeVisible();await page.screenshot({path:join(evidence,'chrome-ai-approved.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(evidence,'chrome-ai-mobile.png'),fullPage:true});h.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'AI control fits mobile')
  h.eq(report.providerRequests.length,2,'exactly one editor and reviewer call from UI');report.checks.push('explicit consent','actual edited draft visible','full original quote visible','family approval','approved reload','mobile layout')
  for(const [kind,status] of [['false-source',502],['severe',422],['withdraw',403],['stale',409],['deleted',409],['unknown',503]]){
   const f=await create();mode=kind;targetStory=f.story;const before=report.providerRequests.length,body=input(f,await getConfig(f)),r=await post(f,body);h.eq(r.status(),status,kind+' protected result')
   const rows=(await h.db.query('SELECT status FROM story_ai_edit_requests WHERE story_id=$1',[f.story])).rows
   if(kind==='false-source'||kind==='severe')h.eq(rows[0].status,'rejected',kind+' records rejection without prose copy')
   if(kind==='unknown'){h.eq(rows[0].status,'editing','unknown external outcome remains pending');h.eq((await post(f,body)).status(),409,'same unknown request not resent');h.eq(report.providerRequests.length,before+1,'unknown made only one provider call')}
   const revisions=(await h.db.query('SELECT body FROM story_revisions WHERE story_id=$1',[f.story])).rows;h.ok(revisions.every(r=>r.body!==edited),kind+' cannot persist edited result');report.checks.push(kind)
  }
  mode='success';const replay=await create(),body=input(replay,await getConfig(replay)),before=report.providerRequests.length
  h.eq((await post(replay,body)).status(),200,'first production edit completes');h.eq((await post(replay,body)).status(),200,'completed request returns persisted result');h.eq(report.providerRequests.length,before+2,'completed replay no provider duplication')
  for(const kind of ['corrected-source','same-text-modification']){
   const f=await create()
   if(kind==='corrected-source'){
    const corrected=await page.request.post(`${origin}/api/stories/${f.story}/review`,{headers:auth(member),data:{operation:'correct_transcript',requestId:randomUUID(),revisionId:f.state.revision.id,expectedVersion:f.state.revision.edit_version,text:raw}})
    h.eq(corrected.status(),200,'another family member corrects transcript before AI')
   }
   await page.goto(`${origin}/?story=${f.story}`);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Prepare AI edited draft',exact:true}).click()
   const paragraph=page.locator('ol > li');await expect(paragraph.getByText(edited,{exact:true})).toBeVisible()
   if(kind==='same-text-modification'){
    await page.getByRole('button',{name:'Modify',exact:true}).click();await expect(page.getByLabel('Family correction',{exact:true})).toHaveValue(edited)
    await page.getByRole('button',{name:'Save correction',exact:true}).click();await expect(paragraph.getByText(/AI edited · independently checked/)).toHaveCount(0)
   }else await page.getByRole('button',{name:'Accept',exact:true}).click()
   await expect(paragraph.getByText('Family supplement',{exact:true})).toBeVisible();await expect(paragraph.getByRole('button',{name:/Listen to source/})).toHaveCount(0)
   await page.getByRole('button',{name:'Approve this version',exact:true}).click();await expect(page.getByText(/Approved version/)).toBeVisible();await page.reload()
   const state=(await(await page.request.get(`${origin}/api/stories/${f.story}/review`,{headers:auth(owner)})).json()).review
   h.eq(state.assertions[0].memory_attribution,'family_supplement',kind+' remains family supplement after reload');h.eq(state.assertions[0].supplemented_by,kind==='corrected-source'?member:owner,kind+' author preserved')
   h.eq(state.assertions[0].evidence_refs,[],kind+' has no audio evidence');h.eq([state.assertions[0].start_ms,state.assertions[0].end_ms],[null,null],kind+' has no claimed audio timing')
   if(kind==='same-text-modification')h.eq(state.assertions[0].ai_review,null,'same-text modification drops AI source badge after reload')
   await page.screenshot({path:join(evidence,`chrome-ai-${kind}.png`),fullPage:true});report.checks.push(kind+' retains family attribution after approval and reload')
  }
  h.eq(report.errors,[],'no browser/provider/app exceptions');report.status='passed';report.checks.push('same completed request idempotent')
 }finally{globalThis.fetch=priorFetch;for(const k of keys){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]}await browser?.close();await close(appServer);await close(providerServer);await db?.close();delete globalThis.__aiEditAdmin}
}
