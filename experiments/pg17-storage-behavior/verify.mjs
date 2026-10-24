import { readFile,writeFile,mkdir } from 'node:fs/promises'
import { join,relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness,root,digest,failure } from '../pg17-routines/runtime.mjs'
import { loadCapture,roles,fixture,catalog } from './fixture.mjs'
import { missingTriggerRed,oldEnumRed,foldername,names,lifecycle,timestamps,deletion } from './scenarios.mjs'
import { inventory,own,evidenceDir } from './inputs.mjs'

const args=process.argv.slice(2),red=args.includes('--red')
const report={startedAt:new Date().toISOString(),status:'running',mode:red?'expected_incompatibilities':'captured_storage_behavior',scope:'Local synthetic PostgreSQL 17.4. No remote, provider, business rows, object bytes or production operations.',assertions:0,actorConnections:[],scenarios:[],observations:[],redGaps:[],limits:{totalDurationMs:120000,connectionTimeoutMs:5000,queryTimeoutMs:10000,statementTimeoutMs:8000,lockTimeoutMs:4000,subprocessTimeoutMs:30000},boundaries:['Synthetic role graph and family policies; not production authorization or the old full RLS composition.','No Storage HTTP, real Auth/JWT, object backend, multipart runtime, media byte checks, privacy qualification, or backup restore.','Direct SQL deletion changes synthetic metadata only. Timestamps are not object-byte versions.','Runtime dynamic libraries are pinned; ambient macOS system libraries and kernel are not.']}
const h=new Harness(report),output=join(root,evidenceDir,`${red?'red':'run'}-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.json`)
process.send?.({type:'evidence',path:output})
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{if(!h.finishing&&!h.signal){h.signal=signal;process.send?.({type:'shutdown-requested',signal})}})
const deadline=setTimeout(()=>{h.signal='deadline'},report.limits.totalDurationMs)
let initial,pinBytes
try {
  h.ok(args.every(x=>['--red','--test-signal-ready','--test-fail-start','--test-client-failure'].includes(x)),'known local flags only')
  report.phase='input_verification';initial=await inventory();pinBytes=await readFile(join(root,own,'input-pins.json'))
  h.eq(initial,JSON.parse(pinBytes),'full frozen inputs dependencies runtime before start')
  report.inputPins={path:own+'/input-pins.json',sha256:digest(pinBytes)};report.sources=initial.sources
  report.dependencyClosure={files:Object.keys(initial.commonJS).length,sha256:digest(JSON.stringify(initial.commonJS)),verified:true}
  report.runtimeClosure={files:Object.keys(initial.runtimeFiles).length,sha256:digest(JSON.stringify(initial.runtimeFiles)),verified:true}
  const capture=await loadCapture(h)
  report.phase='cluster_start';await h.start(args.includes('--test-fail-start'))
  // Private statements can appear in PostgreSQL logs; only a final digest is emitted.
  await h.db.query("SET timezone='UTC'")
  report.phase='fixture';await roles(h,capture)
  await fixture(h,capture,{missingTriggers:red})
  if(args.includes('--test-client-failure')) {
    report.phase='client_connection_failure';await h.client('storage_missing_role');throw failure('EXPECTED_CONNECTION_FAILURE')
  }
  if(args.includes('--test-signal-ready')) {
    report.phase='fixture_ready';h.ok(process.send,'signal test requires external IPC observer')
    process.send({type:'fixture-ready',path:h.scratch})
    const end=Date.now()+15000
    while(!h.signal&&Date.now()<end)await new Promise(r=>setTimeout(r,20))
    h.check();throw failure('SIGNAL_GATE_TIMEOUT')
  }
  if(red) {
    report.phase='missing_trigger_red';await missingTriggerRed(h)
    await h.db.query('DROP SCHEMA storage CASCADE')
    report.phase='old_enum_red';await fixture(h,capture,{oldEnum:true});await oldEnumRed(h)
    h.eq(report.redGaps.length,2,'both independent incompatibilities retained')
  } else {
    report.phase='behavior_matrix'
    await foldername(h);await names(h);await lifecycle(h);await timestamps(h);await deletion(h)
    await catalog(h,capture)
    report.finalCounts=(await h.db.query('SELECT (SELECT count(*)::int FROM storage.buckets) AS buckets,(SELECT count(*)::int FROM storage.objects) AS objects')).rows[0]
  }
  report.status='passed'
} catch(e) {
  report.status=h.signal?'interrupted':'failed'
  if(h.signal)report.signal=h.signal
  else report.error={code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:Number.isInteger(e.status)?'SUBPROCESS_FAILED':'ERROR',label:e.label,subprocessExit:Number.isInteger(e.status)?e.status:undefined}
} finally {
  clearTimeout(deadline);h.finishing=true
  try {
    if(initial){h.eq(await inventory(),initial,'full input dependency runtime closure unchanged at finish');report.sourcesUnchangedAtFinish=true}
    if(pinBytes){h.eq(await readFile(join(root,own,'input-pins.json')),pinBytes,'pin manifest itself unchanged');report.pinManifestUnchangedAtFinish=true}
    if(h.scratch)try {const bytes=await readFile(join(h.scratch,'postgres.log'));report.postgresLog={sha256:digest(bytes),bytes:bytes.length,contents:'withheld: error CONTEXT may contain private definition or arguments'}}catch{}
  } catch {report.status='failed';report.integrityError='INPUTS_CHANGED'}
  try {await h.cleanup()}catch {report.status='failed';report.cleanupError='UNEXPECTED_CLEANUP_ERROR'}
  report.counts={scenarios:report.scenarios.length,behaviorAssertions:report.scenarios.reduce((n,s)=>n+(s.assertions??0),0),observations:report.observations.length,totalAssertionsIncludingPins:report.assertions}
  report.finishedAt=new Date().toISOString()
  await mkdir(join(root,evidenceDir),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o644})
  console.log(JSON.stringify({status:report.status,evidence:relative(root,output),counts:report.counts,phase:report.phase,error:report.error,cleanup:report.cleanup}))
  process.exitCode=h.signal==='SIGTERM'?143:h.signal==='SIGINT'?130:report.status==='passed'?0:1
}
