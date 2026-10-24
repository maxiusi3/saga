import { mkdir,readFile,writeFile } from 'node:fs/promises'
import { join,relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness,root,digest,failure } from '../pg17-routines/runtime.mjs'
import { loadReviewed,replay } from '../pg17-routines/replay.mjs'
import { extendFixture,installPolicies } from './fixture.mjs'
import { validateAdaptations } from './compatibility.mjs'
import { compatibilityRed,rlsMatrix,projector,ledgerMatrix,combined } from './scenarios.mjs'
import { inventory,own } from './inputs.mjs'

const args=process.argv.slice(2),red=args.includes('--red')
const report={startedAt:new Date().toISOString(),status:'running',mode:red?'compatibility-red':'composition',scope:'local synthetic PostgreSQL 17.4; no remote, provider, device or production operations',assertions:0,actorConnections:[],scenarios:[],observations:[],checks:[],lockEvidence:[]}
const h=new Harness(report)
const dir=join(root,'docs/research/evidence/2026-10-22-pg17-rls-source-composition')
const output=join(dir,`${red?'red':'run'}-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.json`)
process.send?.({type:'evidence',path:output})
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{if(!h.finishing&&!h.signal){h.signal=signal;process.send?.({type:'shutdown-requested',signal})}})
const deadline=setTimeout(()=>{h.signal='deadline'},240000)
let initial
try {
  h.ok(args.every(x=>['--red','--test-signal-ready','--test-fail-start','--test-client-failure'].includes(x)),'known local flags only')
  report.phase='input_verification'
  initial=await inventory()
  const pinsBytes=await readFile(join(root,own,'input-pins.json')),pins=JSON.parse(pinsBytes)
  h.eq(initial,pins,'complete frozen source dependency and runtime closure before start')
  report.inputPins={path:own+'/input-pins.json',sha256:digest(pinsBytes)}
  report.sources=initial.sources
  report.dependencyClosure={files:Object.keys(initial.commonJS).length,sha256:digest(JSON.stringify(initial.commonJS)),verified:true}
  report.runtimeClosure={files:Object.keys(initial.runtimeFiles).length,sha256:digest(JSON.stringify(initial.runtimeFiles)),verified:true,systemLibraries:'ambient macOS libSystem/kernel not byte pinned'}
  const reviewed=await loadReviewed(h)
  report.phase='cluster_start'
  await h.start(args.includes('--test-fail-start'))
  report.phase='reviewed_replay'
  await replay(h,reviewed)
  report.phase='extended_fixture'
  await extendFixture(h)
  await validateAdaptations(h)
  if(args.includes('--test-client-failure')) {
    report.phase='client_connection_failure'
    await h.client('synthetic_missing_role')
    throw failure('EXPECTED_CONNECTION_FAILURE')
  }
  if(args.includes('--test-signal-ready')) {
    h.ok(process.send,'signal gate requires IPC observer')
    process.send({type:'fixture-ready',path:h.scratch})
    const end=Date.now()+15000
    while(!h.signal&&Date.now()<end)await new Promise(r=>setTimeout(r,20))
    h.check();throw failure('SIGNAL_GATE_TIMEOUT')
  }
  report.phase='compatibility_red'
  await compatibilityRed(h)
  if(!red) {
    const plan=await projector(h)
    await ledgerMatrix(h,plan)
    await installPolicies(h)
    await rlsMatrix(h)
    await combined(h,plan)
    h.report.finalCounts=(await h.db.query(`SELECT (SELECT count(*)::int FROM t02.source_observations) AS observations,(SELECT count(*)::int FROM t02.source_reviews) AS reviews,(SELECT count(*)::int FROM t02.source_bindings) AS bindings,(SELECT count(*)::int FROM t02.fixture_assets) AS synthetic_assets`)).rows[0]
    h.report.finalRls=(await h.db.query(`SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname=ANY($1)) OR (n.nspname='storage' AND c.relname IN ('objects','buckets')) ORDER BY 1,2`,[['projects','project_roles','project_members','stories','notifications','user_resource_wallets','seat_transactions','export_requests','invitations']])).rows
    h.ok(h.report.finalRls.every(x=>x.relrowsecurity),'all composed public and Storage tables retain RLS')
    h.eq(h.report.compatibility.map(x=>x.uses>0),[true,true,true,true,true,true],'every allowlisted adaptation exercised')
  }
  report.status='passed'
} catch(e) {
  report.status=h.signal?'interrupted':'failed'
  if(h.signal)report.signal=h.signal
  else report.error={code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:Number.isInteger(e.status)?'SUBPROCESS_FAILED':'ERROR',label:e.label,subprocessExit:Number.isInteger(e.status)?e.status:undefined}
} finally {
  clearTimeout(deadline);h.finishing=true
  try {
    if(initial) {h.eq(await inventory(),initial,'entire source dependency and runtime closure unchanged at finish');report.sourcesUnchangedAtFinish=true}
    if(h.scratch)try{const log=await readFile(join(h.scratch,'postgres.log'));report.postgresLog={sha256:digest(log),bytes:log.length,contents:'withheld: PostgreSQL error CONTEXT may contain private function text'}}catch{}
  } catch {report.status='failed';report.integrityError='INPUTS_CHANGED'}
  try {await h.cleanup()}catch {report.status='failed';report.cleanupError='UNEXPECTED_CLEANUP_ERROR'}
  report.counts={scenarios:report.scenarios.length,behaviorAssertions:report.scenarios.reduce((n,x)=>n+(x.assertions??0),0),ledgerChecks:report.checks.length,lockObservations:report.lockEvidence.length,totalAssertionsIncludingPins:report.assertions}
  report.finishedAt=new Date().toISOString()
  await mkdir(dir,{recursive:true})
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o644})
  console.log(JSON.stringify({status:report.status,evidence:relative(root,output),counts:report.counts,phase:report.phase,error:report.error,cleanup:report.cleanup}))
  process.exitCode=h.signal==='SIGTERM'?143:h.signal==='SIGINT'?130:report.status==='passed'?0:1
}
