import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { root } from '../pg17-routines/runtime.mjs'
import { compileModule } from '../g1-local/compile-module.mjs'
import { buildBrowser } from '../recording-flow-browser/build.mjs'
const require=createRequire(import.meta.url), {createClient}=require('@supabase/supabase-js'), {NextRequest}=require('next/server')
const RPC={tick_hosting_reminders:['p_limit','p_email_enabled'],claim_hosting_reminder_email:[],begin_hosting_reminder_email:['p_id','p_token'],complete_hosting_reminder_email:['p_id','p_token','p_status','p_receipt']}
const json=(res,value,status=200,headers={})=>{res.writeHead(status,{'content-type':'application/json',...headers});res.end(JSON.stringify(value))}
const body=async req=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString()||'{}')}
export async function hostingReminderHttp({h,source,evidence}) {
 const user=randomUUID(),other=randomUUID(),key='synthetic-reminder-service',proof=join(evidence,'hosting-reminder-http')
 await mkdir(proof,{recursive:true});await h.db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$3,now()),($2,$4,now())',[user,other,'http-reminder@example.invalid','http-other@example.invalid'])
 async function order(days) {
  const project=randomUUID(),id=randomUUID()
  await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'Sensitive synthetic family name',user])
  await h.db.query("INSERT INTO payment_orders(id,payer_id,package_id,amount_cents,currency,mode,status) VALUES($1,$2,'digital_project_59',5900,'usd','test','paid')",[id,user])
  await h.db.query("INSERT INTO payment_project_rights(order_id,payer_id,project_id,status,hosting_started_at,hosting_expires_at) VALUES($1,$2,$3,'active',now()-interval '1 year',now()+make_interval(days=>$4))",[id,user,project,days])
  return {id,project}
 }
 const report={status:'running',rpc:[],provider:[],browserErrors:[],boundary:'Actual worker, notification routes/page/hook/client and Supabase SDK over controlled local HTTP to real PG roles; synthetic verified Auth identity and Resend transport. No real email, inbox receipt or hosted PostgREST claim.'};h.report.hostingReminderHttp=report
 const transport=createServer(async(req,res)=>{
  let client
  try {
   const url=new URL(req.url,'http://localhost'),actor=req.headers.authorization?.replace('Bearer ',''),service=actor===key
   if(!service&&![user,other].includes(actor))return json(res,{error:'synthetic authentication required'},401)
   client=await h.actorClient(service?'service_role':'authenticated',service?null:actor)
   if(url.pathname.startsWith('/rest/v1/rpc/')) {
    const name=url.pathname.split('/').at(-1),names=RPC[name],args=await body(req)
    if(!service||!names||Object.keys(args).length!==names.length)throw Error('unsupported rpc')
    const values=names.map(n=>args[n]);const result=await client.query(`SELECT public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) r`,values)
    report.rpc.push(name);return json(res,result.rows[0].r)
   }
   if(url.pathname!=='/rest/v1/notifications')throw Error('unsupported table')
   const vals=[],where=[],bind=v=>{vals.push(v);return '$'+vals.length}
   for(const[k,v]of url.searchParams){
    if(['select','order','limit'].includes(k))continue
    if(!['recipient_id','id','is_read'].includes(k))throw Error('unsupported column')
    if(v.startsWith('eq.'))where.push(`${k}=${bind(v.slice(3))}`)
    else if(k==='id'&&v.startsWith('in.(')&&v.endsWith(')'))where.push(`id=ANY(${bind(v.slice(4,-1).split(','))}::uuid[])`)
    else throw Error('unsupported filter')
   }
   const condition=where.length?' WHERE '+where.join(' AND '):''
   if(req.method==='HEAD'){const result=await client.query('SELECT count(*)::int n FROM notifications'+condition,vals);res.writeHead(200,{'content-range':'0-0/'+result.rows[0].n});res.end();return}
   if(req.method==='GET'){
    const limit=Number(url.searchParams.get('limit')||100);if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('bad limit')
    const result=await client.query('SELECT * FROM notifications'+condition+' ORDER BY created_at DESC LIMIT '+limit,vals);return json(res,result.rows)
   }
   if(req.method==='PATCH'){
    const data=await body(req);h.eq(data.is_read,true,'HTTP mark read intent')
    const stamp=bind(data.read_at);const result=await client.query('UPDATE notifications SET is_read=true,read_at='+stamp+condition+' RETURNING id',vals);return json(res,result.rows)
   }
   if(req.method==='DELETE'){await client.query('DELETE FROM notifications'+condition,vals);res.writeHead(204);res.end();return}
   throw Error('unsupported method')
  }catch(error){json(res,{code:error.code||'FIXTURE',message:error.message},500)}finally{if(client)await h.close(client)}
 })
 await new Promise(r=>transport.listen(0,'127.0.0.1',r));const rest=`http://127.0.0.1:${transport.address().port}`
 const client=actor=>createClient(rest,key,{global:{headers:{Authorization:'Bearer '+actor}},auth:{persistSession:false,autoRefreshToken:false}}),admin=client(key)
 const compiled=join(h.scratch,'hosting-reminders-compiled'),seam=join(h.scratch,'hosting-reminders-auth.cjs')
 globalThis.__hostingReminderAuth=async req=>{const actor=req.headers.get('authorization')?.replace('Bearer ','');return [user,other].includes(actor)?{ok:true,user:{id:actor},client:client(actor)}:{ok:false,response:Response.json({error:'Unauthorized'},{status:401})}}
 await writeFile(seam,'exports.getAuthenticatedClient=req=>globalThis.__hostingReminderAuth(req);')
 const worker=await compileModule('lib/server/hosting-reminders.ts',compiled,source),routes=await compileModule('app/api/notifications/route.ts',compiled,source,{'@/lib/server/authenticated-client':seam}),unread=await compileModule('app/api/notifications/unread-count/route.ts',compiled,source,{'@/lib/server/authenticated-client':seam})
 let mode='success'
 const provider=createServer(async(req,res)=>{
  const payload=await body(req);report.provider.push({path:req.url,method:req.method,key:req.headers['idempotency-key'],payload})
  h.eq(req.headers.authorization,'Bearer synthetic-resend-key','provider authentication header')
  if(mode==='unknown'){req.socket.destroy();return}
  if(mode==='failed')return json(res,{message:'Invalid recipient'},422)
  json(res,{id:'synthetic-provider-'+report.provider.length})
 });await new Promise(r=>provider.listen(0,'127.0.0.1',r));const providerOrigin=`http://127.0.0.1:${provider.address().port}`
 const fetcher=(url,init)=>{h.eq(url,'https://api.resend.com/emails','actual production Resend endpoint selected');return fetch(providerOrigin+'/emails',init)}
 const config=worker.readHostingReminderConfig({HOSTING_REMINDER_EMAIL_ENABLED:'true',HOSTING_REMINDER_EMAIL_FROM:'sender@example.invalid',RESEND_API_KEY:'synthetic-resend-key',HOSTING_REMINDER_WEB_ORIGIN:'https://synthetic-app.invalid'})
 let browser,app
 try {
  const first=await order(22);const initial=await worker.runHostingReminderWorkerOnce({admin,config,fetch:fetcher});h.eq(initial,{inAppSent:1,emailAccepted:1,emailUnknown:0,emailFailed:0},'actual SDK worker stores station and provider receipt')
  const notice=(await h.db.query('SELECT * FROM notifications WHERE recipient_id=$1',[user])).rows[0]
  h.eq(report.provider[0].payload.to,['http-reminder@example.invalid'],'only verified synthetic recipient')
  h.ok(!JSON.stringify(report.provider).includes('Sensitive synthetic family'),'no project prose sent to email provider')
  h.eq(report.provider[0].key,'hosting-reminder/'+notice.data.hosting_reminder_id,'stable provider idempotency')
  h.eq((await worker.runHostingReminderWorkerOnce({admin,config,fetch:fetcher})).emailAccepted,0,'actual SDK repeated pass never resends')
  const listReq=actor=>new NextRequest('http://localhost/api/notifications',{headers:{authorization:'Bearer '+actor}})
  const formatted=await(await routes.GET(listReq(user))).json();h.eq(formatted[0].notification_type,'hosting_expiry','production API maps persisted type');h.eq(formatted[0].project_id,first.project,'production API maps hosting project identity')
  h.eq(await(await routes.GET(listReq(other))).json(),[],'actual route and authenticated RLS deny other family')
  h.eq((await routes.GET(new NextRequest('http://localhost/api/notifications'))).status,401,'unauthenticated notifications rejected')
  if(process.argv.includes('--chrome')) {
   const build=await buildBrowser(h.scratch,{entry:join(root,'experiments/pg17-hosting-reminders/entry.tsx'),boundary:join(root,'experiments/pg17-hosting-reminders/boundaries.tsx'),alias:{'@saga/shared$':join(root,'packages/shared/src/lib/notifications.ts')},content:[join(root,'packages/web/src/components/notifications/**/*.tsx'),join(root,'packages/web/src/app/*/dashboard/notifications/*.tsx'),{raw:'<div class="opacity-0"></div>',extension:'html'}]})
   for(const file of build.dependencies)await source(relative(root,file))
   for(const file of ['packages/web/src/styles/design-tokens.css','packages/web/src/styles/accessibility.css'])await source(file)
   app=createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost')
    if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notifications</title><link rel="stylesheet" href="/flow.css"><div id="root"></div><script>window.reminderConfig=${JSON.stringify({user})}</script><script src="/flow.js"></script></html>`);return}
    if(url.pathname==='/flow.js'){res.setHeader('content-type','text/javascript');res.end(build.bundle);return}
    if(url.pathname==='/flow.css'){res.setHeader('content-type','text/css');res.end(build.css);return}
    if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return}
    if(url.pathname.startsWith('/en/dashboard/projects/')){res.writeHead(200,{'content-type':'text/html'});res.end('<h1>Project navigation boundary</h1>');return}
    const chunks=[];for await(const chunk of req)chunks.push(chunk)
    const request=new NextRequest('http://localhost'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})})
    const response=url.pathname.endsWith('/unread-count')?await unread.GET(request):await routes[req.method](request)
    res.writeHead(response.status,{'content-type':'application/json'});res.end(await response.text())
   }catch(error){report.browserErrors.push(error.message);json(res,{error:'fixture'},500)}})
   await new Promise(r=>app.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${app.address().port}`
   const {chromium,expect}=require('@playwright/test');browser=await chromium.launch({channel:'chrome',headless:true});report.chrome=browser.version()
   const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',error=>report.browserErrors.push(error.message))
   await page.goto(origin);await expect(page.getByText('Your project hosting period ends soon',{exact:true})).toBeVisible();await expect(page.getByText('Hosting expiry',{exact:true})).toBeVisible()
   // Opacity-zero elements still satisfy Playwright's toBeVisible and click checks.
   // Verify the compiled app stylesheet is active before trusting CSS assertions.
   report.stylesheet=await page.evaluate(()=>{
    const probe=document.createElement('div');probe.className='opacity-0';document.body.append(probe)
    const opacity=getComputedStyle(probe).opacity;probe.remove()
    return {loaded:[...document.styleSheets].some(sheet=>sheet.href?.endsWith('/flow.css')),hiddenProbeOpacity:opacity}
   })
   h.eq(report.stylesheet,{loaded:true,hiddenProbeOpacity:'0'},'compiled Tailwind stylesheet applies real opacity rules')
   report.visualActions=[]
   const assertVisualActions=async(target,label)=>{
    const actions=target.getByRole('button',{name:/^(Mark as read|Delete notification)$/})
    await expect(actions).toHaveCount(2)
    for(const action of await actions.all()) {
     await expect(action).toHaveCSS('opacity','1')
     const visual=await action.evaluate((button,viewport)=>{
      const rect=button.getBoundingClientRect(),row=button.closest('.cursor-pointer').getBoundingClientRect();let opacity=1
      for(let node=button;node;node=node.parentElement)opacity*=Number(getComputedStyle(node).opacity)
      const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)
      return {name:button.title,opacity,width:rect.width,height:rect.height,inViewport:rect.left>=0&&rect.right<=viewport.width&&rect.top>=0&&rect.bottom<=viewport.height,insideRow:rect.left>=row.left&&rect.right<=row.right&&rect.top>=row.top&&rect.bottom<=row.bottom,hitTarget:button===hit||button.contains(hit)}
     },target.viewportSize())
     h.eq(visual.opacity,1,label+' action visibly opaque: '+visual.name)
     h.ok(visual.width>=24&&visual.height>=24&&visual.inViewport&&visual.insideRow&&visual.hitTarget,label+' action has unobscured web target inside row: '+visual.name)
     report.visualActions.push({label,...visual})
    }
    const indicator=await target.getByText('Your project hosting period ends soon',{exact:true}).evaluate(title=>{
     const row=title.closest('.cursor-pointer'),dot=row.querySelector('.absolute'),r=row.getBoundingClientRect(),d=dot.getBoundingClientRect()
     return {positionedWithinRow:dot.offsetParent===row,insideRow:d.left>=r.left&&d.right<=r.right&&d.top>=r.top&&d.bottom<=r.bottom}
    })
    h.eq(indicator,{positionedWithinRow:true,insideRow:true},label+' unread indicator belongs inside its notification row')
   }
   await assertVisualActions(page,'desktop default')
   await page.getByText('Your project hosting period ends soon',{exact:true}).hover()
   await assertVisualActions(page,'desktop hover')
   await page.mouse.move(0,0)
   // Reach both row actions with Tab, checking the actual keyboard focus ring.
   for(const name of ['Mark as read','Delete notification']) {
    const action=page.getByRole('button',{name,exact:true})
    for(let i=0;i<30&&!(await action.evaluate(button=>button===document.activeElement));i++)await page.keyboard.press('Tab')
    await expect(action).toBeFocused()
    h.ok(await action.evaluate(button=>button.matches(':focus-visible')&&getComputedStyle(button).boxShadow!=='none'),'desktop keyboard focus is visible: '+name)
    await assertVisualActions(page,'desktop keyboard '+name)
   }
   await page.screenshot({path:join(proof,'notifications-desktop.png'),fullPage:true})
   for(const width of [360,390]) {
    const touch=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),mobile=await touch.newPage()
    try {
     mobile.on('pageerror',error=>report.browserErrors.push(error.message))
     await mobile.goto(origin)
     h.eq(await mobile.evaluate(()=>({hover:matchMedia('(hover: hover)').matches,coarse:matchMedia('(pointer: coarse)').matches})),{hover:false,coarse:true},'touch input emulation '+width)
     await assertVisualActions(mobile,'touch '+width)
     await mobile.screenshot({path:join(proof,'notifications-touch-'+width+'.png')})
    }finally{await touch.close()}
   }
   const marked=page.waitForResponse(r=>r.url().endsWith('/api/notifications')&&r.request().method()==='POST')
   await page.getByRole('button',{name:'Mark as read',exact:true}).click();h.eq((await marked).status(),200,'actual visible row mark read request')
   await expect(page.getByRole('button',{name:'Mark as read',exact:true})).toHaveCount(0)
   h.eq((await h.db.query('SELECT is_read FROM notifications WHERE id=$1',[notice.id])).rows[0].is_read,true,'Chrome read action persists in database')
   // Re-seed unread state to retain the separate bulk action regression.
   await h.db.query('UPDATE notifications SET is_read=false,read_at=NULL WHERE id=$1',[notice.id]);await page.goto(origin)
   const markedAll=page.waitForResponse(r=>r.url().endsWith('/api/notifications')&&r.request().method()==='POST')
   await page.getByRole('button',{name:'Mark all read',exact:true}).click();h.eq((await markedAll).status(),200,'actual UI mark all read request')
   h.eq((await h.db.query('SELECT is_read FROM notifications WHERE id=$1',[notice.id])).rows[0].is_read,true,'Chrome bulk read action persists in database')
   await page.getByText('Your project hosting period ends soon',{exact:true}).click();await page.waitForURL(origin+'/en/dashboard/projects/'+first.project);report.navigation=page.url()
   await page.goto(origin);await page.getByRole('button',{name:'Delete notification',exact:true}).click();await expect(page.getByText('No notifications yet',{exact:true})).toBeVisible()
   h.eq((await h.db.query('SELECT count(*)::int n FROM notifications WHERE id=$1',[notice.id])).rows[0].n,0,'Chrome dismissal deletes physical notification')
   h.eq((await worker.runHostingReminderWorkerOnce({admin,config,fetch:fetcher})).inAppSent,0,'dismissal does not reset durable reminder identity')
   h.eq(report.browserErrors,[],'no notification browser errors')
  }
  const uncertain=await order(18);mode='unknown';h.eq((await worker.runHostingReminderWorkerOnce({admin,config,fetch:fetcher})).emailUnknown,1,'lost provider response recorded unknown through actual SDK')
  const count=report.provider.length;await h.db.query("UPDATE hosting_reminders SET created_at=now()-interval '2 days' WHERE order_id=$1",[uncertain.id]);await worker.runHostingReminderWorkerOnce({admin,config,fetch:fetcher});h.eq(report.provider.length,count,'provider 24h idempotency expiry cannot trigger unknown resend')
  await order(17);mode='failed';h.eq((await worker.runHostingReminderWorkerOnce({admin,config,fetch:fetcher})).emailFailed,1,'definite provider rejection recorded failed')
  report.status='passed'
 } finally {
  await browser?.close();if(app){app.closeAllConnections();await new Promise(r=>app.close(r))}
  provider.closeAllConnections();await new Promise(r=>provider.close(r));transport.closeAllConnections();await new Promise(r=>transport.close(r));delete globalThis.__hostingReminderAuth
  await writeFile(join(proof,'results.json'),JSON.stringify(report,null,2))
 }
}
