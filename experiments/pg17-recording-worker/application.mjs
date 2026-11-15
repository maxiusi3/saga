import { createRequire } from 'node:module'
import { once } from 'node:events'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { digest } from '../pg17-routines/runtime.mjs'
import { USER, PROJECT, fixture, rpc, state, compileModules } from './fixture.mjs'

const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
const childProcess = require('node:child_process')
const SECRET = 'synthetic-local-worker-no-real-permission'

export async function applicationScenarios(h, source) {
  const modules = await compileModules(h, source, true)
  const executable = process.env.SAGA_FFMPEG_PATH
  h.ok(executable && isAbsolute(executable), 'SAGA_FFMPEG_PATH supplies explicit native executable')
  const run = args => {
    const out=childProcess.spawnSync(executable,args,{encoding:'utf8',timeout:15000,maxBuffer:1024*1024})
    h.eq(out.status,0,'real native FFmpeg command succeeds')
    return out.stdout
  }
  h.report.audioRuntime = { executable, sha256:digest(await readFile(executable)),version:run(['-version']).split('\n')[0],
    supabaseJs:require('@supabase/supabase-js/package.json').version }
  const file=join(h.scratch,'synthetic.webm')
  run(['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=2','-c:a','libopus','-f','webm',file])
  const bytes=await readFile(file), tempRoot=join(h.scratch,'attempts')
  await mkdir(tempRoot)
  const service=await h.actorClient('service_role',USER)
  const tables=new Set(['processing_jobs','media_assets','recording_sessions','recording_chunks','projects','project_roles','stories','deletion_requests'])
  const columns=new Map()
  for(const table of tables) columns.set(table,new Set((await h.db.query(`SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped`,[table])).rows.map(row=>row.attname)))
  const requests=h.report.applicationRequests=[], decoders=h.report.nativeDecoders=[], pending=new Set(), nativeChildren=new Set()
  const nativeSpawn=childProcess.spawn
  let current
  childProcess.spawn=function(...args){
    h.eq(args[0],executable,'verifier invokes configured actual native FFmpeg')
    const child=nativeSpawn.apply(this,args)
    const event={pid:child.pid,case:current.name,executable:args[0],args:args[1],pcmBytes:0,code:null,signal:null,closed:false}
    decoders.push(event);nativeChildren.add(child)
    child.stdout.on('data',part=>{event.pcmBytes+=part.length})
    child.once('close',(code,signal)=>{Object.assign(event,{code,signal,closed:true});nativeChildren.delete(child)})
    return child
  }
  const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}})
  function track(work){pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));return work}
  const transport=(input,init)=>track((async()=>{
    const request=new Request(input,init),url=new URL(request.url)
    h.eq(url.origin,'https://fixture.invalid','fixture transport refuses any remote host')
    const event={case:current.name,method:request.method,path:url.pathname,kind:'query',action:null,committed:false,aborted:false,finished:false}
    requests.push(event)
    try {
      request.signal.throwIfAborted()
      h.eq(request.headers.get('authorization'),`Bearer ${SECRET}`,'actual Supabase client supplies synthetic service bearer')
      if(url.pathname.startsWith('/storage/v1/object/')){
        event.kind='storage';h.eq(request.method,'GET','worker performs no Storage writes')
        const key=decodeURIComponent(url.pathname.slice('/storage/v1/object/audio-recordings/'.length))
        h.ok(current.f.objects.has(key),'Storage reads only actual sealed fixture key')
        current.storageCount++
        if(current.onStorage && current.storageCount===1) await current.onStorage()
        await delay(current.storageDelayMs,undefined,{signal:request.signal})
        event.bytes=current.f.objects.get(key).length
        return new Response(current.f.objects.get(key),{headers:{'content-type':current.f.mimeType,'content-length':String(event.bytes)}})
      }
      const client=await h.actorClient('service_role',USER)
      const abort=()=>client.connection?.stream?.destroy(new Error('Synthetic request aborted'))
      request.signal.addEventListener('abort',abort,{once:true})
      try {
        request.signal.throwIfAborted()
        if(url.pathname==='/rest/v1/rpc/recording_job_lease'){
          event.kind='rpc';h.eq(request.method,'POST','only lease RPC can mutate through transport')
          const body=await request.json()
          h.eq(Object.keys(body).sort(),['p_job_id','p_action','p_worker_id','p_attempt','p_lease_ms'].sort(),'five exact RPC arguments')
          event.action=body.p_action
          const receipt=await rpc(client,body.p_job_id,body.p_action,body.p_worker_id,body.p_attempt,body.p_lease_ms)
          event.committed=true;event.receiptState=receipt.state
          if(current.delayAction===body.p_action){event.responseDelayed=true;await delay(current.rpcResponseDelayMs,undefined,{signal:request.signal})}
          return json(receipt)
        }
        h.eq(request.method,'GET','non-RPC database route read-only')
        const table=url.pathname.slice('/rest/v1/'.length)
        h.ok(tables.has(table),'query table is explicitly allowlisted')
        const params=[],where=[]
        const quote=name=>{h.ok(columns.get(table).has(name),'query column allowlisted');return `"${name}"`}
        for(const [key,value] of url.searchParams){
          if(['select','order','limit','offset'].includes(key))continue
          const col=quote(key)
          if(value.startsWith('eq.')){params.push(value.slice(3));where.push(`${col}=$${params.length}`)}
          else if(value.startsWith('cs.')){params.push(value.slice(3));where.push(`${col} @> $${params.length}::jsonb`)}
          else if(value.startsWith('in.(')&&value.endsWith(')')){params.push(value.slice(4,-1).split(','));where.push(`${col}::text=ANY($${params.length}::text[])`)}
          else if(value==='not.is.null')where.push(`${col} IS NOT NULL`)
          else throw new Error('Unsupported fixture filter')
        }
        const clause=where.length?` WHERE ${where.join(' AND ')}`:''
        const total=Number((await client.query(`SELECT count(*) AS n FROM public.${table}${clause}`,params)).rows[0].n)
        const select=url.searchParams.get('select')??'*',projection=select==='*'?'*':select.split(',').map(quote).join(',')
        const order=url.searchParams.get('order')
        h.ok(!order||order==='chunk_index.asc','only explicit chunk order supported')
        const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000)
        h.ok(Number.isSafeInteger(offset)&&offset>=0&&Number.isSafeInteger(limit)&&limit>0&&limit<=2001,'safe pagination bounds')
        params.push(limit,offset)
        const result=await client.query(`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') AS rows FROM
          (SELECT ${projection} FROM public.${table}${clause}${order?' ORDER BY chunk_index ASC':''} LIMIT $${params.length-1} OFFSET $${params.length}) t`,params)
        const rows=result.rows[0].rows
        return json(rows,200,{'content-range':rows.length?`${offset}-${offset+rows.length-1}/${total}`:`*/${total}`})
      } finally {request.signal.removeEventListener('abort',abort);await h.close(client)}
    } catch(error){
      if(request.signal.aborted){event.aborted=true;throw new DOMException('Synthetic aborted transport','AbortError')}
      if(/^[A-Z0-9]{5}$/.test(error.code??'')){event.sqlstate=error.code;return json({code:error.code,message:'SECRET synthetic PG provider body'},409)}
      event.fixtureFailure=error.label??error.message
      throw error
    } finally {event.finished=true}
  })())
  const admin=createClient('https://fixture.invalid',SECRET,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}})
  async function execute(name,configuration={}){
    const f=await fixture(h,service,modules.prepareRecordingSessionSeal,bytes)
    current={name,f,storageDelayMs:450,storageCount:0,rpcResponseDelayMs:500,...configuration}
    const first=requests.length,firstDecoder=decoders.length,started=performance.now()
    let result,error
    try{result=await modules.verifyLeasedRecordingJobInput(f.jobId,{admin,storageUrl:'https://fixture.invalid',serviceRoleKey:SECRET,
      ffmpeg:{executable,timeoutMs:10000,maxDurationMs:5000},tempRoot,fetch:transport,ioTimeoutMs:3000,
      workerId:'application-worker',leaseMs:1000,heartbeatMs:150,rpcTimeoutMs:configuration.rpcTimeoutMs??400})}
    catch(caught){error=caught}
    await Promise.allSettled([...pending])
    const afterReturn=requests.length
    await delay(350)
    h.eq(requests.length,afterReturn,'no heartbeat or transport restarts after application return')
    const observed=requests.slice(first), decoded=decoders.slice(firstDecoder), persisted=await state(h,f.jobId)
    h.eq(await readdir(tempRoot),[],'real application removes all attempt temporary files')
    h.eq(nativeChildren.size,0,'no decoder survives application return')
    h.eq(pending.size,0,'all injected transport work settles before verification assertion')
    h.eq(observed.every(row=>row.finished),true,'all query/RPC/Storage requests settle')
    h.eq(observed.filter(row=>row.method!=='GET'&&row.kind!=='rpc').length,0,'no output upload or direct table writes')
    h.eq(persisted.job.result_ref,null,'input verifier never publishes terminal result')
    const entry={name,elapsedMs:performance.now()-started,result:result?.status??null,error:error?{code:error.code??null,message:error.message}:null,
      jobState:persisted.job.state,requestCount:observed.length,heartbeats:observed.filter(row=>row.action==='heartbeat').length,
      storageReads:current.storageCount,decoders:decoded.length,abortedRequests:observed.filter(row=>row.aborted).length}
    ;(h.report.applicationCases??=[]).push(entry)
    return {f,result,error,observed,decoded,persisted,entry}
  }
  try {
    await h.scenario('Actual TS worker, PG RPC/query and native FFmpeg verify while heartbeat extends initial lease',async()=>{
      const value=await execute('real-pg-native-audio-success')
      if(value.error)throw value.error
      h.eq(value.result.status,'input_verified','actual application reports only input verified')
      h.eq(value.result.canClearLocalDrafts,false,'local draft cleanup remains forbidden')
      h.eq(value.persisted.job.state,'running','input-only worker leaves running state for later publication slice')
      h.eq(value.entry.decoders,1,'actual native decoder invoked once')
      h.ok(value.entry.elapsedMs>1000&&value.entry.heartbeats>=3,'verification spans initial TTL under real renewals')
      h.eq(value.decoded[0].code,0,'real FFmpeg exits successfully')
      h.ok(value.decoded[0].pcmBytes>0,'native decoder emits real PCM bytes')
      h.eq(value.result.completion.outputSha256,digest(bytes),'original synthetic bytes hash preserved through app')
      h.eq(value.result.completion.outputByteSize,bytes.length,'original source bytes count preserved')
      h.eq(value.observed.slice(0,2).map(row=>row.action),['claim','start'],'durable claim and start precede verifier I/O')
      h.eq(value.observed.at(-1).action,'check','worker checks final live fence before return')
      h.report.audioFixture={sha256:digest(bytes),byteSize:bytes.length,manifest:value.f.manifest,manifestSha256:value.f.manifestSha256}
    })
    await h.scenario('Actual permission revocation during owned Storage I/O aborts worker and permits cancellation recovery',async()=>{
      const value=await execute('real-pg-role-revoked-during-io',{storageDelayMs:1200,onStorage:async()=>{
        await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2",[PROJECT,USER])
      }})
      h.ok(value.error,'revoked worker never returns successful input')
      h.eq(/SECRET|synthetic-local|projects\//.test(value.error.message),false,'revocation error reveals no provider body or source path')
      h.eq(value.result,undefined,'no success receipt after revocation')
      h.ok(value.entry.abortedRequests>=1,'heartbeat rejection actively aborts owned Storage transport')
      h.eq(value.entry.decoders,0,'revocation before bytes prevents native dispatch')
      h.eq((await rpc(service,value.f.jobId,'recover')).state,'cancelled','real supervisor cancels revoked job')
      await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2",[PROJECT,USER])
    })
    await h.scenario('Heartbeat SQL commits but response times out: no retry, owned I/O aborted, unknown recovery',async()=>{
      const value=await execute('real-pg-heartbeat-unknown-commit',{storageDelayMs:1200,rpcTimeoutMs:80,
        onStorage:async()=>{current.delayAction='heartbeat'}})
      h.ok(value.error,'unknown renewal commit cannot return input success')
      h.eq(/SECRET|synthetic-local|projects\//.test(value.error.message),false,'unknown heartbeat error remains redacted')
      const delayed=value.observed.filter(row=>row.action==='heartbeat'&&row.responseDelayed)
      h.eq(delayed.length,1,'timed-out heartbeat is not retried')
      h.eq(delayed[0].committed,true,'real SQL heartbeat committed before abandoned response')
      h.eq(value.observed.slice(value.observed.indexOf(delayed[0])+1).filter(row=>row.action==='heartbeat').length,0,'no later heartbeat after uncertain commit')
      h.ok(value.entry.abortedRequests>=2,'RPC deadline aborts response and owned Storage transport')
      h.eq(value.observed.some(row=>row.kind==='storage'&&row.aborted),true,'actual in-flight Storage request is aborted by heartbeat timeout')
      const wait=Date.parse(value.persisted.job.lease_expires_at)-Date.now();await delay(Math.max(0,wait)+100)
      h.eq((await h.db.query('SELECT lease_expires_at<clock_timestamp() AS expired FROM processing_jobs WHERE id=$1',[value.f.jobId])).rows[0].expired,true,'DB clock confirms actual running expiry')
      h.eq((await rpc(service,value.f.jobId,'recover')).state,'outcome_unknown','dispatched uncertain operation never becomes automatic retry')
    })
    await h.scenario('Claim SQL commits but response times out: never dispatch or fetch, explicit retry recovery only',async()=>{
      const value=await execute('real-pg-claim-unknown-commit',{delayAction:'claim',rpcTimeoutMs:80})
      h.ok(value.error,'unknown claim commit rejects application')
      h.eq(value.observed.map(row=>row.action),['claim'],'uncertain claim performs no start, retry or input read')
      h.eq(value.persisted.job.state,'leased','database retains committed undispatched lease')
      h.eq(value.persisted.attempts[0].dispatched_at,null,'unknown claim did not record dispatch')
      const wait=Date.parse(value.persisted.job.lease_expires_at)-Date.now();await delay(Math.max(0,wait)+100)
      h.eq((await h.db.query('SELECT lease_expires_at<clock_timestamp() AS expired FROM processing_jobs WHERE id=$1',[value.f.jobId])).rows[0].expired,true,'DB clock confirms actual undispatched expiry')
      h.eq((await rpc(service,value.f.jobId,'recover')).state,'retry_wait','undispatched uncertain claim only retries after explicit expiry recovery')
    })
  } finally {
    childProcess.spawn=nativeSpawn
    await Promise.all([...nativeChildren].map(async child=>{const closed=once(child,'close');child.kill('SIGKILL');await closed}))
    await Promise.allSettled([...pending])
    await h.close(service)
    h.report.applicationCleanup={spawnObserverRestored:childProcess.spawn===nativeSpawn,nativeChildrenRemaining:nativeChildren.size,pendingTransports:pending.size}
    h.report.limits.push('Actual compiled TypeScript and Supabase JS use a strict injected fetch router: PostgREST-shaped requests execute parameterized real PostgreSQL as service_role; Storage responses are synthetic in-process bytes, not live HTTP/TLS, PostgREST, Storage or RLS acceptance.',
      'Only sine-wave WebM/Opus was used for lease integration. Real FFmpeg is external and not deployment/OS-sandbox qualified. No real-device continuity, output publication, remote migration, paid provider or family data.')
  }
}
