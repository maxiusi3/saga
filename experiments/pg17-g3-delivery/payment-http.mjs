import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { compileModule } from '../g1-local/compile-module.mjs'
const require=createRequire(import.meta.url), Stripe=require('stripe'), {NextRequest,NextResponse}=require('next/server')
export async function paymentHttpScenarios({h,source,evidence}) {
 await source('experiments/pg17-g3-delivery/payment-http.mjs')
 const directory=join(h.scratch,'payment-http');await mkdir(directory,{recursive:true})
 const payer=randomUUID(),other=randomUUID();await h.db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$3,now()),($2,$4,now())',[payer,other,'payment-http@example.invalid','payment-http-other@example.invalid'])
 const intents=new Map(),keys=new Map(),charges=new Map(),calls=[];let loseResponses=2
 const provider=createServer(async(req,res)=>{
  const chunks=[];for await(const b of req)chunks.push(b);const params=new URLSearchParams(Buffer.concat(chunks).toString())
  const path=req.url;calls.push({method:req.method,path,key:req.headers['idempotency-key']??null})
  let value
  if(req.method==='POST'&&path==='/v1/payment_intents'){
   const key=req.headers['idempotency-key'];let id=keys.get(key)
   if(!id){id='pi_'+randomUUID().replaceAll('-','');keys.set(key,id);intents.set(id,{id,object:'payment_intent',livemode:false,amount:Number(params.get('amount')),currency:params.get('currency'),metadata:Object.fromEntries(['orderId','payerId','packageId'].map(x=>[x,params.get('metadata['+x+']')])),status:'requires_payment_method',amount_received:0,client_secret:id+'_secret_synthetic',latest_charge:null})}
   value=intents.get(id)
   if(loseResponses>0){loseResponses--;req.socket.destroy();return}
  }else if(path.startsWith('/v1/payment_intents/'))value=intents.get(path.split('/').at(-1))
  else if(path.startsWith('/v1/charges/'))value=charges.get(path.split('/').at(-1))
  if(!value){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'Controlled missing object'}}));return}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(value))
 });await new Promise(r=>provider.listen(0,'127.0.0.1',r));const port=provider.address().port
 const rpcNames={allocate_payment_project:['p_actor','p_order','p_project','p_name','p_description'],reserve_payment_order:['p_actor','p_request','p_package'],read_payment_order:['p_actor','p_order'],bind_payment_intent:['p_order','p_actor','p_intent'],apply_verified_payment_event:['p_order','p_event','p_type','p_intent','p_payer','p_amount','p_currency','p_live','p_hash','p_refunded']}
 globalThis.__g3PaymentAdmin={rpc:async(name,args)=>{
  if(!rpcNames[name])throw Error('Unexpected RPC '+name)
  const params=rpcNames[name].map(x=>args[x]),c=await h.actorClient('service_role',args.p_actor??args.p_payer??null)
  try{return {data:(await c.query(`SELECT public.${name}(${params.map((_,i)=>'$'+(i+1)).join(',')}) r`,params)).rows[0].r,error:null}}
  catch(e){h.report.paymentRpcLastError={code:e.code,message:e.message,where:e.where};return {data:null,error:{code:e.code}}}
  finally{await h.close(c)}
 }}
 globalThis.__g3PaymentAuth=async request=>{
  const user=request.headers.get('authorization')?.replace('Bearer ','')
  if(![payer,other].includes(user))return {ok:false,response:NextResponse.json({error:'unauthorized'},{status:401})}
  return {ok:true,user:{id:user},headers:new Headers()}
 }
 const seams={stripe:join(directory,'stripe.cjs'),'@/lib/supabase':join(directory,'db.cjs'),'@/lib/server/auth':join(directory,'auth.cjs')}
 await writeFile(seams.stripe,`const Stripe=require(${JSON.stringify(require.resolve('stripe'))});module.exports=class extends Stripe{constructor(key,config){super(key,{...config,host:'127.0.0.1',port:${port},protocol:'http'})}};`)
 await writeFile(seams['@/lib/supabase'],'exports.getSupabaseAdmin=()=>globalThis.__g3PaymentAdmin;')
 await writeFile(seams['@/lib/server/auth'],'exports.getAuthenticatedUser=(request)=>globalThis.__g3PaymentAuth(request);')
 const saved=Object.fromEntries(['PAYMENTS_MODE','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'].map(k=>[k,process.env[k]]))
 Object.assign(process.env,{PAYMENTS_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:'whsec_synthetic_g3'})
 try{
  const allocate=await compileModule('app/api/payments/allocate/route.ts',directory,source,seams)
  const create=await compileModule('app/api/payments/create-intent/route.ts',directory,source,seams),webhook=await compileModule('app/api/payments/webhook/route.ts',directory,source,seams),status=await compileModule('app/api/payments/status/route.ts',directory,source,seams)
  const requestId=randomUUID(),start=()=>create.POST(new NextRequest('http://localhost/api/payments/create-intent',{method:'POST',headers:{authorization:'Bearer '+payer},body:JSON.stringify({requestId,packageId:'digital_project_59',amount:1,currency:'jpy',payerId:other})}))
  const initial=await start();h.report.paymentInitial={status:initial.status,body:await initial.json(),calls};h.eq(initial.status,502,'provider accepted intent but response lost')
  const recovered=await start();h.eq(recovered.status,200,'uncertain intent recovers');const body=await recovered.json()
  h.eq(intents.size,1,'retry reused actual Stripe idempotency key');h.eq(body.amount,5900,'amount comes from authenticated catalog')
  h.eq((await (await start()).json()).id,body.id,'third retry reuses bound provider id')
  const intent=intents.get(body.id),getStatus=actor=>status.GET(new NextRequest('http://localhost/api/payments/status?orderId='+body.orderId,{headers:{authorization:'Bearer '+actor}}))
  h.eq((await getStatus(other)).status,404,'foreign payer cannot read order');h.eq((await getStatus('anonymous')).status,401,'unauthenticated status rejected')
  const emit=async(object,type='payment_intent.succeeded',id='evt_'+randomUUID().replaceAll('-',''),mutate={})=>{
   const raw=JSON.stringify({id,object:'event',type,livemode:false,data:{object},...mutate})
   const signature=Stripe.webhooks.generateTestHeaderString({payload:raw,secret:process.env.STRIPE_WEBHOOK_SECRET})
   return webhook.POST(new NextRequest('http://localhost/api/payments/webhook',{method:'POST',headers:{'stripe-signature':signature},body:raw}))
  }
  intent.status='succeeded';intent.amount_received=5900;intent.latest_charge='ch_'+randomUUID().replaceAll('-','')
  for(const changed of [{amount:1},{currency:'eur'},{metadata:{...intent.metadata,payerId:other}},{amount_received:1},{livemode:true}])h.eq((await emit({...intent,...changed})).status,changed.livemode?400:409,'signed forged event fields rejected')
  h.eq((await emit(intent,'payment_intent.succeeded','evt_mode',{livemode:true})).status,400,'signed live event rejected')
  const outputs=await Promise.all([emit({...intent},'payment_intent.succeeded','evt_same'),emit({...intent},'payment_intent.succeeded','evt_same')]);h.eq(outputs.map(x=>x.status),[200,200],'actual handler concurrent duplicate event')
  h.eq((await (await getStatus(payer)).json()).status,'paid','authenticated status requires webhook fulfillment')
  const charge={id:intent.latest_charge,object:'charge',livemode:false,payment_intent:intent.id,amount:5900,currency:'usd',paid:true,amount_refunded:5900,refunded:true};charges.set(charge.id,charge)
  h.eq((await emit({...charge,amount:1},'charge.refunded')).status,409,'refund amount exact')
  h.eq((await emit(charge,'charge.refunded')).status,200,'real signed refund handler')
  h.eq((await emit(intent)).status,200,'late success event accepted without regrant')
  h.eq((await (await getStatus(payer)).json()).status,'refunded','late success leaves refund terminal')
  h.eq((await h.db.query('SELECT storyteller_seats FROM user_resource_wallets WHERE user_id=$1',[payer])).rows[0].storyteller_seats,0,'HTTP refund removes spendable source credits')
  if(process.argv.includes('--chrome')) {const {paymentChrome}=await import('./payment-chrome.mjs');await paymentChrome({h,source,evidence,payer,create,status,allocate,webhook,emit,intents,charges})}
  h.report.paymentHttp={status:'passed',sdk:Stripe.PACKAGE_VERSION,provider:'controlled loopback HTTP',calls,orders:1}
 }finally{await new Promise(r=>provider.close(r));for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}delete globalThis.__g3PaymentAdmin;delete globalThis.__g3PaymentAuth}
}
