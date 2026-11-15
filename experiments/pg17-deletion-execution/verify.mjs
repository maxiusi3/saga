import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { compileModule } from '../g1-local/compile-module.mjs'
import { setup, fresh, capture, execute, USER } from './fixture.mjs'
import { save } from '../pg17-recording-flow/fixture.mjs'
import { workerScenarios } from './worker-scenarios.mjs'
import { chromeAcceptance } from './chrome.mjs'
import { guardScenarios, legacyOnlyScenario } from './guards.mjs'
const red = process.argv.includes('--without-migration')
const directory = join(root,'docs/research/evidence/2026-11-09-g1-deletion-execution',`native-${red?'red-':''}${Date.now()}-${randomUUID()}`)
await mkdir(directory,{recursive:true})
const report = {status:'running',assertions:0,actorConnections:[],sources:{},scenarios:[]}
const h = new Harness(report)
async function source(path) {const b=await readFile(join(root,path));report.sources[path]=digest(b);return b.toString()}
try {
  for(const p of ['verify.mjs','fixture.mjs','worker-scenarios.mjs','storage-http.mjs','chrome.mjs','guards.mjs'])await source('experiments/pg17-deletion-execution/'+p)
  await source('experiments/recording-flow-browser/database-http.mjs')
  await h.start();await setup(h,source,!red)
  const service=await h.actorClient('service_role',USER)
  const {prepareRecordingSessionSeal:prepare}=await compileModule('lib/server/recording-session-service.ts',join(h.scratch,'compiled'),source)
  const f=await fresh(h,service,prepare), request=randomUUID(), run=randomUUID()
  await capture(service,{subjectId:f.storyId,requestId:request})
  const captured=async()=> (await h.db.query('SELECT jsonb_build_array(to_jsonb(r),(SELECT jsonb_agg(to_jsonb(t) ORDER BY target_id) FROM deletion_targets t WHERE t.deletion_request_id=r.id)) AS value FROM deletion_requests r WHERE id=$1',[request])).rows[0].value
  const before=await captured()
  const retained=await fresh(h,service,prepare)
  await save(service,retained.sessionId,'confirm',null,retained.manifestSha256)
  const plan=await execute(service,request,run,'begin')
  report.plan=plan
  h.eq(plan.state,'scanning','first begin obtains executable plan')
  h.ok(plan.objects.length>=2,'plan contains original and chunks')
  const object=plan.objects[0]
  await h.scenario('cannot delete without present observation',async()=>{
    let code;try{await execute(service,request,run,'dispatch',object)}catch(e){code=e.code}
    h.eq(code,'23505','unobserved dispatch denied')
  })
  for(const item of plan.objects)await execute(service,request,run,'observe',{...item,state:'absent'})
  let code;try{await execute(service,request,run,'finish')}catch(e){code=e.code}
  h.eq(code,'23505','incomplete prefix inventory cannot complete')
  for(const prefix of plan.prefixes)await execute(service,request,run,'inventory',prefix)
  const result=await execute(service,request,run,'finish')
  h.eq(result.state,'observed_absent','time-qualified absence recorded')
  h.eq(result.physicalDeletionComplete,false,'no permanent no-late-write claim')
  h.eq(await captured(),before,'complete capture remains immutable')
  h.eq((await capture(service,{subjectId:f.storyId,requestId:randomUUID()})).id,request,'capture remains replayable')
  const later=await fresh(h,service,prepare)
  await save(service,later.sessionId,'confirm',null,later.manifestSha256)
  h.eq((await h.db.query('SELECT status FROM stories WHERE id=$1',[later.storyId])).rows[0].status,'ready','unrelated recording still saves after permanent fences')
  await guardScenarios(h,service,prepare)
  const integrated=await workerScenarios(h,service,prepare,source,directory)
  try { if(process.argv.includes('--chrome'))await chromeAcceptance(h,service,prepare,source,directory,integrated) } finally { await integrated.close() }
  await legacyOnlyScenario(h,service)
  report.status='passed'
}catch(e){report.status='failed';report.error={code:e.code,message:e.message,label:e.label,where:e.where};process.exitCode=1}
finally{await h.cleanup();await writeFile(join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({directory,status:report.status,assertions:report.assertions,error:report.error},null,2))}
