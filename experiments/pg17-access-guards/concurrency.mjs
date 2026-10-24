import { seed, snapshot, invariant, fingerprint, assertAccepted, U, P, I, accept, create } from './scenarios.mjs'

const pause=ms=>new Promise(r=>setTimeout(r,ms))
const result=p=>p.then(r=>({sqlstate:'00000',rows:r.rows,rowCount:r.rowCount}),e=>({sqlstate:/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:'QUERY_FAILED'}))
async function pid(c){return (await c.query('SELECT pg_catalog.pg_backend_pid() AS pid')).rows[0].pid}
async function blocked(h,waiter,holder){
  const until=Date.now()+2000
  while(Date.now()<until){
    const rows=(await h.db.query(`SELECT l.locktype,l.mode,l.granted,l.relation::regclass::text AS relation,a.wait_event_type,a.wait_event,pg_catalog.pg_blocking_pids(l.pid) AS blockers FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_stat_activity a ON a.pid=l.pid WHERE l.pid=$1 AND NOT l.granted`,[waiter])).rows
    if(rows.some(r=>r.blockers.includes(holder))){
      h.ok(rows.every(r=>!r.granted&&r.wait_event_type==='Lock'),'actual lock waiter observed')
      const holderLocks=(await h.db.query(`SELECT locktype,mode,granted,relation::regclass::text AS relation FROM pg_catalog.pg_locks WHERE pid=$1 AND granted ORDER BY locktype,mode,relation`,[holder])).rows
      return {waiterPid:waiter,holderPid:holder,waiter:rows,holder:holderLocks}
    }
    await pause(15)
  }
  h.ok(false,'expected real lock wait with observed blocker')
}
async function finish(h,first,second,pending){
  await first.query('ROLLBACK').catch(()=>{});await second.query('ROLLBACK').catch(()=>{})
  if(pending)await pending
  await h.close(first);await h.close(second)
}
async function acceptRaces(h){
  await h.scenario('concurrent_rebind_to_invoking_new_user_after_locator_denied',async()=>{
    await seed(h.db);const before=await snapshot(h.db),caller=await h.actorClient('authenticated',U.other),changer=await h.client()
    let pending
    try{
      await caller.query('BEGIN');await changer.query('BEGIN');const cp=await pid(caller),mp=await pid(changer)
      const changed=await changer.query('UPDATE public.project_roles SET user_id=$1 WHERE id=$2',[U.other,I]);h.eq(changed.rowCount,1,'same-project user replacement prepared')
      pending=result(caller.query(accept,[I,U.other]));const locks=await blocked(h,cp,mp)
      await invariant(h,before,'new-user acceptance waits while original committed binding is still visible')
      await changer.query('COMMIT');const committed=await snapshot(h.db),outcome=await pending
      // Commit an unexpected successful result so the RED evidence demonstrates
      // its actual writes. A denied statement is aborted and must be rolled back.
      await caller.query(outcome.sqlstate==='00000'?'COMMIT':'ROLLBACK')
      const after=await snapshot(h.db),committedHashes=fingerprint(committed),afterHashes=fingerprint(after)
      const changedTables=Object.keys(committedHashes).filter(t=>committedHashes[t].sha256!==afterHashes[t].sha256)
      h.report.concurrency.push({name:'rebind_to_invoking_new_user_after_locator',order:'change_first',observedLocks:locks,outcome:outcome.sqlstate,expectedSqlstate:'42501',before:fingerprint(before),committedChanger:committedHashes,afterCaller:afterHashes,changedTables,acceptingCallMadeNoWrites:changedTables.length===0,activationObserved:after.project_roles.find(r=>r.id===I)?.status==='active'})
      h.eq(outcome.sqlstate,'42501','new user cannot accept a binding changed after locator read')
      await invariant(h,committed,'new-user rebinding denial preserves committed changer state across all seven tables')
    }finally{await finish(h,changer,caller,pending)}
  })
  await h.scenario('concurrent_double_accept_one_transition',async()=>{
    await seed(h.db);const before=await snapshot(h.db),a=await h.actorClient('authenticated',U.invitee),b=await h.actorClient('authenticated',U.invitee)
    let pending
    try{
      await a.query('BEGIN');await b.query('BEGIN');const ap=await pid(a),bp=await pid(b),first=await result(a.query(accept,[I,U.invitee]));h.eq(first.sqlstate,'00000','first accept executes')
      pending=result(b.query(accept,[I,U.invitee]));const locks=await blocked(h,bp,ap)
      await invariant(h,before,'uncommitted first acceptance invisible to observer')
      await a.query('COMMIT');const second=await pending;h.eq(second.sqlstate,'42501','waiting repeat rechecks pending');await b.query('ROLLBACK')
      await assertAccepted(h,before,first);const after=await snapshot(h.db)
      h.report.concurrency.push({name:'double_accept',observedLocks:locks,before:fingerprint(before),after:fingerprint(after),outcomes:[first.sqlstate,second.sqlstate]})
    }finally{await finish(h,a,b,pending)}
  })
  const changes=[
    ['revoke',"UPDATE public.project_roles SET status='inactive' WHERE id=$1",[I]],
    ['delete_member','DELETE FROM public.project_roles WHERE id=$1',[I]],
    ['rebind_user','UPDATE public.project_roles SET user_id=$1 WHERE id=$2',[U.other,I]],
    ['rebind_project','UPDATE public.project_roles SET project_id=$1 WHERE id=$2',[P.two,I]],
    ['change_inviter','UPDATE public.project_roles SET invited_by=$1 WHERE id=$2',[U.other,I]],
    ['project_transfer','UPDATE public.projects SET facilitator_id=$1 WHERE id=$2',[U.next,P.one]],
    ['project_deactivate',"UPDATE public.projects SET status='inactive' WHERE id=$1",[P.one]],
    ['delete_project','DELETE FROM public.projects WHERE id=$1',[P.one]]
  ]
  for(const [name,sql,args] of changes)for(const order of ['accept_first','change_first'])await h.scenario(`concurrent_${name}_${order}`,async()=>{
    await seed(h.db);const before=await snapshot(h.db),caller=await h.actorClient('authenticated',U.invitee),changer=await h.client()
    let pending
    try{
      await caller.query('BEGIN');await changer.query('BEGIN');const cp=await pid(caller),mp=await pid(changer);let locks,outcome
      if(order==='accept_first'){
        outcome=await result(caller.query(accept,[I,U.invitee]));h.eq(outcome.sqlstate,'00000','first authorized acceptance executes')
        pending=result(changer.query(sql,args));locks=await blocked(h,mp,cp);await invariant(h,before,'acceptance and waiting change uncommitted')
        await caller.query('COMMIT');await assertAccepted(h,before,outcome)
        const changed=await pending;h.eq(changed.sqlstate,'00000','waiting change resumes');h.eq(changed.rowCount,1,'one target changed');await changer.query('COMMIT')
        const after=await snapshot(h.db)
        h.eq(after.user_resource_wallets,before.user_resource_wallets,'acceptance/change never touches resources')
        h.eq(after.projects.length,before.projects.length-(name==='delete_project'?1:0),'no project creation by accept race')
        h.eq(after.project_roles.length,before.project_roles.length-(name==='delete_member'?1:name==='delete_project'?2:0),'no member creation by accept race')
        const member=after.project_roles.find(r=>r.id===I)
        if(member){h.eq(member.status,name==='revoke'?'inactive':'active','later mutation has final state');h.eq(member.joined_at,outcome.rows[0].joined_at,'later mutation cannot make accept overwrite join time')}
      }else{
        const changed=await changer.query(sql,args);h.eq(changed.rowCount,1,'one target changed before accept')
        pending=result(caller.query(accept,[I,U.invitee]));locks=await blocked(h,cp,mp)
        await invariant(h,before,'uncommitted revocation hidden during observed wait')
        await changer.query('COMMIT');const committed=await snapshot(h.db);outcome=await pending;h.eq(outcome.sqlstate,'42501','eligibility rechecked after preceding change');await caller.query('ROLLBACK');await invariant(h,committed,'denied waiting accept makes no intermediate writes')
      }
      h.report.concurrency.push({name,order,observedLocks:locks,outcome:outcome.sqlstate,before:fingerprint(before),after:fingerprint(await snapshot(h.db))})
    }finally{await finish(h,order==='accept_first'?caller:changer,order==='accept_first'?changer:caller,pending)}
  })
}
async function creationRaces(h){
  for(const role of ['facilitator','storyteller'])for(const kind of ['voucher_scarcity','seat_scarcity','two_resources','first_rollback'])await h.scenario(`concurrent_create_${role}_${kind}`,async()=>{
    await seed(h.db);const seat=role==='facilitator'?'facilitator_seats':'storyteller_seats',vouchers=kind==='two_resources'||kind==='seat_scarcity'?2:1,seats=kind==='voucher_scarcity'?2:kind==='two_resources'?2:1
    await h.db.query(`UPDATE public.user_resource_wallets SET project_vouchers=$1,${seat}=$2 WHERE user_id=$3`,[vouchers,seats,U.owner])
    const before=await snapshot(h.db),a=await h.actorClient('authenticated',U.owner),b=await h.actorClient('authenticated',U.owner),args=['Synthetic concurrent','',U.owner,role]
    let pending
    try{
      await a.query('BEGIN');await b.query('BEGIN');const first=await result(a.query(create,args));h.eq(first.sqlstate,'00000','first creation succeeds inside transaction')
      const bp=await pid(b),ap=await pid(a);pending=result(b.query(create,args));const locks=await blocked(h,bp,ap)
      await invariant(h,before,'all uncommitted creation writes invisible while wallet waiter blocked')
      await a.query(kind==='first_rollback'?'ROLLBACK':'COMMIT');const afterFirst=await snapshot(h.db)
      if(kind==='first_rollback')h.eq(afterFirst,before,'first creation rollback restores wallet and all rows')
      const second=await pending,expected=kind==='two_resources'||kind==='first_rollback'?'00000':'42501';h.eq(second.sqlstate,expected,'waiting creation rechecks committed wallet')
      await b.query(second.sqlstate==='00000'?'COMMIT':'ROLLBACK')
      const after=await snapshot(h.db),successes=kind==='two_resources'?2:1
      h.eq(after.projects.length,before.projects.length+successes,'exact committed project count');h.eq(after.project_roles.length,before.project_roles.length+successes,'exact committed role count');h.eq(after.seat_transactions.length,before.seat_transactions.length+successes*2,'two logs per committed creation')
      const wallet=after.user_resource_wallets.find(r=>r.user_id===U.owner),prior=before.user_resource_wallets.find(r=>r.user_id===U.owner)
      h.eq(wallet.project_vouchers,vouchers-successes,'voucher consumption serialized');h.eq(wallet[seat],seats-successes,'corresponding seats serialized');h.eq({...wallet,project_vouchers:prior.project_vouchers,[seat]:prior[seat],updated_at:prior.updated_at},prior,'other resource and payment fields stable')
      const added=after.projects.filter(p=>!before.projects.some(x=>x.id===p.id));for(const p of added){h.eq(p.payment_status,'unverified','concurrent project never implies payment');h.eq(after.seat_transactions.filter(t=>t.project_id===p.id).map(t=>({resource:t.resource_type,amount:t.amount,type:t.transaction_type})).sort((x,y)=>x.resource.localeCompare(y.resource)),[{resource:'project_voucher',amount:-1,type:'consume'},{resource:role+'_seat',amount:-1,type:'consume'}].sort((x,y)=>x.resource.localeCompare(y.resource)),'each project has both exact consumption records')}
      h.eq({...after,projects:after.projects.filter(p=>before.projects.some(x=>x.id===p.id)),project_roles:after.project_roles.filter(r=>before.project_roles.some(x=>x.id===r.id)),seat_transactions:after.seat_transactions.filter(t=>before.seat_transactions.some(x=>x.id===t.id)),user_resource_wallets:after.user_resource_wallets.map(w=>w.user_id===U.owner?prior:w)},before,'historical and unrelated records unchanged in resource race')
      if(expected==='42501')h.eq(after,afterFirst,'losing creation has zero additional writes')
      h.report.concurrency.push({name:'create',role,kind,observedLocks:locks,outcomes:[first.sqlstate,second.sqlstate],firstTransaction:kind==='first_rollback'?'rolled_back':'committed',committedProjects:successes,before:fingerprint(before),after:fingerprint(after)})
    }finally{await finish(h,a,b,pending)}
  })
}
export async function concurrency(h){h.report.concurrency=[];await acceptRaces(h);await creationRaces(h)}
