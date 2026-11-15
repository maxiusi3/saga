import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {Harness,root,digest} from '../pg17-routines/runtime.mjs'
import {compileModules} from '../pg17-recording-worker/fixture.mjs'
import {setup,MIGRATION,USER} from './fixture.mjs'
import {fix1Regressions} from './fix-1-regressions.mjs'
const before=process.argv.includes('--before-fix-1')
const directory=join(root,'docs/research/evidence/2026-11-06-g1-deletion-capture',`native-fix1-${before?'red-':''}${Date.now()}-${randomUUID()}`)
const report={status:'running',assertions:0,actorConnections:[],scenarios:[],sources:{},command:`node experiments/pg17-deletion-capture/verify-fix-1.mjs ${process.argv.slice(2).join(' ')}`.trim(),g1MilestoneSatisfied:false,physicalDeletionComplete:false}
const h=new Harness(report);await mkdir(directory,{recursive:true})
async function source(path){const actual=before&&path===MIGRATION?`.superpowers/sdd/2026-11-06-upgrade-g1-deletion-capture/task-1-fix-1-before/${path}`:path;const bytes=await readFile(join(root,actual));report.sources[actual]=digest(bytes);return bytes.toString()}
try {
  for(const p of ['fixture','registration-check','fix-1-regressions','verify-fix-1'])await source(`experiments/pg17-deletion-capture/${p}.mjs`)
  await h.start();await setup(h,source);const service=await h.actorClient('service_role',USER),{prepareRecordingSessionSeal}=await compileModules(h,source)
  await fix1Regressions(h,service,prepareRecordingSessionSeal,source);report.status='passed'
}catch(e){report.status='failed';report.error={code:e.code??'ERROR',label:e.label??e.message,where:e.where,internalQuery:e.internalQuery};process.exitCode=1}
finally{await h.cleanup();if(report.status!=='passed')process.exitCode=1;await writeFile(join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({directory,status:report.status,assertions:report.assertions,error:report.error,cleanup:report.cleanup},null,2))}
