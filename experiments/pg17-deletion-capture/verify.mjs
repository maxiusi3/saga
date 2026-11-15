import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, fresh, capture, snapshot, compileCapture, applicationAdmin, USER } from './fixture.mjs'
import { scenarios } from './scenarios.mjs'
import { fix1Regressions } from './fix-1-regressions.mjs'
import { sealFenceRegressions } from './seal-fence-regressions.mjs'
const red = process.argv.includes('--without-migration')
const directory = join(root,'docs/research/evidence/2026-11-06-g1-deletion-capture',`native-${red?'red-':''}${Date.now()}-${randomUUID()}`)
const report = {status:'running',assertions:0,actorConnections:[],scenarios:[],sources:{},command:`node experiments/pg17-deletion-capture/verify.mjs ${process.argv.slice(2).join(' ')}`.trim(),g1MilestoneSatisfied:false,physicalDeletionComplete:false}
const h = new Harness(report)
await mkdir(directory,{recursive:true})
async function source(path) { const bytes=await readFile(join(root,path)); report.sources[path]=digest(bytes); return bytes.toString() }
try {
  await source('experiments/pg17-deletion-capture/fixture.mjs');await source('experiments/pg17-deletion-capture/verify.mjs')
  await h.start(); await setup(h,source,!red)
  const service=await h.actorClient('service_role',USER), {prepareRecordingSessionSeal}=await compileModules(h,source)
  await h.scenario('actual published recording atomically captures candidate and original chunk',async()=>{
    const f=await fresh(h,service,prepareRecordingSessionSeal), before=await snapshot(h)
    report.before=before
    const receipt=await capture(service,{subjectId:f.storyId,requestId:randomUUID()})
    const after=await snapshot(h)
    report.publishedCapture={receipt,before,after}
    h.eq(receipt.physicalDeletionComplete,false,'capture never reports physical removal')
    h.eq('capture_targets' in after.deletion_requests.find(r=>r.id===receipt.id),false,'member-visible request contains only digest/count, never candidate paths')
    h.eq(after.deletion_targets.filter(t=>t.deletion_request_id===receipt.id).length,4,'story asset candidate chunk persisted')
  })
  const app=await compileCapture(h,source)
  await source('experiments/pg17-deletion-capture/scenarios.mjs')
  await scenarios(h,service,prepareRecordingSessionSeal,app,applicationAdmin(h,service))
  await source('experiments/pg17-deletion-capture/fix-1-regressions.mjs')
  await source('experiments/pg17-deletion-capture/registration-check.mjs')
  await fix1Regressions(h,service,prepareRecordingSessionSeal,source)
  await source('experiments/pg17-deletion-capture/seal-fence-regressions.mjs')
  await sealFenceRegressions(h,service,prepareRecordingSessionSeal)
  report.status='passed'
} catch(error) {report.status='failed'; report.error={code:error.code??'ERROR',label:error.label??error.message,position:error.position,where:error.where,internalQuery:error.internalQuery};process.exitCode=1}
finally {await h.cleanup();if(report.status!=='passed')process.exitCode=1;await writeFile(join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({directory,status:report.status,assertions:report.assertions,error:report.error,cleanup:report.cleanup},null,2))}
