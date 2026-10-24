import { fork,execFileSync } from 'node:child_process'
import { readFile,writeFile,mkdir,rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join,relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { root,bin,digest,exists,failure } from '../pg17-routines/runtime.mjs'
import { inventory,own,evidenceDir } from './inputs.mjs'

const hostile={PGHOST:'invalid.example.invalid',PGHOSTADDR:'203.0.113.1',PGPORT:'1',PGUSER:'invalid',PGDATABASE:'invalid',PGPASSWORD:'synthetic-invalid',PGSERVICE:'invalid',PGSERVICEFILE:'/synthetic/absent',PGSYSCONFDIR:'/synthetic/absent',PGPASSFILE:'/synthetic/absent',PGOPTIONS:'-c search_path=invalid -c statement_timeout=1',PGSSLMODE:'require',PGSSLROOTCERT:'/synthetic/absent',DATABASE_URL:'postgres://invalid@invalid.example.invalid/invalid'}
const report={startedAt:new Date().toISOString(),status:'running',scope:'External child/process/socket/directory lifecycle observations, local only.',limits:{suiteMs:240000,childMs:140000,outputBytes:32768},cases:[]}
const output=join(root,evidenceDir,`lifecycle-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.json`)
const eq=(a,b,label)=>{if(!isDeepStrictEqual(a,b))throw failure('OBSERVER_ASSERT',label)}
const alive=pid=>{try{process.kill(pid,0);return true}catch(e){if(e.code==='ESRCH')return false;throw e}}
const start=Date.now()
let initial,pinBytes
try {
  initial=await inventory();pinBytes=await readFile(join(root,own,'input-pins.json'))
  eq(initial,JSON.parse(pinBytes),'observer inputs frozen before cases')
  report.inputPinsSha256=digest(pinBytes)
  for(const test of [
    {name:'hostile_environment',args:[],env:hostile,exit:0},
    {name:'actual_SIGTERM_after_fixture',args:['--test-signal-ready'],exit:143},
    {name:'failed_actual_start',args:['--test-fail-start'],exit:1},
    {name:'failed_actual_connection',args:['--test-client-failure'],exit:1},
  ]) {
    eq(Date.now()-start<report.limits.suiteMs,true,'bounded lifecycle suite')
    const item={name:test.name,status:'running',events:[]};report.cases.push(item)
    let evidence,allocation,pid,stdout='',stderr='',killTimer
    const child=fork(join(root,own,'verify.mjs'),test.args,{cwd:root,env:{...process.env,...test.env},stdio:['ignore','pipe','pipe','ipc']})
    const receive=(target,chunk)=>{
      if(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)+chunk.length>report.limits.outputBytes){item.outputLimitExceeded=true;child.kill('SIGTERM');return}
      if(target==='stdout')stdout+=chunk;else stderr+=chunk
    }
    child.stdout.on('data',x=>receive('stdout',x));child.stderr.on('data',x=>receive('stderr',x))
    child.on('message',m=>{
      item.events.push(m.type)
      if(m.type==='evidence')evidence=m.path
      if(m.type==='allocation') {
        allocation=m.path
        item.allocationObserved=typeof allocation==='string'&&/^\/tmp\/saga-pg17-[\w-]+$/.test(allocation)&&existsSync(allocation)
      }
      if(m.type==='server-started') {
        pid=m.pid
        item.postmasterObservedAlive=Number.isInteger(pid)&&pid>1&&alive(pid)
        item.socketObservedPresent=existsSync(join(allocation,'socket','.s.PGSQL.5432'))
      }
      if(m.type==='fixture-ready') {
        item.readyObservedBeforeSignal=true
        item.postmasterAliveAtSignal=alive(pid)
        item.socketPresentAtSignal=existsSync(join(allocation,'socket','.s.PGSQL.5432'))
        child.kill('SIGTERM')
      }
    })
    const timeout=setTimeout(()=>{item.timeout=true;child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),15000)},Math.min(report.limits.childMs,report.limits.suiteMs-(Date.now()-start)))
    try {
      item.exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}))})
      eq(Boolean(item.timeout||item.outputLimitExceeded),false,'watchdog cannot satisfy injected outcome')
      eq(item.exit,{code:test.exit,signal:null},'expected child exit')
      eq(Boolean(evidence?.startsWith(join(root,evidenceDir,'run-'))),true,'scoped unique child evidence')
      const bytes=await readFile(evidence),data=JSON.parse(bytes)
      item.evidence=relative(root,evidence);item.sha256=digest(bytes);item.cleanup=data.cleanup;item.childStatus=data.status;item.phase=data.phase
      eq(item.allocationObserved,true,'external observer saw allocated directory')
      eq(data.cleanup,{clusterStopped:true,tempDirectoryRemoved:true,clientsRemaining:0,errors:[]},'child cleanup complete')
      item.directoryAbsent=!(await exists(allocation));item.socketAbsent=!(await exists(join(allocation,'socket','.s.PGSQL.5432')))
      eq(item.directoryAbsent,true,'external temporary directory absence');eq(item.socketAbsent,true,'external socket absence')
      if(pid) {
        item.postmasterAbsent=!alive(pid)
        eq(item.postmasterObservedAlive,true,'external postmaster observed live before cleanup')
        eq(item.socketObservedPresent,true,'external socket present before cleanup')
        eq(item.postmasterAbsent,true,'external postmaster absence')
      }
      eq(stderr,'','no raw child stderr')
      item.stdoutSafe=stdout.trim().split('\n').every(line=>{try{const r=JSON.parse(line);return Boolean(r.evidence)&&!r.message}catch{return false}})
      eq(item.stdoutSafe,true,'safe JSON summaries only')
      eq(data.sourcesUnchangedAtFinish,true,'child inputs stable');eq(data.pinManifestUnchangedAtFinish,true,'child manifest stable')
      if(test.env) {
        eq(data.status,'passed','hostile environment full behavior pass')
        for(const key of Object.keys(hostile))eq(data.runtime.scrubbedEnvironmentKeys.includes(key),true,'hostile key scrubbed')
        eq(data.runtime.connection.transport,'unix_socket','hostile host cannot change transport')
        item.scrubbedKeys=data.runtime.scrubbedEnvironmentKeys;item.behaviorCounts=data.counts
      }
      if(test.exit===143) {
        eq([data.status,data.signal,data.phase],['interrupted','SIGTERM','fixture_ready'],'actual SIGTERM after readiness')
        eq([item.readyObservedBeforeSignal,item.postmasterAliveAtSignal,item.socketPresentAtSignal],[true,true,true],'real ready server observed before signal')
        eq(item.events.includes('shutdown-requested'),true,'child handled actual signal')
      }
      if(test.name==='failed_actual_start') {
        eq([data.status,data.phase,data.error?.code,data.runtime.clusterStartAttempted],['failed','cluster_start','SUBPROCESS_FAILED',true],'actual invalid-setting startup failure')
        eq(item.events.includes('server-started'),false,'no successful start event')
      }
      if(test.name==='failed_actual_connection')eq([data.status,data.phase,data.error?.code],['failed','client_connection_failure','28000'],'actual missing role connection failure')
      item.status='passed'
    } finally {
      clearTimeout(timeout);clearTimeout(killTimer)
      // Emergency cleanup is never counted as a successful lifecycle case.
      if(allocation&&/^\/tmp\/saga-pg17-[\w-]+$/.test(allocation)&&await exists(allocation)) {
        item.rescueRequired=true
        let rescuePid=pid
        if(!rescuePid)try {
          const candidate=Number((await readFile(join(allocation,'data','postmaster.pid'),'utf8')).split('\n')[0])
          if(Number.isInteger(candidate)&&candidate>1)rescuePid=candidate
        }catch{}
        try {execFileSync(join(bin,'pg_ctl'),['-D',join(allocation,'data'),'-m','immediate','-w','-t','10','stop'],{timeout:15000,stdio:'pipe',env:process.env})}catch{}
        let stopped=false
        try {execFileSync(join(bin,'pg_ctl'),['-D',join(allocation,'data'),'status'],{timeout:5000,stdio:'pipe',env:process.env})}catch(e){stopped=e.status===3||e.status===4}
        if(stopped&&(!rescuePid||!alive(rescuePid)))await rm(allocation,{recursive:true,force:true})
        item.rescueDirectoryAbsent=!(await exists(allocation))
      }
    }
  }
  report.status='passed'
} catch(e) {report.status='failed';report.error={code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'OBSERVER_ERROR',label:e.label}}
finally {
  try {
    if(initial)eq(await inventory(),initial,'observer entire input closure unchanged')
    if(pinBytes)eq(await readFile(join(root,own,'input-pins.json')),pinBytes,'observer pin file unchanged')
    report.inputsUnchangedAtFinish=true
  }catch {report.status='failed';report.integrityError='INPUTS_CHANGED'}
  report.finishedAt=new Date().toISOString();report.elapsedMs=Date.now()-start
  await mkdir(join(root,evidenceDir),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o644})
  console.log(JSON.stringify({status:report.status,cases:report.cases.length,evidence:relative(root,output),error:report.error}))
  process.exitCode=report.status==='passed'?0:1
}
