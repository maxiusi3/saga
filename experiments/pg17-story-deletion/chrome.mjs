import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { root } from '../pg17-routines/runtime.mjs'
import { compileModule } from '../g1-local/compile-module.mjs'
import { buildBrowser } from '../recording-flow-browser/build.mjs'
import { databaseHttp, SERVICE_KEY } from '../recording-flow-browser/database-http.mjs'
import { storageHttp } from '../pg17-deletion-execution/storage-http.mjs'
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test'),{NextRequest}=require('next/server')
export async function storyDeletionChrome({h,source,evidence,owner,other,project}) {
  await h.db.query("DELETE FROM stories WHERE project_id=$1 AND audio_url='https://unknown.invalid/audio.webm'",[project])
  const story=randomUUID(),asset=randomUUID(),kept=randomUUID(),keptAsset=randomUUID()
  const object={bucket:'audio-recordings',objectKey:`${owner}/projects/${project}/stories/${story}/source.webm`}
  const keptObject={bucket:'audio-recordings',objectKey:`${owner}/projects/${project}/stories/${kept}/source.webm`}
  await h.db.query(`INSERT INTO stories(id,project_id,user_id,storyteller_id,title,content,transcript) VALUES($1,$3,$4,$4,'Chrome deletion target','Chrome private body','Chrome private transcript'),($2,$3,$4,$4,'Chrome survivor','Keep body','Keep transcript')`,[story,kept,project,owner])
  for(const [id,sid,o] of [[asset,story,object],[keptAsset,kept,keptObject]]){
    await h.db.query(`INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,state) VALUES($1,$2,$3,$4,$5,$6,'original_audio','audio/webm','ready')`,[id,project,sid,owner,o.bucket,o.objectKey])
    await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[sid,`/api/media/assets/${id}/play`])
  }
  const snapshot=randomUUID()
  await h.db.query(`INSERT INTO publication_snapshots(id,project_id,snapshot_version,manifest_json,pdf_sha256,retention_expires_at,reminder_90d_at,reminder_30d_at) VALUES($1,$2,9,$3,$4,now(),now(),now())`,[snapshot,project,JSON.stringify({assets:[{assetId:asset,caption:'Chrome private body'}]}),'a'.repeat(64)])
  const db=await databaseHttp(h),storage=await storageHttp(join(h.scratch,'chrome-story-files'))
  await storage.put(object);await storage.put(keptObject)
  const worker=await compileModule('lib/server/media-deletion-worker.ts',join(h.scratch,'story-worker'),source)
  const workerOptions={admin:db.admin,storageUrl:'https://storage.invalid',serviceRoleKey:SERVICE_KEY,fetch:storage.fetch}
  const boundary=join(h.scratch,'story-server-boundary.cjs');globalThis.__g1StoryAdmin=db.admin
  await writeFile(boundary,`const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});
const admin=()=>globalThis.__g1StoryAdmin;
exports.getSupabaseAdmin=admin;
exports.cookies=()=>({});
exports.createRouteHandlerClient=()=>({from:(...a)=>admin().from(...a),auth:{getUser:async()=>({data:{user:{id:'${owner}'}},error:null})}});
exports.getAuthenticatedClient=async()=>({ok:true,user:{id:'${owner}'},client:admin()});
exports.getAuthenticatedUser=async request=>{const token=request.headers.get('authorization');const id=token==='Bearer synthetic-story-owner'?'${owner}':token==='Bearer synthetic-story-other'?'${other}':null;return id?{ok:true,user:{id},headers:new Headers()}:{ok:false,response:NextResponse.json({error:'Synthetic session required'},{status:401})}};`)
  const seams={'@/lib/supabase':boundary,'@/lib/server/auth':boundary,'@/lib/server/authenticated-client':boundary,'@supabase/auth-helpers-nextjs':boundary,'next/headers':boundary}
  const deletion=await compileModule('app/api/projects/[id]/stories/[storyId]/delete/route.ts',join(h.scratch,'story-routes'),source,seams)
  const listing=await compileModule('app/api/projects/[id]/stories/route.ts',join(h.scratch,'story-routes'),source,seams)
  const browserBuild=await buildBrowser(h.scratch,{entry:join(root,'experiments/pg17-story-deletion/entry.tsx'),boundary:join(root,'experiments/pg17-story-deletion/boundaries.tsx'),env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid'},alias:{'@saga/shared':join(root,'packages/shared/src')},content:[join(root,'packages/web/src/app/**/ProjectDetailClient.tsx'),join(root,'packages/web/src/components/**/*.tsx')]})
  for(const file of browserBuild.dependencies)await source(relative(root,file))
  const prior=process.env.MEDIA_ASSETS_ENABLED;process.env.MEDIA_ASSETS_ENABLED='true'
  const report={requests:[],errors:[],boundary:'Production ProjectDetailClient, StoryCard, StoryService, deletion route, project list route, SQL and media worker. Synthetic local Auth, project/chapters transport and Supabase HTTP substitutes; actual installed Google Chrome and disk files.'}
  let browser,workerTask,workerResult
  const send=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
  const server=createServer(async(req,res)=>{
    try{
      if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G1 story deletion</title><link rel="stylesheet" href="/flow.css"><div id="root"></div><script>window.g1StoryConfig=${JSON.stringify({owner,project})}</script><script src="/flow.js"></script></html>`);return}
      if(req.url==='/flow.js'){res.setHeader('Content-Type','text/javascript');res.end(browserBuild.bundle);return}
      if(req.url==='/flow.css'){res.setHeader('Content-Type','text/css');res.end(browserBuild.css);return}
      if(req.url==='/api/projects/owned'){send(res,{projects:(await h.db.query('SELECT * FROM projects WHERE id=$1',[project])).rows});return}
      if(req.url==='/api/project-roles'){send(res,{roles:[]});return}
      if(req.url.endsWith('/overview')){send(res,{members:[],storyCount:2});return}
      if(req.url.endsWith('/chapters')){send(res,{progress:[]});return}
      if(req.url.endsWith('/prompts/next')){send(res,{prompt:null});return}
      const buffers=[];for await(const b of req)buffers.push(b)
      const request=new NextRequest('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(buffers)}:{})})
      const deletedPath=/^\/api\/projects\/([^/]+)\/stories\/([^/]+)\/delete$/.exec(req.url)
      let response
      if(deletedPath)response=await deletion.POST(request,{params:Promise.resolve({id:deletedPath[1],storyId:deletedPath[2]})})
      else if(req.url===`/api/projects/${project}/stories`)response=await listing.GET(request,{params:Promise.resolve({id:project})})
      else{send(res,{error:'Unknown fixture request'},404);return}
      const bytes=Buffer.from(await response.arrayBuffer());report.requests.push({path:req.url,status:response.status})
      response.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(response.status);res.end(bytes)
      if(deletedPath&&response.status===202){const id=JSON.parse(bytes).deletionRequest.id;workerTask=worker.runMediaDeletion(id,workerOptions).then(r=>{workerResult=r}).catch(e=>{report.errors.push(e.message)})}
    }catch(e){report.errors.push(e.message);send(res,{error:'Local fixture failed'},500)}
  })
  try{
    await new Promise(done=>server.listen(0,'127.0.0.1',done))
    browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version()
    const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>report.errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await expect(page.getByRole('heading',{name:'Chrome deletion target',exact:true})).toBeVisible()
    await page.screenshot({path:join(evidence,'chrome-story-before.png'),fullPage:true})
    const forbidden=await page.evaluate(async({project,story})=>(await fetch(`/api/projects/${project}/stories/${story}/delete`,{method:'POST',headers:{Authorization:'Bearer synthetic-story-other','Content-Type':'application/json'},body:'{}'})).status,{project,story})
    h.eq(forbidden,403,'Chrome unauthorized deletion denied')
    page.on('dialog',dialog=>dialog.accept())
    const card=page.getByRole('heading',{name:'Chrome deletion target',exact:true}).locator('..').locator('..')
    await card.getByRole('button',{name:'Delete story',exact:true}).click()
    await expect(page.getByText('Deletion request accepted.',{exact:true})).toBeVisible()
    await expect(page.getByRole('heading',{name:'Chrome deletion target',exact:true})).toHaveCount(0)
    await workerTask
    h.eq(workerResult?.state,'observed_absent','Chrome accepted request reaches real media worker')
    h.eq((await h.db.query('SELECT count(*)::int n FROM publication_snapshots WHERE id=$1',[snapshot])).rows[0].n,0,'asset-only publication manifest purged')
    h.eq(await storage.rawExists(object),false,'Chrome-triggered cleanup removes actual disk file')
    h.eq(await storage.rawExists(keptObject),true,'Chrome survivor disk file intact')
    await page.reload()
    await expect(page.getByRole('heading',{name:'Chrome survivor',exact:true})).toBeVisible()
    await expect(page.getByRole('heading',{name:'Chrome deletion target',exact:true})).toHaveCount(0)
    h.eq((await h.db.query('SELECT content,transcript,status FROM stories WHERE id=$1',[story])).rows[0],{content:null,transcript:null,status:'deleted'},'actual UI deletion clears database content')
    const listed=await page.evaluate(async project=>(await(await fetch(`/api/projects/${project}/stories`)).json()).stories.map(s=>s.id),project)
    h.eq(listed.includes(story),false,'service-backed list excludes tombstone after reload')
    h.eq(listed.includes(kept),true,'service-backed list preserves survivor')
    await page.screenshot({path:join(evidence,'chrome-story-after.png'),fullPage:true})
    h.eq(report.errors,[],'Chrome flow has no page or server errors')
    report.status='passed';h.report.storyDeletionChrome=report
  }finally{await workerTask;await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));await storage.close();await db.close();delete globalThis.__g1StoryAdmin;if(prior===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=prior}
}
