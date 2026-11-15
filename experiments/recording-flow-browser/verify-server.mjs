import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { Harness, root } from '../pg17-routines/runtime.mjs'
import { setup, USER, PROJECT, METADATA } from '../pg17-recording-flow/fixture.mjs'
import { databaseHttp, SERVICE_KEY } from './database-http.mjs'
import { compileServer } from './compile-server.mjs'
const evidence = join(root, 'docs/research/evidence/2026-11-05-g1-recording-flow', 'integrated-server-' + Date.now() + '-' + randomUUID())
await mkdir(evidence, { recursive: true })
const report = { status: 'running', assertions: 0, actorConnections: [], sources: {}, checks: [],
  boundary: 'Actual Next route handlers, Supabase JS, PG17 SQL and FFmpeg through synthetic session/auth and local PostgREST/Storage adapters. No remote service or physical microphone.' }
const h = new Harness(report), sha = bytes => createHash('sha256').update(bytes).digest('hex')
async function source(p) { const bytes = await readFile(join(root, p)); report.sources[p] = sha(bytes); return bytes.toString() }
const oldFlag = process.env.MEDIA_ASSETS_ENABLED
let http, server
try {
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  for(const name of ['verify-server.mjs','database-http.mjs','compile-server.mjs'])await source('experiments/recording-flow-browser/'+name)
  await h.start(); await setup(h, source); http = await databaseHttp(h); server = await compileServer(h.scratch, source, http.admin)
  const sessionId = randomUUID(), headers = { authorization: 'Bearer synthetic-flow-session', 'content-type': 'application/json' }
  const route = async (name, method, body, query = '', targetSessionId = sessionId) => {
    const request = new server.NextRequest(`http://fixture.invalid/api/recordings/sessions/${targetSessionId}/${name}${query}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
    const response = await server.routes[name][method](request, { params: Promise.resolve({ sessionId: targetSessionId }) })
    const value = await response.json(); h.ok(response.ok, `${name} ${method} status ${response.status}: ${JSON.stringify(value)}`); return value
  }
  const reservation = await route('save', 'POST', { action: 'reserve', projectId: PROJECT, metadata: METADATA })
  report.checks.push('reserve through actual route and SQL')
  const audioPath = join(h.scratch, 'tone.webm')
  execFileSync('/usr/local/bin/ffmpeg', ['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=2','-c:a','libopus','-f','webm',audioPath], { stdio: 'pipe', timeout: 15000 })
  const audio = await readFile(audioPath), objectKey = `projects/${PROJECT}/sessions/${sessionId}/0`
  http.objects.set(`audio-recordings/${USER}/${objectKey}`, { bytes: audio, type: 'audio/webm' })
  const sealed = await route('seal','POST',{ projectId: PROJECT, storyId: reservation.intent.storyId, mimeType:'audio/webm',
    chunks:[{index:0,chunkId:sessionId+'-0',bucket:'audio-recordings',objectKey,byteSize:audio.length,sha256:sha(audio)}] })
  report.checks.push('seal through actual route registration and SQL')
  const { data: job, error } = await http.admin.from('processing_jobs').select('*').eq('asset_id',sealed.asset.id).single()
  if(error)throw new Error(error.message)
  const workerOptions={admin:http.admin,storageUrl:'https://storage.invalid',serviceRoleKey:SERVICE_KEY,
    fetch:http.transport,workerId:'flow-local-worker',ffmpeg:{executable:'/usr/local/bin/ffmpeg',timeoutMs:15000,maxDurationMs:30000}}
  const terminal = await server.host.runRecordingWorkerOnce(workerOptions)
  h.eq(terminal.status,'processed','actual host consumes queued job');h.eq(terminal.jobId,job.id,'host selected actual registered job')
  h.eq(terminal.outcome,'succeeded','actual worker publishes');report.checks.push('production host selection, native HTTP bytes, FFmpeg verification and worker publication')
  const status = await route('status','GET',null,`?projectId=${PROJECT}&manifestSha256=${sealed.manifestSha256}`)
  h.eq(status.state,'succeeded','actual status confirms published chain');h.eq(status.canClearLocalDrafts,false,'status cannot clear')
  const confirmed = await route('save','POST',{action:'confirm',projectId:PROJECT,manifestSha256:sealed.manifestSha256})
  h.eq(confirmed.storyId,reservation.intent.storyId,'same story');h.eq(confirmed.canClearLocalDrafts,true,'separate confirmation grants cleanup')
  const replay = await route('save','POST',{action:'confirm',projectId:PROJECT,manifestSha256:sealed.manifestSha256})
  h.eq(replay,confirmed,'confirmation replay');h.eq((await h.db.query('SELECT count(*)::int AS n FROM stories')).rows[0].n,1,'one story only')
  report.checks.push('strict status, confirm and duplicate replay through actual handlers')
  const play = await server.routes.play.GET(new server.NextRequest('http://fixture.invalid'+confirmed.playbackUrl,{headers}),{params:Promise.resolve({assetId:confirmed.assetId})})
  report.playDiagnostic={status:play.status,body:play.status===307?null:await play.clone().text(),candidate:(await h.db.query('SELECT to_jsonb(c) AS value FROM recording_output_candidates c')).rows};h.eq(play.status,307,'guarded playback redirects');const playback = await fetch(play.headers.get('location'));h.ok(playback.ok,'signed fixture playback succeeds')
  h.eq(sha(Buffer.from(await playback.arrayBuffer())),sha(audio),'playback bytes equal original captured source');report.checks.push('guarded playback full bytes')
  const createQueued=async()=>{
    const id=randomUUID(),reserved=await route('save','POST',{action:'reserve',projectId:PROJECT,metadata:METADATA},'',id)
    const key=`projects/${PROJECT}/sessions/${id}/0`
    http.objects.set(`audio-recordings/${USER}/${key}`,{bytes:audio,type:'audio/webm'})
    const registered=await route('seal','POST',{projectId:PROJECT,storyId:reserved.intent.storyId,mimeType:'audio/webm',
      chunks:[{index:0,chunkId:id+'-0',bucket:'audio-recordings',objectKey:key,byteSize:audio.length,sha256:sha(audio)}]},'',id)
    return registered.job.id
  }
  const service=await h.actorClient('service_role',USER)
  for(const phase of ['leased','running']){
    const id=await createQueued(),owner='synthetic-expired-'+phase
    await service.query("SELECT recording_job_lease($1,'claim',$2,NULL,1000)",[id,owner])
    if(phase==='running')await service.query("SELECT recording_job_lease($1,'start',$2,1,NULL)",[id,owner])
    h.eq((await server.host.runRecordingWorkerOnce(workerOptions)).status,'idle','host excludes live '+phase+' lease')
    await new Promise(done=>setTimeout(done,1100))
    h.eq((await h.db.query('SELECT lease_expires_at < clock_timestamp() AS expired FROM processing_jobs WHERE id=$1',[id])).rows[0].expired,true,'native clock proves '+phase+' lease expired')
    const recovered=await server.host.runRecordingWorkerOnce(workerOptions)
    h.eq(recovered.status,'recovered','host recovers expired '+phase+' job')
    h.eq(recovered.jobId,id,'host recovers selected identity')
    h.eq(recovered.recoveryState,phase==='leased'?'retry_wait':'outcome_unknown','recovery respects dispatch boundary')
    const wrap=await server.host.runRecordingWorkerOnce({...workerOptions,cursor:recovered.nextCursor})
    h.eq(wrap.status,'idle','cursor completes sweep');h.eq(wrap.nextCursor,null,'empty sweep resets cursor')
    const after=await server.host.runRecordingWorkerOnce({...workerOptions,cursor:wrap.nextCursor})
    h.eq(after.status,phase==='leased'?'processed':'idle','only undispatched work can be selected again')
    h.eq((await h.db.query('SELECT attempt_count FROM processing_jobs WHERE id=$1',[id])).rows[0].attempt_count,phase==='leased'?2:1,'host never retries dispatched unknown')
  }
  await h.close(service);report.checks.push('real database lease expiry distinguishes retryable pre-dispatch from non-retried outcome_unknown')
  const ids=[await createQueued(),await createQueued()].sort()
  await h.db.query("UPDATE processing_jobs SET processor_version='synthetic-invalid-version' WHERE id=$1",[ids[0]])
  const rejected=await server.host.runRecordingWorkerOnce(workerOptions)
  h.eq(rejected.status,'unavailable','invalid job cannot process');h.eq(rejected.nextCursor,ids[0],'rejected row advances cursor')
  const next=await server.host.runRecordingWorkerOnce({...workerOptions,cursor:rejected.nextCursor})
  h.eq(next.jobId,ids[1],'later valid job remains reachable');h.eq(next.status,'processed','later valid job processes')
  const future=await createQueued()
  await h.db.query("UPDATE processing_jobs SET not_before=clock_timestamp()+interval '1 day' WHERE id=$1",[future])
  const afterPoison=await server.host.runRecordingWorkerOnce(workerOptions)
  h.eq(afterPoison.jobId,ids[0],'invalid row stays explicit unavailable')
  const futureScan=await server.host.runRecordingWorkerOnce({...workerOptions,cursor:afterPoison.nextCursor})
  h.eq(futureScan.status,'idle','future not_before excludes queued work')
  report.checks.push('actual query cursor passes rejected row and excludes future jobs')
  report.status='passed'
} catch(error) { report.status='failed';report.error={message:error.message,code:error.code,label:error.label};process.exitCode=1 }
finally {
  report.requests=http?.requests;await http?.close();server?.clear();await h.cleanup()
  if(oldFlag===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=oldFlag
  report.sourceDrift=[]
  for(const [p,hash] of Object.entries(report.sources))if(sha(await readFile(join(root,p)))!==hash)report.sourceDrift.push(p)
  if(report.sourceDrift.length){report.status='failed';process.exitCode=1}
  await writeFile(join(evidence,'results.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({evidence,status:report.status,checks:report.checks,assertions:report.assertions,error:report.error,cleanup:report.cleanup},null,2))
}
