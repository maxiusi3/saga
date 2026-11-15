import { fork } from 'node:child_process'
import { once } from 'node:events'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { root } from '../pg17-routines/runtime.mjs'
import { USER, OTHER, PROJECT, STORY, RPC, fixture, rpc, state, denied, outcome } from './fixture.mjs'

export async function databaseScenarios(h, prepare, children) {
  const service = await h.actorClient('service_role', USER)
  const fresh = () => fixture(h, service, prepare)
  const worker = 'synthetic_worker-A_1'
  const receipts = h.report.receipts = []
  const events = h.report.childEvents = []
  async function receipt(f, value, expectedState, attempt, owner) {
    h.eq(Object.keys(value).sort(), ['schemaVersion','jobId','projectId','assetId','sessionId','manifestSha256','state',
      'attempt','workerId','leaseExpiresAt','serverNow','canClearLocalDrafts'].sort(), 'receipt has exactly closed fields')
    h.eq([value.schemaVersion,value.jobId,value.projectId,value.assetId,value.sessionId,value.manifestSha256,
      value.state,value.attempt,value.workerId,value.canClearLocalDrafts],
    [1,f.jobId,PROJECT,f.assetId,f.sessionId,f.manifestSha256,expectedState,attempt,owner,false], 'receipt binds immutable recording identity and exact fence')
    h.ok(Number.isFinite(Date.parse(value.serverNow)), 'database time is parseable')
    if (owner) h.ok(Date.parse(value.leaseExpiresAt) > Date.parse(value.serverNow), 'active receipt has live database expiry')
    else h.eq(value.leaseExpiresAt, null, 'terminal/retry receipt clears expiry')
    receipts.push(value)
  }
  async function expires(id) {
    const started = performance.now()
    const wait = Number((await h.db.query('SELECT greatest(0,extract(epoch FROM (lease_expires_at-clock_timestamp()))*1000) AS ms FROM processing_jobs WHERE id=$1', [id])).rows[0].ms)
    h.ok(wait <= 6000, 'real expiry wait is bounded by short fixture lease')
    await delay(Math.ceil(wait) + 80)
    h.eq((await h.db.query('SELECT lease_expires_at < clock_timestamp() AS expired FROM processing_jobs WHERE id=$1', [id])).rows[0].expired, true, 'database proves actual wall-clock expiry')
    ;(h.report.realExpiryWaits ??= []).push({ jobId: id, requestedMs: wait, elapsedMs: performance.now() - started })
  }
  async function waitLock(pid) {
    for (let i=0;i<150;i++) {
      if ((await h.db.query("SELECT wait_event_type='Lock' AS locked FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0]?.locked) return h.ok(true, 'independent backend reaches actual lock wait')
      await delay(10)
    }
    h.ok(false, 'backend must block on real row lock')
  }
  function message(child) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Child checkpoint timeout')) }, 10000)
      const done = event => { cleanup(); events.push(event); resolve(event) }
      const failed = error => { cleanup(); reject(error) }
      function cleanup() { clearTimeout(timer); child.off('message',done); child.off('error',failed) }
      child.once('message',done); child.once('error',failed)
    })
  }
  async function child() {
    const instance = fork(join(root,'experiments/pg17-recording-worker/worker-child.mjs'), [], { stdio: ['ignore','ignore','pipe','ipc'],
      env: { PATH: process.env.PATH, HOME: process.env.HOME } })
    children.add(instance)
    instance.once('exit', (code,signal) => { events.push({ type:'exit',pid:instance.pid,code,signal }); children.delete(instance) })
    instance.stderr.on('data', () => {})
    const ready = message(instance)
    instance.send({ type:'connect',config:{ ...h.config,user:'service_role',database:'saga_pg17_rehearsal' } })
    const event = await ready
    h.eq(event.type,'ready','independent Node process connects to actual PG')
    return { instance,backendPid:event.backendPid }
  }
  await h.scenario('Closed RPC args, identity, least privilege and original ledger write restrictions', async () => {
    const f = await fresh()
    const bad = [[null,worker,null,1000],['unknown',worker,null,1000],['claim',null,null,1000],['claim','bad worker',null,1000],
      ['claim','',null,1000],['claim','worker\n',null,1000],['claim','worker\u00e9',null,1000],
      ['claim','a'.repeat(129),null,1000],['claim',worker,1,1000],['claim',worker,null,null],['claim',worker,null,999],
      ['claim',worker,null,120001],['start',worker,null,null],['start',worker,1,1000],['heartbeat',worker,0,1000],
      ['heartbeat',worker,1,null],['check',worker,1,1000],['recover',worker,null,null],['recover',null,1,null],['recover',null,null,1000]]
    for (const args of bad) await denied(h,service,[f.jobId,...args],'22023','invalid/irrelevant lease argument rejected')
    const proc=(await h.db.query(`SELECT prosecdef,proconfig,(SELECT count(*)::int FROM aclexplode(proacl) WHERE grantee=0) AS public_grants
      FROM pg_proc WHERE oid='public.recording_job_lease(uuid,text,text,integer,integer)'::regprocedure`)).rows[0]
    h.eq(proc.prosecdef,true,'lease RPC security definer')
    h.eq(proc.public_grants,0,'no PUBLIC grant')
    h.eq(proc.proconfig,['search_path=pg_catalog, pg_temp','TimeZone=UTC'],'trusted fixed function search path and timezone')
    for (const role of ['anon','authenticated','metadata_reader']) {
      const actor=await h.actorClient(role,USER,'service_role')
      await denied(h,actor,[f.jobId,'claim',worker,null,1000],'42501','forged service JWT cannot grant execute')
      await h.close(actor)
    }
    for (const table of ['recording_sessions','recording_chunks']) {
      const rights=(await h.db.query(`SELECT has_table_privilege('service_role',$1,'INSERT') AS i,
        has_table_privilege('service_role',$1,'UPDATE') AS u,has_table_privilege('service_role',$1,'DELETE') AS d`,[table])).rows[0]
      h.eq(rights,{i:false,u:false,d:false},'lease migration cannot restore direct sealed-ledger writes')
    }
  })
  await h.scenario('Claim/start/check/heartbeat durable rows, duplicate refusal, atomic rollback and injected failure', async () => {
    const f=await fresh()
    const before=await state(h,f.jobId)
    await service.query('BEGIN')
    const provisional=await rpc(service,f.jobId,'claim',worker,null,5000)
    await receipt(f,provisional,'leased',1,worker)
    h.eq(await state(h,f.jobId),before,'uncommitted claim invisible on another connection')
    await service.query('ROLLBACK')
    h.eq(await state(h,f.jobId),before,'rollback removes claim and attempt atomically')
    await h.db.query(`CREATE FUNCTION public.synthetic_fail_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic' USING ERRCODE='P0001'; END $$;
      CREATE TRIGGER synthetic_fail_job BEFORE UPDATE ON public.processing_jobs FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_job()`)
    await denied(h,service,[f.jobId,'claim',worker,null,5000],'P0001','injected initial job write failure has no partial mutation')
    await h.db.query('DROP TRIGGER synthetic_fail_job ON public.processing_jobs; DROP FUNCTION public.synthetic_fail_job()')
    await h.db.query(`CREATE FUNCTION public.synthetic_fail_attempt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic' USING ERRCODE='P0001'; END $$;
      CREATE TRIGGER synthetic_fail_attempt BEFORE INSERT ON public.processing_attempts FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_attempt()`)
    await denied(h,service,[f.jobId,'claim',worker,null,5000],'P0001','attempt insertion failure rolls back preceding job update')
    await h.db.query('DROP TRIGGER synthetic_fail_attempt ON public.processing_attempts')
    const claimed=await rpc(service,f.jobId,'claim',worker,null,5000)
    await receipt(f,claimed,'leased',1,worker)
    const leased=await state(h,f.jobId)
    h.eq([leased.attempts.length,leased.attempts[0].result_state,leased.attempts[0].dispatched_at,leased.attempts[0].finished_at],[1,'leased',null,null],'claim creates exactly one undispatched attempt')
    for(const owner of [worker,'other-worker']) await denied(h,service,[f.jobId,'claim',owner,null,5000],'23505','live claim is never replayable')
    for(const args of [['start','other-worker',1,null],['start',worker,2,null],['heartbeat',worker,1,5000]])
      await denied(h,service,[f.jobId,...args],'23505','wrong owner/attempt or heartbeat before dispatch cannot mutate')
    await h.db.query('CREATE TRIGGER synthetic_fail_attempt BEFORE UPDATE ON public.processing_attempts FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_attempt()')
    await denied(h,service,[f.jobId,'start',worker,1],'P0001','attempt dispatch write failure rolls back running job update')
    await h.db.query('DROP TRIGGER synthetic_fail_attempt ON public.processing_attempts; DROP FUNCTION public.synthetic_fail_attempt()')
    const running=await rpc(service,f.jobId,'start',worker,1)
    await receipt(f,running,'running',1,worker)
    const started=await state(h,f.jobId)
    h.eq(started.attempts[0].result_state,'running','start sets durable attempt running')
    h.ok(Date.parse(started.attempts[0].dispatched_at)>=Date.parse(claimed.serverNow),'actual dispatch timestamp only appears after start')
    await denied(h,service,[f.jobId,'start',worker,1],'23505','start replay refused')
    await rpc(service,f.jobId,'check',worker,1)
    h.eq(await state(h,f.jobId),started,'check is read-only including timestamps')
    await delay(30)
    const beat=await rpc(service,f.jobId,'heartbeat',worker,1,5000)
    await receipt(f,beat,'running',1,worker)
    h.ok(Date.parse(beat.leaseExpiresAt)>Date.parse(running.leaseExpiresAt),'heartbeat renews DB lease')
    h.eq((await state(h,f.jobId)).attempts,started.attempts,'heartbeat changes no attempt history')
    await denied(h,service,[f.jobId,'recover'],'23505','live job cannot be recovered')
  })
  await h.scenario('Two independent processes race the same job and persist a single attempt', async () => {
    const f=await fresh(), a=await child(), b=await child(), lock=await h.client()
    await lock.query('BEGIN'); await lock.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[PROJECT])
    const pa=message(a.instance),pb=message(b.instance)
    const exitA=once(a.instance,'exit'),exitB=once(b.instance,'exit')
    a.instance.send({type:'go',mode:'race',jobId:f.jobId,workerId:'process-A',leaseMs:5000})
    b.instance.send({type:'go',mode:'race',jobId:f.jobId,workerId:'process-B',leaseMs:5000})
    await waitLock(a.backendPid); await waitLock(b.backendPid)
    await lock.query('COMMIT'); await h.close(lock)
    const outcomes=await Promise.all([pa,pb]); await Promise.all([exitA,exitB])
    h.eq(outcomes.map(x=>x.type).sort(),['checkpoint','rejected'],'exactly one process claim wins')
    h.eq(outcomes.find(x=>x.type==='rejected').code,'23505','loser receives state conflict')
    const persisted=await state(h,f.jobId)
    h.eq([persisted.job.attempt_count,persisted.attempts.length,persisted.attempts[0].dispatched_at],[1,1,null],'concurrent process claims create one undispatched attempt')
  })
  await h.scenario('Heartbeat evaluates database time after actual locks and cannot resurrect expired fence', async () => {
    for (const [lockTable,expiry] of [['projects',false],['projects',true],['processing_attempts',true]]) {
      const f=await fresh(), active=await h.actorClient('service_role',USER), lock=await h.client()
      await rpc(service,f.jobId,'claim',worker,null,expiry?1000:5000); await rpc(service,f.jobId,'start',worker,1)
      const before=await state(h,f.jobId)
      await lock.query('BEGIN')
      if(lockTable==='projects')await lock.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[PROJECT])
      else await lock.query('SELECT id FROM processing_attempts WHERE job_id=$1 FOR UPDATE',[f.jobId])
      const started=performance.now(), pending=outcome(active,[f.jobId,'heartbeat',worker,1,1000])
      await waitLock(active.processID); await delay(1200)
      await lock.query('COMMIT')
      const result=await pending
      ;(h.report.lockWaits??=[]).push({jobId:f.jobId,lockTable,expired:expiry,elapsedMs:performance.now()-started,code:result.code})
      if(expiry){h.eq(result.code,'23505','expiry while waiting rejects renewal');h.eq(await state(h,f.jobId),before,'expired heartbeat makes no write')}
      else {h.eq(result.code,'00000','still-live blocked renewal succeeds');h.ok(Date.parse(result.receipt.serverNow)>Date.parse(before.job.updated_at)+1000,'renewal time sampled after wait');
        h.eq(Date.parse(result.receipt.leaseExpiresAt)-Date.parse(result.receipt.serverNow),1000,'full TTL derives from post-lock clock')}
      await h.close(active);await h.close(lock)
    }
  })
  await h.scenario('SIGKILL after leased and running checkpoints yields retry versus outcome_unknown', async () => {
    for(const mode of ['leased','running']) {
      const f=await fresh(), c=await child(), wait=message(c.instance)
      c.instance.send({type:'go',mode,jobId:f.jobId,workerId:`killed-${mode}`,leaseMs:1000})
      const checkpoint=await wait
      h.eq(checkpoint.type,'checkpoint','child commits explicit durable checkpoint before kill')
      h.eq(checkpoint.receipt.state,mode,'checkpoint matches expected dispatch boundary')
      const persisted=await state(h,f.jobId)
      h.eq(persisted.attempts[0].dispatched_at===null,mode==='leased','persisted dispatch timestamp distinguishes killed phases')
      const exited=once(c.instance,'exit');h.eq(c.instance.kill('SIGKILL'),true,'OS SIGKILL delivered to checkpointed child')
      h.eq((await exited)[1],'SIGKILL','child really exits via SIGKILL')
      h.eq(await state(h,f.jobId),persisted,'process death does not erase durable claim/start')
      await expires(f.jobId)
      for(const action of ['start','check','heartbeat']) await denied(h,service,[f.jobId,action,`killed-${mode}`,1,action==='heartbeat'?1000:null],'23505','late operation after actual expiry refuses')
      const recovered=await rpc(service,f.jobId,'recover'), expected=mode==='leased'?'retry_wait':'outcome_unknown'
      await receipt(f,recovered,expected,1,null)
      const after=await state(h,f.jobId)
      h.eq(after.attempts[0].result_state,mode==='leased'?'retryable_error':'outcome_unknown','recovery finishes matching durable attempt state')
      h.ok(Number.isFinite(Date.parse(after.attempts[0].finished_at)),'recovered attempt has database finish timestamp')
      if(mode==='running') {
        await denied(h,service,[f.jobId,'claim','replacement',null,1000],'23505','outcome_unknown never retries automatically')
        await h.db.query("UPDATE processing_jobs SET state='retry_wait',error_code='lease_expired_before_dispatch' WHERE id=$1",[f.jobId])
        await denied(h,service,[f.jobId,'claim','replacement',null,1000],'23505','resetting job retry state cannot bypass unknown durable attempt history')
      }
      else {
        const replacement=await rpc(service,f.jobId,'claim','replacement',null,1000)
        h.eq(replacement.attempt,2,'undispatched crash permits exactly next attempt')
        await denied(h,service,[f.jobId,'start',`killed-${mode}`,1],'23505','old owner/attempt cannot dispatch replacement work')
      }
    }
  })
  await h.scenario('Three real undispatched expiries exhaust budget and preserve all attempts', async () => {
    const f=await fresh()
    for(let attempt=1;attempt<=3;attempt++) {
      const claimed=await rpc(service,f.jobId,'claim',worker,null,1000)
      h.eq(claimed.attempt,attempt,'attempt counter monotonically increments')
      await expires(f.jobId)
      const recovered=await rpc(service,f.jobId,'recover')
      await receipt(f,recovered,attempt===3?'failed':'retry_wait',attempt,null)
    }
    const final=await state(h,f.jobId)
    h.eq(final.attempts.map(a=>[a.attempt_no,a.result_state,a.dispatched_at]),[[1,'retryable_error',null],[2,'retryable_error',null],[3,'fatal_error',null]],'budget exhaustion preserves exact un-dispatched attempt history')
    await denied(h,service,[f.jobId,'claim','next',null,1000],'23505','failed exhausted job cannot claim again')
  })
  await h.scenario('Cancellation requested after real expiry may update job timestamp and still cancels matching attempt', async () => {
    const f=await fresh()
    await rpc(service,f.jobId,'claim',worker,null,1000);await rpc(service,f.jobId,'start',worker,1)
    await expires(f.jobId)
    await h.db.query('UPDATE processing_jobs SET cancel_requested_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1',[f.jobId])
    await receipt(f,await rpc(service,f.jobId,'recover'),'cancelled',1,null)
    h.eq((await state(h,f.jobId)).attempts[0].result_state,'cancelled','normal cancellation timestamp does not corrupt coherent lease history')
  })
  await h.scenario('Recovery attempt-write failure atomically rolls back the job recovery mutation',async()=>{
    const f=await fresh();await rpc(service,f.jobId,'claim',worker,null,1000);await expires(f.jobId)
    await h.db.query(`CREATE FUNCTION public.synthetic_fail_recovery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic' USING ERRCODE='P0001'; END $$;
      CREATE TRIGGER synthetic_fail_recovery BEFORE UPDATE ON public.processing_attempts FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_recovery()`)
    await denied(h,service,[f.jobId,'recover'],'P0001','attempt recovery failure rolls back preceding job update')
    await h.db.query('DROP TRIGGER synthetic_fail_recovery ON public.processing_attempts; DROP FUNCTION public.synthetic_fail_recovery()')
    h.eq((await rpc(service,f.jobId,'recover')).state,'retry_wait','recovery succeeds after only synthetic trigger removed')
  })
  await h.scenario('Permissions, tombstones and cancellation reject late operations and explicit recovery cancels', async () => {
    for(const kind of ['role','story','asset-tombstone','session-tombstone','project-tombstone','asset-deleting','cancel']) {
      const f=await fresh()
      await rpc(service,f.jobId,'claim',worker,null,5000);await rpc(service,f.jobId,'start',worker,1)
      if(kind==='role') await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2",[PROJECT,USER])
      if(kind==='story') await h.db.query('UPDATE stories SET storyteller_id=$1 WHERE id=$2',[OTHER,STORY])
      if(kind.endsWith('tombstone')) await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)',[PROJECT,kind==='asset-tombstone'?f.assetId:kind==='session-tombstone'?f.sessionId:PROJECT,USER])
      if(kind==='cancel') await h.db.query('UPDATE processing_jobs SET cancel_requested_at=clock_timestamp() WHERE id=$1',[f.jobId])
      if(kind==='asset-deleting') await h.db.query("UPDATE media_assets SET state='deleting' WHERE id=$1",[f.assetId])
      for(const action of ['check','heartbeat']) await denied(h,service,[f.jobId,action,worker,1,action==='heartbeat'?1000:null],'42501',`${kind} blocks active lease operation`)
      await receipt(f,await rpc(service,f.jobId,'recover'),'cancelled',1,null)
      h.eq((await state(h,f.jobId)).attempts[0].result_state,'cancelled','revocation finishes current attempt cancelled')
      if(kind==='role') await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2",[PROJECT,USER])
      if(kind==='story') await h.db.query('UPDATE stories SET storyteller_id=$1 WHERE id=$2',[USER,STORY])
      if(kind==='project-tombstone') await h.db.query('DELETE FROM deletion_requests WHERE project_id=$1 AND subject_id=$2',[PROJECT,PROJECT])
      await denied(h,service,[f.jobId,'claim','replacement',null,1000],'23505','cancelled job never reclaims')
    }
  })
  await h.scenario('Immutable binding, due time and dirty current/prior attempt rows are fenced', async () => {
    for(const mutation of [
      "UPDATE processing_jobs SET idempotency_key='wrong' WHERE id=$1",
      'UPDATE processing_jobs SET input_version=2 WHERE id=$1',
      "UPDATE media_assets SET object_key='wrong' WHERE id=(SELECT asset_id FROM processing_jobs WHERE id=$1)",
      "UPDATE recording_chunks SET sha256=repeat('f',64) WHERE session_id=(SELECT (s.seal_input->>'sessionId')::uuid FROM recording_sessions s JOIN processing_jobs j ON s.seal_input->>'assetId'=j.asset_id::text WHERE j.id=$1)",
      "UPDATE recording_sessions SET manifest_sha256=repeat('f',64) WHERE seal_input->>'assetId'=(SELECT asset_id::text FROM processing_jobs WHERE id=$1)",
      "UPDATE processing_jobs SET not_before=clock_timestamp()+interval '1 hour' WHERE id=$1",
      "UPDATE processing_jobs SET created_at='infinity' WHERE id=$1",
      "UPDATE processing_jobs SET not_before='infinity' WHERE id=$1",
      "UPDATE processing_jobs SET updated_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
      "UPDATE media_assets SET updated_at='infinity' WHERE id=(SELECT asset_id FROM processing_jobs WHERE id=$1)",
      "UPDATE recording_sessions SET sealed_at='infinity' WHERE seal_input->>'assetId'=(SELECT asset_id::text FROM processing_jobs WHERE id=$1)",
    ]) {const f=await fresh();await h.db.query(mutation,[f.jobId]);await denied(h,service,[f.jobId,'claim',worker,null,1000],'23505','tampered binding or non-due work refuses claim')}
    const dirty=await fresh()
    await h.db.query("INSERT INTO processing_attempts(job_id,attempt_no,worker_id,result_state) VALUES($1,1,'stray','running')",[dirty.jobId])
    await denied(h,service,[dirty.jobId,'claim',worker,null,1000],'23505','preexisting unexpected attempt prevents claim')
    const current=await fresh();await rpc(service,current.jobId,'claim',worker,null,1000)
    await h.db.query("UPDATE processing_attempts SET worker_id='different' WHERE job_id=$1",[current.jobId])
    await denied(h,service,[current.jobId,'start',worker,1],'23505','current attempt identity must match job')
    const prior=await fresh();await rpc(service,prior.jobId,'claim',worker,null,1000);await expires(prior.jobId);await rpc(service,prior.jobId,'recover')
    await h.db.query('UPDATE processing_attempts SET finished_at=NULL WHERE job_id=$1',[prior.jobId])
    await denied(h,service,[prior.jobId,'claim',worker,null,1000],'23505','unfinished prior attempt prevents replacement claim')
  })
  await h.scenario('No lease scenario writes ready, cloud confirmation, success result or draft cleanup', async () => {
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM media_assets WHERE state='ready'")).rows[0].n,0,'zero ready assets')
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM recording_sessions WHERE state='cloud_confirmed' OR confirmed_at IS NOT NULL")).rows[0].n,0,'zero cloud confirmation')
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM processing_jobs WHERE state='succeeded' OR result_ref IS NOT NULL")).rows[0].n,0,'zero success publication')
  })
  await h.close(service)
}
