import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {writeFile,readFile,mkdir} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {pathToFileURL} from 'node:url'
import {randomUUID,createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {root} from '../pg17-routines/runtime.mjs'
import {compileModule} from '../g1-local/compile-module.mjs'
import {buildBrowser} from '../recording-flow-browser/build.mjs'
import {databaseHttp} from '../recording-flow-browser/database-http.mjs'
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test'),{NextRequest}=require('next/server'),JSZip=require('jszip')
const hash=value=>createHash('sha256').update(value).digest('hex')
export async function deliveryChrome({h,source,evidence}) {
 const owner=randomUUID(),member=randomUUID(),other=randomUUID(),project=randomUUID(),story=randomUUID(),asset=randomUUID(),transcript=randomUUID()
 const projectName='祖母的家庭傳記',paragraphs=['In 1968 Grandma Eleanor moved to Chicago.','Our family kept photographs of the old garden.','Rejected Mercury account.']
 const familyText='家人在京都保留這段回憶。祖母每天清晨在海邊工作，下午陪我們閱讀家中的舊相簿。'.repeat(90)+'完整家族補充的最後一句。'
 const proof=join(evidence,'chrome-delivery');await mkdir(proof,{recursive:true})
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$4),($2,$5),($3,$6)',[owner,member,other,'chrome-g3-owner@example.invalid','chrome-g3-member@example.invalid','chrome-g3-other@example.invalid'])
 await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,projectName,owner])
 await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,member])
 await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript,audio_duration) VALUES($1,$2,$3,$4,$5,12)',[story,project,owner,'家族花園',paragraphs.join('\n\n')])
 const rate=16000,samples=rate*12,wav=Buffer.alloc(44+samples*2),key=`${owner}/projects/${project}/g3-original.wav`
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40)
 for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*4000),44+i*2)
 await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,original_filename,kind,mime_type,state,sha256,byte_size,duration_ms) VALUES($1,$2,$3,$4,'audio-recordings',$5,'family-original.wav','original_audio','audio/wav','ready',$6,$7,12000)",[asset,project,story,owner,key,hash(wav),wav.length])
 await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[story,`/api/media/assets/${asset}/play`])
 await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,asset_id,version,provider,model,alignment_status,content_sha256,full_text,created_by) VALUES($1,$2,$3,$4,1,'synthetic-fixture','controlled-timing','aligned',$5,$6,$7)",[transcript,project,story,asset,hash(paragraphs.join('\n\n')),paragraphs.join('\n\n'),owner])
 for(let i=0;i<paragraphs.length;i++)await h.db.query('INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,text,start_ms,end_ms,confidence) VALUES($1,$2,$3,$4,$5,$6,NULL)',[project,transcript,i,paragraphs[i],i*4000,i*4000+3500])
 const db=await databaseHttp(h,{allowedFunctions:['story_review','search_project_sources','resolve_search_citation','publication_delivery','complete_publication_cleanup','invalidate_publication_job']})
 db.objects.set('audio-recordings/'+key,{bytes:wav,type:'audio/wav'})
 const spool=join(h.scratch,'g3-chrome-spool');await mkdir(spool,{mode:0o700})
 const previous={flag:process.env.MEDIA_ASSETS_ENABLED,spool:process.env.ARCHIVE_SPOOL_DIR};process.env.MEDIA_ASSETS_ENABLED='true';process.env.ARCHIVE_SPOOL_DIR=spool
 const seam=join(h.scratch,'g3-chrome-boundary.cjs');globalThis.__g3ChromeAdmin=db.admin
 await writeFile(seam,`const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});exports.getSupabaseAdmin=()=>globalThis.__g3ChromeAdmin;exports.getAuthenticatedUser=async request=>{const bearer=request.headers.get('authorization');const cookie=(request.headers.get('cookie')||'').match(/(?:^|; )g3-actor=([^;]+)/)?.[1];const id=bearer?bearer.replace('Bearer synthetic-g3-',''):cookie;return ${JSON.stringify([owner,member,other])}.includes(id)?{ok:true,user:{id},headers:new Headers()}:{ok:false,response:NextResponse.json({error:'Synthetic authentication required'},{status:401})}};`)
 const seams={'@/lib/supabase':seam,'@/lib/server/auth':seam},compiled=join(h.scratch,'g3-chrome-routes')
 const routes={review:await compileModule('app/api/stories/[storyId]/review/route.ts',compiled,source,seams),play:await compileModule('app/api/media/assets/[assetId]/play/route.ts',compiled,source,seams),
  search:await compileModule('app/api/projects/[id]/search/route.ts',compiled,source,seams),source:await compileModule('app/api/projects/[id]/search/source/route.ts',compiled,source,seams),
  archive:await compileModule('app/api/projects/[id]/export/route.ts',compiled,source,seams),status:await compileModule('app/api/projects/[id]/export/jobs/[jobId]/route.ts',compiled,source,seams),download:await compileModule('app/api/projects/[id]/export/jobs/[jobId]/download/route.ts',compiled,source,seams)}
 const worker=await compileModule('lib/server/publication-delivery-worker.ts',compiled,source,seams)
 const build=await buildBrowser(h.scratch,{entry:join(root,'experiments/pg17-g3-delivery/entry.tsx'),boundary:join(root,'experiments/pg17-g3-delivery/boundaries.tsx'),content:[join(root,'packages/web/src/components/stories/**/*.tsx'),join(root,'packages/web/src/components/projects/**/*.tsx')]})
 for(const file of build.dependencies)await source(relative(root,file))
 const report={status:'running',requests:[],errors:[],checks:[],source:{project,story,asset,transcript,sha256:hash(wav)},boundary:'Actual StoryReviewPanel, ConnectedProjectHub and PublicationDeliveryPanel; actual routes, Supabase SDK and native PG17.4. Synthetic local authentication and PostgREST/Storage transport, generated tone WAV and explicitly synthetic timed transcript. Installed Chrome. No real ASR, household fidelity, hosted deployment or payment settlement claim.'};h.report.deliveryChrome=report
 const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value))}
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),path=url.pathname
  if(path==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G3 family delivery</title><link rel="stylesheet" href="/flow.css"><div id="root"></div><script>window.g3Config=${JSON.stringify({owner,project,story,projectName})}</script><script src="/flow.js"></script></html>`);return}
  if(path==='/flow.js'){res.setHeader('content-type','text/javascript');res.end(build.bundle);return}
  if(path==='/flow.css'){res.setHeader('content-type','text/css');res.end(build.css);return}
  if(path==='/favicon.ico'){res.writeHead(204);res.end();return}
  const buffers=[];for await(const chunk of req)buffers.push(chunk)
  const request=new NextRequest('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(buffers)}:{})})
  const context={params:Promise.resolve({id:project})};let response
  if(path===`/api/stories/${story}/review`)response=await routes.review[req.method](request,{params:Promise.resolve({storyId:story})})
  else if(path===`/api/media/assets/${asset}/play`)response=await routes.play.GET(request,{params:Promise.resolve({assetId:asset})})
  else if(path===`/api/projects/${project}/search`)response=await routes.search.GET(request,context)
  else if(path===`/api/projects/${project}/search/source`)response=await routes.source.POST(request,context)
  else if(path===`/api/projects/${project}/export`)response=await routes.archive.POST(request,context)
  else if(path.startsWith(`/api/projects/${project}/export/jobs/`)){const suffix=path.split('/export/jobs/')[1],jobId=suffix.split('/')[0],jobContext={params:Promise.resolve({id:project,jobId})};response=await (suffix.endsWith('/download')?routes.download.GET(request,jobContext):routes.status[req.method](request,jobContext))}
  else{json(res,{error:'Unknown local route'},404);return}
  report.requests.push({path:req.url,method:req.method,status:response.status});response.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(response.status)
  if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end()
 }catch(error){report.errors.push(error.message);if(!res.headersSent)json(res,{error:'Local route failed'},500);else res.destroy()}})
 let browser
 try {
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version()
  const context=await browser.newContext({viewport:{width:1280,height:960},acceptDownloads:true})
  await context.addCookies([{name:'g3-actor',value:owner,url:origin,httpOnly:true,sameSite:'Lax'}])
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message))
  await page.goto(origin);const reviewPanel=page.getByRole('region',{name:'Review your family story'}),items=reviewPanel.locator('ol > li')
  await reviewPanel.getByRole('button',{name:'Prepare review',exact:true}).click();await expect(items).toHaveCount(3)
  await items.nth(0).getByRole('button',{name:'Accept',exact:true}).click();await expect(items.nth(0).getByText('Accepted',{exact:true})).toBeVisible()
  await items.nth(1).getByRole('button',{name:'Modify',exact:true}).click();await page.getByLabel('Family correction',{exact:true}).fill(familyText)
  await page.getByRole('button',{name:'Save correction',exact:true}).click();await expect(items.nth(1).getByText('Family supplement',{exact:true})).toBeVisible()
  await items.nth(2).getByRole('button',{name:'Remove from draft',exact:true}).click();await expect(reviewPanel.getByRole('button',{name:'Approve this version',exact:true})).toBeEnabled()
  await reviewPanel.getByRole('button',{name:'Approve this version',exact:true}).click();await expect(reviewPanel.getByText(/Approved version/)).toBeVisible()
  const state=(await h.db.query("SELECT story_review($1,$2,'read',NULL,NULL,'{}') r",[owner,story])).rows[0].r
  h.eq(state.revision.status,'approved','Chrome G2 approval persisted');h.ok(state.revision.body.includes(familyText)&&!state.revision.body.includes('Mercury'),'approved text contains full family supplement and excludes rejection')
  report.revision=state.revision.id;report.checks.push('actual G2 review decisions and long Unicode approval')
  const search=async(query)=>{await page.getByTestId('provenance-search-query-input').fill(query);const ready=page.waitForResponse(response=>response.url().includes(`/api/projects/${project}/search?`));await page.getByTestId('provenance-search-submit-btn').click();const response=await ready;h.eq(response.status(),200,'Chrome search response');return response.json()}
  const matches=await search('Chicago');await expect(page.getByTestId('provenance-search-results')).toContainText('Original transcript · Approved revision')
  h.eq(matches.status,'source_matches','literal matches rather than generated answer');h.eq(matches.semanticSearch,'unavailable_unmeasured','semantic model not simulated')
  const citation=matches.citations[0];h.eq(citation.transcriptVersionId,transcript,'citation exact transcript');h.eq(citation.storyRevisionId,state.revision.id,'citation exact approval');h.eq(citation.quotedText,paragraphs[0],'literal original quotation')
  h.eq([citation.startMs,citation.endMs],[0,3500],'original source time range');h.eq(citation.sourceHash,hash(paragraphs.join('\n\n')),'current source hash returned')
  const identity=Object.fromEntries(['entryId','storyId','storyRevisionId','transcriptVersionId','segmentId','mediaAssetId','sourceHash','sourceFingerprint','startMs','endMs'].map(field=>[field,citation[field]]))
  const signed=page.waitForResponse(response=>response.url().endsWith(`/api/projects/${project}/search/source`));await page.getByTestId(`seek-citation-${citation.segmentId}`).click();h.eq((await signed).status(),200,'source identity resolves protected audio')
  const audio=page.getByLabel('Cited original audio');await expect.poll(()=>audio.evaluate(a=>a.currentTime)).toBeGreaterThan(.15)
  h.ok(await audio.evaluate(a=>!a.paused&&a.duration===12&&a.currentTime<3.5),'actual installed Chrome plays cited original time range');await audio.evaluate(a=>a.pause())
  await page.getByTestId('provenance-search-results').scrollIntoViewIfNeeded();await page.screenshot({path:join(proof,'chrome-approved-source-seek.png')})
  const supplement=await search('京都');h.eq(supplement.citations[0].sourceKind,'family_supplement','approved family supplement labelled');h.eq([supplement.citations[0].startMs,supplement.citations[0].endMs],[null,null],'supplement has no fabricated timing');await expect(page.getByTestId('provenance-search-results').getByRole('button',{name:/Play Audio/})).toHaveCount(0)
  h.eq((await search('Mercury')).citations,[],'rejected claim absent from approved source results')
  report.checks.push('source-backed literal search and original audio playback','supplement null timing and rejected text exclusion')
  const queuedResponse=page.waitForResponse(response=>response.url().includes(`/api/projects/${project}/export?durable=true`))
  await page.getByRole('button',{name:'Prepare offline archive',exact:true}).click();const queued=await queuedResponse;h.eq(queued.status(),202,'real UI queues durable delivery');const job=await queued.json();report.job=job
  h.eq((await worker.runPublicationDeliveryWorker({admin:db.admin})).outcome,'ready','external worker creates the queued artifact')
  await page.getByRole('button',{name:'Check archive status',exact:true}).click();await expect(page.getByRole('link',{name:'Download archive ZIP',exact:true})).toBeVisible()
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download archive ZIP',exact:true}).click()]);const archivePath=join(proof,'archive.zip');await download.saveAs(archivePath)
  const archiveBytes=await readFile(archivePath),zip=await JSZip.loadAsync(archiveBytes,{checkCRC32:true}),offline=join(proof,'offline');await mkdir(offline,{recursive:true})
  for(const [name,file] of Object.entries(zip.files)){if(file.dir)continue;if(name.startsWith('/')||name.split('/').includes('..'))throw new Error('Unsafe archive path');const path=join(offline,name);await mkdir(join(path,'..'),{recursive:true});await writeFile(path,await file.async('nodebuffer'))}
  const snapshot=JSON.parse(await zip.file('publication-snapshot.json').async('string'));h.eq(snapshot.snapshotId,job.jobId,'download preserves persisted snapshot identity');h.eq(snapshot.storyRevisionIds,[state.revision.id],'publication references actual browser approval')
  h.eq(hash(await zip.file(`media/${asset}/family-original.wav`).async('nodebuffer')),hash(wav),'offline original audio hash matches source')
  const exported=JSON.parse(await zip.file('sources-and-revisions.json').async('string'));h.eq(exported[0].transcript,state.revision.body,'complete approved prose in artifact');h.eq(exported[0].rawTranscript,paragraphs.join('\n\n'),'original transcript separately preserved')
  const offlineContext=await browser.newContext({offline:true,viewport:{width:1024,height:900}}),offlinePage=await offlineContext.newPage();await offlinePage.goto(pathToFileURL(join(offline,'index.html')).href)
  await expect(offlinePage.getByText('Original transcript (source record)',{exact:false})).toBeVisible();h.ok((await offlinePage.locator('body').innerText()).includes(familyText),'independent offline HTML contains entire approved supplement');await offlinePage.screenshot({path:join(proof,'chrome-offline-html.png'),fullPage:true})
  const offlineAudio=offlinePage.locator('audio').first();await expect(offlineAudio).toBeVisible();await offlineAudio.scrollIntoViewIfNeeded();await offlineAudio.click({position:{x:20,y:25}})
  await expect.poll(()=>offlineAudio.evaluate(a=>a.currentTime)).toBeGreaterThan(.15)
  report.offlineAudio=await offlineAudio.evaluate(a=>({src:a.currentSrc,time:a.currentTime,duration:a.duration,paused:a.paused}))
  h.ok(report.offlineAudio.src.startsWith('file:')&&!report.offlineAudio.paused&&report.offlineAudio.duration===12,'independent offline HTML actually plays original local WAV without network')
  await offlinePage.screenshot({path:join(proof,'chrome-offline-audio.png')});await offlineAudio.evaluate(a=>a.pause());await offlineContext.close()
  const pdf=join(offline,'biography-booklet.pdf'),pdfText=join(proof,'booklet.txt');execFileSync('pdftotext',['-layout',pdf,pdfText]);const readPdf=await readFile(pdfText,'utf8')
  h.ok(readPdf.replace(/\s/g,'').includes(familyText.replace(/\s/g,'')),'PDF contains every character of full approved Chinese prose');h.ok(readPdf.split('\f').length>3,'long PDF truly paginates');h.ok(readPdf.includes('Actual')||readPdf.includes('Original transcript'),'PDF labels sources')
  execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','1400','-png',pdf,join(proof,'booklet-first')]);report.pdfPages=readPdf.split('\f').length-1;report.archiveBytes=archiveBytes.length
  report.checks.push('durable UI prepare/status and worker completion','browser protected ZIP download','offline HTML and original audio playback independent of network','full paginated Chinese PDF and original audio SHA-256')
  await page.setViewportSize({width:390,height:844});await page.getByRole('region',{name:'Offline archive delivery'}).scrollIntoViewIfNeeded();await page.screenshot({path:join(proof,'chrome-mobile-delivery.png')});h.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'delivery UI fits narrow viewport')
  await reviewPanel.getByRole('button',{name:'Correct transcript',exact:true}).click();await page.getByLabel('Corrected transcript',{exact:true}).fill('Corrected family source in Toronto in 1978.');await page.getByRole('button',{name:'Save as new transcript version',exact:true}).click();await expect(page.getByText('Family-corrected transcript',{exact:true})).toBeVisible()
  h.eq((await search('Chicago')).citations,[],'correction removes old source from active search');const corrected=await search('Toronto');h.eq([corrected.citations[0].sourceKind,corrected.citations[0].reviewStatus,corrected.citations[0].startMs],['family_supplement','source_only',null],'new source is unapproved and unaligned')
  const auth=actor=>({Authorization:`Bearer synthetic-g3-${actor}`})
  h.eq((await page.request.post(`${origin}/api/projects/${project}/search/source`,{headers:auth(owner),data:identity})).status(),409,'old source citation playback denied after correction')
  h.eq((await page.request.get(`${origin}${job.downloadUrl}`,{headers:auth(owner)})).status(),409,'old publication source identity denied after correction')
  h.eq((await h.db.query('SELECT count(*)::int n FROM publication_snapshots WHERE id=$1',[job.jobId])).rows[0].n,1,'approved publication history remains immutable')
  await h.db.query("UPDATE project_roles SET status='removed' WHERE user_id=$1 AND project_id=$2",[member,project])
  for(const actor of [member,other]){h.eq((await page.request.get(`${origin}/api/projects/${project}/search?q=Toronto`,{headers:auth(actor)})).status(),403,'revoked/other-family search denied');h.eq((await page.request.post(`${origin}/api/projects/${project}/search/source`,{headers:auth(actor),data:identity})).status(),403,'revoked/other-family source playback denied');h.eq((await page.request.get(`${origin}${job.downloadUrl}`,{headers:auth(actor)})).status(),403,'revoked/other-family archive denied')}
  await h.db.query('SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,story,randomUUID()]);h.eq((await search('Toronto')).citations,[],'G1 deletion clears active source search');await worker.reconcilePublicationArtifacts(db.admin)
  h.eq((await h.db.query('SELECT count(*)::int n FROM publication_snapshots WHERE id=$1',[job.jobId])).rows[0].n,0,'G1 erases persisted publication');report.checks.push('correction supersedes source and denies stale playback/download','family isolation and member revocation','G1 deletion clears search/publication')
  h.eq(report.errors,[],'no browser or route exceptions');report.status='passed'
 } finally {
  await writeFile(join(proof,'browser-results.json'),JSON.stringify(report,null,2));await writeFile(join(proof,'transport.json'),JSON.stringify(db.requests,null,2))
  await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));await db.close();delete globalThis.__g3ChromeAdmin
  if(previous.flag===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=previous.flag
  if(previous.spool===undefined)delete process.env.ARCHIVE_SPOOL_DIR;else process.env.ARCHIVE_SPOOL_DIR=previous.spool
 }
}
