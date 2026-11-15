import {createServer} from 'node:http'
import {writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {compileModule} from '../g1-local/compile-module.mjs'
import {fresh,USER,OTHER,PROJECT} from './fixture.mjs'
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test'),{NextRequest}=require('next/server')
export async function chromeAcceptance(h,service,prepare,source,directory,integrated) {
  const f=await fresh(h,service,prepare),objects=(await h.db.query('SELECT bucket,object_key AS "objectKey" FROM media_assets WHERE id=$1 UNION SELECT bucket,object_key FROM recording_chunks WHERE session_id=$2',[f.assetId,f.sessionId])).rows
  for(const o of objects)await integrated.storage.put(o)
  const boundary=join(h.scratch,'deletion-boundary.cjs')
  globalThis.__g1DeleteAdmin=integrated.db.admin
  await writeFile(boundary,`const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});
exports.getSupabaseAdmin=()=>globalThis.__g1DeleteAdmin;
exports.getAuthenticatedUser=async req=>{const token=req.headers.get('authorization');const id=token==='Bearer local-owner'?'${OTHER}':token==='Bearer local-storyteller'?'${USER}':null;return id?{ok:true,user:{id},headers:new Headers()}:{ok:false,response:NextResponse.json({error:'Local account required'},{status:401})}};`)
  const boundaries={'@/lib/supabase':boundary,'@/lib/server/auth':boundary}
  const deletion=await compileModule('app/api/media/delete-request/route.ts',join(h.scratch,'chrome-delete'),source,boundaries)
  const playback=await compileModule('app/api/media/assets/[assetId]/play/route.ts',join(h.scratch,'chrome-play'),source,boundaries)
  const prior=process.env.MEDIA_ASSETS_ENABLED;process.env.MEDIA_ASSETS_ENABLED='true'
  let requestId,workerError,browser,pending
  const report={requests:[],boundary:'Local test UI; actual request/play routes, SQL and deletion worker. Synthetic auth and declared PostgREST/Storage transport adapters.'}
  const server=createServer(async(req,res)=>{
    try {
      if(req.url==='/') {res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="zh"><meta charset="utf-8"><title>G1 删除验收</title><body><h1>本地 G1 删除验收</h1><p>合成账号 · 真实 PostgreSQL 与文件读写</p><button id="delete">删除测试录音</button><p id="receipt">等待操作</p><p id="state"></p><button id="play">检查已删除录音</button><p id="playback"></p><script>
const headers={'Authorization':'Bearer local-owner','Content-Type':'application/json'};
document.querySelector('#delete').onclick=async()=>{const r=await fetch('/api/media/delete-request',{method:'POST',headers,body:JSON.stringify({projectId:'${PROJECT}',storyId:'${f.storyId}'})});document.querySelector('#receipt').textContent='请求状态 '+r.status;const timer=setInterval(async()=>{const r=await fetch('/test/state');const data=await r.json();document.querySelector('#state').textContent=data.state||'处理中';if(data.state==='observed_absent'||data.error)clearInterval(timer)},100)};
document.querySelector('#play').onclick=async()=>{const r=await fetch('/api/media/assets/${f.assetId}/play',{headers});document.querySelector('#playback').textContent='回放状态 '+r.status};</script></body></html>`);return}
      if(req.url==='/test/state'){const row=requestId?(await h.db.query('SELECT state FROM media_deletion_executions WHERE request_id=$1',[requestId])).rows[0]:{};res.setHeader('content-type','application/json');res.end(JSON.stringify({...row,error:workerError}));return}
      const buffers=[];for await(const b of req)buffers.push(b)
      const request=new NextRequest('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(buffers)}:{})})
      const response=req.method==='POST'?await deletion.POST(request):await playback.GET(request,{params:Promise.resolve({assetId:f.assetId})})
      const bytes=Buffer.from(await response.arrayBuffer());report.requests.push({path:req.url,status:response.status})
      response.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(response.status);res.end(bytes)
      if(response.status===202){requestId=JSON.parse(bytes).deletionRequest.id;pending=integrated.worker.runMediaDeletion(requestId,integrated.options).catch(()=>{workerError='worker failed'})}
    }catch(e){report.error=e.message;res.writeHead(500);res.end('test adapter failure')}
  })
  try {
    await new Promise(done=>server.listen(0,'127.0.0.1',done))
    browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version()
    const page=await browser.newPage({viewport:{width:1152,height:800}})
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const forbidden=await page.evaluate(async data=>(await fetch('/api/media/delete-request',{method:'POST',headers:{Authorization:'Bearer local-storyteller','Content-Type':'application/json'},body:JSON.stringify(data)})).status,{projectId:PROJECT,storyId:f.storyId})
    h.eq(forbidden,403,'Chrome storyteller cannot delete owner-controlled asset')
    await page.getByRole('button',{name:'删除测试录音'}).click()
    await expect(page.locator('#receipt')).toHaveText('请求状态 202')
    await expect(page.locator('#state')).toHaveText('observed_absent',{timeout:30000})
    await page.getByRole('button',{name:'检查已删除录音'}).click()
    await expect(page.locator('#playback')).toHaveText('回放状态 409')
    await page.screenshot({path:join(directory,'chrome-deletion.png'),fullPage:true})
    for(const o of objects)h.eq(await integrated.storage.rawExists(o),false,'Chrome-triggered deletion removed disk bytes')
    for(const o of integrated.kept.objects)h.eq(await integrated.storage.rawExists(o),true,'Chrome deletion preserves another story')
    h.eq(workerError,undefined,'Chrome worker completed normally')
    report.requestId=requestId;report.status='passed';h.report.chrome=report
  }finally{await pending;await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));delete globalThis.__g1DeleteAdmin;if(prior===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=prior}
}
