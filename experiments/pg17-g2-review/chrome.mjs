import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {writeFile,readFile} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {root} from '../pg17-routines/runtime.mjs'
import {compileModule} from '../g1-local/compile-module.mjs'
import {buildBrowser} from '../recording-flow-browser/build.mjs'
import {databaseHttp} from '../recording-flow-browser/database-http.mjs'
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test'),{NextRequest}=require('next/server')
const hash=text=>createHash('sha256').update(text).digest('hex')

export async function storyReviewChrome({h,source,evidence,owner,member,other,project}) {
 const story=randomUUID(),asset=randomUUID(),transcript=randomUUID(),paragraphs=['In 1972, we planted an apple tree.','My sister remembers the first harvest.','This sentence should be removed.']
 await h.db.query('INSERT INTO stories(id,project_id,user_id,storyteller_id,title,transcript,audio_duration) VALUES($1,$2,$3,$3,$4,$5,12)',[story,project,owner,'The family garden',paragraphs.join('\n')])
 await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/wav','ready')",[asset,project,story,owner,`${owner}/projects/${project}/g2-source.wav`])
 await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[story,`/api/media/assets/${asset}/play`])
 await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,asset_id,version,provider,model,alignment_status,content_sha256,full_text,created_by) VALUES($1,$2,$3,$4,1,'synthetic-fixture','controlled-timing','aligned',$5,$6,$7)",[transcript,project,story,asset,hash(paragraphs.join('\n')),paragraphs.join('\n'),owner])
 for(let i=0;i<paragraphs.length;i++)await h.db.query('INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,text,start_ms,end_ms,confidence) VALUES($1,$2,$3,$4,$5,$6,NULL)',[project,transcript,i,paragraphs[i],i*4000,i*4000+3500])
 await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2",[project,member])
 const rate=16000,samples=rate*12,wav=Buffer.alloc(44+samples*2)
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40)
 for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*(i<rate*4?440:i<rate*8?660:880)/rate)*4000),44+i*2)
 await writeFile(join(evidence,'review-source.wav'),wav)
 await h.db.query('UPDATE media_assets SET sha256=$2,byte_size=$3,duration_ms=12000 WHERE id=$1',[asset,hash(wav),wav.length])
 const db=await databaseHttp(h,{allowedFunctions:['story_review','reserve_story_transcription','read_story_transcription_status']})
 const seam=join(h.scratch,'g2-boundary.cjs');globalThis.__g2Admin=db.admin
 await writeFile(seam,`const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});exports.getSupabaseAdmin=()=>globalThis.__g2Admin;exports.getAuthenticatedUser=async request=>{const value=request.headers.get('authorization')||'';const id=value.replace('Bearer synthetic-g2-','');return ['${owner}','${member}','${other}'].includes(id)?{ok:true,user:{id},headers:new Headers()}:{ok:false,response:NextResponse.json({error:'Synthetic authentication required'},{status:401})}};`)
 const seams={'@/lib/supabase':seam,'@/lib/server/auth':seam}
 const review=await compileModule('app/api/stories/[storyId]/review/route.ts',join(h.scratch,'g2-routes'),source,seams)
 const play=await compileModule('app/api/media/assets/[assetId]/play/route.ts',join(h.scratch,'g2-routes'),source,seams)
 db.objects.set(`audio-recordings/${owner}/projects/${project}/g2-source.wav`,{bytes:wav,type:'audio/wav'})
 const build=await buildBrowser(h.scratch,{entry:join(root,'experiments/pg17-g2-review/entry.tsx'),boundary:join(root,'experiments/pg17-g2-review/boundaries.tsx'),content:[join(root,'packages/web/src/components/stories/**/*.tsx')]})
 for(const file of build.dependencies)await source(relative(root,file))
 const prior=process.env.MEDIA_ASSETS_ENABLED;process.env.MEDIA_ASSETS_ENABLED='true'
 const report={status:'running',requests:[],errors:[],checks:[],boundary:'Production StoryReviewPanel mounted by the actual story detail page, production review and protected playback handlers, Supabase SDK and complete native PG17 schema. Local synthetic Auth/PostgREST/Storage transport, generated tone WAV and explicitly synthetic timed transcript. Actual installed Google Chrome; no live ASR or real household semantics measured.'}
 h.report.storyReviewChrome=report
 let browser;const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value))}
 const server=createServer(async(req,res)=>{try{
   if(req.url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G2 family review</title><link rel="stylesheet" href="/flow.css"><div id="root"></div><script>window.g2Config=${JSON.stringify({owner,story,project,locale:'en'})}</script><script src="/flow.js"></script></html>`);return}
   if(req.url==='/flow.js'){res.setHeader('content-type','text/javascript');res.end(build.bundle);return}
   if(req.url==='/flow.css'){res.setHeader('content-type','text/css');res.end(build.css);return}
   const buffers=[];for await(const b of req)buffers.push(b)
   const headers={...req.headers};if(req.url.includes('/play'))headers.authorization=`Bearer synthetic-g2-${owner}`
   const request=new NextRequest('http://127.0.0.1'+req.url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(buffers)}:{})})
   let response
   if(req.url===`/api/stories/${story}/review`)response=await review[req.method](request,{params:Promise.resolve({storyId:story})})
   else if(req.url===`/api/media/assets/${asset}/play`)response=await play.GET(request,{params:Promise.resolve({assetId:asset})})
   else if(req.url===`/api/stories/${story}/transcribe`&&req.method==='GET'){json(res,{transcription:{ready:false,provider:'elevenlabs',model:'scribe_v2',region:'us',policyVersion:null,requiresConsent:true,pendingRequestId:null}});return}
   else{json(res,{error:'Unknown local route'},404);return}
   report.requests.push({path:req.url,method:req.method,status:response.status});response.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()))
 }catch(error){report.errors.push(error.message);json(res,{error:'Local route failure'},500)}})
 try{
   await new Promise(done=>server.listen(0,'127.0.0.1',done));browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version()
   const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));const origin=`http://127.0.0.1:${server.address().port}`
   await page.goto(origin);await page.getByRole('button',{name:'Prepare review',exact:true}).click();await expect(page.getByText('Transcript with source audio',{exact:true})).toBeVisible()
   const items=page.locator('ol > li');await expect(items).toHaveCount(3);await expect(page.getByRole('button',{name:'Approve this version',exact:true})).toBeDisabled()
   await page.locator('audio').evaluate(a=>{
     window.g2AudioEvents=[]
     const snapshot=event=>window.g2AudioEvents.push({event,time:a.currentTime,duration:a.duration,readyState:a.readyState,seeking:a.seeking,seekable:Array.from({length:a.seekable.length},(_,i)=>[a.seekable.start(i),a.seekable.end(i)])})
     for(const event of ['loadedmetadata','seeking','seeked','playing','pause','error'])a.addEventListener(event,()=>snapshot(event))
     snapshot('before seek')
   })
   await items.nth(1).getByRole('button',{name:/Listen to source/}).click()
   try {await expect.poll(()=>page.locator('audio').evaluate(a=>a.currentTime)).toBeGreaterThan(4.1)}
   finally {report.audioEvents=await page.evaluate(()=>window.g2AudioEvents);report.storageRequests=db.requests.filter(r=>r.path.includes('/storage/'))}
   h.ok(await page.locator('audio').evaluate(a=>!a.paused&&a.currentTime<8),'actual audio seek and playback at paragraph two');report.checks.push('actual source audio seek and time progression')
   await page.locator('audio').evaluate(a=>a.pause())
   await items.nth(0).getByRole('button',{name:'Modify',exact:true}).click()
   report.editorLabels=await page.locator('label').evaluateAll(labels=>labels.map(l=>({text:l.textContent,html:l.outerHTML})))
   await page.getByLabel('Family correction',{exact:true}).fill('We planted it in 1973, according to our family album.');await page.getByRole('button',{name:'Save correction',exact:true}).click()
   await expect(items.nth(0).getByText('Family supplement',{exact:true})).toBeVisible();await expect(items.nth(0).getByRole('button',{name:/Listen to source/})).toHaveCount(0)
   await items.nth(1).getByRole('button',{name:'Keep another recollection',exact:true}).click();await page.getByLabel('Another recollection',{exact:true}).fill('I remember the harvest in the following autumn.');await page.getByRole('button',{name:'Save recollection',exact:true}).click();await expect(page.getByText('Review saved.',{exact:true})).toBeVisible()
   let state=(await h.db.query('SELECT public.story_review($1,$2,\'read\',NULL,NULL,\'{}\') AS r',[owner,story])).rows[0].r
   const altResponse=await page.request.post(`${origin}/api/stories/${story}/review`,{headers:{Authorization:`Bearer synthetic-g2-${member}`},data:{operation:'decide_assertion',requestId:randomUUID(),revisionId:state.revision.id,expectedVersion:state.revision.edit_version,assertionId:state.assertions[1].id,action:'dispute',text:'I remember the harvest one year later.'}})
   h.eq(altResponse.status(),200,'second member dispute accepted')
   await page.getByRole('button',{name:'Reload review',exact:true}).click();await expect(page.getByText('I remember the harvest one year later.',{exact:true})).toBeVisible();await expect(page.getByText('I remember the harvest in the following autumn.',{exact:true})).toBeVisible()
   await items.nth(2).getByRole('button',{name:'Remove from draft',exact:true}).click();await expect(page.getByRole('button',{name:'Approve this version',exact:true})).toBeEnabled()
   await page.screenshot({path:join(evidence,'chrome-review-before-approval.png'),fullPage:true})
   await page.getByRole('button',{name:'Approve this version',exact:true}).click();await expect(page.getByText(/Approved version/)).toBeVisible();await page.reload();await expect(page.getByText(/Approved version/)).toBeVisible()
   state=(await h.db.query('SELECT public.story_review($1,$2,\'read\',NULL,NULL,\'{}\') AS r',[owner,story])).rows[0].r
   h.eq(state.revision.status,'approved','Chrome approval durable');h.ok(state.revision.body.includes('family album')&&!state.revision.body.includes('should be removed'),'Chrome decisions change approved body');h.eq(state.assertions[1].alternatives.length,2,'both alternatives survive reload')
   const forbidden=await page.request.get(`${origin}/api/stories/${story}/review`,{headers:{Authorization:`Bearer synthetic-g2-${other}`}});h.eq(forbidden.status(),403,'Chrome outsider denied')
   await page.getByRole('button',{name:'Correct transcript',exact:true}).click();await page.getByLabel('Corrected transcript',{exact:true}).fill('The family album dates the tree to 1973.');await page.getByRole('button',{name:'Save as new transcript version',exact:true}).click();await expect(page.getByText('Family-corrected transcript',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Approve this version',exact:true})).toBeDisabled()
   h.eq((await h.db.query("SELECT count(*)::int n FROM story_revisions WHERE story_id=$1 AND status='approved'",[story])).rows[0].n,1,'correction preserves approved history')
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(evidence,'chrome-review-mobile.png'),fullPage:true});h.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'review fits narrow viewport')
   await h.db.query("UPDATE stories SET transcript='A late legacy edit' WHERE id=$1",[story]);await page.getByRole('button',{name:'Reload review',exact:true}).click();await expect(page.getByText('The source transcript has changed. Prepare a new review before approving.',{exact:true})).toBeVisible()
   await h.db.query('SELECT public.request_story_deletion($1,$2,$3,$4)',[owner,project,story,randomUUID()]);await page.getByRole('button',{name:'Reload review',exact:true}).click();await expect(page.getByText('Review is unavailable. Reload to try again.',{exact:true})).toBeVisible();h.eq((await h.db.query('SELECT count(*)::int n FROM story_revisions WHERE story_id=$1',[story])).rows[0].n,0,'G1 erases Chrome review history')
   h.eq(report.errors,[],'no browser or route exceptions');report.status='passed';report.checks.push('modified and rejected body persisted','two-member disputes','approved reload and history','outsider denied','correction new version','narrow viewport','source-change and deletion rejected');h.report.storyReviewChrome=report
 }finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));await db.close();delete globalThis.__g2Admin;if(prior===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=prior}
 await source('experiments/pg17-g2-review/transcription-chrome.mjs')
 const {transcriptionChrome}=await import('./transcription-chrome.mjs')
 await transcriptionChrome({h,source,evidence,owner,member,other,project})
}
