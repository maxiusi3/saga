import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {join,relative} from 'node:path'
import {writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {root} from '../pg17-routines/runtime.mjs'
import {buildBrowser} from '../recording-flow-browser/build.mjs'
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test'),{NextRequest}=require('next/server')
export async function paymentChrome({h,source,evidence,payer,create,status,allocate,emit,intents,charges}){
 await source('experiments/pg17-g3-delivery/payment-chrome.mjs')
 const build=await buildBrowser(h.scratch,{entry:join(root,'experiments/pg17-g3-delivery/payment-entry.tsx'),boundary:join(root,'experiments/pg17-g3-delivery/payment-boundaries.tsx'),content:[join(root,'packages/web/src/components/purchase/**/*.tsx')]})
 for(const file of build.dependencies)await source(relative(root,file))
 const report={status:'running',requests:[],errors:[],boundary:'Actual PurchasePanel, payment client, routes and Stripe SDK. Controlled loopback Stripe events; no Stripe.js/card network loaded or real charge. Installed desktop Chrome.'}
 const server=createServer(async(req,res)=>{try{
  if(req.url==='/'){res.setHeader('content-type','text/html');res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/flow.css"><div id="root"></div><script>window.paymentConfig=${JSON.stringify({payer})}</script><script src="/flow.js"></script></html>`);return}
  if(req.url==='/flow.js'||req.url==='/flow.css'){res.setHeader('content-type',req.url.endsWith('js')?'text/javascript':'text/css');res.end(req.url.endsWith('js')?build.bundle:build.css);return}
  const bytes=[];for await(const b of req)bytes.push(b)
  const r=new NextRequest('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(bytes)}:{})})
  const response=req.url==='/api/payments/create-intent'?await create.POST(r):req.url==='/api/payments/allocate'?await allocate.POST(r):req.url.startsWith('/api/payments/status?')?await status.GET(r):Response.json({error:'Not found'},{status:404})
  report.requests.push({path:req.url,method:req.method,status:response.status});res.writeHead(response.status,{'content-type':'application/json'});res.end(Buffer.from(await response.arrayBuffer()))
 }catch(e){report.errors.push(e.message);res.writeHead(500);res.end('local failure')}})
 let browser
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version()
  const page=await browser.newPage({viewport:{width:1100,height:900}});page.on('pageerror',e=>report.errors.push(e.message))
  await page.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'?route.continue():route.abort()})
  await page.goto('http://127.0.0.1:'+server.address().port)
  await expect(page.getByText('US$59',{exact:true})).toBeVisible();await expect(page.getByText('12 months of hosting',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Start test purchase',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Payment status: awaiting_payment')
  const order=(await h.db.query("SELECT * FROM payment_orders WHERE payer_id=$1 AND status='awaiting_payment'",[payer])).rows[0],intent=intents.get(order.intent_id)
  await page.reload();await expect(page.getByRole('status')).toHaveText('Payment status: awaiting_payment')
  await page.getByRole('button',{name:'Retry same purchase',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Payment status: awaiting_payment')
  h.eq((await h.db.query("SELECT count(*)::int n FROM payment_orders WHERE payer_id=$1 AND status='awaiting_payment'",[payer])).rows[0].n,1,'Chrome reload and retry retain one order')
  intent.status='succeeded';intent.amount_received=5900;intent.latest_charge='ch_'+randomUUID().replaceAll('-','');h.eq((await emit(intent)).status,200,'signed event changes browser order')
  await page.getByRole('button',{name:'Refresh order status',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Payment status: paid')
  await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Chrome purchased family');await page.getByRole('button',{name:'Use purchase for this project',exact:true}).click();await expect(page.getByRole('link',{name:'Open purchased project'})).toBeVisible()
  const right=(await h.db.query('SELECT * FROM payment_project_rights WHERE order_id=$1',[order.id])).rows[0]
  h.ok(right.project_id&&right.hosting_expires_at,'Chrome purchase allocated usable project with fixed dates')
  await page.reload();await expect(page.getByRole('link',{name:'Open purchased project'})).toBeVisible()
  await page.screenshot({path:join(evidence,'payment-chrome-paid.png'),fullPage:true})
  const charge={id:intent.latest_charge,object:'charge',livemode:false,payment_intent:intent.id,amount:5900,currency:'usd',paid:true,amount_refunded:5900,refunded:true};charges.set(charge.id,charge);h.eq((await emit(charge,'charge.refunded')).status,200,'signed refund from controlled Stripe')
  await page.getByRole('button',{name:'Refresh order status',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Payment status: refunded')
  await page.setViewportSize({width:390,height:844});h.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'purchase fits mobile width');await page.screenshot({path:join(evidence,'payment-chrome-refunded-mobile.png'),fullPage:true})
  h.eq(report.errors,[],'payment browser no errors');report.status='passed';h.report.paymentChrome=report
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile(join(evidence,'payment-chrome.json'),JSON.stringify(report,null,2))}
}
