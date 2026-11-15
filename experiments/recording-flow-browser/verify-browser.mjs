import { createRequire } from 'node:module'
import { readFile,writeFile,mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID,createHash } from 'node:crypto'
import { platform,release } from 'node:os'
import { performance } from 'node:perf_hooks'
import { chromeOptions,createMicrophoneFile } from './chrome-options.mjs'
import { Harness,root } from '../pg17-routines/runtime.mjs'
import { setup,PROJECT } from '../pg17-recording-flow/fixture.mjs'
import { buildBrowser } from './build.mjs'
import { databaseHttp,SERVICE_KEY } from './database-http.mjs'
import { compileServer } from './compile-server.mjs'
import { browserServer } from './browser-server.mjs'
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test')
const interruptions=process.argv.includes('--interruptions')
const options=chromeOptions(process.argv.slice(2))
const evidence=join(root,'docs/research/evidence',options.chrome?'2026-11-07-g1-chrome':'2026-11-05-g1-recording-flow',(interruptions?'interrupted-browser-':'integrated-browser-')+Date.now()+'-'+randomUUID())
await mkdir(evidence,{recursive:true})
const report={status:'running',interruptions,assertions:0,actorConnections:[],sources:{},checks:[],externalRequests:[],
  requestedSeconds:options.seconds,channel:options.chrome?'chrome':'chromium',os:{platform:platform(),release:release()},
  boundary:'Actual recording page, native MediaRecorder and IndexedDB, Next route handlers, Supabase JS, PG17 and FFmpeg. Local session/auth and PostgREST/Storage adapters. Chrome mode uses native getUserMedia with a synthetic file microphone; physical microphone, mobile OS and hosted services remain untested.'}
const h=new Harness(report),sha=b=>createHash('sha256').update(b).digest('hex')
async function source(p){const bytes=await readFile(join(root,p));report.sources[p]=sha(bytes);return bytes.toString()}
const oldFlag=process.env.MEDIA_ASSETS_ENABLED
let database,compiled,fixture,browser
try{
  process.env.MEDIA_ASSETS_ENABLED='true'
  await h.start();await setup(h,source);database=await databaseHttp(h);compiled=await compileServer(h.scratch,source,database.admin)
  const ui=await buildBrowser(h.scratch)
  for(const p of ui.dependencies)report.sources[p.slice(root.length+1)]=sha(await readFile(p))
  for(const name of ['entry.tsx','boundaries.tsx','build.mjs','database-http.mjs','compile-server.mjs','browser-server.mjs','verify-browser.mjs','chrome-options.mjs'])await source('experiments/recording-flow-browser/'+name)
  let workerCursor=null
  report.workerIterations=[]
  fixture=await browserServer({h,database,compiled,ui,runWorker:async()=>{
    const result=await compiled.host.runRecordingWorkerOnce({admin:database.admin,storageUrl:'https://storage.invalid',serviceRoleKey:SERVICE_KEY,fetch:database.transport,
      cursor:workerCursor,workerId:'browser-flow-worker',ffmpeg:{executable:'/usr/local/bin/ffmpeg',timeoutMs:60000,maxDurationMs:Math.max(30000,(options.seconds+10)*1000)}})
    workerCursor=result.nextCursor
    if(result.status!=='idle')report.workerIterations.push(result)
    if(result.status==='unavailable')throw new Error('actual worker host unavailable')
  }})
  const microphone=options.chrome?await createMicrophoneFile(h.scratch):null
  browser=await chromium.launch({headless:true,...(options.chrome?{channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${microphone}`]}:{})});report.browser=browser.version()
  const context=await browser.newContext({viewport:{width:1280,height:960},...(options.chrome?{permissions:['microphone']}:{})})
  const errors=report.pageErrors=[];report.consoleErrors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)))
  await context.route('**/*',route=>{const origin=new URL(route.request().url()).origin;if(![fixture.origin,database.origin].includes(origin)){report.externalRequests.push(origin);return route.abort()}return route.continue()})
  if(!options.chrome)await context.addInitScript(()=>{
    window.__toneContexts=[]
    const NativeRecorder=window.MediaRecorder
    window.MediaRecorder=class extends NativeRecorder { constructor(...args){super(...args);window.__activeNativeRecorder=this} }
    if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{}})
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      const audio=new AudioContext(),tone=audio.createOscillator(),gain=audio.createGain(),sink=audio.createMediaStreamDestination()
      tone.frequency.value=440;gain.gain.value=.05;tone.connect(gain);gain.connect(sink);tone.start();await audio.resume();window.__toneContexts.push(audio);return sink.stream
    }})
  })
  const page=await context.newPage();page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});page.setDefaultTimeout(15000);await page.goto(fixture.origin)
  report.mediaSupport=await page.evaluate(()=>({userAgent:navigator.userAgent,nativeGetUserMedia:String(navigator.mediaDevices.getUserMedia).includes('[native code]'),formats:['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].map(type=>({type,supported:MediaRecorder.isTypeSupported(type)}))}))
  if(options.chrome)h.ok(report.mediaSupport.nativeGetUserMedia,'Chrome uses native getUserMedia')
  await page.getByRole('button',{name:/Chat Bubbles/}).click()
  await page.getByRole('button',{name:'Start Recording',exact:true}).click()
  await page.getByRole('button',{name:'Stop',exact:true}).waitFor()
  const started=performance.now();report.recordingSamples=[]
  while(performance.now()-started<options.seconds*1000){
    await page.waitForTimeout(Math.min(15000,options.seconds*1000-(performance.now()-started)))
    if(options.seconds>=60){
      const sample=await page.evaluate(async project=>{const db=window.flowFixture.recorderDB,sessions=await db.getSessionsByProject(project),s=sessions[0];return s?{sessionId:s.id,state:s.state,chunks:(await db.getChunksBySession(s.id)).length}:null},PROJECT)
      report.recordingSamples.push({elapsedMs:Math.round(performance.now()-started),...sample})
      console.log(JSON.stringify({event:'recording-progress',seconds:options.seconds,...report.recordingSamples.at(-1)}))
    }
  }
  report.elapsedRecordingMs=Math.round(performance.now()-started)
  if(interruptions){
    // Flush a real native chunk, then reload without the user completing the recording.
    // This proves interruption/recovery, not the production 60-second timeslice or device suspension.
    if(!options.chrome)await page.evaluate(()=>window.__activeNativeRecorder.requestData())
    // Chrome interruption runs wait for the application's real 60-second chunk.
    await expect.poll(()=>page.evaluate(async project=>{
      const db=window.flowFixture.recorderDB,sessions=await db.getSessionsByProject(project)
      return sessions.length?(await db.getChunksBySession(sessions[0].id)).length:0
    },PROJECT),{timeout:options.chrome?70000:15000}).toBeGreaterThan(0)
  }else{
    // At 30 minutes the production page stops automatically.
    if(await page.getByRole('button',{name:'Stop',exact:true}).isEnabled())await page.getByRole('button',{name:'Stop',exact:true}).click()
    await page.getByRole('button',{name:'Complete Recording',exact:true}).click()
    await expect(page.getByRole('button',{name:'Save to Timeline',exact:true})).toBeVisible()
  }
  const local=await page.evaluate(async project=>{
    const db=window.flowFixture.recorderDB,sessions=await db.getSessionsByProject(project),session=sessions[0],chunks=await db.getChunksBySession(session.id)
    return{id:session.id,state:session.state,mimeType:session.mimeType,count:chunks.length,bytes:chunks.reduce((n,c)=>n+c.blob.size,0)}
  },PROJECT)
  report.localRecording=local
  if(options.seconds>=60&&!interruptions)h.ok(local.count>=Math.floor(options.seconds/60),'production minute timeslice persisted expected chunk count')
  h.ok(local.count>0&&local.bytes>0,'native captured audio committed');report.checks.push(interruptions?'native active recording persists a requested chunk before interrupted reload':'native recording completes and persists before save')
  await page.reload();await page.getByRole('button',{name:/Listen \/ recover/}).first().click()
  await expect(page.getByRole('button',{name:'Continue saving',exact:true})).toBeVisible()
  report.checks.push('real page reload discovers draft with continue-saving action')
  await page.getByRole('button',{name:'Continue saving',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Review & Polish',exact:true})).toBeVisible()
  await expect(page.getByText('Listen to or download the part saved on this device. The ending may be missing if recording was interrupted. These copies have not been confirmed as saved to your project.',{exact:true})).toBeVisible()
  report.checks.push('recovery range and possibly missing ending remain visible during continued save')
  const reopen=async()=>{
    await page.reload();await page.getByRole('button',{name:/Listen \/ recover/}).first().click()
    await page.getByRole('button',{name:'Continue saving',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Review & Polish',exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'Continue saving',exact:true})).toBeVisible()
  }
  const retained=async label=>h.eq(await page.evaluate(async id=>(await window.flowFixture.recorderDB.getChunksBySession(id)).length,local.id),local.count,label)
  if(interruptions){
    fixture.controls.workerPaused=true
    await context.setOffline(true)
    await page.getByRole('button',{name:'Save to Timeline',exact:true}).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await retained('offline save retains local chunks')
    h.eq((await h.db.query('SELECT count(*)::int AS n FROM stories')).rows[0].n,0,'offline save creates no story')
    await context.setOffline(false)
    report.checks.push('offline save keeps durable intent and all local chunks')
    // Hold an auth await, then change account while the production operation is active.
    const requestsBefore=fixture.requests.filter(r=>r.path.includes('/api/recordings/')).length
    await page.evaluate(()=>window.flowFixture.useAuthStore.setState({getAccessToken:()=>new Promise(resolve=>{window.__releaseAuth=resolve})}))
    await page.getByRole('button',{name:'Continue saving',exact:true}).click()
    await expect.poll(()=>page.evaluate(()=>typeof window.__releaseAuth)).toBe('function')
    await page.evaluate(()=>{window.flowFixture.useAuthStore.setState({user:{id:'22222222-2222-4222-8222-222222222222'}});window.__releaseAuth('synthetic-flow-session')})
    await page.waitForTimeout(100)
    h.eq(fixture.requests.filter(r=>r.path.includes('/api/recordings/')).length,requestsBefore,'account change prevents post-auth recording request')
    await retained('account change retains local chunks')
    await reopen();report.checks.push('account change during auth await cancels stale save without remote write')
    for(const action of ['reserve','seal']){
      fixture.controls.dropReply=action
      await page.getByRole('button',{name:'Continue saving',exact:true}).click()
      await expect(page.getByRole('alert')).toBeVisible()
      h.eq(fixture.controls.dropReply,null,action+' reply dropped after actual commit')
      await retained(action+' lost response retains local chunks')
      h.eq((await h.db.query('SELECT count(*)::int AS n FROM stories')).rows[0].n,1,action+' loss keeps single story')
      await reopen();report.checks.push(action+' committed response lost, page reopened, same draft recovered')
    }
    await page.getByRole('button',{name:'Continue saving',exact:true}).click()
    await expect(page.getByText('Audio is waiting for processing. Your local copy is retained. Continue saving to check again.',{exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'Clear local copy',exact:true})).toHaveCount(0)
    await retained('pending processing cannot clean local chunks')
    report.checks.push('paused worker gives actionable pending state without cleanup')
    fixture.controls.workerPaused=false
    await expect.poll(async()=> (await h.db.query("SELECT count(*)::int AS n FROM processing_jobs WHERE state='succeeded'")).rows[0].n,{timeout:30000}).toBe(1)
    fixture.controls.dropReply='confirm'
    await page.getByRole('button',{name:'Continue saving',exact:true}).click()
    await expect(page.getByRole('alert')).toBeVisible()
    h.eq(fixture.controls.dropReply,null,'confirm reply dropped after actual commit')
    await expect(page.getByRole('button',{name:'Clear local copy',exact:true})).toHaveCount(0)
    await retained('lost confirmation never cleans local chunks')
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM stories WHERE status='ready'")).rows[0].n,1,'lost confirm committed one ready story')
    await reopen();report.checks.push('lost confirmation retains copy and resumes same ready story after reload')
    await page.getByRole('button',{name:'Continue saving',exact:true}).evaluate(button=>{button.click();button.click()})
  }else await page.getByRole('button',{name:'Save to Timeline',exact:true}).click()
  // The app intentionally stops polling and asks the user to continue when
  // processing takes longer. Exercise that visible action for long recordings.
  await expect.poll(async()=>{
    if(await page.getByRole('link',{name:'Open saved story',exact:true}).isVisible())return true
    const pending=page.getByText('Audio is waiting for processing. Your local copy is retained. Continue saving to check again.',{exact:true})
    const resume=page.getByRole('button',{name:'Continue saving',exact:true})
    if(await pending.isVisible()&&await resume.isEnabled()){
      await resume.click();report.checks.push('clicked visible Continue saving after processing wait')
    }
    return false
  },{timeout:120000,intervals:[1000]}).toBe(true)
  h.eq(fixture.controls.workerError,null,'worker completed without fixture error')
  h.ok(report.workerIterations.some(result=>result.status==='processed'&&result.outcome==='succeeded'),'actual worker host selected and processed queue')
  const story=(await h.db.query('SELECT id,status,audio_url FROM stories')).rows
  h.eq(story.length,1,'one story');h.eq(story[0].status,'ready','story ready after confirmed publication')
  report.checks.push('recovered draft saves through actual API, PG, worker and confirmation')
  await page.screenshot({path:join(evidence,'saved-desktop.png'),fullPage:true})
  const cloudAudio=await page.evaluate(async url=>{
    const response=await fetch(url);if(!response.ok)throw new Error('guarded playback failed')
    const buffer=await response.arrayBuffer(),audio=new AudioContext();const decoded=await audio.decodeAudioData(buffer.slice(0));await audio.close()
    return {bytes:buffer.byteLength,duration:decoded.duration}
  },story[0].audio_url)
  h.ok(cloudAudio.bytes>0&&cloudAudio.duration>1,'browser decodes saved original');report.checks.push('saved original decodes in browser')
  report.savedAudio=cloudAudio
  if(options.seconds>=60&&!interruptions)h.ok(Math.abs(cloudAudio.duration-options.seconds)<=5,'decoded duration matches real elapsed recording within five seconds')
  if(options.chrome){
    report.savedObjects=[]
    for(const [key,object]of database.objects){
      const filename=`object-${sha(Buffer.from(key)).slice(0,16)}.audio`
      await writeFile(join(evidence,filename),object.bytes)
      report.savedObjects.push({key,filename,byteSize:object.bytes.length,sha256:sha(object.bytes),mimeType:object.type})
    }
    report.databaseEvidence=(await h.db.query("SELECT jsonb_build_object('sessions',(SELECT jsonb_agg(t) FROM recording_sessions t),'chunks',(SELECT jsonb_agg(t) FROM recording_chunks t),'assets',(SELECT jsonb_agg(t) FROM media_assets t),'stories',(SELECT jsonb_agg(t) FROM stories t)) AS value")).rows[0].value
  }
  const player=page.getByLabel('Saved recording',{exact:true})
  await player.evaluate(audio=>audio.play())
  await expect.poll(()=>player.evaluate(audio=>audio.currentTime)).toBeGreaterThan(0)
  await player.evaluate(audio=>audio.pause());report.checks.push('saved recording player actually advances playback')
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.delete;let injected=false
    window.__restoreCleanup=()=>{IDBObjectStore.prototype.delete=original}
    IDBObjectStore.prototype.delete=function(...args){const request=original.apply(this,args)
      if(!injected&&this.name==='chunks'){injected=true;window.__cleanupAborted=true;const tx=this.transaction;request.addEventListener('success',()=>tx.abort(),{once:true})}
      return request
    }
  })
  await page.getByRole('button',{name:'Clear local copy',exact:true}).click()
  await expect(page.getByRole('alert')).toBeVisible()
  h.ok(await page.evaluate(()=>window.__cleanupAborted),'cleanup abort actually injected')
  h.eq(await page.evaluate(async id=>(await window.flowFixture.recorderDB.getChunksBySession(id)).length,local.id),local.count,'aborted cleanup preserves every chunk')
  await page.evaluate(()=>window.__restoreCleanup());report.checks.push('native IDB cleanup abort preserves local copy and retry')
  await page.getByRole('button',{name:'Clear local copy',exact:true}).click()
  await expect.poll(()=>page.evaluate(async id=>(await window.flowFixture.recorderDB.getChunksBySession(id)).length,local.id)).toBe(0)
  h.eq((await h.db.query('SELECT count(*)::int AS n FROM stories')).rows[0].n,1,'cleanup preserves cloud story')
  report.checks.push('explicit local cleanup removes only confirmed local copy')
  await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:'reduce'})
  await page.screenshot({path:join(evidence,'saved-mobile.png'),fullPage:true})
  h.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile no horizontal overflow')
  h.eq(errors,[],'no unhandled browser errors');h.eq(report.externalRequests,[],'no external requests');report.status='passed'
}catch(error){report.status='failed';report.error={message:error.message,code:error.code,label:error.label};process.exitCode=1
  const failedPage=browser?.contexts()[0]?.pages()[0]
  await failedPage?.screenshot({path:join(evidence,'failure.png'),fullPage:true}).catch(()=>{})
  report.diagnostic=await failedPage?.evaluate(async project=>{
    const f=window.flowFixture,sessions=await f.recorderDB.getSessionsByProject(project),session=sessions[0]
    if(!session?.saveIntent)return {stage:'no pinned save intent'}
    return {session,visibleText:document.body.innerText}
  },PROJECT).catch(e=>({diagnosticError:e.message}))
}
finally{
  await browser?.close();await fixture?.close();report.apiRequests=fixture?.requests;report.dbRequests=database?.requests
  await database?.close();compiled?.clear();await h.cleanup()
  if(oldFlag===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=oldFlag
  report.sourceDrift=[];for(const [p,hash]of Object.entries(report.sources))if(sha(await readFile(join(root,p)))!==hash)report.sourceDrift.push(p)
  if(report.sourceDrift.length){report.status='failed';process.exitCode=1}
  await writeFile(join(evidence,'results.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({evidence,status:report.status,checks:report.checks,error:report.error,cleanup:report.cleanup},null,2))
}
