import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { access, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
export const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..')
export const bin=join(root,'.superpowers/sdd/2026-10-17-upgrade-pg17-routines/runtime/install/bin')
export const digest=(x,alg='sha256')=>createHash(alg).update(x).digest('hex')
export const exists=p=>access(p).then(()=>true,()=>false)
const removed=Object.keys(process.env).filter(k=>/^PG/i.test(k)||k==='DATABASE_URL')
for(const k of removed)delete process.env[k]
const env={...process.env}
const require=createRequire(import.meta.url)
const {Client}=require('../t05-durable-worker/node_modules/pg')
export function failure(code,label){return Object.assign(new Error('safe local failure'),{code,label})}
export class Harness {
  constructor(report){this.report=report;this.clients=new Set();this.finishing=false;this.clusterMayExist=false;report.runtime={node:process.version,pg:require('../t05-durable-worker/node_modules/pg/package.json').version,scrubbedEnvironmentKeys:removed.sort()};}
  check(){if(this.signal&&!this.finishing)throw failure('INTERRUPTED','signal received')}
  eq(a,b,label){this.check();if(!isDeepStrictEqual(a,b))throw failure('ASSERT_FAILED',label);this.report.assertions++}
  ok(x,label){this.eq(Boolean(x),true,label)}
  async scenario(name,fn){this.check();const before=this.report.assertions;try{await fn();this.report.scenarios.push({name,status:'passed',assertions:this.report.assertions-before})}catch(e){this.report.scenarios.push({name,status:'failed',code:e.code??'ERROR',label:e.label});throw e}}
  command(name,args,timeout=30000){this.check();return execFileSync(join(bin,name),args,{env,timeout,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}
  async start(invalid=false){
    const pins=JSON.parse(await readFile(join(here,'runtime-pins.json')))
    this.report.runtime.binarySha256={}
    for(const name of ['postgres','pg_ctl','initdb']){const h=digest(await readFile(join(bin,name)));this.eq(h,pins[name],'runtime executable fingerprint');this.report.runtime.binarySha256[name]=h}
    this.report.runtime.postgres=this.command('postgres',['--version']);this.eq(this.report.runtime.postgres,'postgres (PostgreSQL) 17.4','exact upstream version')
    this.report.runtime.nodeExecutableSha256=digest(await readFile(process.execPath))
    this.report.runtime.pgEntrySha256=digest(await readFile(require.resolve('../t05-durable-worker/node_modules/pg')))
    this.scratch=mkdtempSync('/tmp/saga-pg17-');this.report.scratch=this.scratch;process.send?.({type:'allocation',path:this.scratch})
    await mkdir(join(this.scratch,'socket'),{mode:0o700});this.check()
    this.command('initdb',['-D',join(this.scratch,'data'),'-U','rehearsal_admin','-A','trust','--no-locale','-E','UTF8'])
    this.clusterMayExist=true;this.report.runtime.clusterStartAttempted=true
    this.command('pg_ctl',['-D',join(this.scratch,'data'),'-l',join(this.scratch,'postgres.log'),'-w','-t','20','-o',`-k ${join(this.scratch,'socket')} -p 5432 -c listen_addresses='' -c unix_socket_permissions=0700 -c plpgsql.variable_conflict=error${invalid?' -c saga_invalid_setting=1':''}`,'start'])
    this.report.runtime.serverPid=Number((await readFile(join(this.scratch,'data/postmaster.pid'),'utf8')).split('\n')[0]);process.send?.({type:'server-started',pid:this.report.runtime.serverPid})
    this.config={host:join(this.scratch,'socket'),port:5432,ssl:false,password:'unused-local-synthetic',connectionTimeoutMillis:5000,query_timeout:10000,options:'-c statement_timeout=8000 -c lock_timeout=4000 -c idle_in_transaction_session_timeout=15000 -c search_path=pg_catalog,public,auth,extensions'}
    const admin=await this.client('rehearsal_admin','postgres');await admin.query('CREATE DATABASE saga_pg17_rehearsal');await this.close(admin)
    this.db=await this.client()
    this.eq((await this.db.query('SHOW listen_addresses')).rows[0].listen_addresses,'','TCP disabled')
    this.eq((await this.db.query('SELECT inet_server_addr() AS addr')).rows[0].addr,null,'Unix socket transport')
    this.report.runtime.variableConflict=(await this.db.query('SHOW plpgsql.variable_conflict')).rows[0]['plpgsql.variable_conflict']
    this.eq(this.report.runtime.variableConflict,'error','explicit variable conflict error')
    this.report.runtime.connection={host:this.config.host,database:'saga_pg17_rehearsal',port:5432,ssl:false,transport:'unix_socket',statementTimeoutMs:8000,lockTimeoutMs:4000}
  }
  async client(user='rehearsal_admin',database='saga_pg17_rehearsal'){
    this.check();const c=new Client({...this.config,user,database});this.clients.add(c);c.on('error',()=>{});c.once('end',()=>this.clients.delete(c));await c.connect();this.check();return c
  }
  async close(c){let t;try{await Promise.race([c.end(),new Promise((_,reject)=>{t=setTimeout(()=>{c.connection?.stream?.destroy();reject(failure('CLOSE_TIMEOUT'))},2000)})])}finally{clearTimeout(t)}}
  async actorClient(role,user,claimRole=role){
    if(!['anon','authenticated','metadata_reader','service_role'].includes(role))throw failure('ROLE_NOT_ALLOWED')
    const c=await this.client(role)
    try{const id=(await c.query('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user')).rows[0]
      this.eq(id,{current_user:role,session_user:role,rolsuper:false,rolbypassrls:false},'real unprivileged caller')
      if(!this.report.actorConnections.some(r=>r.current_user===role))this.report.actorConnections.push(id)
      await c.query("SELECT pg_catalog.set_config('request.jwt.claim.sub',$1,false),pg_catalog.set_config('request.jwt.claim.role',$2,false)",[user??'',claimRole]);return c
    }catch(e){await this.close(c);throw e}
  }
  async actor(role,user,sql,values=[],claimRole=role,rollback=false){
    const c=await this.actorClient(role,user,claimRole)
    try{if(rollback)await c.query('BEGIN');try{let r=await c.query(sql,values);if(Array.isArray(r))r=r.at(-1);return{sqlstate:'00000',rows:r.rows,rowCount:r.rowCount}}catch(e){this.check();return{sqlstate:/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:'QUERY_FAILED',errorClassification:/ambiguous/i.test(e.message??'')?'ambiguous_reference':/does not exist/i.test(e.message??'')?'missing_object':'other',classificationSource:'private_error_message_pattern_only'}}finally{if(rollback)await c.query('ROLLBACK')}}finally{await this.close(c)}
  }
  async cleanup(){
    this.finishing=true;const errors=[]
    for(const c of [...this.clients])try{await this.close(c)}catch(e){errors.push(e.code??'CLOSE_FAILED')}
    if(this.scratch&&this.clusterMayExist){try{this.command('pg_ctl',['-D',join(this.scratch,'data'),'-m','immediate','-w','-t','10','stop'],15000);this.clusterMayExist=false}catch{try{this.command('pg_ctl',['-D',join(this.scratch,'data'),'status'],5000);errors.push('SERVER_RUNNING')}catch(e){if(e.status===3)this.clusterMayExist=false;else errors.push('STOP_UNCONFIRMED')}}}
    let removed=!this.scratch;if(this.scratch&&!this.clusterMayExist){await rm(this.scratch,{recursive:true,force:true});removed=!await exists(this.scratch)}
    this.report.cleanup={clusterStopped:!this.clusterMayExist,tempDirectoryRemoved:removed,clientsRemaining:this.clients.size,errors}
    if(errors.length||this.clusterMayExist||!removed||this.clients.size)this.report.status='failed'
  }
}
