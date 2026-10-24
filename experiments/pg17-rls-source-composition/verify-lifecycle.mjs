import { fork } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { root, digest, exists, failure } from '../pg17-routines/runtime.mjs'

const here=dirname(fileURLToPath(import.meta.url))
const hostile={PGHOST:'invalid.example.invalid',PGHOSTADDR:'203.0.113.1',PGPORT:'1',PGUSER:'invalid',PGDATABASE:'invalid',PGPASSWORD:'synthetic-invalid',PGSERVICE:'invalid',PGSERVICEFILE:'/synthetic/absent',PGSYSCONFDIR:'/synthetic/absent',PGPASSFILE:'/synthetic/absent',PGOPTIONS:'-c search_path=invalid -c statement_timeout=1',PGSSLMODE:'require',PGSSLROOTCERT:'/synthetic/absent',DATABASE_URL:'postgres://invalid@invalid.example.invalid/invalid'}
const report={startedAt:new Date().toISOString(),status:'running',sourceSha256:digest(await readFile(new URL(import.meta.url))),cases:[]}
const output=join(root,'docs/research/evidence/2026-10-22-pg17-rls-source-composition',`lifecycle-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.json`)
const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw failure('OBSERVER_ASSERT',label)}
const alive=pid=>{try{process.kill(pid,0);return true}catch(e){if(e.code==='ESRCH')return false;throw e}}
try {
  for(const test of [
    {name:'hostile_environment',args:[],env:hostile,exit:0},
    {name:'actual_SIGTERM_after_fixture',args:['--test-signal-ready'],exit:143},
    {name:'failed_actual_start',args:['--test-fail-start'],exit:1},
    {name:'failed_actual_connection',args:['--test-client-failure'],exit:1},
  ]) {
    const item={name:test.name,status:'running',events:[]};report.cases.push(item)
    let evidence,allocation,pid,stdout='',stderr='',killTimer
    const child=fork(join(here,'verify.mjs'),test.args,{cwd:root,env:{...process.env,...test.env},stdio:['ignore','pipe','pipe','ipc']})
    child.stdout.on('data',x=>{stdout+=x});child.stderr.on('data',x=>{stderr+=x})
    child.on('message',m=>{
      item.events.push(m.type)
      if(m.type==='evidence')evidence=m.path
      if(m.type==='allocation')allocation=m.path
      if(m.type==='server-started')pid=m.pid
      if(m.type==='fixture-ready')child.kill('SIGTERM')
    })
    const timeout=setTimeout(()=>{item.timeout=true;child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),15000)},270000)
    try {
      item.exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}))})
      eq(Boolean(item.timeout),false,'observer watchdog must never satisfy an injection')
      eq(item.exit,{code:test.exit,signal:null},'expected real child exit')
      eq(Boolean(evidence?.startsWith(join(root,'docs/research/evidence/2026-10-22-pg17-rls-source-composition/run-'))),true,'scoped evidence')
      const bytes=await readFile(evidence), data=JSON.parse(bytes)
      item.evidence=relative(root,evidence);item.sha256=digest(bytes);item.cleanup=data.cleanup
      eq(item.cleanup,{clusterStopped:true,tempDirectoryRemoved:true,clientsRemaining:0,errors:[]},'all cleanup complete')
      eq(await exists(allocation),false,'observer confirms directory removed')
      if(pid){item.postmasterAbsent=!alive(pid);eq(item.postmasterAbsent,true,'postmaster absent')}
      eq(stderr,'','raw stderr absent')
      item.stdoutSafe=stdout.trim().split('\n').every(line=>{try{const r=JSON.parse(line);return Boolean(r.evidence)&&!r.message}catch{return false}})
      eq(item.stdoutSafe,true,'stdout safe JSON only')
      if(test.env){eq(data.status,'passed','hostile environment still passes');for(const key of Object.keys(hostile))eq(data.runtime.scrubbedEnvironmentKeys.includes(key),true,'environment key scrubbed');item.scrubbedKeys=data.runtime.scrubbedEnvironmentKeys}
      if(test.exit===143){eq(data.status,'interrupted','actual signal observed');eq(data.signal,'SIGTERM','SIGTERM recorded');eq(item.events.includes('fixture-ready'),true,'fixture signal gate reached');eq(item.events.includes('shutdown-requested'),true,'child signal handler observed request');eq(data.phase,'extended_fixture','signal interruption after complete fixture')}
      if(test.name==='failed_actual_start') {eq(data.phase,'cluster_start','failure at requested startup');eq(data.error?.code,'SUBPROCESS_FAILED','actual pg_ctl failure');eq(data.runtime.clusterStartAttempted,true,'actual startup attempted');eq(item.events.includes('server-started'),false,'server did not start')}
      if(test.name==='failed_actual_connection') {eq(data.phase,'client_connection_failure','failure at requested connection');eq(data.error?.code,'28000','actual missing role authorization failure');eq(item.events.includes('server-started'),true,'actual server started before connection failure')}
      item.status='passed'
    } finally {clearTimeout(timeout);clearTimeout(killTimer)}
  }
  report.status='passed'
} catch(e) {report.status='failed';report.error={code:e.code??'ERROR',label:e.label}}
report.finishedAt=new Date().toISOString()
await mkdir(dirname(output),{recursive:true})
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:report.status,cases:report.cases.length,evidence:relative(root,output),error:report.error}))
process.exitCode=report.status==='passed'?0:1

