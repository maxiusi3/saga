import { seed,U,P,four,three } from './scenarios.mjs'
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function blocked(h,waiter,blocker){
  const until=Date.now()+1800
  while(Date.now()<until){
    const r=(await h.db.query(`SELECT l.locktype,l.mode,l.granted,l.relation::regclass::text AS relation,a.wait_event_type,a.wait_event,pg_catalog.pg_blocking_pids(l.pid) AS blockers FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_stat_activity a ON a.pid=l.pid WHERE l.pid=$1 AND NOT l.granted`,[waiter])).rows
    if(r.some(x=>x.blockers.includes(blocker))){h.ok(r.every(x=>x.granted===false),'actual pg_locks waiter exists');return r.map(x=>({...x,blockers:x.blockers.length}))}
    await pause(15)
  }
  h.ok(false,'expected real blocking relation within bounded observation')
}
export async function concurrency(h){
  h.report.concurrency=[]
  for(const kind of [4,3])for(const target of ['membership_update','membership_delete','facilitator_update'])for(const order of ['request_first','revoke_first']){
    await h.scenario(`concurrent_${kind}_${target}_${order}`,async()=>{
      await seed(h.db)
      const who=target==='facilitator_update'?U.a:U.b
      if(target==='facilitator_update')await h.db.query('DELETE FROM public.project_roles WHERE user_id=$1 AND project_id=$2',[U.a,P.one])
      const caller=await h.actorClient('authenticated',who), revoker=await h.client()
      const callerPid=(await caller.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
      const revokerPid=(await revoker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
      const sql=kind===4?four:three,args=kind===4?[who,P.one,true,false]:[P.one,who,{}]
      const revoke=target==='membership_update'?['UPDATE public.project_roles SET status=$1 WHERE project_id=$2 AND user_id=$3',['inactive',P.one,who]]:target==='membership_delete'?['DELETE FROM public.project_roles WHERE project_id=$1 AND user_id=$2',[P.one,who]]:['UPDATE public.projects SET facilitator_id=$1 WHERE id=$2',[U.d,P.one]]
      let pending
      try{
        await caller.query('BEGIN');await revoker.query('BEGIN')
        let locks,result
        if(order==='request_first'){
          result=await caller.query(sql,args)
          pending=revoker.query(...revoke).then(r=>({ok:true,count:r.rowCount}),e=>({ok:false,code:e.code}))
          locks=await blocked(h,revokerPid,callerPid)
          h.eq((await h.db.query('SELECT count(*)::integer AS n FROM public.export_requests WHERE id=$1',[result.rows[0].export_id])).rows[0].n,0,'uncommitted registration invisible to observer')
          await caller.query('COMMIT');const update=await pending;h.eq(update.ok,true,'revocation resumes after request commit');h.eq(update.count,1,'one authorization row changed');await revoker.query('COMMIT')
          h.eq((await h.db.query('SELECT count(*)::integer AS n FROM public.export_requests WHERE id=$1',[result.rows[0].export_id])).rows[0].n,1,'already authorized request remains durable')
        }else{
          await revoker.query(...revoke)
          pending=caller.query(sql,args).then(r=>({ok:true,rows:r.rows}),e=>({ok:false,code:e.code}))
          locks=await blocked(h,callerPid,revokerPid)
          await revoker.query('COMMIT');result=await pending;h.eq(result,{ok:false,code:'42501'},'committed revocation is rechecked after row wait');await caller.query('ROLLBACK')
          h.eq((await h.db.query('SELECT count(*)::integer AS n FROM public.export_requests')).rows[0].n,1,'only historical request remains')
        }
        h.report.concurrency.push({overload:kind,target,order,observedLocks:locks,postcondition:order==='request_first'?'registered_before_revocation':'revocation_denied_registration'})
      }finally{
        // Roll back the known lock holder before awaiting a pending waiter.
        if(order==='request_first'){await caller.query('ROLLBACK').catch(()=>{});await revoker.query('ROLLBACK').catch(()=>{})}
        else{await revoker.query('ROLLBACK').catch(()=>{});await caller.query('ROLLBACK').catch(()=>{})}
        if(pending)await pending
        await h.close(caller);await h.close(revoker)
      }
    })
  }
}
