import { mkdir,readFile,readdir,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness,root,here,digest,failure } from './runtime.mjs'
import { loadReviewed,replay } from './replay.mjs'
import { seed,baseline,applyCandidate,candidates,checkDomains } from './scenarios.mjs'
import { concurrency } from './concurrency.mjs'
const args=process.argv.slice(2),red=args.includes('--red')
const allowed=['--red','--test-signal-ready','--test-fail-start','--test-client-failure']
const report={startedAt:new Date().toISOString(),status:'running',mode:red?'red':'candidate',scope:'Exact audited12 RPCs plus trigger; synthetic local PG17.4; no remote calls',sources:{},assertions:0,actorConnections:[],scenarios:[]}
const h=new Harness(report)
const dir=join(root,'docs/research/evidence/2026-10-17-pg17-routines'),output=join(dir,`pg17-${red?'red':'run'}-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.json`)
process.send?.({type:'evidence',path:output})
for(const name of ['SIGINT','SIGTERM'])process.once(name,()=>{if(!h.finishing&&!h.signal){h.signal=name;process.send?.({type:'shutdown-requested',signal:name})}})
const deadline=setTimeout(()=>{h.signal='deadline'},180000)
try{
  h.ok(args.every(x=>allowed.includes(x)),'only allowed local flags')
  for(const f of (await readdir(here)).filter(x=>/\.(mjs|cjs|sql|md|json)$/.test(x)).sort())report.sources[`experiments/pg17-routines/${f}`]=digest(await readFile(join(here,f)))
  const reviewed=await loadReviewed(h)
  await h.start(args.includes('--test-fail-start'))
  await replay(h,reviewed);await seed(h.db)
  if(args.includes('--test-signal-ready')){
    h.ok(process.send,'signal gate requires IPC observer');process.send({type:'fixture-ready',path:h.scratch})
    const until=Date.now()+15000;while(!h.signal&&Date.now()<until)await new Promise(r=>setTimeout(r,20));h.check();throw failure('SIGNAL_GATE_TIMEOUT')
  }
  if(args.includes('--test-client-failure')){
    report.phase='client_connection_failure';await h.client('synthetic_missing_role');throw failure('EXPECTED_CONNECTION_FAILURE')
  }
  await checkDomains(h)
  await baseline(h)
  if(!red)await applyCandidate(h)
  await candidates(h,red)
  if(!red)await concurrency(h)
  report.status='passed'
}catch(e){
  report.status=h.signal?'interrupted':'failed'
  if(h.signal)report.signal=h.signal
  else report.error={code:e.code??(Number.isInteger(e.status)?'SUBPROCESS_FAILED':'ERROR'),label:e.label,subprocessExit:Number.isInteger(e.status)?e.status:undefined}
}finally{
  clearTimeout(deadline)
  try{await h.cleanup()}catch{report.status='failed';report.cleanupError='UNEXPECTED_CLEANUP_ERROR'}
  report.finishedAt=new Date().toISOString();await mkdir(dir,{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o644})
  console.log(JSON.stringify({status:report.status,evidence:output.slice(root.length+1),scenarios:report.scenarios.length,assertions:report.assertions,error:report.error,cleanup:report.cleanup}))
  process.exitCode=report.status==='passed'?0:report.status==='interrupted'?(h.signal==='SIGINT'?130:143):1
  process.disconnect?.()
}
