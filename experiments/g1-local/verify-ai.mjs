import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { setup, PROJECT } from '../pg17-recording-flow/fixture.mjs'
import { buildBrowser } from '../recording-flow-browser/build.mjs'
import { databaseHttp, SERVICE_KEY } from '../recording-flow-browser/database-http.mjs'
import { compileServer } from '../recording-flow-browser/compile-server.mjs'
import { browserServer } from '../recording-flow-browser/browser-server.mjs'
import { createMicrophoneFile } from '../recording-flow-browser/chrome-options.mjs'

const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test')
const evidence=join(root,'docs/research/evidence/2026-11-07-g1-fixes',`ai-${Date.now()}-${randomUUID()}`)
await mkdir(evidence,{recursive:true})
const report={status:'running',assertions:0,actorConnections:[],sources:{},cases:[],externalRequests:[],pageErrors:[],
  boundary:'Installed Chrome and native microphone/MediaRecorder, actual UI/AIService/parser/save/worker/confirmation and PG. Synthetic browser caption event and controlled AI HTTP responses, no provider calls. Auth/PostgREST/Storage use declared local adapters.'}
const h=new Harness(report),previous=process.env.MEDIA_ASSETS_ENABLED
let database,compiled,fixture,browser
async function source(path){const bytes=await readFile(join(root,path));report.sources[path]=digest(bytes);return bytes.toString()}
const caption='Synthetic caption for G1 recording save verification.'
const good={title:'Synthetic draft title',summary:'Synthetic draft summary',followUpQuestions:[]}
try{
  process.env.MEDIA_ASSETS_ENABLED='true'
  await h.start();await setup(h,source);database=await databaseHttp(h);compiled=await compileServer(h.scratch,source,database.admin)
  const ui=await buildBrowser(h.scratch)
  for(const p of ui.dependencies)report.sources[p.slice(root.length+1)]=digest(await readFile(p))
  for(const p of ['experiments/g1-local/verify-ai.mjs','experiments/recording-flow-browser/browser-server.mjs','experiments/recording-flow-browser/chrome-options.mjs'])await source(p)
  let cursor=null
  fixture=await browserServer({h,database,compiled,ui,runWorker:async()=>{
    const result=await compiled.host.runRecordingWorkerOnce({admin:database.admin,storageUrl:'https://storage.invalid',serviceRoleKey:SERVICE_KEY,fetch:database.transport,cursor,workerId:'g1-ai-worker',
      ffmpeg:{executable:'/usr/local/bin/ffmpeg',timeoutMs:30000,maxDurationMs:30000}})
    cursor=result.nextCursor
    if(result.status==='unavailable')throw Error('Worker unavailable')
  }})
  const microphone=await createMicrophoneFile(h.scratch)
  browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${microphone}`]})
  report.browser=browser.version()
  const cases=[
    {name:'quota',status:429,failed:true},{name:'provider_rejection',status:403,failed:true},
    {name:'server_timeout',status:504,failed:true},{name:'network_failure',abort:true,failed:true},
    {name:'invalid_structure',body:{title:'missing summary'},failed:true},
    {name:'zero_confidence',body:{...good,confidence:0}},
    {name:'low_confidence',body:{...good,confidence:0.1}},
    {name:'unknown_confidence',body:good},
    {name:'pending_then_late_success',pending:true,body:good},
  ]
  for(const test of cases){
    const context=await browser.newContext({permissions:['microphone'],viewport:{width:1280,height:960}})
    let release,pending=new Promise(resolve=>{release=resolve}),calls=0
    const observation={name:test.name,checks:[]};report.cases.push(observation)
    try{
      await context.addInitScript(text=>{
        class CaptionFixture {
          start(){this.timer=setTimeout(()=>{const result=[{transcript:text}];result.isFinal=true;this.onresult?.({resultIndex:0,results:[result]})},250)}
          stop(){clearTimeout(this.timer)}
          abort(){this.stop()}
        }
        window.SpeechRecognition=CaptionFixture;window.webkitSpeechRecognition=CaptionFixture
      },caption)
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url())
        if(![fixture.origin,database.origin].includes(url.origin)){report.externalRequests.push(url.origin);return route.abort()}
        if(url.pathname==='/api/ai/generate-content'){
          calls++
          const body=route.request().postDataJSON();h.eq(body.transcript,caption,'actual caption reaches AI service')
          if(test.pending)await pending
          if(test.abort)return route.abort('failed')
          return route.fulfill({status:test.status??200,contentType:'application/json',body:JSON.stringify(test.body??{error:test.name})})
        }
        return route.continue()
      })
      const page=await context.newPage();page.on('pageerror',error=>report.pageErrors.push(error.message));page.setDefaultTimeout(20000)
      await page.goto(fixture.origin)
      await page.getByRole('button',{name:/Chat Bubbles/}).click()
      await page.getByRole('button',{name:'Start Recording',exact:true}).click()
      await page.getByText(caption,{exact:true}).waitFor()
      await page.waitForTimeout(2200)
      await page.getByRole('button',{name:'Stop',exact:true}).click()
      await page.getByRole('button',{name:'Complete Recording',exact:true}).click()
      await expect.poll(()=>calls).toBeGreaterThan(0)
      const statusText=test.pending?'Preparing a draft. You can save the recording now.':test.failed?
        'A draft could not be prepared. You can still save the recording and any available transcript.':'Draft prepared. Review the recording before saving.'
      await expect(page.getByText(statusText,{exact:true})).toBeVisible()
      await expect(page.getByRole('link',{name:'Open saved story',exact:true})).toHaveCount(0)
      const local=await page.evaluate(async project=>{
        const db=window.flowFixture.recorderDB,session=(await db.getSessionsByProject(project))[0],chunks=await db.getChunksBySession(session.id)
        return{id:session.id,chunks:chunks.length,bytes:chunks.reduce((total,c)=>total+c.blob.size,0)}
      },PROJECT)
      h.ok(local.chunks>0&&local.bytes>0,'native audio persists before AI-independent save')
      await page.getByRole('button',{name:'Save to Timeline',exact:true}).click()
      await expect.poll(async()=>{
        if(await page.getByRole('link',{name:'Open saved story',exact:true}).isVisible())return true
        const button=page.getByRole('button',{name:'Continue saving',exact:true})
        if(await button.isVisible()&&await button.isEnabled())await button.click()
        return false
      },{timeout:60000,intervals:[500]}).toBe(true)
      h.eq(fixture.controls.workerError,null,'actual worker healthy')
      const story=(await h.db.query('SELECT s.* FROM stories s JOIN recording_sessions r ON r.story_id=s.id WHERE r.id=$1',[local.id])).rows[0]
      h.eq(story.status,'ready','recording confirmed despite AI case')
      h.eq(story.transcript,caption,'only supplied synthetic caption retained')
      h.eq(story.content,test.failed||test.pending?'':good.summary,'failed or unfinished AI never fabricates saved content')
      const player=page.getByLabel('Saved recording',{exact:true})
      await player.evaluate(audio=>audio.play());await expect.poll(()=>player.evaluate(audio=>audio.currentTime)).toBeGreaterThan(0)
      await player.evaluate(audio=>audio.pause())
      h.eq(await page.evaluate(async id=>(await window.flowFixture.recorderDB.getChunksBySession(id)).length,local.id),local.chunks,'AI and save retain original local copy')
      if(test.pending){
        release();await expect(page.getByText('Draft prepared. Review the recording before saving.',{exact:true})).toBeVisible()
        h.eq((await h.db.query('SELECT * FROM stories WHERE id=$1',[story.id])).rows[0],story,'late AI response does not rewrite saved story')
        observation.checks.push('save succeeds while AI response is still pending','late success cannot mutate pinned saved metadata')
      }
      await page.screenshot({path:join(evidence,test.name+'.png'),fullPage:true})
      observation.calls=calls;observation.local=local;observation.story=story;observation.status='passed'
      observation.checks.push('AI status visible','real original saved and confirmed','playback advances','local chunks retained')
      console.log(JSON.stringify({case:test.name,status:'passed',calls}))
    }finally{release();await context.close()}
  }
  h.eq(report.externalRequests,[],'no provider calls');h.eq(report.pageErrors,[],'no unhandled page errors')
  report.status='passed'
}catch(error){report.status='failed';report.error={message:error.message,label:error.label};process.exitCode=1}
finally{
  await browser?.close();await fixture?.close();await database?.close();compiled?.clear();await h.cleanup()
  if(previous===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=previous
  report.sourceDrift=[];for(const [path,hash]of Object.entries(report.sources))if(digest(await readFile(join(root,path)))!==hash)report.sourceDrift.push(path)
  if(report.sourceDrift.length){report.status='failed';process.exitCode=1}
  await writeFile(join(evidence,'results.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({evidence,status:report.status,assertions:report.assertions,error:report.error,cleanup:report.cleanup},null,2))
}
